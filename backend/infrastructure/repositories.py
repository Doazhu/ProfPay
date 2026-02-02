"""
Repository implementations for database operations.
Uses parameterized queries to prevent SQL injection.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, and_, or_, Integer, cast
from sqlalchemy.orm import Session, joinedload

from backend.domain.models import (
    SystemUser, Faculty, StudentGroup, Payer, Payment, AuditLog,
    PaymentStatus, PaymentSettings, AppSettings
)


class UserRepository:
    """Repository for SystemUser operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[SystemUser]:
        return self.db.query(SystemUser).filter(SystemUser.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[SystemUser]:
        return self.db.query(SystemUser).filter(SystemUser.username == username).first()

    def get_by_email(self, email: str) -> Optional[SystemUser]:
        return self.db.query(SystemUser).filter(SystemUser.email == email).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[SystemUser]:
        return self.db.query(SystemUser).offset(skip).limit(limit).all()

    def create(self, user: SystemUser) -> SystemUser:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: SystemUser) -> SystemUser:
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user_id: int) -> bool:
        user = self.get_by_id(user_id)
        if user:
            self.db.delete(user)
            self.db.commit()
            return True
        return False


class FacultyRepository:
    """Repository for Faculty operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, faculty_id: int) -> Optional[Faculty]:
        return self.db.query(Faculty).filter(Faculty.id == faculty_id).first()

    def get_all(self, active_only: bool = True) -> List[Faculty]:
        query = self.db.query(Faculty)
        if active_only:
            query = query.filter(Faculty.is_active == True)
        return query.order_by(Faculty.name).all()

    def create(self, faculty: Faculty) -> Faculty:
        self.db.add(faculty)
        self.db.commit()
        self.db.refresh(faculty)
        return faculty

    def update(self, faculty: Faculty) -> Faculty:
        self.db.commit()
        self.db.refresh(faculty)
        return faculty

    def delete(self, faculty_id: int) -> bool:
        faculty = self.get_by_id(faculty_id)
        if faculty:
            faculty.is_active = False  # Soft delete
            self.db.commit()
            return True
        return False


class GroupRepository:
    """Repository for StudentGroup operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, group_id: int) -> Optional[StudentGroup]:
        return self.db.query(StudentGroup).filter(StudentGroup.id == group_id).first()

    def get_by_faculty(self, faculty_id: int, active_only: bool = True) -> List[StudentGroup]:
        query = self.db.query(StudentGroup).filter(StudentGroup.faculty_id == faculty_id)
        if active_only:
            query = query.filter(StudentGroup.is_active == True)
        return query.order_by(StudentGroup.course, StudentGroup.name).all()

    def get_all(self, active_only: bool = True) -> List[StudentGroup]:
        query = self.db.query(StudentGroup).options(joinedload(StudentGroup.faculty))
        if active_only:
            query = query.filter(StudentGroup.is_active == True)
        return query.order_by(StudentGroup.faculty_id, StudentGroup.course, StudentGroup.name).all()

    def create(self, group: StudentGroup) -> StudentGroup:
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def update(self, group: StudentGroup) -> StudentGroup:
        self.db.commit()
        self.db.refresh(group)
        return group

    def delete(self, group_id: int) -> bool:
        group = self.get_by_id(group_id)
        if group:
            group.is_active = False  # Soft delete
            self.db.commit()
            return True
        return False


