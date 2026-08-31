"""
Схемы Pydantic: валидация входа и формат ответов.

HTML на входе намеренно не экранируется. React экранирует всё при отрисовке,
поэтому экранирование ещё и здесь давало двойное — фамилия «О'Коннор»
и сохранялась, и показывалась как «О&#x27;Коннор».
"""
import re
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from backend.domain.academic import EducationLevel
from backend.domain.models import PaymentStatus, SemesterType, UserRole


# ============== Утилиты ==============

def sanitize_string(value: Optional[str]) -> Optional[str]:
    """Обрезать пробелы и выкинуть управляющие символы."""
    if value is None:
        return None
    value = "".join(ch for ch in value if ch in "\n\t" or ord(ch) >= 32)
    return value.strip() or None


def validate_phone(phone: Optional[str]) -> Optional[str]:
    """Нормализовать телефон: только цифры и ведущий плюс."""
    if not phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", phone)
    if len(cleaned) < 10:
        raise ValueError("Телефон слишком короткий")
    return cleaned


# ============== Аутентификация ==============

class LoginRequest(BaseModel):
    """Вход по логину или по почте."""
    username: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=256)
    # Шестизначный код из приложения-аутентификатора либо резервный код
    # вида «abcd-efgh». Нужен, только если второй фактор включён.
    totp_code: Optional[str] = Field(None, max_length=20)

    @field_validator("username")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=256)
    # При включённом втором факторе смена пароля тоже подтверждается кодом:
    # иначе перехваченная сессия позволила бы сменить пароль в обход него.
    totp_code: Optional[str] = Field(None, max_length=20)


class AdminPasswordReset(BaseModel):
    """Администратор задаёт пароль другому пользователю."""
    new_password: str = Field(..., min_length=8, max_length=256)


# ---- Второй фактор ----

class TotpSetupResponse(BaseModel):
    """Данные для привязки приложения-аутентификатора."""
    secret: str          # показываем, если QR отсканировать нечем
    qr_svg: str          # готовый QR — рисуется на сервере
    account: str         # что покажет приложение рядом с кодом


class TotpEnableRequest(BaseModel):
    """Подтверждение привязки: код из приложения."""
    code: str = Field(..., min_length=6, max_length=10)


class TotpEnableResponse(BaseModel):
    """Резервные коды. Показываются один раз — потом только хеши."""
    recovery_codes: List[str]


class TotpDisableRequest(BaseModel):
    """Отключение второго фактора — под пароль и действующий код."""
    password: str = Field(..., min_length=1, max_length=256)
    code: str = Field(..., min_length=6, max_length=20)


class TotpStatus(BaseModel):
    """Включён ли второй фактор и сколько резервных кодов осталось."""
    enabled: bool
    recovery_codes_left: int


# ============== Пользователи ==============

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=256)
    full_name: str = Field(..., min_length=2, max_length=150)
    role: UserRole = UserRole.VIEWER

    @field_validator("full_name")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    @field_validator("full_name")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]
    is_locked: bool = False
    totp_enabled: bool = False


# ============== Деректораты ==============

class FacultyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    short_name: Optional[str] = Field(None, max_length=20)

    @field_validator("name", "short_name")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v


class FacultyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    short_name: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None

    @field_validator("name", "short_name")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v


class FacultyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    short_name: Optional[str]
    is_active: bool
    created_at: datetime


# ============== Суммы взносов ==============

class PaymentSettingsCreate(BaseModel):
    academic_year: str = Field(..., pattern=r"^\d{4}-\d{4}$")
    currency: str = Field(default="RUB", max_length=10)
    fall_amount: Decimal = Field(..., ge=0, le=1_000_000)
    spring_amount: Decimal = Field(..., ge=0, le=1_000_000)

    @field_validator("academic_year")
    @classmethod
    def consecutive_years(cls, v):
        start, end = v.split("-")
        if int(end) != int(start) + 1:
            raise ValueError("Учебный год должен идти двумя подряд идущими годами")
        return v


class PaymentSettingsUpdate(BaseModel):
    currency: Optional[str] = Field(None, max_length=10)
    fall_amount: Optional[Decimal] = Field(None, ge=0, le=1_000_000)
    spring_amount: Optional[Decimal] = Field(None, ge=0, le=1_000_000)
    is_active: Optional[bool] = None


class PaymentSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    academic_year: str
    currency: str
    fall_amount: Decimal
    spring_amount: Decimal
    total_year_amount: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class GroupHint(BaseModel):
    """Ранее введённая группа: подсказка для подстановки кафедры."""
    group_name: str
    faculty_id: Optional[int]
    department: Optional[str]
    education_level: str
    count: int
    latest_admission_year: Optional[int]


class DataEntryContext(BaseModel):
    """
    Что подставится в новую запись из настроек системы.

    Отдельная ручка, потому что форма ввода должна показывать связь
    с настройками: какой сейчас учебный год, какие суммы взносов и какие
    значения по умолчанию для бюджетников. Без этого настройки выглядят
    оторванными от ввода данных.
    """
    academic_year: str                      # "2025-2026"
    academic_year_start: int                # 2025
    fall_amount: Optional[Decimal]
    spring_amount: Optional[Decimal]
    year_total: Optional[Decimal]
    currency: str
    has_payment_settings: bool              # false — суммы на год не заданы
    default_budget_percent: str
    default_stipend_amount: str
    faculties_count: int


