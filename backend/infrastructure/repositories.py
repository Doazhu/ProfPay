"""
Repository implementations for database operations.
Uses parameterized queries to prevent SQL injection.
Sensitive fields are encrypted/decrypted transparently via the encryption module.
"""
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy import func, and_, or_, Integer, cast, extract
from sqlalchemy.orm import Session, joinedload, object_session

from backend.core.encryption import (
    encrypt_field, decrypt_field,
    encrypt_decimal, decrypt_decimal,
    encrypt_date, decrypt_date,
)
from backend.domain.models import (
    SystemUser, Faculty, StudentGroup, Payer, Payment, AuditLog,
    PaymentStatus, PaymentSettings, AppSettings
)


# ---------------------------------------------------------------------------
# Helpers: encrypt / decrypt Payer & Payment objects in-place
# ---------------------------------------------------------------------------

def _safe_expunge(db: Session, obj) -> None:
    """Detach object from session if attached (prevents dirty flush)."""
    if object_session(obj) is not None:
        db.expunge(obj)


def _encrypt_payer(payer: Payer, key: bytes) -> None:
    """Encrypt sensitive payer fields before DB write."""
    payer.last_name = encrypt_field(payer.last_name, key)
    payer.first_name = encrypt_field(payer.first_name, key)
    payer.middle_name = encrypt_field(payer.middle_name, key)
    payer.date_of_birth = encrypt_date(payer.date_of_birth, key) if not isinstance(payer.date_of_birth, str) else encrypt_field(payer.date_of_birth, key)
    payer.email = encrypt_field(payer.email, key)
    payer.phone = encrypt_field(payer.phone, key)
    payer.telegram = encrypt_field(payer.telegram, key)
    payer.vk = encrypt_field(payer.vk, key)
    payer.stipend_amount = encrypt_decimal(payer.stipend_amount, key) if payer.stipend_amount is not None else None
    payer.budget_percent = encrypt_decimal(payer.budget_percent, key) if payer.budget_percent is not None else None
    payer.notes = encrypt_field(payer.notes, key)


def _decrypt_payer(payer: Payer, key: bytes) -> None:
    """Decrypt sensitive payer fields after DB read."""
    payer.last_name = decrypt_field(payer.last_name, key) or payer.last_name
    payer.first_name = decrypt_field(payer.first_name, key) or payer.first_name
    payer.middle_name = decrypt_field(payer.middle_name, key)
    payer.date_of_birth = decrypt_date(payer.date_of_birth, key)
    payer.email = decrypt_field(payer.email, key)
    payer.phone = decrypt_field(payer.phone, key)
    payer.telegram = decrypt_field(payer.telegram, key)
    payer.vk = decrypt_field(payer.vk, key)
    payer.stipend_amount = decrypt_decimal(payer.stipend_amount, key)
    payer.budget_percent = decrypt_decimal(payer.budget_percent, key)
    payer.notes = decrypt_field(payer.notes, key)


def _encrypt_payment(payment: Payment, key: bytes) -> None:
    """Encrypt sensitive payment fields before DB write."""
    if payment.amount is not None:
        payment.amount = encrypt_decimal(payment.amount, key)
    payment.receipt_number = encrypt_field(payment.receipt_number, key)
    payment.notes = encrypt_field(payment.notes, key)


