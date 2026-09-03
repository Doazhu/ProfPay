"""
Конфигурация приложения. Все значения приходят из переменных окружения
(docker-compose.prod.yml передаёт их контейнеру из .env).
"""
from functools import lru_cache
from typing import Annotated, Any, List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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
    # NoDecode отключает разбор значения как JSON — списки собирает валидатор
    # ниже, чтобы запись через запятую работала наравне с JSON.
    CORS_ORIGINS: Annotated[List[str], NoDecode] = ["http://localhost:5173"]
    COOKIE_SECURE: bool = False
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"
    TRUSTED_HOSTS: Annotated[List[str], NoDecode] = ["*"]

    @field_validator("CORS_ORIGINS", "TRUSTED_HOSTS", mode="before")
    @classmethod
    def _parse_list(cls, value: Any) -> Any:
        """
        Списки можно писать и через запятую, и в JSON.

        Раньше принимался только JSON, и строка
        `CORS_ORIGINS=https://profpay.site` роняла запуск с сообщением
        «Expecting value: line 1 column 1» — по нему невозможно догадаться,
        что не хватает кавычек и скобок. На боевом сервере такое падение
        выглядит как «сайт не поднялся после обновления».
        """
        if not isinstance(value, str):
            return value

        text = value.strip()
        if text.startswith("["):
            import json
            try:
                return json.loads(text)
            except ValueError as error:
                raise ValueError(
                    f"Не разобрать список: {text!r}. Допустимо либо "
                    f'JSON ["a","b"], либо просто a,b'
                ) from error
        return [item.strip() for item in text.split(",") if item.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