class BudgetSettings(BaseModel):
    default_budget_percent: str = "1"
    default_stipend_amount: str = ""


# ============== Плательщики ==============

_PAYER_TEXT_FIELDS = ("last_name", "first_name", "middle_name", "notes",
                      "telegram", "vk", "group_name", "department")


class PayerCreate(BaseModel):
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[date] = None

    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    telegram: Optional[str] = Field(None, max_length=100)
    vk: Optional[str] = Field(None, max_length=200)

    is_budget: bool = False
    stipend_amount: Optional[Decimal] = Field(None, ge=0, le=1_000_000)
    budget_percent: Optional[Decimal] = Field(None, ge=0, le=100)

    faculty_id: Optional[int] = None
    group_name: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    admission_year: Optional[int] = Field(None, ge=1990, le=2100)
    education_level: EducationLevel = EducationLevel.BACHELOR

    status: PaymentStatus = PaymentStatus.UNPAID
    membership_start: Optional[date] = None
    membership_end: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator(*_PAYER_TEXT_FIELDS)
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v):
        return validate_phone(v) if v else None


class PayerUpdate(BaseModel):
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[date] = None

    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    telegram: Optional[str] = Field(None, max_length=100)
    vk: Optional[str] = Field(None, max_length=200)

    is_budget: Optional[bool] = None
    stipend_amount: Optional[Decimal] = Field(None, ge=0, le=1_000_000)
    budget_percent: Optional[Decimal] = Field(None, ge=0, le=100)

    faculty_id: Optional[int] = None
    group_name: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    admission_year: Optional[int] = Field(None, ge=1990, le=2100)
    education_level: Optional[EducationLevel] = None

    status: Optional[PaymentStatus] = None
    membership_start: Optional[date] = None
    membership_end: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=5000)

    @field_validator(*_PAYER_TEXT_FIELDS)
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, v):
        return validate_phone(v) if v else None


class PayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    last_name: str
    first_name: str
    middle_name: Optional[str]
    full_name: str
    date_of_birth: Optional[date]

    email: Optional[str]
    phone: Optional[str]
    telegram: Optional[str]
    vk: Optional[str]

    is_budget: bool
    stipend_amount: Optional[Decimal]
    budget_percent: Optional[Decimal]

    faculty_id: Optional[int]
    group_name: Optional[str]   # как хранится: "1-мд-35"
    group_code: Optional[str]   # с актуальным курсом: "3-мд-35"
    department: Optional[str]
    admission_year: Optional[int]
    education_level: Optional[str]
    course: Optional[int]       # вычисляется из года поступления
    is_archived: bool

    status: PaymentStatus
    membership_start: Optional[date]
    membership_end: Optional[date]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    total_paid: Decimal
    decryption_failed: bool = False


class PayerWithDetailsResponse(PayerResponse):
    faculty: Optional[FacultyResponse] = None
    payments: List["PaymentResponse"] = []


# ============== Платежи ==============

class PaymentCreate(BaseModel):
    payer_id: int = Field(..., gt=0)
    amount: Decimal = Field(..., gt=0, le=1_000_000)
    payment_date: date
    academic_year: Optional[str] = Field(None, pattern=r"^\d{4}-\d{4}$")
    semester: Optional[SemesterType] = None
    receipt_number: Optional[str] = Field(None, max_length=50)
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("receipt_number", "payment_method", "notes")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v

    @field_validator("payment_date")
    @classmethod
    def not_in_future(cls, v):
        if v and v > date.today():
            raise ValueError("Дата платежа не может быть в будущем")
        return v


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0, le=1_000_000)
    payment_date: Optional[date] = None
    academic_year: Optional[str] = Field(None, pattern=r"^\d{4}-\d{4}$")
    semester: Optional[SemesterType] = None
    receipt_number: Optional[str] = Field(None, max_length=50)
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("receipt_number", "payment_method", "notes")
    @classmethod
    def clean(cls, v):
        return sanitize_string(v) if v else v


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payer_id: int
    amount: Decimal
    payment_date: date
    academic_year: Optional[str]
    semester: Optional[SemesterType]
    receipt_number: Optional[str]
    payment_method: Optional[str]
    notes: Optional[str]
    created_at: datetime


# ============== Статистика ==============

class DashboardStats(BaseModel):
    total_payers: int
    active_payers: int
    archived_payers: int
    total_debtors: int
    total_paid_amount: Decimal
    paid_count: int
    partial_count: int
    unpaid_count: int
    exempt_count: int


class FacultyStats(BaseModel):
    faculty_id: int
    faculty_name: str
    total_payers: int
    paid_count: int
    unpaid_count: int
    total_amount: Decimal


class MonthlyStats(BaseModel):
    month: str
    payments_count: int
    total_amount: Decimal


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int]
    action: str
    entity_type: str
    entity_id: Optional[int]
    summary: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


# ============== Постраничная навигация ==============

class PaginatedPayers(BaseModel):
    items: List[PayerResponse]
    total: int
    page: int
    per_page: int
    pages: int


PayerWithDetailsResponse.model_rebuild()
