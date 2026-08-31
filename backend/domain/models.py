"""
Модели SQLAlchemy.

Что шифруется
-------------
Зашифрованы только поля, опасные при утечке дампа: контакты, дата рождения,
свободные примечания, номера квитанций. Они помечены комментарием
«шифруется» и имеют тип Text.

ФИО, группа, кафедра, курс и все суммы лежат открытыми. Это сознательный
размен: по ним нужно искать, сортировать и суммировать в SQL. Когда
зашифровано было всё, список из двадцати человек поднимал из базы всю таблицу
со всеми платежами и расшифровывал каждое поле в Python — на тысяче записей
такое перестаёт работать.
"""
import enum
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date,
    ForeignKey, Numeric, Enum, Text, Index, func
)
from sqlalchemy.orm import relationship

from backend.core.database import Base
from backend.domain.academic import (
    apply_course_to_group_code, current_course, is_graduated,
)


class UserRole(str, enum.Enum):
    """Роли доступа."""
    ADMIN = "admin"           # всё, включая пользователей и настройки
    OPERATOR = "operator"     # может изменять данные
    VIEWER = "viewer"         # только просмотр


class PaymentStatus(str, enum.Enum):
    """Статус оплаты."""
    PAID = "paid"
    PARTIAL = "partial"
    UNPAID = "unpaid"
    EXEMPT = "exempt"


class SemesterType(str, enum.Enum):
    FALL = "fall"       # осенний
    SPRING = "spring"   # весенний


class SystemUser(Base):
    """Пользователь системы."""
    __tablename__ = "system_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Защита от перебора пароля: счётчик неудач и время снятия блокировки.
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Второй фактор: приложение-аутентификатор (TOTP).
    # Секрет шифруется — по нему генерируются коды, это тот же уровень
    # чувствительности, что и пароль.
    totp_secret = Column(Text, nullable=True)          # шифруется
    totp_enabled = Column(Boolean, default=False, nullable=False)
    # Резервные коды на случай потери телефона: список хешей через запятую,
    # сам список тоже шифруется.
    totp_recovery_hashes = Column(Text, nullable=True)  # шифруется

    def __repr__(self):
        return f"<SystemUser {self.username} ({self.role})>"


class Faculty(Base):
    """Деректорат (институт)."""
    __tablename__ = "faculties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    short_name = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    payers = relationship("Payer", back_populates="faculty")

    def __repr__(self):
        return f"<Faculty {self.short_name or self.name}>"


class PaymentSettings(Base):
    """Суммы взносов по учебным годам."""
    __tablename__ = "payment_settings"

    id = Column(Integer, primary_key=True, index=True)
    academic_year = Column(String(9), nullable=False, unique=True)  # "2025-2026"
    currency = Column(String(10), default="RUB")
    fall_amount = Column(Numeric(10, 2), nullable=False)
    spring_amount = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def total_year_amount(self) -> Decimal:
        return (self.fall_amount or Decimal("0")) + (self.spring_amount or Decimal("0"))

    def __repr__(self):
        return f"<PaymentSettings {self.academic_year}>"


class AppSettings(Base):
    """Настройки приложения ключ-значение."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False)
    value = Column(Text, nullable=True)
    description = Column(String(200), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<AppSettings {self.key}={self.value}>"


class Payer(Base):
    """Плательщик профсоюзных взносов."""
    __tablename__ = "payers"

    id = Column(Integer, primary_key=True, index=True)

    # --- ФИО: открыто, по нему идут поиск и сортировка в SQL ---
    last_name = Column(String(100), nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    middle_name = Column(String(100), nullable=True)

    # --- Контакты: шифруется ---
    email = Column(Text, nullable=True)
    phone = Column(Text, nullable=True)
    telegram = Column(Text, nullable=True)
    vk = Column(Text, nullable=True)
    date_of_birth = Column(Text, nullable=True)  # шифруется, ISO-строка

    # --- Бюджет: открыто, участвует в расчётах ---
    is_budget = Column(Boolean, default=False, nullable=False)
    stipend_amount = Column(Numeric(10, 2), nullable=True)
    budget_percent = Column(Numeric(5, 2), nullable=True)

    # --- Учёба: открыто, по нему фильтруют и группируют ---
    faculty_id = Column(Integer, ForeignKey("faculties.id", ondelete="SET NULL"), nullable=True)
    group_name = Column(String(50), nullable=True, index=True)  # "1-мд-35"
    department = Column(String(100), nullable=True)             # кафедра, "ЦИАТ"

    # Курс вычисляется из года поступления — см. backend/domain/academic.py
    admission_year = Column(Integer, nullable=True, index=True)
    education_level = Column(String(20), nullable=True)
    course = Column(Integer, nullable=True)  # legacy: до перехода на admission_year

    status = Column(Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False, index=True)

    membership_start = Column(Date, nullable=True)
    membership_end = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    notes = Column(Text, nullable=True)  # шифруется

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("system_users.id", ondelete="SET NULL"), nullable=True)

    faculty = relationship("Faculty", back_populates="payers")
    payments = relationship("Payment", back_populates="payer", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_payers_faculty_status", "faculty_id", "status"),
        Index("ix_payers_admission", "admission_year", "education_level"),
        # Сортировка списка идёт по фамилии и имени — составной индекс покрывает её целиком.
        Index("ix_payers_fio", "last_name", "first_name"),
    )

    # Не колонки. total_paid проставляет репозиторий одним агрегатом на запрос —
    # свойство с обходом self.payments давало бы N+1 запрос на каждую строку списка.
    total_paid: Decimal = Decimal("0")
    decryption_failed = False

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return " ".join(p for p in parts if p)

    @property
    def computed_course(self) -> Optional[int]:
        """Курс на сегодня. Растёт сам каждое 1 сентября."""
        return current_course(self.admission_year, self.education_level, self.course)

    @property
    def is_archived(self) -> bool:
        """Срок обучения вышел — запись уходит в архив."""
        return is_graduated(self.admission_year, self.education_level)

    @property
    def group_code(self) -> Optional[str]:
        """Код группы с актуальным курсом: «1-мд-35» на третьем курсе → «3-мд-35»."""
        return apply_course_to_group_code(self.group_name, self.computed_course)

    def __repr__(self):
        return f"<Payer {self.last_name} {self.first_name}>"


class Payment(Base):
    """Платёж."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    payer_id = Column(Integer, ForeignKey("payers.id", ondelete="CASCADE"), nullable=False, index=True)

    # Сумма открыта: по ней считаются итоги и статистика прямо в SQL.
    amount = Column(Numeric(10, 2), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)

    academic_year = Column(String(9), nullable=True)
    semester = Column(Enum(SemesterType), nullable=True)

    receipt_number = Column(Text, nullable=True)  # шифруется
    payment_method = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)           # шифруется

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("system_users.id", ondelete="SET NULL"), nullable=True)

    payer = relationship("Payer", back_populates="payments")

    __table_args__ = (
        Index("ix_payments_academic_year", "academic_year", "semester"),
    )

    decryption_failed = False

    def __repr__(self):
        return f"<Payment {self.amount} payer_id={self.payer_id}>"


class AuditLog(Base):
    """Журнал изменений."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("system_users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)       # create / update / delete / login...
    entity_type = Column(String(50), nullable=False)  # payer / payment / user...
    entity_id = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)             # шифруется: что именно изменилось
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )

    def __repr__(self):
        return f"<AuditLog {self.action} {self.entity_type}#{self.entity_id}>"
