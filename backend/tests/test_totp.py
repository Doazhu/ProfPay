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


def test_qr_is_a_standalone_svg_document():
    """
    QR должен открываться как картинка по data:-адресу.

    Без объявленного xmlns браузер такой файл не рисует: на месте кода
    оказывалась пустота, и привязать приложение можно было только вводом
    ключа руками. Проверяется именно пространство имён — по виду разметки
    поломка незаметна.
    """
    svg = totp_service.qr_svg(totp_service.generate_secret(), "user@profpay.site")
    assert svg.startswith("<svg")
    assert 'xmlns="http://www.w3.org/2000/svg"' in svg
    assert "<?xml" not in svg          # в data:-адресе объявление только мешает


def test_qr_encodes_the_binding_link():
    """В коде должна быть ссылка привязки именно этого секрета."""
    secret = totp_service.generate_secret()
    uri = totp_service.provisioning_uri(secret, "user@profpay.site")

    assert uri.startswith("otpauth://totp/")
    assert secret in uri
    assert "issuer=ProfPay" in uri


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


# ---------------------------------------------------------------------------
# Несколько пользователей: у каждого свой второй фактор
# ---------------------------------------------------------------------------

OPERATOR_PASSWORD = "ПарольОператора2026"


def create_operator(client, username="operator", email="op@profpay.site") -> int:
    """Завести пользователя и вернуть его id (вызывать под администратором)."""
    created = client.post(f"{API}/auth/users", json={
        "username": username, "email": email,
        "password": OPERATOR_PASSWORD, "full_name": "Оператор", "role": "operator",
    })
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_new_user_starts_without_second_factor(auth_client, admin):
    """Заведённый пользователь второго фактора ещё не имеет — его он привяжет сам."""
    user_id = create_operator(auth_client)
    listed = next(u for u in auth_client.get(f"{API}/auth/users").json() if u["id"] == user_id)
    assert listed["totp_enabled"] is False


def test_every_user_binds_its_own_second_factor(client, admin):
    """
    Второй фактор заводится под каждую учётную запись отдельно.

    Проверяется главное: секреты разные, код одного пользователя не пускает
    другого, и включение у второго ничего не ломает у первого.
    """
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    admin_secret, _ = enable_totp(client)
    create_operator(client)

    client.post(f"{API}/auth/logout")
    client.cookies.clear()

    assert client.post(f"{API}/auth/login", json={
        "username": "operator", "password": OPERATOR_PASSWORD,
    }).status_code == 200
    assert client.get(f"{API}/auth/totp/status").json()["enabled"] is False

    operator_secret, operator_codes = enable_totp(client)
    assert operator_secret != admin_secret

    client.post(f"{API}/auth/logout")
    client.cookies.clear()

    # Без кода не пускают, с чужим кодом — тоже.
    assert client.post(f"{API}/auth/login", json={
        "username": "operator", "password": OPERATOR_PASSWORD,
    }).status_code == 401
    assert client.post(f"{API}/auth/login", json={
        "username": "operator", "password": OPERATOR_PASSWORD,
        "totp_code": code_for(admin_secret),
    }).status_code == 401

    assert client.post(f"{API}/auth/login", json={
        "username": "operator", "password": OPERATOR_PASSWORD,
        "totp_code": code_for(operator_secret),
    }).status_code == 200

    # Резервные коды у каждого свои.
    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    assert client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": operator_codes[0],
    }).status_code == 401
    assert client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": code_for(admin_secret),
    }).status_code == 200


def test_disabling_one_user_does_not_touch_another(client, admin):
    """Отключение второго фактора у одного не снимает его у другого."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    admin_secret, _ = enable_totp(client)
    create_operator(client)
    client.put(f"{API}/auth/totp/policy", json={"enabled": False})

    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    client.post(f"{API}/auth/login", json={
        "username": "operator", "password": OPERATOR_PASSWORD,
    })
    operator_secret, _ = enable_totp(client)
    assert client.post(f"{API}/auth/totp/disable", json={
        "password": OPERATOR_PASSWORD, "code": code_for(operator_secret),
    }).status_code == 200

    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    assert client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD,
    }).status_code == 401  # у администратора фактор на месте


def test_admin_reset_does_not_affect_other_users(client, admin):
    """Сброс второго фактора одному пользователю не трогает остальных."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    admin_secret, _ = enable_totp(client)
    user_id = create_operator(client)

    assert client.post(f"{API}/auth/users/{user_id}/totp/reset").status_code == 200

    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    assert client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": code_for(admin_secret),
    }).status_code == 200


# ---------------------------------------------------------------------------
# Требование второго фактора для всех
# ---------------------------------------------------------------------------

