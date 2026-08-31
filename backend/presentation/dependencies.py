"""Зависимости FastAPI: аутентификация и права."""
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import decode_token
from backend.domain.models import SystemUser, UserRole
from backend.infrastructure.repositories import UserRepository

security = HTTPBearer(auto_error=False)


def client_ip(request: Request) -> str:
    """
    IP клиента с учётом обратного прокси.

    Берётся первый адрес из X-Forwarded-For — его ставит host nginx.
    Заголовок подделываем только доверенным прокси; наружу порт бэкенда
    не опубликован, так что источник заголовка контролируем мы.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


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
    """Фабрика зависимостей для проверки роли."""
    async def checker(current_user: SystemUser = Depends(get_current_user)) -> SystemUser:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для этого действия",
            )
        return current_user
    return checker


require_admin = require_role(UserRole.ADMIN)
require_operator = require_role(UserRole.ADMIN, UserRole.OPERATOR)
require_any_role = require_role(UserRole.ADMIN, UserRole.OPERATOR, UserRole.VIEWER)
