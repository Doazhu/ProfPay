"""
Database connection and session management.
"""
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from backend.core.config import settings

# Create database engine
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for getting database session.
    Automatically closes session after request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_encryption_migration(db: Session) -> None:
    """
    Migrate column types from specific types (String, Numeric, Date)
    to Text for encrypted storage. Safe to run multiple times.
    """
    inspector = inspect(engine)

    # Payer columns that need to become TEXT
    payer_columns = {
        "last_name": "character varying",
        "first_name": "character varying",
        "middle_name": "character varying",
        "date_of_birth": "date",
        "email": "character varying",
        "phone": "character varying",
        "telegram": "character varying",
        "vk": "character varying",
        "stipend_amount": "numeric",
        "budget_percent": "numeric",
    }

    if inspector.has_table("payers"):
        existing_cols = {c["name"]: c["type"] for c in inspector.get_columns("payers")}
        for col_name, old_type_prefix in payer_columns.items():
            if col_name in existing_cols:
                col_type_str = str(existing_cols[col_name]).lower()
                if old_type_prefix in col_type_str:
                    db.execute(text(
                        f'ALTER TABLE payers ALTER COLUMN {col_name} TYPE TEXT USING {col_name}::TEXT'
                    ))

        # Drop the old name index if it exists
        existing_indexes = [idx["name"] for idx in inspector.get_indexes("payers")]
        if "ix_payers_full_name" in existing_indexes:
            db.execute(text("DROP INDEX IF EXISTS ix_payers_full_name"))
        if "ix_payers_last_name" in existing_indexes:
            db.execute(text("DROP INDEX IF EXISTS ix_payers_last_name"))

    # Payment columns
    payment_columns = {
        "amount": "numeric",
        "receipt_number": "character varying",
    }

    if inspector.has_table("payments"):
        existing_cols = {c["name"]: c["type"] for c in inspector.get_columns("payments")}
        for col_name, old_type_prefix in payment_columns.items():
            if col_name in existing_cols:
                col_type_str = str(existing_cols[col_name]).lower()
                if old_type_prefix in col_type_str:
                    db.execute(text(
                        f'ALTER TABLE payments ALTER COLUMN {col_name} TYPE TEXT USING {col_name}::TEXT'
                    ))

    # SystemUser: add encryption columns if missing
    if inspector.has_table("system_users"):
        existing_cols = {c["name"] for c in inspector.get_columns("system_users")}
        if "encrypted_master_key" not in existing_cols:
            db.execute(text(
                "ALTER TABLE system_users ADD COLUMN encrypted_master_key BYTEA"
            ))
        if "key_salt" not in existing_cols:
            db.execute(text(
                "ALTER TABLE system_users ADD COLUMN key_salt BYTEA"
            ))

    db.commit()
    print("DB schema migration for encryption completed")


def init_db() -> None:
    """Initialize database tables and initial data."""
    from backend.domain import models  # Import models to register them

    Base.metadata.create_all(bind=engine)

    # Create initial data
    try:
        from backend.core.security import get_password_hash
        from backend.domain.models import SystemUser, UserRole

        db = SessionLocal()

        try:
            # Run encryption schema migration
            _run_encryption_migration(db)

            # Check if admin already exists
            existing_admin = db.query(SystemUser).filter(
                SystemUser.username == "admin"
            ).first()

            if not existing_admin:
                admin_password = settings.ADMIN_PASSWORD
                admin = SystemUser(
                    username=settings.ADMIN_USERNAME,
                    email="admin@profpay.local",
                    hashed_password=get_password_hash(admin_password),
                    full_name="Администратор системы",
                    role=UserRole.ADMIN,
                    is_active=True
                )
                db.add(admin)
                db.commit()
                print(f"Admin user created (username: {settings.ADMIN_USERNAME})")
            else:
                print("Admin user already exists")

        except Exception as e:
            db.rollback()
            print(f"Error creating initial data: {e}")
            raise
        finally:
            db.close()

    except Exception as e:
        print(f"Error in init_db: {e}")
        raise
