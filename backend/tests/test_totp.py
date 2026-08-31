"""
Второй фактор: приложение-аутентификатор.

Проверяется весь путь целиком — привязка, вход с кодом, резервные коды,
отключение — и то, что подбор кода упирается в ту же блокировку, что и подбор
пароля. Без этого второй фактор был бы обходим перебором.
"""
import pyotp
import pytest

from backend.core import totp as totp_service
from backend.core.config import settings
from backend.tests.conftest import ADMIN_PASSWORD

API = "/api/v1"


def code_for(secret: str) -> str:
    return pyotp.TOTP(secret).now()


def enable_totp(client) -> tuple[str, list[str]]:
    """Пройти привязку целиком. Возвращает секрет и резервные коды."""
    setup = client.post(f"{API}/auth/totp/setup").json()
    secret = setup["secret"]
    assert setup["qr_svg"].startswith("<svg")

    enabled = client.post(f"{API}/auth/totp/enable", json={"code": code_for(secret)})
    assert enabled.status_code == 200, enabled.text
    return secret, enabled.json()["recovery_codes"]


# ---------------------------------------------------------------------------
# Ядро
# ---------------------------------------------------------------------------

def test_code_verification():
    secret = totp_service.generate_secret()
    assert totp_service.verify_code(secret, code_for(secret))
    assert not totp_service.verify_code(secret, "000000")
    assert not totp_service.verify_code(secret, "")
    assert not totp_service.verify_code(None, code_for(secret))


def test_code_from_other_secret_rejected():
    assert not totp_service.verify_code(
        totp_service.generate_secret(), code_for(totp_service.generate_secret())
    )


def test_recovery_codes_stored_only_as_hashes():
    codes = totp_service.generate_recovery_codes()
    hashes = [totp_service.hash_recovery_code(c) for c in codes]

    assert len(codes) == len(set(codes)) == 8
    for code, digest in zip(codes, hashes):
        assert code not in digest
    assert totp_service.match_recovery_code(codes[2], hashes) == hashes[2]
    assert totp_service.match_recovery_code("zzzz-zzzz", hashes) is None


def test_recovery_code_is_case_and_space_insensitive():
    """Код переписывают с бумаги — регистр и пробелы прощаем."""
    codes = totp_service.generate_recovery_codes()
    hashes = [totp_service.hash_recovery_code(codes[0])]
    assert totp_service.match_recovery_code(f"  {codes[0].upper()} ", hashes) == hashes[0]


# ---------------------------------------------------------------------------
# Привязка и вход
# ---------------------------------------------------------------------------

def test_setup_does_not_enable_until_confirmed(auth_client, admin, db):
    """
    Секрет сохраняется сразу, а фактор включается только после ввода кода.
    Иначе можно было бы запереть себя, не успев настроить приложение.
    """
    auth_client.post(f"{API}/auth/totp/setup")
    assert auth_client.get(f"{API}/auth/totp/status").json()["enabled"] is False

    db.refresh(admin)
    assert admin.totp_secret is not None
    assert admin.totp_enabled is False


def test_enable_requires_correct_code(auth_client, admin):
    auth_client.post(f"{API}/auth/totp/setup")
    bad = auth_client.post(f"{API}/auth/totp/enable", json={"code": "000000"})
    assert bad.status_code == 400
    assert auth_client.get(f"{API}/auth/totp/status").json()["enabled"] is False


def test_full_enable_flow(auth_client, admin):
    _, codes = enable_totp(auth_client)
    status = auth_client.get(f"{API}/auth/totp/status").json()
    assert status["enabled"] is True
    assert status["recovery_codes_left"] == len(codes) == 8


def test_secret_encrypted_in_db(auth_client, admin, db):
    """Секрет — тот же уровень чувствительности, что пароль."""
    from sqlalchemy import text
    secret, _ = enable_totp(auth_client)
    stored = db.execute(
        text("SELECT totp_secret FROM system_users WHERE id = :i"), {"i": admin.id}
    ).scalar()
    assert stored.startswith("gAAAAA")
    assert secret not in stored


