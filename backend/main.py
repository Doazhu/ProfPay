"""
ProfPay — точка входа FastAPI.
"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import settings
from backend.core.database import init_db, legacy_schema_detected
from backend.core.encryption import EncryptionNotConfigured, get_fernet
from backend.presentation.auth_api import router as auth_router
from backend.presentation.payer_api import router as payer_router
from backend.presentation.stats_api import router as stats_router

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("profpay")


def _check_configuration() -> None:
    """
    Проверить настройки до приёма первого запроса.

    Падать на старте с внятным сообщением лучше, чем принять запрос
    и записать данные не тем ключом.
    """
    problems: list[str] = []

    if not settings.DEBUG:
        if settings.SECRET_KEY == "your-super-secret-key-change-in-production":
            problems.append("SECRET_KEY остался значением по умолчанию")
        elif len(settings.SECRET_KEY) < 32:
            # RFC 7518: ключ HMAC-SHA256 должен быть не короче длины выхода хеша.
            problems.append(
                f"SECRET_KEY слишком короткий ({len(settings.SECRET_KEY)} символов, нужно от 32). "
                "Сгенерируйте: python3 -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        if settings.ADMIN_PASSWORD == "admin123":
            problems.append("ADMIN_PASSWORD остался значением по умолчанию")
        if not settings.COOKIE_SECURE:
            logger.warning(
                "COOKIE_SECURE=false вне отладки: куки уйдут по HTTP. "
                "Включите его, если сайт работает по HTTPS."
            )

    try:
        get_fernet()
    except EncryptionNotConfigured as exc:
        problems.append(str(exc))

    if legacy_schema_detected():
        problems.append(
            "База осталась от версии со сплошным шифрованием (есть колонка "
            "system_users.encrypted_master_key). Запустите миграцию:\n"
            "  python -m backend.tools.migrate_partial_encryption --apply"
        )

    if problems:
        for problem in problems:
            logger.critical("Запуск невозможен: %s", problem)
        sys.exit(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Старт и остановка приложения (@app.on_event объявлен устаревшим)."""
    _check_configuration()
    init_db()
    logger.info("ProfPay %s запущен", settings.APP_VERSION)
    yield
    logger.info("ProfPay остановлен")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Заголовки безопасности по рекомендациям OWASP."""

    # 'unsafe-inline' для стилей нужен: Vite инлайнит критический CSS,
    # а React ставит style-атрибуты. Для скриптов он убран — именно там
    # он и опасен, потому что превращает XSS в исполнение кода.
    CSP = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'"
    )

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Swagger и ReDoc тянут скрипты с CDN — под общий CSP они не подходят.
        # Открыты они только при DEBUG.
        if request.url.path in ("/api/docs", "/api/redoc", "/openapi.json"):
            return response

        csp = self.CSP
        if settings.COOKIE_SECURE:
            csp += "; upgrade-insecure-requests"
        response.headers["Content-Security-Policy"] = csp

        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        # X-XSS-Protection намеренно не ставим: заголовок устарел, в старых
        # браузерах его фильтр сам служил вектором атаки, современные его
        # игнорируют. Защиту даёт CSP выше.

        if settings.COOKIE_SECURE:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API учёта плательщиков профсоюзных взносов",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Порядок важен: middleware выполняются в обратном порядке регистрации,
# поэтому проверка Host стоит первой на входе.
if settings.TRUSTED_HOSTS != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(payer_router, prefix="/api/v1")
app.include_router(stats_router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["Служебные"])
async def health():
    """Проверка живости для мониторинга и healthcheck в Docker."""
    return {"status": "healthy", "version": settings.APP_VERSION}
