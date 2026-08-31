"""
Пароли, JWT, CSRF, токены восстановления.

Две замены по сравнению с прошлой версией, обе вынужденные:

passlib → bcrypt напрямую. passlib не обновлялся с 2020 года и на bcrypt 4.x
ловит AttributeError при определении версии бэкенда. Хуже другое: bcrypt
принимает максимум 72 байта, а passlib молча обрезал до них. В UTF-8 русская
буква занимает два байта, поэтому пароль из 40 кириллических символов — это
76 байт, и первые 36 символов открывали вход наравне с полным паролем.
Лечится предварительным SHA-256: на вход bcrypt всегда идут ровно 44 байта
независимо от длины и языка пароля.

python-jose → PyJWT. У jose были CVE-2024-33663 (подмена алгоритма) и
CVE-2024-33664 (отказ в обслуживании на сжатых токенах), библиотека почти
не сопровождается, и документация FastAPI перешла на PyJWT.
"""
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from pydantic import BaseModel

from backend.core.config import settings

# Стоимость bcrypt. 12 — примерно 250 мс на современном железе: достаточно
# дорого для перебора и незаметно при одиночном входе.
BCRYPT_ROUNDS = 12


class TokenPayload(BaseModel):
    """Содержимое JWT."""
    sub: str   # id пользователя
    role: str
    exp: datetime
    type: str  # "access" или "refresh"


# ---------------------------------------------------------------------------
# Пароли
# ---------------------------------------------------------------------------

def _prehash(password: str) -> bytes:
    """
    Свернуть пароль любой длины в 44 байта для bcrypt.

    base64 от SHA-256 не содержит нулевых байтов — иначе bcrypt обрезал бы
    строку по первому из них.
    """
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)


def get_password_hash(password: str) -> str:
    """Захешировать пароль."""
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt(BCRYPT_ROUNDS)).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверить пароль.

    Сначала текущая схема, затем — старые хеши passlib без предварительного
    SHA-256. Второй путь нужен ровно один раз: при первом успешном входе
    пароль перехешируется (см. needs_rehash).
    """
    if not hashed_password:
        return False
    encoded_hash = hashed_password.encode("ascii")

    try:
        if bcrypt.checkpw(_prehash(plain_password), encoded_hash):
            return True
    except (ValueError, TypeError):
        return False

    # Старый формат: passlib отдавал bcrypt сырые байты, обрезая до 72.
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8")[:72], encoded_hash)
    except (ValueError, TypeError):
        return False


def needs_rehash(plain_password: str, hashed_password: str) -> bool:
    """Хеш в старом формате — пароль верный, но пересохранить его надо."""
    try:
        return not bcrypt.checkpw(_prehash(plain_password), hashed_password.encode("ascii"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def _create_token(subject: str, role: str, token_type: str, expires: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "exp": now + expires,
        "iat": now,
        "type": token_type,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    return _create_token(
        subject, role, "access",
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str, role: str, expires_delta: Optional[timedelta] = None) -> str:
    return _create_token(
        subject, role, "refresh",
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> Optional[TokenPayload]:
    """
    Разобрать и проверить JWT.

    Алгоритм задаётся явным списком — без него подпись можно было бы подменить
    на "none" или на HMAC чужим ключом.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
        return TokenPayload(**payload)
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# CSRF
# ---------------------------------------------------------------------------

def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def validate_csrf_token(token: str, stored_token: str) -> bool:
    """Сравнение за постоянное время — обычное == подсказало бы длину совпадения."""
    return secrets.compare_digest(token, stored_token)