class PayerRepository:
    """Repository for Payer operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payer_id: int) -> Optional[Payer]:
        return self.db.query(Payer).options(
            joinedload(Payer.faculty),
            joinedload(Payer.group),
            joinedload(Payer.payments)
        ).filter(Payer.id == payer_id).first()

    def get_all(
        self,
        skip: int = 0,
        limit: int = 50,
        faculty_id: Optional[int] = None,
        group_id: Optional[int] = None,
        status: Optional[PaymentStatus] = None,
        search: Optional[str] = None,
        active_only: bool = True
    ) -> Tuple[List[Payer], int]:
        """Get payers with filters and pagination. Returns (payers, total_count)."""
        query = self.db.query(Payer)

        if active_only:
            query = query.filter(Payer.is_active == True)

        if faculty_id:
            query = query.filter(Payer.faculty_id == faculty_id)

        if group_id:
            query = query.filter(Payer.group_id == group_id)

        if status:
            query = query.filter(Payer.status == status)

        if search:
            # Safe search with parameterized query
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Payer.last_name.ilike(search_term),
                    Payer.first_name.ilike(search_term),
                    Payer.middle_name.ilike(search_term),
                    Payer.email.ilike(search_term),
                    Payer.phone.ilike(search_term)
                )
            )

        total = query.count()
        payers = query.order_by(Payer.last_name, Payer.first_name).offset(skip).limit(limit).all()

        return payers, total

    def get_debtors(
        self,
        skip: int = 0,
        limit: int = 50,
        faculty_id: Optional[int] = None
    ) -> Tuple[List[Payer], int]:
        """Get payers with unpaid or partial status."""
        query = self.db.query(Payer).filter(
            Payer.is_active == True,
            Payer.status.in_([PaymentStatus.UNPAID, PaymentStatus.PARTIAL])
        )

        if faculty_id:
            query = query.filter(Payer.faculty_id == faculty_id)

        total = query.count()
        payers = query.order_by(Payer.last_name, Payer.first_name).offset(skip).limit(limit).all()

        return payers, total

    def create(self, payer: Payer) -> Payer:
        self.db.add(payer)
        self.db.commit()
        self.db.refresh(payer)
        return payer

    def update(self, payer: Payer) -> Payer:
        self.db.commit()
        self.db.refresh(payer)
        return payer

    def delete(self, payer_id: int) -> bool:
        payer = self.db.query(Payer).filter(Payer.id == payer_id).first()
        if payer:
            payer.is_active = False  # Soft delete
            self.db.commit()
            return True
        return False


class PaymentRepository:
    """Repository for Payment operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payment_id: int) -> Optional[Payment]:
        return self.db.query(Payment).filter(Payment.id == payment_id).first()

    def get_by_payer(self, payer_id: int) -> List[Payment]:
        return self.db.query(Payment).filter(
            Payment.payer_id == payer_id
        ).order_by(Payment.payment_date.desc()).all()

    def get_by_period(
        self,
        start_date: date,
        end_date: date,
        faculty_id: Optional[int] = None
    ) -> List[Payment]:
        query = self.db.query(Payment).filter(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date
        )

        if faculty_id:
            query = query.join(Payer).filter(Payer.faculty_id == faculty_id)

        return query.order_by(Payment.payment_date.desc()).all()

    def create(self, payment: Payment) -> Payment:
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def update(self, payment: Payment) -> Payment:
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def delete(self, payment_id: int) -> bool:
        payment = self.get_by_id(payment_id)
        if payment:
            self.db.delete(payment)
            self.db.commit()
            return True
        return False

    def get_total_by_payer(self, payer_id: int) -> Decimal:
        result = self.db.query(func.sum(Payment.amount)).filter(
            Payment.payer_id == payer_id
        ).scalar()
        return result or Decimal("0")


class PaymentSettingsRepository:
    """Repository for PaymentSettings operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, settings_id: int) -> Optional[PaymentSettings]:
        return self.db.query(PaymentSettings).filter(PaymentSettings.id == settings_id).first()

    def get_by_year(self, academic_year: str) -> Optional[PaymentSettings]:
        return self.db.query(PaymentSettings).filter(
            PaymentSettings.academic_year == academic_year
        ).first()

    def get_current(self) -> Optional[PaymentSettings]:
        """Get the current active payment settings."""
        return self.db.query(PaymentSettings).filter(
            PaymentSettings.is_active == True
        ).order_by(PaymentSettings.academic_year.desc()).first()

    def get_all(self, active_only: bool = False) -> List[PaymentSettings]:
        query = self.db.query(PaymentSettings)
        if active_only:
            query = query.filter(PaymentSettings.is_active == True)
        return query.order_by(PaymentSettings.academic_year.desc()).all()

    def create(self, settings: PaymentSettings) -> PaymentSettings:
        self.db.add(settings)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def update(self, settings: PaymentSettings) -> PaymentSettings:
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def delete(self, settings_id: int) -> bool:
        settings = self.get_by_id(settings_id)
        if settings:
            self.db.delete(settings)
            self.db.commit()
            return True
        return False


class AppSettingsRepository:
    """Repository for AppSettings operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_key(self, key: str) -> Optional[AppSettings]:
        return self.db.query(AppSettings).filter(AppSettings.key == key).first()

    def get_all(self) -> List[AppSettings]:
        return self.db.query(AppSettings).order_by(AppSettings.key).all()

    def set(self, key: str, value: str, description: str = None) -> AppSettings:
        """Set a setting value, creating it if it doesn't exist."""
        setting = self.get_by_key(key)
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = AppSettings(key=key, value=value, description=description)
            self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting


class StatsRepository:
    """Repository for statistics queries."""

    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_stats(self) -> dict:
        """Get overall statistics for dashboard."""
        total_payers = self.db.query(func.count(Payer.id)).filter(Payer.is_active == True).scalar()
        active_payers = total_payers  # Same as total for active

        status_counts = self.db.query(
            Payer.status,
            func.count(Payer.id)
        ).filter(Payer.is_active == True).group_by(Payer.status).all()

        status_dict = {status: count for status, count in status_counts}

        total_paid = self.db.query(func.sum(Payment.amount)).scalar() or Decimal("0")

        return {
            "total_payers": total_payers or 0,
            "active_payers": active_payers or 0,
            "total_debtors": status_dict.get(PaymentStatus.UNPAID, 0) + status_dict.get(PaymentStatus.PARTIAL, 0),
            "total_paid_amount": total_paid,
            "paid_count": status_dict.get(PaymentStatus.PAID, 0),
            "partial_count": status_dict.get(PaymentStatus.PARTIAL, 0),
            "unpaid_count": status_dict.get(PaymentStatus.UNPAID, 0),
            "exempt_count": status_dict.get(PaymentStatus.EXEMPT, 0),
        }

    def get_faculty_stats(self) -> List[dict]:
        """Get statistics grouped by faculty."""
        results = self.db.query(
            Faculty.id,
            Faculty.name,
            func.count(Payer.id).label('total'),
            func.sum(cast(Payer.status == PaymentStatus.PAID, Integer)).label('paid'),
            func.sum(cast(Payer.status == PaymentStatus.UNPAID, Integer)).label('unpaid'),
        ).outerjoin(Payer, and_(
            Payer.faculty_id == Faculty.id,
            Payer.is_active == True
        )).group_by(Faculty.id, Faculty.name).all()

        stats = []
        for row in results:
            # Get total amount for faculty
            total_amount = self.db.query(func.sum(Payment.amount)).join(Payer).filter(
                Payer.faculty_id == row.id
            ).scalar() or Decimal("0")

            stats.append({
                "faculty_id": row.id,
                "faculty_name": row.name,
                "total_payers": row.total or 0,
                "paid_count": row.paid or 0,
                "unpaid_count": row.unpaid or 0,
                "total_amount": total_amount,
            })

        return stats

    def get_monthly_stats(self, year: int) -> List[dict]:
        """Get monthly payment statistics for a year."""
        from sqlalchemy import extract

        results = self.db.query(
            extract('month', Payment.payment_date).label('month'),
            func.count(Payment.id).label('count'),
            func.sum(Payment.amount).label('total')
        ).filter(
            extract('year', Payment.payment_date) == year
        ).group_by(
            extract('month', Payment.payment_date)
        ).order_by('month').all()

        return [
            {
                "month": f"{year}-{int(row.month):02d}",
                "payments_count": row.count,
                "total_amount": row.total or Decimal("0"),
            }
            for row in results
        ]


class AuditRepository:
    """Repository for audit log operations."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, log: AuditLog) -> AuditLog:
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_by_entity(self, entity_type: str, entity_id: int) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id
        ).order_by(AuditLog.created_at.desc()).all()
