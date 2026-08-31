"""
Аутентификация, восстановление пароля, управление пользователями.

Защита входа устроена в два слоя:

1. По учётной записи — счётчик неудач в БД. После MAX_LOGIN_ATTEMPTS вход
   блокируется на LOGIN_LOCKOUT_MINUTES. Счётчик в базе, а не в памяти:
   перезапуск контейнера не должен обнулять защиту.
2. По IP — окно в памяти процесса. Грубее, зато ловит перебор по разным
   логинам. Приложение работает одним процессом в одном контейнере, поэтому
   общего хранилища вроде Redis для этого не требуется.
"""
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Deque, Dict, Optional

from fastapi import (
    APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status,
)
from sqlalchemy.orm import Session

from backend.application.schemas import (
    AdminPasswordReset, LoginRequest, PasswordChange, PasswordResetConfirm,
    PasswordResetRequest, TokenResponse, UserCreate, UserResponse, UserUpdate,
)
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.mailer import send_password_reset
from backend.core.security import (
    compare_reset_token, create_access_token, create_refresh_token, decode_token,
    generate_reset_token, get_password_hash, hash_reset_token, needs_rehash,
    verify_password,
)
from backend.domain.models import SystemUser, UserRole
from backend.infrastructure.repositories import AuditRepository, UserRepository
from backend.presentation.dependencies import (
    client_ip, get_current_user, require_admin,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Аутентификация"])

# Хеш заведомо несуществующего пароля. Нужен, чтобы неудачный вход по
# несуществующему логину занимал столько же времени, сколько по существующему —
# иначе по времени ответа можно перебрать список учётных записей.
_DUMMY_HASH = get_password_hash("dummy-password-for-constant-time-comparison")

_ip_attempts: Dict[str, Deque[float]] = defaultdict(deque)


def _ip_throttled(ip: str) -> bool:
    """Слишком много попыток входа с одного адреса за окно."""
    window = settings.LOGIN_IP_WINDOW_MINUTES * 60
    now = time.monotonic()
    attempts = _ip_attempts[ip]
    while attempts and now - attempts[0] > window:
        attempts.popleft()
    return len(attempts) >= settings.LOGIN_IP_ATTEMPTS


def _record_ip_attempt(ip: str) -> None:
    _ip_attempts[ip].append(time.monotonic())
    # Словарь не должен расти бесконечно от случайных адресов.
    if len(_ip_attempts) > 10_000:
        for key in [k for k, v in _ip_attempts.items() if not v]:
            _ip_attempts.pop(key, None)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware(value: Optional[datetime]) -> Optional[datetime]:
    """
    Привести время из БД к UTC-aware.

    Postgres отдаёт TIMESTAMPTZ уже с зоной, а SQLite (тесты) — без неё.
    Сравнение наивного времени с aware падает с TypeError, поэтому зону
    дописываем на чтении, а не надеемся на драйвер.
    """
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _is_locked(user: SystemUser) -> bool:
    locked_until = _as_aware(user.locked_until)
    return bool(locked_until and locked_until > _now())


def reset_ip_throttle() -> None:
    """Сбросить окно попыток по IP. Нужно тестам."""
    _ip_attempts.clear()


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        "access_token", access,
        httponly=settings.COOKIE_HTTPONLY, secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE, path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        "refresh_token", refresh,
        httponly=settings.COOKIE_HTTPONLY, secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE, path="/",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def _user_response(user: SystemUser) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login": user.last_login,
        "is_locked": _is_locked(user),
    }


