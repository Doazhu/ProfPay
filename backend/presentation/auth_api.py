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
from typing import Deque, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.application.schemas import (
    AdminPasswordReset, LoginRequest, PasswordChange, TokenResponse,
    TotpDisableRequest, TotpEnableRequest, TotpEnableResponse, TotpPolicy,
    TotpSetupResponse, TotpStatus, UserCreate, UserResponse, UserUpdate,
)
from backend.core.config import settings
from backend.core.database import get_db
from backend.core.encryption import decrypt_field, encrypt_field
from backend.core.security import (
    create_access_token, create_refresh_token, decode_token, get_password_hash,
    needs_rehash, verify_password,
)
from backend.core import totp as totp_service
from backend.domain.models import SystemUser, UserRole
from backend.infrastructure.repositories import (
    AppSettingsRepository, AuditRepository, UserRepository,
)
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

# Проверки кода вне входа — смена пароля и отключение второго фактора.
# Там уже есть действующая сессия, поэтому счётчик неудачных входов не
# работает, а перебор шестизначного кода из открытой чужой вкладки — ровно
# то, от чего второй фактор в этих местах и защищает.
SECOND_FACTOR_ATTEMPTS = 10
SECOND_FACTOR_WINDOW_MINUTES = 15
_code_attempts: Dict[int, Deque[float]] = defaultdict(deque)


def _code_attempts_exhausted(user_id: int) -> bool:
    window = SECOND_FACTOR_WINDOW_MINUTES * 60
    now = time.monotonic()
    attempts = _code_attempts[user_id]
    while attempts and now - attempts[0] > window:
        attempts.popleft()
    return len(attempts) >= SECOND_FACTOR_ATTEMPTS


def _record_code_attempt(user_id: int) -> None:
    _code_attempts[user_id].append(time.monotonic())


def _clear_code_attempts(user_id: int) -> None:
    _code_attempts.pop(user_id, None)


def _guard_code_attempts(user: SystemUser) -> None:
    """Отказать, если код в этой сессии подбирают."""
    if _code_attempts_exhausted(user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Слишком много неверных кодов. Повторите через "
                   f"{SECOND_FACTOR_WINDOW_MINUTES} минут.",
        )


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
    """Сбросить окна попыток. Нужно тестам."""
    _ip_attempts.clear()
    _code_attempts.clear()


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


def _totp_secret(user: SystemUser) -> Optional[str]:
    """Секрет второго фактора в открытом виде (в базе он зашифрован)."""
    try:
        return decrypt_field(user.totp_secret)
    except Exception:
        logger.exception("Секрет второго фактора не открывается текущим ключом")
        return None


def _recovery_hashes(user: SystemUser) -> List[str]:
    try:
        raw = decrypt_field(user.totp_recovery_hashes)
    except Exception:
        return []
    return [h for h in (raw or "").split(",") if h]


def _store_recovery_hashes(user: SystemUser, hashes: List[str]) -> None:
    user.totp_recovery_hashes = encrypt_field(",".join(hashes)) if hashes else None


def _check_second_factor(user: SystemUser, code: Optional[str]) -> bool:
    """
    Проверить код второго фактора: сначала из приложения, потом резервный.

    Сработавший резервный код гасится сразу — он одноразовый. Вызывающий
    обязан сохранить сессию (db.commit), иначе гашение не запишется.
    """
    secret = _totp_secret(user)
    if totp_service.verify_code(secret, code):
        return True

    if not code:
        return False

    hashes = _recovery_hashes(user)
    matched = totp_service.match_recovery_code(code, hashes)
    if matched is None:
        return False

    hashes.remove(matched)
    _store_recovery_hashes(user, hashes)
    logger.info("Использован резервный код, осталось: %s", len(hashes))
    return True


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
        "totp_enabled": bool(user.totp_enabled),
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

    # Второй фактор проверяется только после верного пароля: иначе по ответу
    # можно было бы понять, что пароль угадан, ещё не имея кода.
    if user.totp_enabled:
        if not login_data.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Нужен код из приложения-аутентификатора",
                headers={"X-Requires-Totp": "1"},
            )
        if not _check_second_factor(user, login_data.totp_code):
            # Неверный код считается наравне с неверным паролем: иначе
            # перебор кода не упирался бы в блокировку.
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = _now() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
                user.failed_login_attempts = 0
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Код неверен или истёк",
                headers={"X-Requires-Totp": "1"},
            )
        db.commit()  # гасим использованный резервный код

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
# Второй фактор: приложение-аутентификатор
# ---------------------------------------------------------------------------