def _decrypt_payment(payment: Payment, key: bytes) -> None:
    """Decrypt sensitive payment fields after DB read."""
    payment.amount = decrypt_decimal(payment.amount, key)
    payment.receipt_number = decrypt_field(payment.receipt_number, key)
    payment.notes = decrypt_field(payment.notes, key)


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
    """Repository for Payer operations with field-level encryption."""

    def __init__(self, db: Session, encryption_key: bytes):
        self.db = db
        self.key = encryption_key

    def get_by_id(self, payer_id: int) -> Optional[Payer]:
        payer = self.db.query(Payer).options(
            joinedload(Payer.faculty),
            joinedload(Payer.group),
            joinedload(Payer.payments)
        ).filter(Payer.id == payer_id).first()
        if payer:
            payments = list(payer.payments)
            for p in payments:
                _safe_expunge(self.db, p)
            _safe_expunge(self.db, payer)
            _decrypt_payer(payer, self.key)
            for p in payments:
                _decrypt_payment(p, self.key)
        return payer

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
        """Get payers with filters and pagination. Returns (payers, total_count).

        SQL-level filters: faculty_id, group_id, status, is_active
        Python-level: search (on decrypted names/contacts), sort by decrypted name
        """
        query = self.db.query(Payer)

        if active_only:
            query = query.filter(Payer.is_active == True)
        if faculty_id:
            query = query.filter(Payer.faculty_id == faculty_id)
        if group_id:
            query = query.filter(Payer.group_id == group_id)
        if status:
            query = query.filter(Payer.status == status)

        # Load all matching payers with payments (needed for total_paid computation)
        all_payers = query.options(joinedload(Payer.payments)).all()
        # Expunge all before decrypting to prevent dirty flush on later commits
        for payer in all_payers:
            for p in payer.payments:
                _safe_expunge(self.db, p)
            _safe_expunge(self.db, payer)
        for payer in all_payers:
            _decrypt_payer(payer, self.key)
            for p in payer.payments:
                _decrypt_payment(p, self.key)

        if search:
            search_lower = search.lower()
            all_payers = [
                p for p in all_payers
                if search_lower in (p.last_name or "").lower()
                or search_lower in (p.first_name or "").lower()
                or search_lower in (p.middle_name or "").lower()
                or search_lower in (p.email or "").lower()
                or search_lower in (p.phone or "").lower()
            ]

        # Sort by decrypted name
        all_payers.sort(key=lambda p: (p.last_name or "", p.first_name or ""))
        total = len(all_payers)
        payers = all_payers[skip:skip + limit]

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

        all_payers = query.options(joinedload(Payer.payments)).all()
        for payer in all_payers:
            for p in payer.payments:
                _safe_expunge(self.db, p)
            _safe_expunge(self.db, payer)
        for payer in all_payers:
            _decrypt_payer(payer, self.key)
            for p in payer.payments:
                _decrypt_payment(p, self.key)

        all_payers.sort(key=lambda p: (p.last_name or "", p.first_name or ""))
        total = len(all_payers)
        payers = all_payers[skip:skip + limit]

        return payers, total

    def create(self, payer: Payer) -> Payer:
        _encrypt_payer(payer, self.key)
        self.db.add(payer)
        self.db.commit()
        self.db.refresh(payer)
        _safe_expunge(self.db, payer)
        _decrypt_payer(payer, self.key)
        return payer

    def update(self, payer: Payer) -> Payer:
        # Re-attach detached object if needed
        if object_session(payer) is None:
            payer = self.db.merge(payer)
        _encrypt_payer(payer, self.key)
        self.db.commit()
        self.db.refresh(payer)
        _safe_expunge(self.db, payer)
        _decrypt_payer(payer, self.key)
        return payer

    def delete(self, payer_id: int) -> bool:
        payer = self.db.query(Payer).filter(Payer.id == payer_id).first()
        if payer:
            payer.is_active = False  # Soft delete
            self.db.commit()
            return True
        return False


