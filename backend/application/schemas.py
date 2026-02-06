"""
Pydantic schemas for request/response validation.
Provides input sanitization and output encoding for XSS protection.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
import re
import html

from pydantic import BaseModel, Field, field_validator, EmailStr

from backend.domain.models import UserRole, PaymentStatus, SemesterType


# ============== Utilities ==============

def sanitize_string(value: Optional[str]) -> Optional[str]:
    """
    Sanitize string input to prevent XSS.
    Encodes HTML special characters.
    """
    if value is None:
        return None
    # Strip leading/trailing whitespace
    value = value.strip()
    # HTML encode special characters
    return html.escape(value)


def validate_phone(phone: Optional[str]) -> Optional[str]:
    """Validate and normalize phone number."""
    if phone is None:
        return None
    # Remove all non-digit characters except +
    cleaned = re.sub(r'[^\d+]', '', phone)
    if len(cleaned) < 10:
        raise ValueError("Phone number too short")
    return cleaned


# ============== Auth Schemas ==============

class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    """Login request schema."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)

    @field_validator('username')
    @classmethod
    def sanitize_username(cls, v):
        return sanitize_string(v)


class UserCreate(BaseModel):
    """Schema for creating a new user."""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=150)
    role: UserRole = UserRole.VIEWER

    @field_validator('username', 'full_name')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v)


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

    @field_validator('full_name')
    @classmethod
    def sanitize_full_name(cls, v):
        return sanitize_string(v) if v else v


class UserResponse(BaseModel):
    """User response schema."""
    id: int
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


# ============== Faculty Schemas ==============

class FacultyCreate(BaseModel):
    """Schema for creating a faculty."""
    name: str = Field(..., min_length=2, max_length=200)
    short_name: Optional[str] = Field(None, max_length=20)

    @field_validator('name', 'short_name')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v) if v else v


class FacultyUpdate(BaseModel):
    """Schema for updating a faculty."""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    short_name: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None

    @field_validator('name', 'short_name')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v) if v else v


class FacultyResponse(BaseModel):
    """Faculty response schema."""
    id: int
    name: str
    short_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Group Schemas ==============

class GroupCreate(BaseModel):
    """Schema for creating a student group."""
    name: str = Field(..., min_length=1, max_length=50)
    faculty_id: int = Field(..., gt=0)  # Required
    course: Optional[int] = Field(None, ge=1, le=6)

    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v):
        return sanitize_string(v)


class GroupUpdate(BaseModel):
    """Schema for updating a student group."""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    faculty_id: Optional[int] = Field(None, gt=0)
    course: Optional[int] = Field(None, ge=1, le=6)
    is_active: Optional[bool] = None

    @field_validator('name')
    @classmethod
    def sanitize_name(cls, v):
        return sanitize_string(v) if v else v


class GroupResponse(BaseModel):
    """Student group response schema."""
    id: int
    name: str
    faculty_id: int  # Always present now
    course: Optional[int]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GroupWithFacultyResponse(GroupResponse):
    """Group response with faculty info."""
    faculty: FacultyResponse  # Always present


# ============== Payment Settings Schemas ==============

class PaymentSettingsCreate(BaseModel):
    """Schema for creating payment settings."""
    academic_year: str = Field(..., pattern=r'^\d{4}-\d{4}$')  # "2024-2025"
    currency: str = Field(default="RUB", max_length=10)
    fall_amount: Decimal = Field(..., gt=0)
    spring_amount: Decimal = Field(..., gt=0)

    @field_validator('academic_year')
    @classmethod
    def validate_year(cls, v):
        years = v.split('-')
        if int(years[1]) != int(years[0]) + 1:
            raise ValueError("Academic year must be consecutive years")
        return v


class PaymentSettingsUpdate(BaseModel):
    """Schema for updating payment settings."""
    currency: Optional[str] = Field(None, max_length=10)
    fall_amount: Optional[Decimal] = Field(None, gt=0)
    spring_amount: Optional[Decimal] = Field(None, gt=0)
    is_active: Optional[bool] = None


class PaymentSettingsResponse(BaseModel):
    """Payment settings response schema."""
    id: int
    academic_year: str
    currency: str
    fall_amount: Decimal
    spring_amount: Decimal
    total_year_amount: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== App Settings Schemas ==============

class AppSettingUpdate(BaseModel):
    """Schema for updating app settings."""
    value: Optional[str] = None
    description: Optional[str] = Field(None, max_length=200)


class AppSettingResponse(BaseModel):
    """App setting response schema."""
    id: int
    key: str
    value: Optional[str]
    description: Optional[str]
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Payer Schemas ==============

