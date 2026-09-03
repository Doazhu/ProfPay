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
    create_access_token, create_refresh_token, decode_token, get_password_hash,
    needs_rehash, verify_password,
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
# Стойкость паролей
# ---------------------------------------------------------------------------

def test_common_passwords_rejected():
    """Пароли из первой сотни любого словаря подбираются мгновенно."""
    from pydantic import ValidationError

    from backend.application.schemas import UserCreate

    for weak in ("password", "12345678", "admin123", "profpay123"):
        with pytest.raises(ValidationError):
            UserCreate(username="user1", email="u@profpay.site",
                       password=weak, full_name="Пользователь")


def test_password_equal_to_login_rejected():
    from pydantic import ValidationError

    from backend.application.schemas import UserCreate

    with pytest.raises(ValidationError):
        UserCreate(username="buhgalter", email="b@profpay.site",
                   password="buhgalter", full_name="Бухгалтер")


def test_password_of_repeated_characters_rejected():
    from pydantic import ValidationError

    from backend.application.schemas import UserCreate

    with pytest.raises(ValidationError):
        UserCreate(username="user1", email="u@profpay.site",
                   password="ааааааааа", full_name="Пользователь")


def test_normal_password_accepted():
    from backend.application.schemas import UserCreate

    user = UserCreate(username="user1", email="u@profpay.site",
                      password="Взносы-Осень-2026", full_name="Пользователь")
    assert user.password == "Взносы-Осень-2026"


# ---------------------------------------------------------------------------
# Подмена адреса клиента
# ---------------------------------------------------------------------------

def test_forwarded_header_ignored_from_outside():
    """
    X-Forwarded-For принимается только от своего же nginx.

    Иначе перебор пароля обходился бы новым значением заголовка в каждом
    запросе: ограничение по IP считало бы каждую попытку первой.
    """
    from backend.presentation.dependencies import client_ip

    class FakeClient:
        def __init__(self, host):
            self.host = host

    class FakeRequest:
        def __init__(self, peer, forwarded):
            self.client = FakeClient(peer)
            self.headers = {"x-forwarded-for": forwarded} if forwarded else {}

    # Запрос из локальной сети — заголовку верим (его ставит наш прокси).
    assert client_ip(FakeRequest("172.18.0.5", "203.0.113.7")) == "203.0.113.7"
    assert client_ip(FakeRequest("127.0.0.1", "203.0.113.7, 10.0.0.1")) == "203.0.113.7"

    # Запрос напрямую снаружи — заголовок игнорируем.
    assert client_ip(FakeRequest("198.51.100.9", "203.0.113.7")) == "198.51.100.9"
    assert client_ip(FakeRequest("198.51.100.9", None)) == "198.51.100.9"
