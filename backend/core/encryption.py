"""
Field-level encryption for sensitive data using Fernet (AES-128-CBC + HMAC-SHA256).

Architecture:
- A random Master Key encrypts/decrypts all sensitive DB fields.
- Each user's password derives a User Key (PBKDF2) that wraps the Master Key.
- The Master Key is never stored in plaintext — only wrapped per-user.
- On login, the user's password unwraps the Master Key for the session.
"""
import os
import base64
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes


# ---------------------------------------------------------------------------
# Master Key generation
# ---------------------------------------------------------------------------

def generate_master_key() -> bytes:
    """Generate a random 32-byte key suitable for Fernet."""
    return Fernet.generate_key()  # 32 bytes URL-safe base64


# ---------------------------------------------------------------------------
# User Key derivation (from password)
# ---------------------------------------------------------------------------

def generate_salt() -> bytes:
    """Generate a random 16-byte salt for PBKDF2."""
    return os.urandom(16)


def derive_user_key(password: str, salt: bytes) -> bytes:
    """Derive a Fernet-compatible key from a password using PBKDF2."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    raw_key = kdf.derive(password.encode("utf-8"))
    return base64.urlsafe_b64encode(raw_key)  # Fernet requires base64 key


# ---------------------------------------------------------------------------
# Key wrapping (encrypt Master Key with User Key)
# ---------------------------------------------------------------------------

def wrap_master_key(master_key: bytes, user_key: bytes) -> bytes:
    """Encrypt the master key with a user-derived key."""
    f = Fernet(user_key)
    return f.encrypt(master_key)


def unwrap_master_key(wrapped_key: bytes, user_key: bytes) -> Optional[bytes]:
    """Decrypt the master key with a user-derived key. Returns None on failure."""
    try:
        f = Fernet(user_key)
        return f.decrypt(wrapped_key)
    except (InvalidToken, Exception):
        return None


# ---------------------------------------------------------------------------
# Field encryption / decryption
# ---------------------------------------------------------------------------

def encrypt_field(value: Optional[str], key: bytes) -> Optional[str]:
    """Encrypt a string field. Returns base64-encoded ciphertext or None."""
    if value is None:
        return None
    f = Fernet(key)
    token = f.encrypt(value.encode("utf-8"))
    return token.decode("ascii")


def decrypt_field(token: Optional[str], key: bytes) -> Optional[str]:
    """Decrypt a string field. Returns plaintext or None."""
    if token is None:
        return None
    try:
        f = Fernet(key)
        return f.decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, Exception):
        # If decryption fails, return the raw value (possibly unencrypted data)
        return token


def encrypt_decimal(value: Optional[Decimal], key: bytes) -> Optional[str]:
    """Encrypt a Decimal value as a string."""
    if value is None:
        return None
    return encrypt_field(str(value), key)


def decrypt_decimal(token: Optional[str], key: bytes) -> Optional[Decimal]:
    """Decrypt a string back to Decimal."""
    if token is None:
        return None
    plaintext = decrypt_field(token, key)
    if plaintext is None:
        return None
    try:
        return Decimal(plaintext)
    except (InvalidOperation, ValueError):
        return None


def encrypt_date(value: Optional[date], key: bytes) -> Optional[str]:
    """Encrypt a date value as ISO string."""
    if value is None:
        return None
    return encrypt_field(value.isoformat(), key)


def decrypt_date(token: Optional[str], key: bytes) -> Optional[date]:
    """Decrypt a string back to date."""
    if token is None:
        return None
    plaintext = decrypt_field(token, key)
    if plaintext is None:
        return None
    try:
        return date.fromisoformat(plaintext)
    except (ValueError, TypeError):
        return None
