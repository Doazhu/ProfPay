"""Подключение к базе и создание схемы."""
import logging
from typing import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from backend.core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,   # молча переподключаемся после разрыва соединения
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,    # Postgres рвёт долгие простаивающие соединения
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# declarative_base из sqlalchemy.orm, а не из ext.declarative:
# старый путь объявлен устаревшим и будет удалён.
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Сессия на запрос."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def legacy_schema_detected() -> bool:
    """
    Осталась ли база от версии со сплошным шифрованием.

    Признак — колонка encrypted_master_key: тогда ключ заворачивался в пароль
    пользователя, а ФИО и суммы лежали зашифрованными. Запускаться на такой
    базе нельзя: приложение прочитает шифротекст как имя и запишет его обратно.
    """
    inspector = inspect(engine)
    if not inspector.has_table("system_users"):
        return False
    columns = {c["name"] for c in inspector.get_columns("system_users")}
    return "encrypted_master_key" in columns


def init_db() -> None:
    """Создать таблицы и первого администратора."""
    from backend.core.security import get_password_hash
    from backend.domain import models  # noqa: F401 — регистрирует модели
    from backend.domain.models import SystemUser, UserRole

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        _ensure_columns(db)
        _sync_budget_status(db)

        if db.query(SystemUser).filter(SystemUser.role == UserRole.ADMIN).first():
            logger.info("Администратор уже существует")
            return

        admin = SystemUser(
            username=settings.ADMIN_USERNAME,
            email=settings.ADMIN_EMAIL.strip().lower(),
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            full_name="Администратор системы",
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Создан администратор: %s", settings.ADMIN_USERNAME)
    except Exception:
        db.rollback()
        logger.exception("Ошибка инициализации базы")
        raise
    finally:
        db.close()


def _sync_budget_status(db: Session) -> None:
    """
    Привести статусы бюджетников к правилу «бюджетник числится оплаченным».

    Правило выставляется при сохранении карточки, но записи, заведённые
    раньше — загруженные из таблицы или оставшиеся от прежней версии, — про
    него не знают и висят с «не оплачено». Долги и статистика их и так не
    считают, а вот в списке у них стоит метка, противоречащая правилу.

    Проверка идемпотентна: трогает только те строки, которые ему не
    соответствуют. Освобождённых не касается — это ручное решение
    бухгалтера, и переписывать его нельзя.
    """
    from backend.domain.models import Payer, PaymentStatus

    if not inspect(engine).has_table("payers"):
        return

    changed = db.query(Payer).filter(
        Payer.is_budget.is_(True),
        Payer.status.notin_([PaymentStatus.PAID, PaymentStatus.EXEMPT]),
    ).update({Payer.status: PaymentStatus.PAID}, synchronize_session=False)

    if changed:
        db.commit()
        logger.info("Бюджетникам проставлено «оплачено»: %s", changed)


def _ensure_columns(db: Session) -> None:
    """
    Дописать колонки, появившиеся в новых версиях.

    create_all() создаёт только отсутствующие таблицы и не трогает
    существующие, поэтому на уже развёрнутой базе новые колонки надо добавлять
    отдельно. Проверки идемпотентны — повторный запуск ничего не меняет.
    """
    inspector = inspect(engine)
    if not inspector.has_table("system_users"):
        return

    additions = {
        "system_users": {
            "failed_login_attempts": "INTEGER NOT NULL DEFAULT 0",
            "locked_until": "TIMESTAMP WITH TIME ZONE",
            "totp_secret": "TEXT",
            "totp_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
            "totp_recovery_hashes": "TEXT",
        },
        "payers": {
            "admission_year": "INTEGER",
            "education_level": "VARCHAR(20)",
            "archived_at": "DATE",
        },
    }

    changed = False
    for table, columns in additions.items():
        if not inspector.has_table(table):
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl in columns.items():
            if name not in existing:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                changed = True
                logger.info("Добавлена колонка %s.%s", table, name)

    if changed:
        db.commit()