# ---------------------------------------------------------------------------
# Вход и выход
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    """Вход по логину или почте."""
    ip = client_ip(request)
    audit = AuditRepository(db)

    if _ip_throttled(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток входа. Попробуйте через несколько минут.",
        )
    _record_ip_attempt(ip)

    user_repo = UserRepository(db)
    user = user_repo.get_by_login(login_data.username)

    if user is None:
        # Сравниваем с заглушкой, чтобы ответ занял столько же времени,
        # сколько при существующем логине.
        verify_password(login_data.password, _DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )

    if _is_locked(user):
        minutes = max(1, int((_as_aware(user.locked_until) - _now()).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Вход заблокирован после {settings.MAX_LOGIN_ATTEMPTS} неудачных попыток. "
                   f"Повторите через {minutes} мин или восстановите пароль по почте.",
        )

    if not verify_password(login_data.password, user.hashed_password):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = _now() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
            user.failed_login_attempts = 0
            db.commit()
            audit.record("login_locked", "user", user.id, user.id,
                         f"Блокировка после {settings.MAX_LOGIN_ATTEMPTS} неудачных попыток", ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Вход заблокирован на {settings.LOGIN_LOCKOUT_MINUTES} минут "
                       f"после {settings.MAX_LOGIN_ATTEMPTS} неудачных попыток.",
            )
        left = settings.MAX_LOGIN_ATTEMPTS - user.failed_login_attempts
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Неверный логин или пароль. Осталось попыток: {left}",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Учётная запись отключена",
        )

    # Пароль подошёл по старому формату passlib — пересохраняем в текущем.
    if needs_rehash(login_data.password, user.hashed_password):
        user.hashed_password = get_password_hash(login_data.password)
        logger.info("Хеш пароля пользователя %s обновлён до текущего формата", user.username)

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = _now()
    db.commit()

    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id), user.role.value)
    _set_auth_cookies(response, access, refresh)
    audit.record("login", "user", user.id, user.id, None, ip)

    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    """Обновить access-токен по refresh-токену из куки."""
    token = request.cookies.get("refresh_token")
    payload = decode_token(token) if token else None

    if not payload or payload.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Сессия истекла, войдите заново",
        )

    user = UserRepository(db).get_by_id(int(payload.sub))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или отключён",
        )

    access = create_access_token(str(user.id), user.role.value)
    refresh = create_refresh_token(str(user.id), user.role.value)
    _set_auth_cookies(response, access, refresh)

    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/logout")
async def logout(response: Response):
    """Выход: чистим куки."""
    for name in ("access_token", "refresh_token", "encryption_key"):
        response.delete_cookie(name, path="/")
    return {"message": "Вы вышли из системы"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: SystemUser = Depends(get_current_user)):
    return _user_response(current_user)


# ---------------------------------------------------------------------------
# Восстановление пароля по почте
# ---------------------------------------------------------------------------

# Один ответ на любой исход: существует адрес или нет, отправилось письмо
# или нет. Иначе форма восстановления превращается в способ проверить,
# заведён ли в системе конкретный человек.
_RESET_REPLY = {
    "message": "Если такой адрес есть в системе, письмо со ссылкой уже отправлено. "
               "Проверьте почту, включая папку «Спам»."
}


