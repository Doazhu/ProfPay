"""
Database connection and session management.
"""
from sqlalchemy import create_engine
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


def init_db() -> None:
    """Initialize database tables and initial data."""
    from backend.domain import models  # Import models to register them
    
    Base.metadata.create_all(bind=engine)
    
    # Create initial data
    try:
        from backend.core.security import get_password_hash
        from backend.domain.models import SystemUser, Faculty, StudentGroup, UserRole, PaymentSettings
        from decimal import Decimal
        
        db = SessionLocal()
        
        try:
            # Check if admin already exists
            existing_admin = db.query(SystemUser).filter(
                SystemUser.username == "admin"
            ).first()

            if not existing_admin:
                # Create admin user
                admin = SystemUser(
                    username="admin",
                    email="admin@profpay.local",
                    hashed_password=get_password_hash("admin123"),
                    full_name="Администратор системы",
                    role=UserRole.ADMIN,
                    is_active=True
                )
                db.add(admin)
                db.commit()
                print("✅ Admin user created (username: admin, password: admin123)")
            else:
                print("ℹ️  Admin user already exists")
                
        except Exception as e:
            db.rollback()
            print(f"❌ Error creating initial data: {e}")
            raise
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Error in init_db: {e}")
        raise
