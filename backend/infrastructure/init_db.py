"""
Database initialization script.
Creates tables and initial data.
"""
from decimal import Decimal
from backend.core.database import engine, SessionLocal, Base
from backend.core.security import get_password_hash
from backend.domain.models import (
    SystemUser, Faculty, StudentGroup, UserRole, PaymentSettings
)


def create_tables():
    """Create all database tables."""
    # Import all models to register them
    from backend.domain import models
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


def create_initial_data():
    """Create initial admin user and sample data."""
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
            print("Admin user created (username: admin, password: admin123)")

        # Create sample faculties if not exist
        faculties_data = [
            ("Факультет информационных технологий", "ФИТ"),
            ("Факультет экономики и управления", "ФЭУ"),
            ("Юридический факультет", "ЮрФак"),
            ("Факультет иностранных языков", "ФИЯ"),
            ("Механико-математический факультет", "МехМат"),
        ]

        for name, short_name in faculties_data:
            existing = db.query(Faculty).filter(Faculty.name == name).first()
            if not existing:
                faculty = Faculty(name=name, short_name=short_name)
                db.add(faculty)

        db.commit()
        print("Initial faculties created!")

        # Create sample groups for first faculty
        fit = db.query(Faculty).filter(Faculty.short_name == "ФИТ").first()
        if fit:
            groups_data = [
                ("ИТ-11", 1), ("ИТ-12", 1),
                ("ИТ-21", 2), ("ИТ-22", 2),
                ("ИТ-31", 3), ("ИТ-32", 3),
                ("ИТ-41", 4),
            ]
            for name, course in groups_data:
                existing = db.query(StudentGroup).filter(
                    StudentGroup.name == name,
                    StudentGroup.faculty_id == fit.id
                ).first()
                if not existing:
                    group = StudentGroup(
                        name=name,
                        faculty_id=fit.id,
                        course=course
                    )
                    db.add(group)

            db.commit()
            print("Sample groups created for ФИТ!")

        # Create payment settings for current academic year
        current_year = "2024-2025"
        existing_settings = db.query(PaymentSettings).filter(
            PaymentSettings.academic_year == current_year
        ).first()

        if not existing_settings:
            settings = PaymentSettings(
                academic_year=current_year,
                currency="RUB",
                fall_amount=Decimal("500.00"),
                spring_amount=Decimal("500.00"),
                is_active=True
            )
            db.add(settings)
            db.commit()
            print(f"Payment settings created for {current_year}!")

    except Exception as e:
        db.rollback()
        print(f"Error creating initial data: {e}")
        raise
    finally:
        db.close()


def init_database():
    """Initialize database with tables and initial data."""
    print("Initializing database...")
    create_tables()
    create_initial_data()
    print("Database initialization complete!")


if __name__ == "__main__":
    init_database()
