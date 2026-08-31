"""
Сквозные проверки API на живой базе.

Здесь проверяется то, ради чего делалась переработка: вход не перебирается,
правка карточки не портит непереданные поля, список и статистика считаются
в SQL, а выпускники не мешают отчётности.
"""
from datetime import date

import pytest

from backend.core.config import settings
from backend.domain.academic import academic_year_start
from backend.tests.conftest import ADMIN_PASSWORD

API = "/api/v1"


def make_payer(client, faculty_id=None, **overrides):
    payload = {
        "last_name": "Ренёв", "first_name": "Александр", "middle_name": "Дмитриевич",
        "date_of_birth": "2007-09-25",
        "email": "me@doazhu.pro", "phone": "+79001234567",
        "telegram": "@doazhu", "vk": "vk.com/doazhu",
        "group_name": "1-мд-35", "department": "ЦИАТ",
        "admission_year": academic_year_start(), "education_level": "bachelor",
        "is_budget": True, "stipend_amount": "2500.00", "budget_percent": "1",
        "notes": "примечание с 'кавычками'",
        "faculty_id": faculty_id,
    }
    payload.update(overrides)
    response = client.post(f"{API}/payers", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Вход
# ---------------------------------------------------------------------------

def test_login_success(client, admin):
    response = client.post(f"{API}/auth/login",
                           json={"username": "admin", "password": ADMIN_PASSWORD})
    assert response.status_code == 200
    assert "access_token" in client.cookies


def test_login_by_email(client, admin):
    """Бухгалтеру привычнее почта, чем логин."""
    response = client.post(f"{API}/auth/login",
                           json={"username": "admin@profpay.site", "password": ADMIN_PASSWORD})
    assert response.status_code == 200


def test_login_wrong_password_counts_down(client, admin):
    response = client.post(f"{API}/auth/login",
                           json={"username": "admin", "password": "неверный"})
    assert response.status_code == 401
    assert "Осталось попыток: 4" in response.json()["detail"]


def test_account_locks_after_five_attempts(client, admin):
    """Пятая неудача блокирует вход — ровно как просили."""
    for _ in range(settings.MAX_LOGIN_ATTEMPTS - 1):
        assert client.post(f"{API}/auth/login",
                           json={"username": "admin", "password": "неверный"}).status_code == 401

    locked = client.post(f"{API}/auth/login", json={"username": "admin", "password": "неверный"})
    assert locked.status_code == 429

    # Даже верный пароль теперь не пускает.
    after = client.post(f"{API}/auth/login",
                        json={"username": "admin", "password": ADMIN_PASSWORD})
    assert after.status_code == 429


def test_successful_login_resets_counter(client, admin):
    client.post(f"{API}/auth/login", json={"username": "admin", "password": "неверный"})
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})

    again = client.post(f"{API}/auth/login", json={"username": "admin", "password": "неверный"})
    assert "Осталось попыток: 4" in again.json()["detail"]


