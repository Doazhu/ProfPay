"""
Конфигурация приложения. Все значения приходят из переменных окружения
(docker-compose.prod.yml передаёт их контейнеру из .env).
"""
from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения."""

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore"
    )

    # ---- Приложение ----
    APP_NAME: str = "ProfPay - Учёт плательщиков Профкома"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # ---- База данных ----
    DATABASE_URL: Optional[str] = None
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "profpay_user"
    POSTGRES_PASSWORD: str = "profpay_password"
    POSTGRES_DB: str = "profpay_db"

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ---- Первый администратор ----
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@profpay.site"
    ADMIN_PASSWORD: str = "admin123"  # переопределить в .env до первого запуска

    # ---- JWT ----
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ---- Шифрование полей ----
    # Ключ Fernet в base64. Сгенерировать:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Раньше ключ был завёрнут в пароль администратора — из-за этого нельзя было
    # ни восстановить пароль по почте, ни завести второго пользователя, не сломав
    # данные. Теперь ключ живёт в окружении, отдельно от базы.
    ENCRYPTION_KEY: Optional[str] = None

    # ---- Защита входа ----
    MAX_LOGIN_ATTEMPTS: int = 5          # попыток до блокировки учётной записи
    LOGIN_LOCKOUT_MINUTES: int = 15      # на сколько блокируем
    LOGIN_IP_ATTEMPTS: int = 20          # попыток с одного IP за окно
    LOGIN_IP_WINDOW_MINUTES: int = 15

    # ---- Второй фактор ----
    # Восстановление пароля по почте убрано: вместо него приложение-
    # аутентификатор (TOTP), которому не нужен SMTP-сервер. Забытый пароль
    # сбрасывает другой администратор либо backend/tools/reset_admin.py.
    PUBLIC_URL: str = "https://profpay.site"

    # ---- Безопасность HTTP ----
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]
    COOKIE_SECURE: bool = False
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"
    TRUSTED_HOSTS: List[str] = ["*"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
