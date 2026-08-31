"""
Отправка почты для восстановления пароля.

Работает синхронно в фоновой задаче FastAPI: письма редкие, отдельная очередь
была бы лишней сущностью. Ошибка отправки не должна ронять запрос — иначе
по тому, упал ответ или нет, можно было бы определить, есть ли такой адрес.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

from backend.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> bool:
    """Отправить письмо. False, если не настроено или не отправилось."""
    if not settings.email_enabled:
        logger.warning("SMTP не настроен — письмо для %s не отправлено", to)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message.set_content(body)

    try:
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT,
                                  context=ssl.create_default_context(), timeout=15) as smtp:
                _login_and_send(smtp, message)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
                if settings.SMTP_STARTTLS:
                    smtp.starttls(context=ssl.create_default_context())
                _login_and_send(smtp, message)
        return True
    except Exception:
        logger.exception("Не удалось отправить письмо на %s", to)
        return False


def _login_and_send(smtp, message: EmailMessage) -> None:
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    smtp.send_message(message)


def send_password_reset(to: str, full_name: str, token: str) -> bool:
    """Письмо со ссылкой восстановления."""
    link = f"{settings.PUBLIC_URL.rstrip('/')}/reset-password?token={token}"
    minutes = settings.PASSWORD_RESET_TTL_MINUTES
    body = (
        f"Здравствуйте, {full_name}!\n\n"
        f"Для этой учётной записи в ProfPay запрошено восстановление пароля.\n"
        f"Чтобы задать новый пароль, перейдите по ссылке:\n\n"
        f"{link}\n\n"
        f"Ссылка действует {minutes} минут и сработает один раз.\n\n"
        f"Если вы не запрашивали восстановление — просто удалите это письмо, "
        f"пароль останется прежним.\n"
    )
    return send_email(to, "ProfPay — восстановление пароля", body)