def test_unknown_user_gives_same_message(client, admin):
    """Ответ не должен подсказывать, есть такой логин или нет."""
    response = client.post(f"{API}/auth/login",
                           json={"username": "несуществующий", "password": "любой"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Неверный логин или пароль"


def test_protected_endpoint_requires_auth(client):
    assert client.get(f"{API}/payers").status_code == 401


# ---------------------------------------------------------------------------
# Восстановление пароля
# ---------------------------------------------------------------------------

def test_password_reset_unavailable_without_smtp(client, admin):
    """Пока почта не настроена — честная ошибка, а не молчаливая пустота."""
    response = client.post(f"{API}/auth/password-reset/request",
                           json={"email": "admin@profpay.site"})
    assert response.status_code == 503


def test_password_reset_flow(client, admin, db, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.org")
    monkeypatch.setattr(settings, "SMTP_FROM", "noreply@profpay.site")

    sent = {}
    monkeypatch.setattr(
        "backend.presentation.auth_api.send_password_reset",
        lambda to, name, token: sent.update(to=to, token=token) or True,
    )

    response = client.post(f"{API}/auth/password-reset/request",
                           json={"email": "admin@profpay.site"})
    assert response.status_code == 200
    assert sent["to"] == "admin@profpay.site"

    confirm = client.post(f"{API}/auth/password-reset/confirm",
                          json={"token": sent["token"], "new_password": "НовыйПароль2026"})
    assert confirm.status_code == 200

    assert client.post(f"{API}/auth/login",
                       json={"username": "admin", "password": "НовыйПароль2026"}).status_code == 200

    # Токен одноразовый.
    reuse = client.post(f"{API}/auth/password-reset/confirm",
                        json={"token": sent["token"], "new_password": "ЕщёОдин2026"})
    assert reuse.status_code == 400


def test_password_reset_hides_unknown_email(client, admin, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.org")
    monkeypatch.setattr(settings, "SMTP_FROM", "noreply@profpay.site")

    known = client.post(f"{API}/auth/password-reset/request", json={"email": "admin@profpay.site"})
    unknown = client.post(f"{API}/auth/password-reset/request", json={"email": "нет@profpay.site"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


def test_bad_reset_token_rejected(client, admin):
    response = client.post(f"{API}/auth/password-reset/confirm",
                           json={"token": "x" * 40, "new_password": "НовыйПароль2026"})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Плательщики
# ---------------------------------------------------------------------------

def test_create_and_read_payer(auth_client, faculty):
    created = make_payer(auth_client, faculty.id)
    fetched = auth_client.get(f"{API}/payers/{created['id']}").json()

    assert fetched["full_name"] == "Ренёв Александр Дмитриевич"
    assert fetched["email"] == "me@doazhu.pro"
    assert fetched["date_of_birth"] == "2007-09-25"
    assert fetched["notes"] == "примечание с 'кавычками'"   # без двойного экранирования
    assert fetched["course"] == 1
    assert fetched["group_code"] == "1-мд-35"
    assert fetched["is_archived"] is False


def test_partial_update_keeps_untouched_fields(auth_client, faculty):
    """
    Тот самый баг: раньше поля, которых нет в запросе, получали второй слой
    шифрования — телефон становился «gAAAAA…», а дата рождения пропадала.
    """
    created = make_payer(auth_client, faculty.id)

    for _ in range(4):  # несколько сохранений подряд — слои не должны копиться
        response = auth_client.put(f"{API}/payers/{created['id']}",
                                   json={"last_name": "Ренёв-Петров"})
        assert response.status_code == 200

    payer = auth_client.get(f"{API}/payers/{created['id']}").json()
    assert payer["last_name"] == "Ренёв-Петров"
    assert payer["email"] == "me@doazhu.pro"
    assert payer["phone"] == "+79001234567"
    assert payer["department"] == "ЦИАТ"
    assert payer["date_of_birth"] == "2007-09-25"
    assert str(payer["stipend_amount"]) == "2500.00"
    assert not payer["decryption_failed"]


def test_sensitive_fields_encrypted_in_db(auth_client, faculty, db):
    """Контакты в базе — шифротекст, ФИО — открытый текст для поиска в SQL."""
    from sqlalchemy import text
    created = make_payer(auth_client, faculty.id)

    row = db.execute(
        text("SELECT last_name, group_name, email, phone, notes FROM payers WHERE id = :i"),
        {"i": created["id"]},
    ).fetchone()

    assert row.last_name == "Ренёв"        # открыто: по нему ищем и сортируем
    assert row.group_name == "1-мд-35"     # открыто
    assert row.email.startswith("gAAAAA")  # зашифровано
    assert row.phone.startswith("gAAAAA")
    assert row.notes.startswith("gAAAAA")


def test_search_and_pagination(auth_client, faculty):
    for i in range(25):
        make_payer(auth_client, faculty.id,
                   last_name=f"Фамилия{i:02d}", first_name="Имя", email=None,
                   group_name=f"1-мд-{i:02d}")

    page = auth_client.get(f"{API}/payers", params={"page": 1, "per_page": 10}).json()
    assert len(page["items"]) == 10
    assert page["total"] == 25
    assert page["pages"] == 3

    second = auth_client.get(f"{API}/payers", params={"page": 2, "per_page": 10}).json()
    assert {p["id"] for p in page["items"]} & {p["id"] for p in second["items"]} == set()

    found = auth_client.get(f"{API}/payers", params={"search": "Фамилия07"}).json()
    assert found["total"] == 1

    by_group = auth_client.get(f"{API}/payers", params={"search": "мд-03"}).json()
    assert by_group["total"] == 1


def test_sorted_by_surname(auth_client, faculty):
    for surname in ("Яковлев", "Абрамов", "Миронов"):
        make_payer(auth_client, faculty.id, last_name=surname, email=None)

    items = auth_client.get(f"{API}/payers").json()["items"]
    assert [p["last_name"] for p in items] == ["Абрамов", "Миронов", "Яковлев"]


def test_archive_filter(auth_client, faculty):
    base = academic_year_start()
    make_payer(auth_client, faculty.id, last_name="Первокурсник",
               admission_year=base, email=None)
    make_payer(auth_client, faculty.id, last_name="Выпустился",
               admission_year=base - 4, email=None)

    active = auth_client.get(f"{API}/payers").json()
    assert [p["last_name"] for p in active["items"]] == ["Первокурсник"]

    archived = auth_client.get(f"{API}/payers", params={"archive": "archived"}).json()
    assert [p["last_name"] for p in archived["items"]] == ["Выпустился"]
    assert archived["items"][0]["is_archived"] is True

    every = auth_client.get(f"{API}/payers", params={"archive": "all"}).json()
    assert every["total"] == 2


def test_graduates_are_not_debtors(auth_client, faculty):
    base = academic_year_start()
    make_payer(auth_client, faculty.id, last_name="Должник",
               admission_year=base, email=None)
    make_payer(auth_client, faculty.id, last_name="Выпустился",
               admission_year=base - 4, email=None)

    debtors = auth_client.get(f"{API}/debtors").json()
    assert [p["last_name"] for p in debtors["items"]] == ["Должник"]


def test_soft_delete_hides_but_keeps(auth_client, faculty):
    created = make_payer(auth_client, faculty.id)
    assert auth_client.delete(f"{API}/payers/{created['id']}").status_code == 200
    assert auth_client.get(f"{API}/payers").json()["total"] == 0
    # Запись на месте, просто скрыта.
    assert auth_client.get(f"{API}/payers/{created['id']}").status_code == 200


# ---------------------------------------------------------------------------
# Платежи и статус
# ---------------------------------------------------------------------------

def test_partial_payment_sets_partial_status(auth_client, faculty, year_settings):
    """120 ₽ из 240 за год — это частичная оплата, а не полная."""
    payer = make_payer(auth_client, faculty.id)

    auth_client.post(f"{API}/payments", json={
        "payer_id": payer["id"], "amount": "120.00",
        "payment_date": str(date.today()), "academic_year": "2025-2026", "semester": "fall",
    })
    assert auth_client.get(f"{API}/payers/{payer['id']}").json()["status"] == "partial"

    auth_client.post(f"{API}/payments", json={
        "payer_id": payer["id"], "amount": "120.00",
        "payment_date": str(date.today()), "academic_year": "2025-2026", "semester": "spring",
    })
    full = auth_client.get(f"{API}/payers/{payer['id']}").json()
    assert full["status"] == "paid"
    assert str(full["total_paid"]) == "240.00"


def test_deleting_payment_returns_status_to_unpaid(auth_client, faculty, year_settings):
    """Раньше человек оставался «Оплачено» с нулевой суммой."""
    payer = make_payer(auth_client, faculty.id)
    payment = auth_client.post(f"{API}/payments", json={
        "payer_id": payer["id"], "amount": "240.00", "payment_date": str(date.today()),
    }).json()

    assert auth_client.get(f"{API}/payers/{payer['id']}").json()["status"] == "paid"

    auth_client.delete(f"{API}/payments/{payment['id']}")
    after = auth_client.get(f"{API}/payers/{payer['id']}").json()
    assert after["status"] == "unpaid"
    assert str(after["total_paid"]) == "0"


def test_future_payment_rejected(auth_client, faculty):
    from datetime import timedelta
    payer = make_payer(auth_client, faculty.id)
    response = auth_client.post(f"{API}/payments", json={
        "payer_id": payer["id"], "amount": "120.00",
        "payment_date": str(date.today() + timedelta(days=1)),
    })
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Статистика
# ---------------------------------------------------------------------------

def test_dashboard_excludes_graduates(auth_client, faculty, year_settings):
    base = academic_year_start()
    payer = make_payer(auth_client, faculty.id, last_name="Активный",
                       admission_year=base, email=None)
    make_payer(auth_client, faculty.id, last_name="Выпустился",
               admission_year=base - 4, email=None)
    auth_client.post(f"{API}/payments", json={
        "payer_id": payer["id"], "amount": "240.00", "payment_date": str(date.today()),
    })

    stats = auth_client.get(f"{API}/stats/dashboard").json()
    assert stats["total_payers"] == 1
    assert stats["archived_payers"] == 1
    assert stats["paid_count"] == 1
    assert str(stats["total_paid_amount"]) == "240.00"


def test_faculty_stats(auth_client, faculty):
    make_payer(auth_client, faculty.id, email=None)
    rows = auth_client.get(f"{API}/stats/by-faculty").json()
    row = next(r for r in rows if r["faculty_id"] == faculty.id)
    assert row["total_payers"] == 1
    assert row["faculty_name"] == "ИИТА"


# ---------------------------------------------------------------------------
# Пользователи и права
# ---------------------------------------------------------------------------

def test_viewer_cannot_create_payer(client, admin, faculty):
    client.post(f"{API}/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD})
    client.post(f"{API}/auth/users", json={
        "username": "viewer", "email": "viewer@profpay.site",
        "password": "ПарольПросмотра2026", "full_name": "Только просмотр", "role": "viewer",
    })
    client.post(f"{API}/auth/logout")

    client.post(f"{API}/auth/login", json={"username": "viewer", "password": "ПарольПросмотра2026"})
    response = client.post(f"{API}/payers", json={"last_name": "Тест", "first_name": "Тест"})
    assert response.status_code == 403


def test_create_user_rejects_duplicates(auth_client, admin):
    payload = {"username": "operator", "email": "op@profpay.site",
               "password": "ПарольОператора2026", "full_name": "Оператор", "role": "operator"}
    assert auth_client.post(f"{API}/auth/users", json=payload).status_code == 201

    assert auth_client.post(f"{API}/auth/users", json=payload).status_code == 400
    assert auth_client.post(f"{API}/auth/users", json={
        **payload, "username": "operator2"
    }).status_code == 400  # почта занята


def test_new_user_can_log_in_immediately(auth_client, admin):
    """
    Раньше второй пользователь при первом входе получал собственный
    мастер-ключ и переставал читать чужие записи.
    """
    auth_client.post(f"{API}/auth/users", json={
        "username": "operator", "email": "op@profpay.site",
        "password": "ПарольОператора2026", "full_name": "Оператор", "role": "operator",
    })
    auth_client.post(f"{API}/auth/logout")

    login = auth_client.post(f"{API}/auth/login",
                             json={"username": "operator", "password": "ПарольОператора2026"})
    assert login.status_code == 200
    assert auth_client.get(f"{API}/payers").status_code == 200


def test_operator_sees_data_created_by_admin(auth_client, admin, faculty):
    """Общий ключ: то, что завёл администратор, читает и оператор."""
    make_payer(auth_client, faculty.id)
    auth_client.post(f"{API}/auth/users", json={
        "username": "operator", "email": "op@profpay.site",
        "password": "ПарольОператора2026", "full_name": "Оператор", "role": "operator",
    })
    auth_client.post(f"{API}/auth/logout")
    auth_client.post(f"{API}/auth/login",
                     json={"username": "operator", "password": "ПарольОператора2026"})

    items = auth_client.get(f"{API}/payers").json()["items"]
    assert items[0]["email"] == "me@doazhu.pro"


def test_cannot_demote_last_admin(auth_client, admin):
    response = auth_client.put(f"{API}/auth/users/{admin.id}", json={"role": "viewer"})
    assert response.status_code == 400
    assert "последний администратор" in response.json()["detail"]


def test_cannot_delete_self(auth_client, admin):
    assert auth_client.delete(f"{API}/auth/users/{admin.id}").status_code == 400


def test_admin_can_unlock_user(auth_client, admin, db):
    auth_client.post(f"{API}/auth/users", json={
        "username": "operator", "email": "op@profpay.site",
        "password": "ПарольОператора2026", "full_name": "Оператор", "role": "operator",
    })
    user_id = next(u["id"] for u in auth_client.get(f"{API}/auth/users").json()
                   if u["username"] == "operator")

    for _ in range(settings.MAX_LOGIN_ATTEMPTS):
        auth_client.post(f"{API}/auth/login", json={"username": "operator", "password": "нет"})

    assert auth_client.post(f"{API}/auth/users/{user_id}/unlock").status_code == 200


# ---------------------------------------------------------------------------
# Заголовки безопасности
# ---------------------------------------------------------------------------

def test_security_headers_present(client):
    headers = client.get(f"{API}/health").headers
    assert "script-src 'self'" in headers["content-security-policy"]
    assert "'unsafe-inline'" not in headers["content-security-policy"].split("style-src")[0]
    assert headers["x-frame-options"] == "DENY"
    assert headers["x-content-type-options"] == "nosniff"
    assert "x-xss-protection" not in headers   # заголовок устарел и сам был вектором