class PayerCreate(BaseModel):
    """Schema for creating a payer."""
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[date] = None
    is_budget: bool = False
    stipend_amount: Optional[Decimal] = Field(None, ge=0)
    budget_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    telegram: Optional[str] = Field(None, max_length=100)
    vk: Optional[str] = Field(None, max_length=100)
    faculty_id: Optional[int] = None  # Optional now
    group_id: Optional[int] = None
    course: Optional[int] = Field(None, ge=1, le=6)
    status: PaymentStatus = PaymentStatus.UNPAID
    membership_start: Optional[date] = None
    membership_end: Optional[date] = None
    notes: Optional[str] = None

    @field_validator('last_name', 'first_name', 'middle_name', 'notes', 'telegram', 'vk')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v) if v else v

    @field_validator('phone')
    @classmethod
    def validate_phone_field(cls, v):
        return validate_phone(v) if v else v


class PayerUpdate(BaseModel):
    """Schema for updating a payer."""
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: Optional[date] = None
    is_budget: Optional[bool] = None
    stipend_amount: Optional[Decimal] = Field(None, ge=0)
    budget_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    telegram: Optional[str] = Field(None, max_length=100)
    vk: Optional[str] = Field(None, max_length=100)
    faculty_id: Optional[int] = None
    group_id: Optional[int] = None
    course: Optional[int] = Field(None, ge=1, le=6)
    status: Optional[PaymentStatus] = None
    membership_start: Optional[date] = None
    membership_end: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

    @field_validator('last_name', 'first_name', 'middle_name', 'notes', 'telegram', 'vk')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v) if v else v

    @field_validator('phone')
    @classmethod
    def validate_phone_field(cls, v):
        return validate_phone(v) if v else v


class PayerResponse(BaseModel):
    """Payer response schema."""
    id: int
    last_name: str
    first_name: str
    middle_name: Optional[str]
    date_of_birth: Optional[date]
    is_budget: bool
    stipend_amount: Optional[Decimal]
    budget_percent: Optional[Decimal]
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    telegram: Optional[str]
    vk: Optional[str]
    faculty_id: Optional[int]
    group_id: Optional[int]
    course: Optional[int]
    status: PaymentStatus
    membership_start: Optional[date]
    membership_end: Optional[date]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    total_paid: Decimal

    class Config:
        from_attributes = True


class PayerListResponse(BaseModel):
    """Payer list item (simplified)."""
    id: int
    full_name: str
    faculty_id: Optional[int]
    group_id: Optional[int]
    status: PaymentStatus
    total_paid: Decimal

    class Config:
        from_attributes = True


class PayerWithDetailsResponse(PayerResponse):
    """Payer response with faculty and group details."""
    faculty: Optional[FacultyResponse]
    group: Optional[GroupResponse]
    payments: List["PaymentResponse"] = []


# ============== Payment Schemas ==============

class PaymentCreate(BaseModel):
    """Schema for creating a payment."""
    payer_id: int
    amount: Decimal = Field(..., gt=0)
    payment_date: date
    academic_year: Optional[str] = Field(None, pattern=r'^\d{4}-\d{4}$')
    semester: Optional[SemesterType] = None
    period_start: Optional[date] = None  # Legacy, optional
    period_end: Optional[date] = None    # Legacy, optional
    receipt_number: Optional[str] = Field(None, max_length=50)
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None

    @field_validator('receipt_number', 'payment_method', 'notes')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v) if v else v


class PaymentUpdate(BaseModel):
    """Schema for updating a payment."""
    amount: Optional[Decimal] = Field(None, gt=0)
    payment_date: Optional[date] = None
    academic_year: Optional[str] = Field(None, pattern=r'^\d{4}-\d{4}$')
    semester: Optional[SemesterType] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    receipt_number: Optional[str] = Field(None, max_length=50)
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None

    @field_validator('receipt_number', 'payment_method', 'notes')
    @classmethod
    def sanitize_fields(cls, v):
        return sanitize_string(v) if v else v


class PaymentResponse(BaseModel):
    """Payment response schema."""
    id: int
    payer_id: int
    amount: Decimal
    payment_date: date
    academic_year: Optional[str]
    semester: Optional[SemesterType]
    period_start: Optional[date]
    period_end: Optional[date]
    receipt_number: Optional[str]
    payment_method: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============== Statistics Schemas ==============

class DashboardStats(BaseModel):
    """Dashboard statistics."""
    total_payers: int
    active_payers: int
    total_debtors: int
    total_paid_amount: Decimal
    paid_count: int
    partial_count: int
    unpaid_count: int
    exempt_count: int


class FacultyStats(BaseModel):
    """Statistics by faculty."""
    faculty_id: int
    faculty_name: str
    total_payers: int
    paid_count: int
    unpaid_count: int
    total_amount: Decimal


class MonthlyStats(BaseModel):
    """Monthly payment statistics."""
    month: str  # "2024-01"
    payments_count: int
    total_amount: Decimal


# ============== Pagination ==============

class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    items: List
    total: int
    page: int
    per_page: int
    pages: int


# Forward reference update
PayerWithDetailsResponse.model_rebuild()