def test_required_by_default(client, admin):
    """По умолчанию второй фактор обязателен — иначе его никто не настроит."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    assert client.get(f"{API}/auth/totp/policy").json()["enabled"] is True
    assert client.get(f"{API}/auth/totp/status").json()["required"] is True


def test_work_sections_closed_until_second_factor_bound(auth_client, admin):
    """
    Пока фактор обязателен, а приложение не привязано, рабочие разделы закрыты.

    Проверка живёт на сервере, а не только в интерфейсе: иначе требование
    обходилось бы прямым запросом к API.
    """
    auth_client.put(f"{API}/auth/totp/policy", json={"enabled": True})

    blocked = auth_client.get(f"{API}/payers")
    assert blocked.status_code == 403
    assert blocked.headers.get("X-Totp-Enrollment-Required") == "1"

    # Привязка при этом остаётся доступной — иначе выйти из положения нельзя.
    enable_totp(auth_client)
    assert auth_client.get(f"{API}/payers").status_code == 200


def test_policy_off_lets_unbound_user_work(auth_client, admin):
    """Со снятым требованием непривязанный пользователь работает как раньше."""
    auth_client.put(f"{API}/auth/totp/policy", json={"enabled": False})
    assert auth_client.get(f"{API}/payers").status_code == 200
    assert auth_client.get(f"{API}/auth/totp/status").json()["required"] is False


def test_policy_change_is_admin_only(client, admin):
    """Требование снимает только администратор."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    client.put(f"{API}/auth/totp/policy", json={"enabled": False})
    create_operator(client)

    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    client.post(f"{API}/auth/login", json={
        "username": "operator", "password": OPERATOR_PASSWORD,
    })
    assert client.put(f"{API}/auth/totp/policy", json={"enabled": True}).status_code == 403


def test_admin_without_second_factor_can_still_drop_requirement(auth_client, admin):
    """
    Администратор без привязанного приложения обязан иметь выход.

    Настройки закрыты тем же требованием, поэтому снятие требования сделано
    отдельной ручкой — иначе получилась бы запертая дверь с ключом внутри.
    """
    auth_client.put(f"{API}/auth/totp/policy", json={"enabled": True})

    assert auth_client.get(f"{API}/settings/faculties").status_code in (403, 404)
    assert auth_client.put(f"{API}/auth/totp/policy", json={"enabled": False}).status_code == 200
    assert auth_client.get(f"{API}/payers").status_code == 200


# ---------------------------------------------------------------------------
# Перевыпуск резервных кодов
# ---------------------------------------------------------------------------

def test_recovery_codes_can_be_reissued(auth_client, admin):
    """
    Коды показываются один раз, а отключить фактор при обязательном требовании
    нельзя — без перевыпуска потерянные коды означали бы, что один потерянный
    телефон отрезает человека от системы.
    """
    secret, old_codes = enable_totp(auth_client)

    response = auth_client.post(f"{API}/auth/totp/recovery-codes", json={
        "password": ADMIN_PASSWORD, "code": code_for(secret),
    })
    assert response.status_code == 200, response.text

    new_codes = response.json()["recovery_codes"]
    assert len(new_codes) == 8
    assert not set(new_codes) & set(old_codes)
    assert auth_client.get(f"{API}/auth/totp/status").json()["recovery_codes_left"] == 8


def test_reissued_set_replaces_the_old_one(client, admin):
    """Старые коды гаснут все разом, иначе перевыпуск не снижал бы риск."""
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    secret, old_codes = enable_totp(client)
    client.post(f"{API}/auth/totp/recovery-codes", json={
        "password": ADMIN_PASSWORD, "code": code_for(secret),
    })

    client.post(f"{API}/auth/logout")
    client.cookies.clear()
    assert client.post(f"{API}/auth/login", json={
        "username": "admin", "password": ADMIN_PASSWORD, "totp_code": old_codes[0],
    }).status_code == 401


def test_reissue_requires_password_and_code(auth_client, admin):
    secret, _ = enable_totp(auth_client)

    assert auth_client.post(f"{API}/auth/totp/recovery-codes", json={
        "password": "неверный", "code": code_for(secret),
    }).status_code == 400
    assert auth_client.post(f"{API}/auth/totp/recovery-codes", json={
        "password": ADMIN_PASSWORD, "code": "000000",
    }).status_code == 400


def test_reissue_works_while_second_factor_is_required(auth_client, admin):
    """Именно этот случай и был тупиком: отключить нельзя, а коды потеряны."""
    secret, _ = enable_totp(auth_client)
    auth_client.put(f"{API}/auth/totp/policy", json={"enabled": True})

    assert auth_client.post(f"{API}/auth/totp/disable", json={
        "password": ADMIN_PASSWORD, "code": code_for(secret),
    }).status_code == 400  # отключить не дают

    assert auth_client.post(f"{API}/auth/totp/recovery-codes", json={
        "password": ADMIN_PASSWORD, "code": code_for(secret),
    }).status_code == 200  # а новые коды выпустить можно


def test_code_guessing_outside_login_is_limited(auth_client, admin):
    """
    Перебор кода вне входа упирается в отдельный счётчик: блокировка учётной
    записи здесь не работает — сессия уже открыта.
    """
    from backend.presentation.auth_api import SECOND_FACTOR_ATTEMPTS

    enable_totp(auth_client)
    for _ in range(SECOND_FACTOR_ATTEMPTS):
        auth_client.post(f"{API}/auth/totp/recovery-codes", json={
            "password": ADMIN_PASSWORD, "code": "000000",
        })

    blocked = auth_client.post(f"{API}/auth/totp/recovery-codes", json={
        "password": ADMIN_PASSWORD, "code": "000000",
    })
    assert blocked.status_code == 429