class PaymentRepository:
    """Repository for Payment operations with field-level encryption."""

    def __init__(self, db: Session, encryption_key: bytes):
        self.db = db
        self.key = encryption_key

    def get_by_id(self, payment_id: int) -> Optional[Payment]:
        payment = self.db.query(Payment).filter(Payment.id == payment_id).first()
        if payment:
            _safe_expunge(self.db, payment)
            _decrypt_payment(payment, self.key)
        return payment

    def get_by_payer(self, payer_id: int) -> List[Payment]:
        payments = self.db.query(Payment).filter(
            Payment.payer_id == payer_id
        ).order_by(Payment.payment_date.desc()).all()
        for p in payments:
            _safe_expunge(self.db, p)
        for p in payments:
            _decrypt_payment(p, self.key)
        return payments

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

        payments = query.order_by(Payment.payment_date.desc()).all()
        for p in payments:
            _safe_expunge(self.db, p)
        for p in payments:
            _decrypt_payment(p, self.key)
        return payments

    def create(self, payment: Payment) -> Payment:
        _encrypt_payment(payment, self.key)
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        _safe_expunge(self.db, payment)
        _decrypt_payment(payment, self.key)
        return payment

    def update(self, payment: Payment) -> Payment:
        if object_session(payment) is None:
            payment = self.db.merge(payment)
        _encrypt_payment(payment, self.key)
        self.db.commit()
        self.db.refresh(payment)
        _safe_expunge(self.db, payment)
        _decrypt_payment(payment, self.key)
        return payment

    def delete(self, payment_id: int) -> bool:
        payment = self.db.query(Payment).filter(Payment.id == payment_id).first()
        if payment:
            self.db.delete(payment)
            self.db.commit()
            return True
        return False

    def get_total_by_payer(self, payer_id: int) -> Decimal:
        """Calculate total paid amount — decrypt each amount in Python."""
        payments = self.db.query(Payment).filter(
            Payment.payer_id == payer_id
        ).all()
        for p in payments:
            _safe_expunge(self.db, p)
        total = Decimal("0")
        for p in payments:
            _decrypt_payment(p, self.key)
            if p.amount is not None:
                total += p.amount
        return total


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
    """Repository for statistics queries with encrypted field support."""

    def __init__(self, db: Session, encryption_key: bytes):
        self.db = db
        self.key = encryption_key

    def get_dashboard_stats(self) -> dict:
        """Get overall statistics for dashboard."""
        total_payers = self.db.query(func.count(Payer.id)).filter(Payer.is_active == True).scalar()
        active_payers = total_payers

        status_counts = self.db.query(
            Payer.status,
            func.count(Payer.id)
        ).filter(Payer.is_active == True).group_by(Payer.status).all()

        status_dict = {s: count for s, count in status_counts}

        # Amounts are encrypted — decrypt and sum in Python
        payments = self.db.query(Payment).all()
        for p in payments:
            _safe_expunge(self.db, p)
        total_paid = Decimal("0")
        for p in payments:
            _decrypt_payment(p, self.key)
            if p.amount is not None:
                total_paid += p.amount

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
        # Status counts per faculty — these fields are not encrypted
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

        # Pre-load all payments with payer faculty info for amount aggregation
        all_payments = self.db.query(Payment, Payer.faculty_id).join(Payer).all()
        for payment, _ in all_payments:
            _safe_expunge(self.db, payment)
        faculty_totals: dict[int, Decimal] = defaultdict(Decimal)
        for payment, fac_id in all_payments:
            _decrypt_payment(payment, self.key)
            if payment.amount is not None and fac_id is not None:
                faculty_totals[fac_id] += payment.amount

        stats = []
        for row in results:
            stats.append({
                "faculty_id": row.id,
                "faculty_name": row.name,
                "total_payers": row.total or 0,
                "paid_count": row.paid or 0,
                "unpaid_count": row.unpaid or 0,
                "total_amount": faculty_totals.get(row.id, Decimal("0")),
            })

        return stats

    def get_monthly_stats(self, year: int) -> List[dict]:
        """Get monthly payment statistics for a year."""
        payments = self.db.query(Payment).filter(
            extract('year', Payment.payment_date) == year
        ).all()
        for p in payments:
            _safe_expunge(self.db, p)

        monthly: dict[int, dict] = {}
        for p in payments:
            _decrypt_payment(p, self.key)
            month = p.payment_date.month
            if month not in monthly:
                monthly[month] = {"count": 0, "total": Decimal("0")}
            monthly[month]["count"] += 1
            if p.amount is not None:
                monthly[month]["total"] += p.amount

        return sorted([
            {
                "month": f"{year}-{m:02d}",
                "payments_count": data["count"],
                "total_amount": data["total"],
            }
            for m, data in monthly.items()
        ], key=lambda x: x["month"])


class AuditRepository:
    """Repository for audit log operations."""

    def __init__(self, db: Session, encryption_key: Optional[bytes] = None):
        self.db = db
        self.key = encryption_key

    def create(self, log: AuditLog) -> AuditLog:
        if self.key:
            log.old_values = encrypt_field(log.old_values, self.key)
            log.new_values = encrypt_field(log.new_values, self.key)
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_by_entity(self, entity_type: str, entity_id: int) -> List[AuditLog]:
        logs = self.db.query(AuditLog).filter(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id
        ).order_by(AuditLog.created_at.desc()).all()
        if self.key:
            for log in logs:
                log.old_values = decrypt_field(log.old_values, self.key)
                log.new_values = decrypt_field(log.new_values, self.key)
        return logs