@router.get("/totp/status", response_model=TotpStatus)
async def totp_status(
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Состояние второго фактора у текущего пользователя."""
    return TotpStatus(
        enabled=bool(current_user.totp_enabled),
        recovery_codes_left=len(_recovery_hashes(current_user)),
        required=AppSettingsRepository(db).totp_required(),
    )


@router.get("/totp/policy", response_model=TotpPolicy)
async def get_totp_policy(
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Обязателен ли второй фактор всем."""
    return TotpPolicy(enabled=AppSettingsRepository(db).totp_required())


@router.put("/totp/policy", response_model=TotpPolicy)
async def set_totp_policy(
    data: TotpPolicy,
    request: Request,
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Включить или снять требование второго фактора для всех.

    Права проверяются здесь, а не через require_admin, намеренно: та
    зависимость сама упирается в это требование, и администратор, у которого
    приложение ещё не привязано, не смог бы до настройки добраться —
    получилась бы запертая дверь с ключом внутри.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Настройку меняет администратор")

    AppSettingsRepository(db).set_totp_required(data.enabled)
    AuditRepository(db).record(
        "totp_policy", "settings", None, current_user.id,
        "Второй фактор обязателен для всех" if data.enabled
        else "Второй фактор больше не обязателен",
        client_ip(request),
    )
    return TotpPolicy(enabled=data.enabled)


@router.post("/totp/setup", response_model=TotpSetupResponse)
async def totp_setup(
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Начать привязку приложения: выдать секрет и QR-код.

    Секрет сразу пишется в базу, но второй фактор ещё не включается — это
    произойдёт в /totp/enable после того, как человек введёт код и докажет,
    что приложение действительно настроено. Иначе можно было бы запереть
    себя, не сохранив секрет.
    """
    if current_user.totp_enabled:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Второй фактор уже включён. Сначала отключите его.",
        )

    secret = totp_service.generate_secret()
    current_user.totp_secret = encrypt_field(secret)
    db.commit()

    account = current_user.email or current_user.username
    return TotpSetupResponse(
        secret=secret,
        qr_svg=totp_service.qr_svg(secret, account),
        account=account,
    )


@router.post("/totp/enable", response_model=TotpEnableResponse)
async def totp_enable(
    data: TotpEnableRequest,
    request: Request,
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Подтвердить привязку кодом и включить второй фактор."""
    secret = _totp_secret(current_user)
    if not secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сначала начните привязку приложения")
    if not totp_service.verify_code(secret, data.code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Код неверен. Проверьте время на телефоне.")

    codes = totp_service.generate_recovery_codes()
    _store_recovery_hashes(current_user, [totp_service.hash_recovery_code(c) for c in codes])
    current_user.totp_enabled = True
    db.commit()

    AuditRepository(db).record(
        "totp_enabled", "user", current_user.id, current_user.id, None, client_ip(request)
    )
    # Коды показываются ровно один раз: дальше в базе только их хеши.
    return TotpEnableResponse(recovery_codes=codes)


@router.post("/totp/recovery-codes", response_model=TotpEnableResponse)
async def regenerate_recovery_codes(
    data: TotpDisableRequest,
    request: Request,
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Выпустить новый набор резервных кодов взамен старого.

    Нужно, когда коды потеряны: показываются они один раз, а отключить и
    заново привязать фактор нельзя, пока он обязателен для всех. Без этой
    ручки человек оставался бы с работающим приложением, но без запасного
    входа — и один потерянный телефон отрезал бы его от системы.

    Условия те же, что для отключения: пароль и действующий код. Старые коды
    гаснут все разом, иначе выпуск нового набора не уменьшал бы риск.
    """
    if not current_user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Второй фактор не включён")

    _guard_code_attempts(current_user)
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пароль неверен")
    if not _check_second_factor(current_user, data.code):
        _record_code_attempt(current_user.id)
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Код неверен или истёк")
    _clear_code_attempts(current_user.id)

    codes = totp_service.generate_recovery_codes()
    _store_recovery_hashes(current_user, [totp_service.hash_recovery_code(c) for c in codes])
    db.commit()

    AuditRepository(db).record(
        "totp_recovery_reissued", "user", current_user.id, current_user.id,
        "Выпущен новый набор резервных кодов", client_ip(request),
    )
    return TotpEnableResponse(recovery_codes=codes)


@router.post("/totp/disable")
async def totp_disable(
    data: TotpDisableRequest,
    request: Request,
    current_user: SystemUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Отключить второй фактор — под пароль и действующий код."""
    if not current_user.totp_enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Второй фактор не включён")

    # Проверяется до кода: иначе резервный код сгорел бы впустую, а отключить
    # всё равно бы не дали.
    if AppSettingsRepository(db).totp_required():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Второй фактор обязателен для всех — сначала снимите требование "
            "в настройках системы",
        )

    _guard_code_attempts(current_user)
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Пароль неверен")
    if not _check_second_factor(current_user, data.code):
        _record_code_attempt(current_user.id)
        db.commit()  # гасим резервный код, если он подошёл, но что-то ещё не сошлось
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Код неверен или истёк")
    _clear_code_attempts(current_user.id)

    current_user.totp_enabled = False
    current_user.totp_secret = None
    current_user.totp_recovery_hashes = None
    db.commit()

    AuditRepository(db).record(
        "totp_disabled", "user", current_user.id, current_user.id, None, client_ip(request)
    )
    return {"message": "Второй фактор отключён"}


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

    # Смена пароля тоже подтверждается кодом: без этого перехваченная сессия
    # позволила бы сменить пароль в обход второго фактора и закрепиться.
    if current_user.totp_enabled:
        _guard_code_attempts(current_user)
        if not _check_second_factor(current_user, data.totp_code):
            _record_code_attempt(current_user.id)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Код из приложения неверен или истёк",
                headers={"X-Requires-Totp": "1"},
            )
        _clear_code_attempts(current_user.id)

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
    user_repo.save(user)

    AuditRepository(db).record(
        "password_set", "user", user.id, current_user.id,
        f"Администратор задал пароль для {user.username}", client_ip(request),
    )
    return {"message": f"Пароль для «{user.username}» изменён"}


@router.post("/users/{user_id}/totp/reset")
async def admin_reset_totp(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """
    Сбросить второй фактор пользователю — когда телефон потерян,
    а резервные коды не сохранились.

    Отдельно от сброса пароля намеренно: смена пароля не должна молча
    отключать второй фактор, иначе он перестаёт что-либо защищать.
    """
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")

    user.totp_enabled = False
    user.totp_secret = None
    user.totp_recovery_hashes = None
    user_repo.save(user)

    AuditRepository(db).record(
        "totp_reset", "user", user.id, current_user.id,
        f"Администратор сбросил второй фактор для {user.username}", client_ip(request),
    )
    return {"message": f"Второй фактор для «{user.username}» сброшен"}


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
