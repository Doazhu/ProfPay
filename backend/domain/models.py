"""
SQLAlchemy models for the ProfPay application.
"""
import enum
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date,
    ForeignKey, Numeric, Enum, Text, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class UserRole(str, enum.Enum):
    """User roles for access control."""
    ADMIN = "admin"           # Full access
    OPERATOR = "operator"     # Can edit data
    VIEWER = "viewer"         # Read-only access


class PaymentStatus(str, enum.Enum):
    """Payment status for payers."""
    PAID = "paid"             # Fully paid
    PARTIAL = "partial"       # Partially paid
    UNPAID = "unpaid"         # Not paid (debtor)
    EXEMPT = "exempt"         # Exempt from payment


class SemesterType(str, enum.Enum):
    """Semester type."""
    FALL = "fall"       # Осенний семестр
    SPRING = "spring"   # Весенний семестр


class SystemUser(Base):
    """System user for authentication."""
    __tablename__ = "system_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<SystemUser {self.username} ({self.role})>"


class Faculty(Base):
    """Faculty/Institute of the university."""
    __tablename__ = "faculties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    short_name = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    groups = relationship("StudentGroup", back_populates="faculty")
    payers = relationship("Payer", back_populates="faculty")

    def __repr__(self):
        return f"<Faculty {self.short_name or self.name}>"


class StudentGroup(Base):
    """Student group within a faculty."""
    __tablename__ = "student_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=False)  # Required
    course = Column(Integer, nullable=True)  # 1-6 course, optional
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    faculty = relationship("Faculty", back_populates="groups")
    payers = relationship("Payer", back_populates="group")

    # Index for faster queries
    __table_args__ = (
        Index("ix_student_groups_faculty_course", "faculty_id", "course"),
    )

    def __repr__(self):
        return f"<StudentGroup {self.name}>"


class PaymentSettings(Base):
    """Payment settings for years and semesters."""
    __tablename__ = "payment_settings"

    id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String(9), nullable=False, unique=True)  # "2024-2025"
    currency = Column(String(10), default="RUB")
    fall_amount = Column(Numeric(10, 2), nullable=False)  # Осенний семестр
    spring_amount = Column(Numeric(10, 2), nullable=False)  # Весенний семестр
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def total_year_amount(self) -> Decimal:
        """Total amount for the year."""
        return (self.fall_amount or Decimal("0")) + (self.spring_amount or Decimal("0"))

    def __repr__(self):
        return f"<PaymentSettings {self.academic_year}>"


class AppSettings(Base):
    """Application-wide settings."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    description = Column(String(200), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<AppSettings {self.key}={self.value}>"


class Payer(Base):
    """Trade union payer (student/employee)."""
    __tablename__ = "payers"

    id = Column(Integer, primary_key=True, index=True)

    # Personal info
    last_name = Column(String(100), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)
    date_of_birth = Column(Date, nullable=True)

    # Contact info
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    telegram = Column(String(100), nullable=True)  # Telegram username
    vk = Column(String(100), nullable=True)  # VK link

    # Budget student info
    is_budget = Column(Boolean, default=False)
    stipend_amount = Column(Numeric(10, 2), nullable=True)
    budget_percent = Column(Numeric(5, 2), nullable=True)

    # University info - all optional now
    faculty_id = Column(Integer, ForeignKey("faculties.id"), nullable=True)  # Optional
    group_id = Column(Integer, ForeignKey("student_groups.id"), nullable=True)
    course = Column(Integer, nullable=True)  # Course year (1-6)

    # Payment status
    status = Column(Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False, index=True)

    # Membership
    membership_start = Column(Date, nullable=True)
    membership_end = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("system_users.id"), nullable=True)

    # Relationships
    faculty = relationship("Faculty", back_populates="payers")
    group = relationship("StudentGroup", back_populates="payers")
    payments = relationship("Payment", back_populates="payer", cascade="all, delete-orphan")

    # Indexes for search
    __table_args__ = (
        Index("ix_payers_full_name", "last_name", "first_name"),
        Index("ix_payers_faculty_status", "faculty_id", "status"),
    )

    @property
    def full_name(self) -> str:
        """Get full name of the payer."""
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return " ".join(parts)

    @property
    def total_paid(self) -> Decimal:
        """Calculate total paid amount."""
        return sum(p.amount for p in self.payments if p.amount) or Decimal("0")

    def __repr__(self):
        return f"<Payer {self.full_name}>"


class Payment(Base):
    """Payment record for a payer."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payer_id = Column(Integer, ForeignKey("payers.id"), nullable=False)

    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)

    # Semester info
    academic_year = Column(String(9), nullable=True)  # "2024-2025"
    semester = Column(Enum(SemesterType), nullable=True)  # fall/spring

    # Legacy period fields (optional, for backwards compatibility)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)

    # Optional info
    receipt_number = Column(String(50), nullable=True)
    payment_method = Column(String(50), nullable=True)  # cash, card, transfer
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(Integer, ForeignKey("system_users.id"), nullable=True)

    # Relationships
    payer = relationship("Payer", back_populates="payments")

    # Index for period queries
    __table_args__ = (
        Index("ix_payments_academic_year", "academic_year", "semester"),
    )

    def __repr__(self):
        return f"<Payment {self.amount} for payer_id={self.payer_id}>"


class AuditLog(Base):
    """Audit log for tracking changes."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("system_users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # create, update, delete, login, etc.
    entity_type = Column(String(50), nullable=False)  # payer, payment, user, etc.
    entity_id = Column(Integer, nullable=True)
    old_values = Column(Text, nullable=True)  # JSON
    new_values = Column(Text, nullable=True)  # JSON
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AuditLog {self.action} on {self.entity_type}>"
