"""
Перевод базы со сплошного шифрования на частичное.

Что меняется
------------
Было: зашифровано всё, включая ФИО и суммы, а мастер-ключ заворачивался
в пароль администратора. Из-за этого список плательщиков поднимал из базы
всю таблицу, второй пользователь получал собственный ключ и переставал читать
чужие записи, а восстановление пароля по почте было невозможно в принципе.

Стало: ключ живёт в ENCRYPTION_KEY, зашифрованы только контакты, дата
рождения, примечания и номера квитанций. ФИО, группа и суммы открыты —
по ним идут поиск, сортировка и подсчёт в SQL.

Скрипт заодно чинит поля, испорченные старой ошибкой в update_payer: если
на значение налипло несколько слоёв шифрования, снимаются все.

Запуск
------
    docker compose -f docker-compose.prod.yml exec backend \\
        python -m backend.tools.migrate_partial_encryption            # только показать

    docker compose -f docker-compose.prod.yml exec backend \\
        python -m backend.tools.migrate_partial_encryption --apply    # выполнить

Перед --apply обязательно снимите дамп базы. Скрипт работает в одной
транзакции: при ошибке база останется в прежнем состоянии.
"""
from __future__ import annotations

import argparse
import getpass
import sys
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy import text

from backend.core.config import settings
from backend.core.database import engine
from backend.core.encryption import (
    DecryptionError, encrypt_field, get_fernet, is_encrypted, peel_field,
)

# Поля плательщика: имя -> остаётся ли зашифрованным после миграции
PAYER_FIELDS = {
    "last_name": False, "first_name": False, "middle_name": False,
    "group_name": False, "department": False,
    "stipend_amount": False, "budget_percent": False,
    "email": True, "phone": True, "telegram": True, "vk": True,
    "date_of_birth": True, "notes": True,
}
PAYMENT_FIELDS = {"amount": False, "receipt_number": True, "notes": True}

# Колонки, у которых меняется тип: имя -> (новый тип, был ли NOT NULL)
PAYER_RETYPE = {
    "last_name": ("VARCHAR(100)", True),
    "first_name": ("VARCHAR(100)", True),
    "middle_name": ("VARCHAR(100)", False),
    "group_name": ("VARCHAR(50)", False),
    "department": ("VARCHAR(100)", False),
    "stipend_amount": ("NUMERIC(10,2)", False),
    "budget_percent": ("NUMERIC(5,2)", False),
}
PAYMENT_RETYPE = {"amount": ("NUMERIC(10,2)", True)}


def _unwrap_legacy_key(conn, username: str, password: str) -> Optional[bytes]:
    """Развернуть старый мастер-ключ паролем пользователя."""
    from backend.core.security import verify_password
    from cryptography.fernet import Fernet, InvalidToken
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    import base64

    row = conn.execute(
        text("SELECT hashed_password, encrypted_master_key, key_salt "
             "FROM system_users WHERE username = :u"),
        {"u": username},
    ).fetchone()

    if row is None:
        print(f"Пользователь «{username}» не найден", file=sys.stderr)
        return None
    if not verify_password(password, row.hashed_password):
        print("Неверный пароль", file=sys.stderr)
        return None
    if not row.encrypted_master_key or not row.key_salt:
        print(f"У «{username}» нет старого ключа шифрования", file=sys.stderr)
        return None

    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=bytes(row.key_salt), iterations=480_000)
    user_key = base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))
    try:
        return Fernet(user_key).decrypt(bytes(row.encrypted_master_key))
    except InvalidToken:
        print("Старый мастер-ключ не разворачивается этим паролем", file=sys.stderr)
        return None


def _to_decimal(value: Optional[str]) -> Optional[Decimal]:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _read_and_decrypt(conn, table: str, fields: dict, old_key: bytes) -> tuple[list[dict], int]:
    """Прочитать строки и снять с полей все слои шифрования."""
    columns = ", ".join(["id"] + list(fields))
    rows = conn.execute(text(f"SELECT {columns} FROM {table} ORDER BY id")).fetchall()

    decoded, unreadable = [], 0
    for row in rows:
        item = {"id": row.id}
        for field in fields:
            raw = getattr(row, field)
            if raw is None:
                item[field] = None
                continue
            try:
                # peel снимает и один слой, и несколько — второй появлялся
                # из-за прежней ошибки в update_payer.
                item[field] = peel_field(str(raw), old_key)
            except DecryptionError:
                unreadable += 1
                print(f"  ! {table}#{row.id}.{field}: не открывается этим ключом, оставляю пустым")
                item[field] = None
        decoded.append(item)
    return decoded, unreadable


def _retype_columns(conn, table: str, retype: dict) -> None:
    """Сменить тип колонок: обнулить, изменить тип, значения вернём следом."""
    for column, (_new_type, not_null) in retype.items():
        if not_null:
            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL"))
        conn.execute(text(f"UPDATE {table} SET {column} = NULL"))

    for column, (new_type, _not_null) in retype.items():
        conn.execute(text(
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {new_type} USING NULL"
        ))