def test_login_requires_code_when_enabled(client, admin):
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    secret, _ = enable_totp(client)
    client.post(f"{API}/auth/logout")
    client.cookies.clear()

    without = client.post(f"{API}/auth/login",
                          json={"username": "admin", "password": ADMIN_PASSWORD})
    assert without.status_code == 401
    assert without.headers.get("X-Requires-Totp") == "1"

    with_code = client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": code_for(secret),
    })
    assert with_code.status_code == 200


def test_wrong_code_does_not_reveal_password_validity(client, admin):
    """Неверный пароль и неверный код должны отвечать одинаково по смыслу."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    enable_totp(client)
    client.post(f"{API}/auth/logout")
    client.cookies.clear()

    response = client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": "000000",
    })
    assert response.status_code == 401


def test_code_bruteforce_hits_lockout(client, admin):
    """Подбор кода должен упираться в ту же блокировку, что и подбор пароля."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    secret, _ = enable_totp(client)
    client.post(f"{API}/auth/logout")
    client.cookies.clear()

    for _ in range(settings.MAX_LOGIN_ATTEMPTS):
        client.post(f"{API}/auth/login", json={
            "username": "admin", "password": ADMIN_PASSWORD, "totp_code": "000000",
        })

    blocked = client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": code_for(secret),
    })
    assert blocked.status_code == 429


# ---------------------------------------------------------------------------
# Резервные коды
# ---------------------------------------------------------------------------

def test_recovery_code_works_once(client, admin):
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    _, codes = enable_totp(client)
    client.post(f"{API}/auth/logout")
    client.cookies.clear()

    first = client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": codes[0],
    })
    assert first.status_code == 200
    assert client.get(f"{API}/auth/totp/status").json()["recovery_codes_left"] == 7

    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    again = client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": codes[0],
    })
    assert again.status_code == 401


# ---------------------------------------------------------------------------
# Смена пароля и отключение
# ---------------------------------------------------------------------------

def test_change_password_requires_code(auth_client, admin):
    """
    Иначе перехваченная сессия позволила бы сменить пароль в обход
    второго фактора и закрепиться в системе.
    """
    secret, _ = enable_totp(auth_client)

    without = auth_client.post(f"{API}/auth/change-password", json={
        "current_password": ADMIN_PASSWORD, "new_password": "НовыйПароль2026",
    })
    assert without.status_code == 400

    with_code = auth_client.post(f"{API}/auth/change-password", json={
        "current_password": ADMIN_PASSWORD,
        "new_password": "НовыйПароль2026",
        "totp_code": code_for(secret),
    })
    assert with_code.status_code == 200


def test_disable_requires_password_and_code(auth_client, admin):
    secret, _ = enable_totp(auth_client)

    assert auth_client.post(f"{API}/auth/totp/disable", json={
        "password": "неверный", "code": code_for(secret),
    }).status_code == 400

    assert auth_client.post(f"{API}/auth/totp/disable", json={
        "password": ADMIN_PASSWORD, "code": "000000",
    }).status_code == 400

    ok = auth_client.post(f"{API}/auth/totp/disable", json={
        "password": ADMIN_PASSWORD, "code": code_for(secret),
    })
    assert ok.status_code == 200
    assert auth_client.get(f"{API}/auth/totp/status").json()["enabled"] is False


def test_admin_can_reset_lost_second_factor(auth_client, admin):
    """Телефон потерян, резервные коды не сохранились — сбрасывает администратор."""
    auth_client.post(f"{API}/auth/users", json={
        "username": "operator", "email": "op@profpay.site",
        "password": "ПарольОператора2026", "full_name": "Оператор", "role": "operator",
    })
    user_id = next(u["id"] for u in auth_client.get(f"{API}/auth/users").json()
                   if u["username"] == "operator")

    assert auth_client.post(f"{API}/auth/users/{user_id}/totp/reset").status_code == 200
