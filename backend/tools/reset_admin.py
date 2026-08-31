"""
Аварийное восстановление доступа администратора.

Нужен ровно в одном случае: администратор один, он забыл пароль или потерял
телефон со вторым фактором — и войти в систему больше некем. Через интерфейс
такое не решается по определению, поэтому здесь.

Запускается на сервере, где лежит база, то есть требует того же доступа,
что и прямое редактирование базы. Отдельной защиты не имеет и не должен:
кто дошёл до консоли сервера, тот и так может всё.

    docker compose -f docker-compose.prod.yml exec backend \\
        python -m backend.tools.reset_admin --list

    docker compose -f docker-compose.prod.yml exec backend \\
        python -m backend.tools.reset_admin --username admin --password
    docker compose -f docker-compose.prod.yml exec backend \\
        python -m backend.tools.reset_admin --username admin --clear-totp
"""
from __future__ import annotations

import argparse
import getpass
import sys

from backend.core.database import SessionLocal
from backend.core.security import get_password_hash
from backend.domain.models import SystemUser, UserRole


def _print_users(db) -> None:
    users = db.query(SystemUser).order_by(SystemUser.id).all()
    if not users:
        print("Пользователей нет")
        return
    print(f"{'id':>3}  {'логин':<20} {'роль':<10} {'активен':<8} {'2FA':<5} блокировка")
    for user in users:
        print(f"{user.id:>3}  {user.username:<20} {user.role.value:<10} "
              f"{'да' if user.is_active else 'нет':<8} "
              f"{'вкл' if user.totp_enabled else '—':<5} "
              f"{user.locked_until or '—'}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="показать пользователей")
    parser.add_argument("--username", help="кого чинить")
    parser.add_argument("--password", action="store_true", help="задать новый пароль")
    parser.add_argument("--clear-totp", action="store_true", help="снять второй фактор")
    parser.add_argument("--unlock", action="store_true", help="снять блокировку входа")
    parser.add_argument("--make-admin", action="store_true", help="выдать роль администратора")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.list or not args.username:
            _print_users(db)
            if not args.username:
                print("\nУкажите --username и что сделать: "
                      "--password / --clear-totp / --unlock / --make-admin")
            return 0

        user = db.query(SystemUser).filter(SystemUser.username == args.username).first()
        if user is None:
            print(f"Пользователь «{args.username}» не найден", file=sys.stderr)
            return 1

        changed = []

        if args.password:
            first = getpass.getpass("Новый пароль: ")
            if len(first) < 8:
                print("Пароль короче 8 символов", file=sys.stderr)
                return 1
            if first != getpass.getpass("Повторите: "):
                print("Пароли не совпадают", file=sys.stderr)
                return 1
            user.hashed_password = get_password_hash(first)
            changed.append("пароль")

        if args.clear_totp:
            user.totp_enabled = False
            user.totp_secret = None
            user.totp_recovery_hashes = None
            changed.append("второй фактор снят")

        if args.unlock:
            user.failed_login_attempts = 0
            user.locked_until = None
            changed.append("блокировка снята")

        if args.make_admin:
            user.role = UserRole.ADMIN
            user.is_active = True
            changed.append("роль администратора")

        if not changed:
            print("Ничего не указано — что делать?", file=sys.stderr)
            return 1

        db.commit()
        print(f"Готово для «{user.username}»: {', '.join(changed)}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