def _write_back(conn, table: str, fields: dict, rows: list[dict], retype: dict) -> None:
    """Вернуть значения: часть открытыми, часть — зашифрованными новым ключом."""
    numeric = {c for c, (t, _) in retype.items() if t.startswith("NUMERIC")}

    for item in rows:
        values = {"id": item["id"]}
        for field, keep_encrypted in fields.items():
            plain = item[field]
            if keep_encrypted:
                values[field] = encrypt_field(plain) if plain else None
            elif field in numeric:
                values[field] = _to_decimal(plain)
            else:
                values[field] = plain

        assignments = ", ".join(f"{f} = :{f}" for f in fields)
        conn.execute(text(f"UPDATE {table} SET {assignments} WHERE id = :id"), values)

    for column, (_t, not_null) in retype.items():
        if not_null:
            default = "''" if column in ("last_name", "first_name") else "0"
            conn.execute(text(f"UPDATE {table} SET {column} = {default} WHERE {column} IS NULL"))
            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL"))


def _drop_legacy(conn) -> None:
    """Убрать то, что больше не используется."""
    statements = [
        # Ключ больше не заворачивается в пароль — он в ENCRYPTION_KEY.
        "ALTER TABLE system_users DROP COLUMN IF EXISTS encrypted_master_key",
        "ALTER TABLE system_users DROP COLUMN IF EXISTS key_salt",
        # Группы давно ведутся свободным полем group_name.
        "ALTER TABLE payers DROP COLUMN IF EXISTS group_id",
        "DROP TABLE IF EXISTS student_groups",
        # Устаревшие поля периода — вытеснены academic_year + semester.
        "ALTER TABLE payments DROP COLUMN IF EXISTS period_start",
        "ALTER TABLE payments DROP COLUMN IF EXISTS period_end",
        # Журнал: два JSON-поля заменены одним описанием.
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS summary TEXT",
        "ALTER TABLE audit_logs DROP COLUMN IF EXISTS old_values",
        "ALTER TABLE audit_logs DROP COLUMN IF EXISTS new_values",
        "ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent",
        # Защита входа и восстановление пароля.
        "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64)",
        "ALTER TABLE system_users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE system_users ALTER COLUMN email TYPE VARCHAR(255)",
        # Индексы под новые запросы.
        "CREATE INDEX IF NOT EXISTS ix_payers_fio ON payers (last_name, first_name)",
        "CREATE INDEX IF NOT EXISTS ix_payers_group_name ON payers (group_name)",
        "CREATE INDEX IF NOT EXISTS ix_payers_is_active ON payers (is_active)",
        "CREATE INDEX IF NOT EXISTS ix_payments_payer_id ON payments (payer_id)",
        "CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_logs (entity_type, entity_id)",
    ]
    for statement in statements:
        conn.execute(text(statement))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", default="admin", help="под кем разворачивать старый ключ")
    parser.add_argument("--master-key", help="старый ключ напрямую (из резервной копии)")
    parser.add_argument("--apply", action="store_true", help="выполнить (без флага — только показать)")
    args = parser.parse_args()

    if not settings.ENCRYPTION_KEY:
        print("ENCRYPTION_KEY не задан в .env — задайте новый ключ до миграции", file=sys.stderr)
        return 1
    get_fernet()  # проверяем формат нового ключа до всех изменений

    with engine.begin() as conn:
        has_legacy = conn.execute(text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'system_users' AND column_name = 'encrypted_master_key'"
        )).fetchone()

        if not has_legacy:
            print("База уже переведена на частичное шифрование — делать нечего")
            return 0

        if args.master_key:
            old_key = args.master_key.encode("ascii")
        else:
            password = getpass.getpass(f"Пароль для «{args.username}»: ")
            old_key = _unwrap_legacy_key(conn, args.username, password)
        if old_key is None:
            return 1

        print(f"\nРежим: {'ЗАПИСЬ' if args.apply else 'ПРОСМОТР (изменения не сохранятся)'}\n")

        print("payers:")
        payers, bad_payers = _read_and_decrypt(conn, "payers", PAYER_FIELDS, old_key)
        print(f"  прочитано записей: {len(payers)}")

        print("payments:")
        payments, bad_payments = _read_and_decrypt(conn, "payments", PAYMENT_FIELDS, old_key)
        print(f"  прочитано записей: {len(payments)}")

        if payers:
            sample = payers[0]
            print(f"\n  проверка: первая запись читается как "
                  f"«{sample['last_name']} {sample['first_name']}», группа «{sample['group_name']}»")

        if bad_payers or bad_payments:
            print(f"\n  ВНИМАНИЕ: полей не открылось: {bad_payers + bad_payments}. "
                  f"Они станут пустыми.")

        if not args.apply:
            print("\nВыглядит верно? Снимите дамп базы и запустите ещё раз с --apply")
            conn.rollback()
            return 0

        print("\nМеняю типы колонок и записываю данные...")
        _retype_columns(conn, "payers", PAYER_RETYPE)
        _write_back(conn, "payers", PAYER_FIELDS, payers, PAYER_RETYPE)
        _retype_columns(conn, "payments", PAYMENT_RETYPE)
        _write_back(conn, "payments", PAYMENT_FIELDS, payments, PAYMENT_RETYPE)
        _drop_legacy(conn)

    print("\nГотово. Проверьте список плательщиков в интерфейсе.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
