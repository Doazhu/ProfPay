"""
Security utilities: password hashing, JWT tokens, CSRF protection, session key encryption.
"""
import base64
from datetime import datetime, timedelta
from typing import Optional, Any
import secrets

from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from backend.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str  # user id
    role: str
    exp: datetime
    type: str  # "access" or "refresh"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(
    subject: str,
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "type": "access"
    }
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    subject: str,
    role: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

    to_encode = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "type": "refresh"
    }
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> Optional[TokenPayload]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return TokenPayload(**payload)
    except JWTError:
        return None


def generate_csrf_token() -> str:
    """Generate a random CSRF token."""
    return secrets.token_urlsafe(32)


def validate_csrf_token(token: str, stored_token: str) -> bool:
    """Validate CSRF token using constant-time comparison."""
    return secrets.compare_digest(token, stored_token)


# ---------------------------------------------------------------------------
# Session encryption key (for storing master key in HttpOnly cookie)
# ---------------------------------------------------------------------------

def _derive_session_fernet_key() -> bytes:
    """Derive a Fernet key from SECRET_KEY for encrypting session data."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"profpay-session-key-salt",  # fixed salt is OK here — key is already secret
        iterations=100_000,
    )
    raw = kdf.derive(settings.SECRET_KEY.encode("utf-8"))
    return base64.urlsafe_b64encode(raw)


def encrypt_session_key(master_key: bytes) -> str:
    """Encrypt the master key for safe storage in a cookie."""
    fernet_key = _derive_session_fernet_key()
    f = Fernet(fernet_key)
    return f.encrypt(master_key).decode("ascii")


def decrypt_session_key(token: str) -> Optional[bytes]:
    """Decrypt the master key from a cookie value. Returns None on failure."""
    try:
        fernet_key = _derive_session_fernet_key()
        f = Fernet(fernet_key)
        return f.decrypt(token.encode("ascii"))
    except (InvalidToken, Exception):
        return None
