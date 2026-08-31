"""
Шифрование чувствительных полей БД (Fernet: AES-128-CBC + HMAC-SHA256).

Что шифруется, а что нет
------------------------
Шифруются только те поля, которые действительно опасны при утечке дампа:
контакты, дата рождения, свободные примечания, номера квитанций.

ФИО, группа, кафедра, курс и суммы остаются открытыми — по ним нужно искать,
сортировать и считать в SQL. Раньше зашифровано было всё, и из-за этого список
плательщиков грузил из базы *всех* и расшифровывал каждого, чтобы отдать двадцать.
На тысяче записей это перестаёт работать.

Ключ
----
Мастер-ключ лежит в переменной окружения ENCRYPTION_KEY, а не заворачивается
в пароль пользователя. Прежняя схема (ключ внутри пароля) делала невозможными
и восстановление пароля по почте, и заведение второго пользователя — тот
получал собственный ключ и переставал читать чужие записи.

Модель угроз: защищаемся от утечки дампа базы или файла бэкапа. От полного
доступа к серверу (где лежит и база, и .env) это не защитит — храните .env
и бэкапы раздельно.
"""
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from backend.core.config import settings

logger = logging.getLogger(__name__)

# Токены Fernet версии 0x80 всегда начинаются с этих символов в base64url.
FERNET_TOKEN_PREFIX = "gAAAAA"


class DecryptionError(Exception):
    """Значение зашифровано, но текущим ключом не открывается."""


class EncryptionNotConfigured(Exception):
    """ENCRYPTION_KEY не задан или задан неверно."""


def generate_key() -> bytes:
    """Сгенерировать ключ для ENCRYPTION_KEY."""
    return Fernet.generate_key()


_fernet: Optional[Fernet] = None


def get_fernet() -> Fernet:
    """
    Получить настроенный Fernet. Кэшируется: разбор ключа не бесплатный,
    а вызывается он на каждое поле каждой записи.
    """
    global _fernet
    if _fernet is None:
        if not settings.ENCRYPTION_KEY:
            raise EncryptionNotConfigured(
                "ENCRYPTION_KEY не задан. Сгенерируйте ключ:\n"
                "  python -c \"from cryptography.fernet import Fernet; "
                "print(Fernet.generate_key().decode())\"\n"
                "и пропишите его в .env"
            )
        try:
            _fernet = Fernet(settings.ENCRYPTION_KEY.encode("ascii"))
        except (ValueError, TypeError) as exc:
            raise EncryptionNotConfigured(
                "ENCRYPTION_KEY имеет неверный формат — нужен ключ Fernet в base64"
            ) from exc
    return _fernet


def reset_fernet_cache() -> None:
    """Сбросить кэш ключа. Нужно тестам и инструментам миграции."""
    global _fernet
    _fernet = None


def is_encrypted(value) -> bool:
    """Похоже ли значение на токен Fernet."""
    return isinstance(value, str) and value.startswith(FERNET_TOKEN_PREFIX)


# ---------------------------------------------------------------------------
# Строки
# ---------------------------------------------------------------------------

def encrypt_field(value: Optional[str], key: Optional[bytes] = None) -> Optional[str]:
    """
    Зашифровать строку.

    Уже зашифрованное значение возвращается как есть — защита от наложения
    второго слоя, из-за которого поля раньше становились нечитаемыми.
    """
    if value is None or value == "":
        return None
    if is_encrypted(value):
        return value
    f = Fernet(key) if key else get_fernet()
    return f.encrypt(str(value).encode("utf-8")).decode("ascii")


def decrypt_field(token: Optional[str], key: Optional[bytes] = None) -> Optional[str]:
    """
    Расшифровать строку.

    Значение, не похожее на токен, отдаётся как есть — это открытые данные,
    записанные до включения шифрования. Настоящий токен, который не открылся,
    поднимает ошибку: молчать нельзя, иначе шифротекст уедет в интерфейс
    и перезапишет собой живые данные.
    """
    if token is None:
        return None
    if not is_encrypted(token):
        return token
    try:
        f = Fernet(key) if key else get_fernet()
        return f.decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, TypeError, ValueError) as exc:
        raise DecryptionError(
            "Поле зашифровано другим ключом и не может быть прочитано"
        ) from exc


def peel_field(token: Optional[str], key: Optional[bytes] = None, max_layers: int = 8) -> Optional[str]:
    """
    Снять все слои шифрования подряд.

    Нужно инструментам миграции: если из-за старой ошибки поле зашифровали
    дважды, обычная расшифровка вернёт шифротекст вместо текста.
    """
    value = token
    for _ in range(max_layers):
        if not is_encrypted(value):
            return value
        value = decrypt_field(value, key)
    return value


# ---------------------------------------------------------------------------
# Дата — единственный нестроковый тип, который остался зашифрованным
# ---------------------------------------------------------------------------

def encrypt_date(value, key: Optional[bytes] = None) -> Optional[str]:
    """Зашифровать дату как ISO-строку."""
    if value is None:
        return None
    if isinstance(value, str):
        return encrypt_field(value, key)
    return encrypt_field(value.isoformat(), key)


def decrypt_date(token: Optional[str], key: Optional[bytes] = None) -> Optional[date]:
    """Расшифровать строку обратно в дату."""
    plaintext = decrypt_field(token, key)
    if plaintext is None or isinstance(plaintext, date):
        return plaintext
    try:
        return date.fromisoformat(plaintext)
    except (ValueError, TypeError):
        logger.error("Не удалось разобрать дату после расшифровки — поле повреждено")
        return None


def decrypt_decimal(token: Optional[str], key: Optional[bytes] = None) -> Optional[Decimal]:
    """Расшифровать строку в Decimal. Осталось для миграции старых данных."""
    plaintext = decrypt_field(token, key)
    if plaintext is None or isinstance(plaintext, Decimal):
        return plaintext
    try:
        return Decimal(plaintext)
    except (InvalidOperation, ValueError):
        logger.error("Не удалось разобрать сумму после расшифровки — поле повреждено")
        return None
