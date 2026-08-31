"""
Пароли и токены.

Проверки закрывают две конкретные проблемы: passlib молча обрезал пароли
до 72 байт (русский пароль из 40 букв — это 76 байт), и python-jose с его
CVE на подмену алгоритма.
"""
from datetime import timedelta

import bcrypt
import jwt
import pytest

from backend.core.config import settings
from backend.core.security import (
    compare_reset_token, create_access_token, create_refresh_token, decode_token,
    generate_reset_token, get_password_hash, hash_reset_token, needs_rehash,
    verify_password,
)

# 40 кириллических символов = 76 байт в UTF-8, больше предела bcrypt.
LONG_RU_PASSWORD = "ОченьДлинныйНадёжныйПарольБухгалтера2026"


def test_round_trip():
    assert verify_password("простой", get_password_hash("простой"))
    assert not verify_password("другой", get_password_hash("простой"))


def test_long_cyrillic_password_is_not_truncated():
    """
    Главная проверка: пароли, отличающиеся только после 72-го байта,
    не должны совпадать. Раньше первые 36 русских букв открывали вход.
    """
    assert len(LONG_RU_PASSWORD.encode()) > 72

    hashed = get_password_hash(LONG_RU_PASSWORD)
    assert verify_password(LONG_RU_PASSWORD, hashed)

    truncated = LONG_RU_PASSWORD.encode()[:72].decode("utf-8", "ignore")
    assert truncated != LONG_RU_PASSWORD
    assert not verify_password(truncated, hashed)


def test_very_long_password_does_not_raise():
    """bcrypt напрямую упал бы на длинном пароле — предварительный SHA-256 это снимает."""
    password = "п" * 500
    assert verify_password(password, get_password_hash(password))


def test_legacy_passlib_hash_still_verifies():
    """Старые хеши должны продолжать пускать людей — иначе все потеряют доступ."""
    legacy_hash = bcrypt.hashpw("старыйпароль".encode("utf-8")[:72], bcrypt.gensalt(4)).decode()
    assert verify_password("старыйпароль", legacy_hash)
    assert needs_rehash("старыйпароль", legacy_hash)


def test_current_hash_needs_no_rehash():
    hashed = get_password_hash("пароль")
    assert not needs_rehash("пароль", hashed)


def test_empty_hash_is_rejected():
    assert not verify_password("что угодно", "")


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def test_access_token_round_trip():
    payload = decode_token(create_access_token("42", "admin"))
    assert payload is not None
    assert payload.sub == "42"
    assert payload.role == "admin"
    assert payload.type == "access"


def test_refresh_token_type_is_distinct():
    """Refresh-токен не должен приниматься там, где ждут access."""
    assert decode_token(create_refresh_token("1", "admin")).type == "refresh"


def test_expired_token_rejected():
    expired = create_access_token("1", "admin", expires_delta=timedelta(seconds=-10))
    assert decode_token(expired) is None


def test_token_signed_with_other_key_rejected():
    forged = jwt.encode(
        {"sub": "1", "role": "admin", "type": "access", "exp": 9999999999},
        "не-наш-секрет", algorithm="HS256",
    )
    assert decode_token(forged) is None


def test_alg_none_token_rejected():
    """Классическая подмена алгоритма — из-за неё и был CVE у python-jose."""
    forged = jwt.encode(
        {"sub": "1", "role": "admin", "type": "access", "exp": 9999999999},
        key="", algorithm="none",
    )
    assert decode_token(forged) is None


def test_token_without_required_claims_rejected():
    incomplete = jwt.encode({"sub": "1"}, settings.SECRET_KEY, algorithm="HS256")
    assert decode_token(incomplete) is None


def test_garbage_token_rejected():
    assert decode_token("совсем-не-токен") is None


# ---------------------------------------------------------------------------
# Токены восстановления
# ---------------------------------------------------------------------------

def test_reset_token_stored_only_as_hash():
    token = generate_reset_token()
    stored = hash_reset_token(token)
    assert token not in stored
    assert compare_reset_token(token, stored)
    assert not compare_reset_token(generate_reset_token(), stored)


def test_reset_token_is_random():
    assert len({generate_reset_token() for _ in range(100)}) == 100
