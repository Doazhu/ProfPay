"""Зависимости FastAPI: аутентификация и права."""
import ipaddress
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import decode_token
from backend.domain.models import SystemUser, UserRole
from backend.infrastructure.repositories import AppSettingsRepository, UserRepository

security = HTTPBearer(auto_error=False)


# Сети, из которых до бэкенда доходит только наш собственный прокси:
# петля и частные диапазоны, в которых Docker выдаёт адреса контейнерам.
# Готовый is_private не подходит — начиная с Python 3.13 он считает частными
# и документационные диапазоны вроде 198.51.100.0/24, то есть обычные внешние
# адреса из примеров прошли бы проверку.
_TRUSTED_PROXY_NETWORKS = tuple(
    ipaddress.ip_network(cidr) for cidr in (
        "127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        "::1/128", "fc00::/7",
    )
)


def _is_local_peer(host: Optional[str]) -> bool:
    """Пришёл ли запрос из локальной сети — то есть от нашего же nginx."""
    if not host:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(address in network for network in _TRUSTED_PROXY_NETWORKS)


def client_ip(request: Request) -> str:
    """
    IP клиента с учётом обратного прокси.

    X-Forwarded-For ставит host nginx, и заголовку верим только тогда, когда
    запрос действительно пришёл из локальной сети. Иначе кто угодно подставил
    бы себе новый адрес в каждой попытке входа и обошёл ограничение по IP —
    сейчас порт бэкенда наружу не опубликован, но одна ошибка в настройке
    docker-compose делала бы защиту бесполезной.
    """
    peer = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")

    if forwarded and _is_local_peer(peer):
        return forwarded.split(",")[0].strip()
    return peer or "unknown"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> SystemUser:
    """Текущий пользователь из JWT: сначала Bearer, потом HttpOnly-кука."""
    token = credentials.credentials if credentials else access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не аутентифицирован",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload or payload.type != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен недействителен или истёк",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user = UserRepository(db).get_by_id(int(payload.sub))
    except (TypeError, ValueError):
        user = None

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Учётная запись отключена")

    return user


def require_role(*roles: UserRole):
    """
    Фабрика зависимостей для проверки роли.

    Здесь же проверяется второй фактор: если он обязателен по настройке, а у
    человека не привязан, к рабочим разделам его не пускают. Проверка стоит
    именно тут, а не только в интерфейсе — иначе требование обходилось бы
    прямым запросом к API мимо страниц.

    Раздел /auth/* через эту зависимость не проходит: там живут привязка
    приложения, смена пароля и выход, и они должны оставаться доступными,
    пока человек ещё не настроил второй фактор.
    """
    async def checker(
        current_user: SystemUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> SystemUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для этого действия",
            )

        if not current_user.totp_enabled and AppSettingsRepository(db).totp_required():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Сначала настройте вход по коду из приложения — "
                       "это обязательно для всех учётных записей",
                # По заголовку интерфейс отличает «не хватает прав» от
                # «нужно закончить настройку» и открывает нужный экран.
                headers={"X-Totp-Enrollment-Required": "1"},
            )

        return current_user
    return checker


require_admin = require_role(UserRole.ADMIN)
require_operator = require_role(UserRole.ADMIN, UserRole.OPERATOR)
require_any_role = require_role(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
