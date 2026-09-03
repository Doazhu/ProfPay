"""Общая обвязка тестов: временная база SQLite и настроенный ключ шифрования."""
import os
import tempfile

# Настройки читаются при импорте модулей, поэтому задаются до них.
_tmpdir = tempfile.mkdtemp(prefix="profpay-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_tmpdir}/test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin-password")

from cryptography.fernet import Fernet  # noqa: E402

os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.core.database import Base, SessionLocal, engine  # noqa: E402
from backend.core.security import get_password_hash  # noqa: E402
from backend.domain.models import Faculty, PaymentSettings, SystemUser, UserRole  # noqa: E402
from backend.main import app  # noqa: E402

ADMIN_PASSWORD = "test-admin-password"


@pytest.fixture(autouse=True)
def reset_login_throttle():
    """
    Окно попыток по IP живёт в памяти процесса и общее на все тесты.
    Без сброса двадцатая попытка входа в любом тесте начинала отдавать 429.
    """
    from backend.presentation.auth_api import reset_ip_throttle
    reset_ip_throttle()
    yield
    reset_ip_throttle()


@pytest.fixture(autouse=True)
def clean_db():
    """Каждый тест начинает с пустой базы."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def admin(db) -> SystemUser:
    user = SystemUser(
        username="admin",
        email="admin@profpay.site",
        hashed_password=get_password_hash(ADMIN_PASSWORD),
        full_name="Администратор системы",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def faculty(db) -> Faculty:
    item = Faculty(name="Институт информационных технологий и автоматизации", short_name="ИИТА")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def year_settings(db) -> PaymentSettings:
    """Взносы 120 + 120 = 240 ₽ за год — как в реальных настройках."""
    item = PaymentSettings(
        academic_year="2025-2026", currency="RUB",
        fall_amount=120, spring_amount=120, is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def client():
    """
    Клиент без запуска lifespan.

    Контекстный менеджер TestClient запустил бы lifespan, а с ним init_db,
    который завёл бы своего администратора поверх фикстуры. Схему готовит
    clean_db, поэтому старт приложения тестам не нужен.
    """
    return TestClient(app)


@pytest.fixture
def auth_client(client, admin):
    """
    Клиент с активной сессией администратора.

    Требование второго фактора здесь снимается: по умолчанию оно включено,
    и без этого каждый тест про учёт взносов пришлось бы начинать с привязки
    приложения. Тесты самого требования включают его обратно явно.
    """
    response = client.post("/api/v1/auth/login",
                           json={"username": "admin", "password": ADMIN_PASSWORD})
    assert response.status_code == 200, response.text
    client.put("/api/v1/auth/totp/policy", json={"enabled": False})
    return client
