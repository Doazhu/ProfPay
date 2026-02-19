"""
Authentication API endpoints.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.config import settings
from backend.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, decode_token,
    encrypt_session_key, decrypt_session_key,
)
from backend.core.encryption import (
    generate_master_key, generate_salt, derive_user_key,
    wrap_master_key, unwrap_master_key,
    encrypt_field, decrypt_field, encrypt_decimal, encrypt_date,
)
from backend.application.schemas import (
    LoginRequest, TokenResponse, UserCreate, UserResponse, UserUpdate, PasswordChange
)
from backend.domain.models import SystemUser, UserRole, Payer, Payment, AuditLog
from backend.infrastructure.repositories import UserRepository
from backend.presentation.dependencies import (
    get_current_user, require_admin, get_encryption_key
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


def _migrate_encrypt_existing_data(db: Session, master_key: bytes) -> None:
    """One-time migration: encrypt all existing plaintext data in the DB."""
    # Encrypt payer fields
    payers = db.query(Payer).all()
    for payer in payers:
        # Skip if already encrypted (Fernet tokens start with 'gAAAAA')
        if payer.last_name and not payer.last_name.startswith("gAAAAA"):
            payer.last_name = encrypt_field(payer.last_name, master_key)
            payer.first_name = encrypt_field(payer.first_name, master_key)
            payer.middle_name = encrypt_field(payer.middle_name, master_key)
            payer.date_of_birth = encrypt_date(
                payer.date_of_birth, master_key
            ) if payer.date_of_birth and not isinstance(payer.date_of_birth, str) else encrypt_field(
                str(payer.date_of_birth) if payer.date_of_birth else None, master_key
            )
            payer.email = encrypt_field(payer.email, master_key)
            payer.phone = encrypt_field(payer.phone, master_key)
            payer.telegram = encrypt_field(payer.telegram, master_key)
            payer.vk = encrypt_field(payer.vk, master_key)
            payer.stipend_amount = encrypt_decimal(payer.stipend_amount, master_key) if payer.stipend_amount else None
            payer.budget_percent = encrypt_decimal(payer.budget_percent, master_key) if payer.budget_percent else None
            payer.notes = encrypt_field(payer.notes, master_key)

    # Encrypt payment fields
    payments = db.query(Payment).all()
    for payment in payments:
        if payment.amount and not str(payment.amount).startswith("gAAAAA"):
            payment.amount = encrypt_decimal(payment.amount, master_key) if payment.amount else None
            payment.receipt_number = encrypt_field(payment.receipt_number, master_key)
            payment.notes = encrypt_field(payment.notes, master_key)

    # Encrypt audit log sensitive fields
    audit_logs = db.query(AuditLog).all()
    for log in audit_logs:
        if log.old_values and not log.old_values.startswith("gAAAAA"):
            log.old_values = encrypt_field(log.old_values, master_key)
        if log.new_values and not log.new_values.startswith("gAAAAA"):
            log.new_values = encrypt_field(log.new_values, master_key)

    db.commit()
    print("Encryption migration completed for existing data")


@router.post("/login", response_model=TokenResponse)
async def login(
    response: Response,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT tokens.
    Sets HttpOnly cookies for security.
    On first login after encryption update, migrates existing data.
    """
    user_repo = UserRepository(db)
    user = user_repo.get_by_username(login_data.username)

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # --- Encryption key management ---
    if user.encrypted_master_key is None:
        # First login after encryption update: generate master key & migrate data
        master_key = generate_master_key()
        salt = generate_salt()
        user_key = derive_user_key(login_data.password, salt)
        user.encrypted_master_key = wrap_master_key(master_key, user_key)
        user.key_salt = salt

        # Wrap master key for all other users (they'll need to re-login)
        other_users = db.query(SystemUser).filter(SystemUser.id != user.id).all()
        for other_user in other_users:
            # Other users don't have their key yet — set a flag
            # They'll get it when admin creates/updates them or resets password
            pass

        # Migrate existing plaintext data
        _migrate_encrypt_existing_data(db, master_key)
    else:
        # Normal login: unwrap master key
        salt = user.key_salt
        user_key = derive_user_key(login_data.password, salt)
        master_key = unwrap_master_key(user.encrypted_master_key, user_key)
        if master_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to decrypt encryption key",
            )

    # Update last login
    user.last_login = datetime.utcnow()
    user_repo.update(user)

    # Create tokens
    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = create_refresh_token(str(user.id), user.role.value)

    # Encrypt master key for session cookie
    enc_key_cookie = encrypt_session_key(master_key)

    # Set HttpOnly cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    response.set_cookie(
        key="encryption_key",
        value=enc_key_cookie,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token."""
    refresh_token = request.cookies.get("refresh_token")

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
        )

    payload = decode_token(refresh_token)
    if not payload or payload.type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_repo = UserRepository(db)
    user = user_repo.get_by_id(int(payload.sub))

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Create new tokens
    new_access_token = create_access_token(str(user.id), user.role.value)
    new_refresh_token = create_refresh_token(str(user.id), user.role.value)

    # Update cookies
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )

    # Preserve encryption_key cookie
    enc_key = request.cookies.get("encryption_key")
    if enc_key:
        response.set_cookie(
            key="encryption_key",
            value=enc_key,
            httponly=settings.COOKIE_HTTPONLY,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token
    )


@router.post("/logout")
async def logout(response: Response):
    """Logout user by clearing cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    response.delete_cookie("encryption_key")
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: SystemUser = Depends(get_current_user)
):
    """Get current user information."""
    return current_user


@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
    master_key: bytes = Depends(get_encryption_key),
):
    """Create a new user (admin only). Wraps master encryption key for the new user."""
    user_repo = UserRepository(db)

    # Check if username exists
    if user_repo.get_by_username(user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email exists
    if user_repo.get_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Wrap master key for the new user
    salt = generate_salt()
    user_key = derive_user_key(user_data.password, salt)
    wrapped_key = wrap_master_key(master_key, user_key)

    new_user = SystemUser(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        encrypted_master_key=wrapped_key,
        key_salt=salt,
    )

    return user_repo.create(new_user)


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin)
):
    """List all users (admin only)."""
    user_repo = UserRepository(db)
    return user_repo.get_all(skip=skip, limit=limit)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin)
):
    """Update user (admin only)."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user_data.email is not None:
        user.email = user_data.email
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    return user_repo.update(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Delete a user (admin only). Cannot delete yourself."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    db.delete(user)
    db.commit()


@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    data: PasswordChange,
    response: Response,
    current_user: SystemUser = Depends(get_current_user),
    master_key: bytes = Depends(get_encryption_key),
    db: Session = Depends(get_db),
):
    """
    Change the current user's password.
    Re-wraps the master encryption key with the new password.
    """
    # Verify current password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Текущий пароль неверен",
        )

    # Re-wrap master key with new password
    new_salt = generate_salt()
    new_user_key = derive_user_key(data.new_password, new_salt)
    new_wrapped_key = wrap_master_key(master_key, new_user_key)

    # Update user in DB
    user_repo = UserRepository(db)
    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.encrypted_master_key = new_wrapped_key
    current_user.key_salt = new_salt
    user_repo.update(current_user)

    # Re-issue encryption cookie with new wrapping
    new_enc_key_cookie = encrypt_session_key(master_key)
    response.set_cookie(
        key="encryption_key",
        value=new_enc_key_cookie,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {"message": "Пароль успешно изменён"}
