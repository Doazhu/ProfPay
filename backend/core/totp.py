"""
Двухфакторная аутентификация через приложение-аутентификатор.

Используется TOTP (RFC 6238) — тот самый шестизначный код, который каждые
30 секунд показывают Google Authenticator, Aegis, 1Password и прочие.

Почему так, а не письмом на почту:
- не нужен SMTP-сервер и его настройка;
- код нельзя перехватить в почте;
- работает без интернета на телефоне.

Важное ограничение, которое стоит понимать. TOTP — это *второй фактор*,
а не восстановление пароля. Забытый пароль он не вернёт: код подтверждает,
что рядом ваш телефон, но не заменяет знание пароля. Поэтому забытый пароль
сбрасывает другой администратор в разделе «Пользователи», а если админ один
и он потерял доступ — есть аварийный скрипт backend/tools/reset_admin.py,
который запускается на сервере.
"""
import base64
import hashlib
import secrets
from typing import List, Optional

import pyotp
import segno

# Приложение показывает это имя рядом с кодом.
ISSUER = "ProfPay"

# Допуск по времени: ±1 шаг по 30 секунд. Покрывает расхождение часов
# на телефоне и медленный ввод, не расширяя окно перебора сверх нужного.
VALID_WINDOW = 1

RECOVERY_CODE_COUNT = 8


def generate_secret() -> str:
    """Секрет для привязки приложения (base32, 160 бит)."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, account: str) -> str:
    """Ссылка otpauth:// — её и кодирует QR-код."""
    return pyotp.TOTP(secret).provisioning_uri(name=account, issuer_name=ISSUER)


def qr_svg(secret: str, account: str) -> str:
    """
    QR-код ссылки привязки в виде встроенного SVG.

    Рисуется на сервере, чтобы не тянуть JS-библиотеку и не разрешать
    в Content-Security-Policy сторонние скрипты ради одной картинки.

    Код всегда чёрный на белом, независимо от темы интерфейса. Светлый код
    на тёмном фоне — инвертированный, и заметная часть сканеров такие
    не читает. Белая рамка вокруг нужна по той же причине: без «тихой зоны»
    код распознаётся хуже.
    """
    qr = segno.make(provisioning_uri(secret, account), error="m")
    return qr.svg_inline(scale=5, border=3, dark="#000000", light="#ffffff")


def verify_code(secret: Optional[str], code: Optional[str]) -> bool:
    """Проверить шестизначный код."""
    if not secret or not code:
        return False
    cleaned = "".join(ch for ch in code if ch.isdigit())
    if len(cleaned) != 6:
        return False
    return pyotp.TOTP(secret).verify(cleaned, valid_window=VALID_WINDOW)


# ---------------------------------------------------------------------------
# Резервные коды на случай потери телефона
# ---------------------------------------------------------------------------

def generate_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> List[str]:
    """
    Одноразовые коды на случай, если телефон потерян.

    Формат «xxxx-xxxx» из строчных букв и цифр: достаточно длинный, чтобы
    не перебирался, и достаточно короткий, чтобы записать на бумаге.
    """
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"  # без похожих 0/o, 1/l/i
    codes = []
    for _ in range(count):
        raw = "".join(secrets.choice(alphabet) for _ in range(8))
        codes.append(f"{raw[:4]}-{raw[4:]}")
    return codes


def hash_recovery_code(code: str) -> str:
    """
    Хеш резервного кода для хранения.

    В базе лежат только хеши: утечка дампа не должна давать возможность
    войти. Соль не нужна — код и так случайный, перебирать нечего.
    """
    normalized = code.strip().lower().replace(" ", "")
    return hashlib.sha256(normalized.encode("ascii", "ignore")).hexdigest()


def match_recovery_code(code: str, stored_hashes: List[str]) -> Optional[str]:
    """Найти совпавший хеш. Возвращает его, чтобы вызывающий смог погасить код."""
    candidate = hash_recovery_code(code)
    for stored in stored_hashes:
        if secrets.compare_digest(candidate, stored):
            return stored
    return None
