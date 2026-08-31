"""
Частичное шифрование полей.

Проверки закрывают баг, из-за которого правка карточки накладывала второй
слой шифрования на непереданные поля: телефон показывался как «gAAAAA…»,
а дата рождения и суммы пропадали.
"""
import pytest
from cryptography.fernet import Fernet

from backend.core.encryption import (
    DecryptionError, decrypt_date, decrypt_field, encrypt_date, encrypt_field,
    get_fernet, is_encrypted, peel_field,
)


def test_round_trip():
    assert decrypt_field(encrypt_field("me@doazhu.pro")) == "me@doazhu.pro"


def test_encrypt_is_idempotent():
    """Повторное шифрование не наслаивается — защита от порчи данных."""
    once = encrypt_field("+79001234567")
    assert encrypt_field(once) == once
    assert decrypt_field(once) == "+79001234567"


def test_empty_becomes_none():
    """Пустая строка и None не должны занимать место шифротекстом."""
    assert encrypt_field("") is None
    assert encrypt_field(None) is None


def test_date_round_trip():
    from datetime import date
    assert decrypt_date(encrypt_date(date(2007, 9, 25))) == date(2007, 9, 25)


def test_date_survives_second_pass():
    from datetime import date
    token = encrypt_date(encrypt_date(date(2007, 9, 25)))
    assert decrypt_date(token) == date(2007, 9, 25)


def test_plaintext_passes_through():
    """Данные, записанные до включения шифрования, читаются как есть."""
    assert decrypt_field("Гом Павел") == "Гом Павел"


def test_wrong_key_raises_instead_of_returning_ciphertext():
    """
    Чужой ключ обязан падать. Раньше расшифровка возвращала шифротекст,
    он уезжал в интерфейс, а оттуда — обратно в базу поверх живых данных.
    """
    token = encrypt_field("секрет")
    with pytest.raises(DecryptionError):
        decrypt_field(token, key=Fernet.generate_key())


@pytest.mark.parametrize("layers", [2, 3, 4])
def test_peel_recovers_corrupted_data(layers):
    """Данные, испорченные старым кодом, восстанавливаются полностью."""
    key = get_fernet()
    token = "1-мд-35"
    for _ in range(layers):
        token = key.encrypt(token.encode()).decode()
    assert peel_field(token) == "1-мд-35"


def test_is_encrypted():
    assert is_encrypted(encrypt_field("что-то"))
    assert not is_encrypted("Гом Павел")
    assert not is_encrypted(None)
