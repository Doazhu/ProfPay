"""
Application configuration with environment variables support.
"""
from functools import lru_cache
from typing import Optional, List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore"
    )

    # Application
    APP_NAME: str = "ProfPay - Учёт плательщиков Профкома"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database - support both individual params and full URL
    DATABASE_URL: Optional[str] = None
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "profpay_user"
    POSTGRES_PASSWORD: str = "profpay_password"
    POSTGRES_DB: str = "profpay_db"

    @property
    def database_url(self) -> str:
        """Get database URL for sync connections."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def database_url_async(self) -> str:
        """Get database URL for async connections."""
        base = self.database_url
        if base.startswith("postgresql://"):
            return base.replace("postgresql://", "postgresql+asyncpg://", 1)
        return base

    # Initial admin account (created on first launch if no admin exists)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"  # Override in .env before first launch!

    # JWT Authentication
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security - pydantic-settings auto-parses JSON for List[str]
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    COOKIE_SECURE: bool = False
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