@router.post("/password-reset/request")
async def request_password_reset(
    data: PasswordResetRequest,
    background: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
):
    """Запросить ссылку восстановления пароля."""
    if not settings.email_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Отправка почты не настроена. Обратитесь к администратору — "
                   "он задаст новый пароль в разделе «Пользователи».",
        )

    user_repo = UserRepository(db)
    user = user_repo.get_by_email(data.email)

    if user and user.is_active:
        token = generate_reset_token()
        user.reset_token_hash = hash_reset_token(token)
        user.reset_token_expires = _now() + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES)
        db.commit()

        # В фоне: время ответа не должно зависеть от того, нашёлся адрес или нет.
        background.add_task(send_password_reset, user.email, user.full_name, token)
        AuditRepository(db).record(
            "password_reset_requested", "user", user.id, user.id, None, client_ip(request)
        )

    return _RESET_REPLY


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    data: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db),
):
    """Установить новый пароль по токену из письма."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_reset_token_hash(hash_reset_token(data.token))

    token_valid = (
        user is not None
        and user.is_active
        and user.reset_token_expires is not None
        and _as_aware(user.reset_token_expires) > _now()
        and compare_reset_token(data.token, user.reset_token_hash)
    )

    if not token_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка недействительна или истекла. Запросите восстановление заново.",
        )

    user.hashed_password = get_password_hash(data.new_password)
    # Токен одноразовый: гасим сразу, чтобы по той же ссылке нельзя было
    # сменить пароль второй раз.
    user.reset_token_hash = None
    user.reset_token_expires = None
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()

    AuditRepository(db).record(
        "password_reset", "user", user.id, user.id, None, client_ip(request)
    )
    return {"message": "Пароль изменён. Теперь войдите с новым паролем."}


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    request: Request,
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Сменить свой пароль."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль неверен",
        )
    if data.current_password == data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль совпадает с текущим",
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()

    AuditRepository(db).record(
        "password_changed", "user", current_user.id, current_user.id, None, client_ip(request)
    )
    return {"message": "Пароль изменён"}


# ---------------------------------------------------------------------------
# Пользователи (только администратор)
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    return [_user_response(u) for u in UserRepository(db).get_all()]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """
    Завести пользователя.

    Раньше здесь заворачивался мастер-ключ под пароль нового пользователя,
    и любая ошибка на этом шаге оставляла человека без доступа к данным.
    Теперь ключ общий и живёт в окружении — заводить пользователей безопасно.
    """
    user_repo = UserRepository(db)

    if user_repo.get_by_username(user_data.username):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Такой логин уже занят")
    if user_repo.get_by_email(user_data.email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Такой email уже используется")

    user = user_repo.create(SystemUser(
        username=user_data.username,
        email=user_data.email.strip().lower(),
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=True,
    ))

    AuditRepository(db).record(
        "create", "user", user.id, current_user.id,
        f"Создан пользователь {user.username} с ролью {user.role.value}", client_ip(request),
    )
    return _user_response(user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Изменить пользователя."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    if user_data.email is not None:
        existing = user_repo.get_by_email(user_data.email)
        if existing and existing.id != user_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Такой email уже используется")
        user.email = user_data.email.strip().lower()

    if user_data.full_name is not None:
        user.full_name = user_data.full_name

    # Нельзя снять роль или отключить последнего администратора — иначе
    # в систему больше никто не войдёт с правами на управление.
    losing_admin = (
        user.role == UserRole.ADMIN
        and (
            (user_data.role is not None and user_data.role != UserRole.ADMIN)
            or user_data.is_active is False
        )
    )
    if losing_admin and user_repo.count_active_admins(exclude_id=user_id) == 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Это последний администратор — сначала назначьте другого",
        )

    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    user_repo.save(user)
    AuditRepository(db).record(
        "update", "user", user.id, current_user.id,
        f"Изменён пользователь {user.username}", client_ip(request),
    )
    return _user_response(user)


@router.post("/users/{user_id}/password")
async def admin_set_password(
    user_id: int,
    data: AdminPasswordReset,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Задать пользователю новый пароль и снять блокировку входа."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    user.hashed_password = get_password_hash(data.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.reset_token_hash = None
    user.reset_token_expires = None
    user_repo.save(user)

    AuditRepository(db).record(
        "password_set", "user", user.id, current_user.id,
        f"Администратор задал пароль для {user.username}", client_ip(request),
    )
    return {"message": f"Пароль для «{user.username}» изменён"}


@router.post("/users/{user_id}/unlock")
async def unlock_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Снять блокировку входа, не меняя пароль."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    user.failed_login_attempts = 0
    user.locked_until = None
    user_repo.save(user)

    AuditRepository(db).record(
        "unlock", "user", user.id, current_user.id, None, client_ip(request)
    )
    return {"message": f"Блокировка для «{user.username}» снята"}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Удалить пользователя."""
    if user_id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя удалить собственную учётную запись")

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    if user.role == UserRole.ADMIN and user_repo.count_active_admins(exclude_id=user_id) == 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Это последний администратор — сначала назначьте другого",
        )

    username = user.username
    user_repo.delete(user_id)
    AuditRepository(db).record(
        "delete", "user", user_id, current_user.id, f"Удалён пользователь {username}", client_ip(request)
    )
