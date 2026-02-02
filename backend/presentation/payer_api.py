"""
Payer and Payment API endpoints.
"""
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.application.schemas import (
    PayerCreate, PayerUpdate, PayerResponse, PayerWithDetailsResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    FacultyCreate, FacultyUpdate, FacultyResponse,
    GroupCreate, GroupUpdate, GroupResponse,
    PaymentSettingsCreate, PaymentSettingsUpdate, PaymentSettingsResponse,
    PaginatedResponse
)
from backend.domain.models import (
    SystemUser, Payer, Payment, Faculty, StudentGroup, PaymentStatus, PaymentSettings
)
from backend.infrastructure.repositories import (
    PayerRepository, PaymentRepository, FacultyRepository, GroupRepository, PaymentSettingsRepository
)
from backend.presentation.dependencies import (
    get_current_user, require_operator, require_any_role
)


router = APIRouter(tags=["Payers"])


# ============== Faculty Endpoints ==============

@router.get("/faculties", response_model=list[FacultyResponse])
async def list_faculties(
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get all faculties."""
    faculty_repo = FacultyRepository(db)
    return faculty_repo.get_all(active_only=active_only)


@router.post("/faculties", response_model=FacultyResponse)
async def create_faculty(
    faculty_data: FacultyCreate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Create a new faculty."""
    faculty_repo = FacultyRepository(db)
    faculty = Faculty(
        name=faculty_data.name,
        short_name=faculty_data.short_name
    )
    return faculty_repo.create(faculty)


@router.put("/faculties/{faculty_id}", response_model=FacultyResponse)
async def update_faculty(
    faculty_id: int,
    faculty_data: FacultyUpdate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Update a faculty."""
    faculty_repo = FacultyRepository(db)
    faculty = faculty_repo.get_by_id(faculty_id)

    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty not found"
        )

    if faculty_data.name is not None:
        faculty.name = faculty_data.name
    if faculty_data.short_name is not None:
        faculty.short_name = faculty_data.short_name
    if faculty_data.is_active is not None:
        faculty.is_active = faculty_data.is_active

    return faculty_repo.update(faculty)


@router.delete("/faculties/{faculty_id}")
async def delete_faculty(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Soft delete a faculty."""
    faculty_repo = FacultyRepository(db)

    if not faculty_repo.delete(faculty_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty not found"
        )

    return {"message": "Faculty deleted successfully"}


# ============== Group Endpoints ==============

@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(
    faculty_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get all student groups, optionally filtered by faculty."""
    group_repo = GroupRepository(db)
    if faculty_id:
        return group_repo.get_by_faculty(faculty_id, active_only=active_only)
    return group_repo.get_all(active_only=active_only)


@router.post("/groups", response_model=GroupResponse)
async def create_group(
    group_data: GroupCreate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Create a new student group."""
    group_repo = GroupRepository(db)
    faculty_repo = FacultyRepository(db)

    # Validate faculty exists if provided
    if group_data.faculty_id and not faculty_repo.get_by_id(group_data.faculty_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faculty not found"
        )

    group = StudentGroup(
        name=group_data.name,
        faculty_id=group_data.faculty_id,
        course=group_data.course
    )
    return group_repo.create(group)


@router.put("/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    group_data: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Update a student group."""
    group_repo = GroupRepository(db)
    group = group_repo.get_by_id(group_id)

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    if group_data.name is not None:
        group.name = group_data.name
    if group_data.faculty_id is not None:
        group.faculty_id = group_data.faculty_id
    if group_data.course is not None:
        group.course = group_data.course
    if group_data.is_active is not None:
        group.is_active = group_data.is_active

    return group_repo.update(group)


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Soft delete a group."""
    group_repo = GroupRepository(db)

    if not group_repo.delete(group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    return {"message": "Group deleted successfully"}


# ============== Payment Settings Endpoints ==============

@router.get("/payment-settings", response_model=list[PaymentSettingsResponse])
async def list_payment_settings(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get all payment settings."""
    settings_repo = PaymentSettingsRepository(db)
    return settings_repo.get_all()


@router.get("/payment-settings/current", response_model=PaymentSettingsResponse)
async def get_current_payment_settings(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get current active payment settings."""
    settings_repo = PaymentSettingsRepository(db)
    settings = settings_repo.get_current()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active payment settings found"
        )

    return settings


@router.post("/payment-settings", response_model=PaymentSettingsResponse)
async def create_payment_settings(
    settings_data: PaymentSettingsCreate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Create new payment settings for an academic year."""
    settings_repo = PaymentSettingsRepository(db)

    # Check if settings for this year already exist
    existing = settings_repo.get_by_year(settings_data.academic_year)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment settings for {settings_data.academic_year} already exist"
        )

    settings = PaymentSettings(
        academic_year=settings_data.academic_year,
        currency=settings_data.currency,
        fall_amount=settings_data.fall_amount,
        spring_amount=settings_data.spring_amount
    )
    created = settings_repo.create(settings)

    return {
        **created.__dict__,
        "total_year_amount": created.total_year_amount
    }


@router.put("/payment-settings/{settings_id}", response_model=PaymentSettingsResponse)
async def update_payment_settings(
    settings_id: int,
    settings_data: PaymentSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Update payment settings."""
    settings_repo = PaymentSettingsRepository(db)
    settings = settings_repo.get_by_id(settings_id)

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment settings not found"
        )

    if settings_data.currency is not None:
        settings.currency = settings_data.currency
    if settings_data.fall_amount is not None:
        settings.fall_amount = settings_data.fall_amount
    if settings_data.spring_amount is not None:
        settings.spring_amount = settings_data.spring_amount
    if settings_data.is_active is not None:
        settings.is_active = settings_data.is_active

    updated = settings_repo.update(settings)

    return {
        **updated.__dict__,
        "total_year_amount": updated.total_year_amount
    }


@router.delete("/payment-settings/{settings_id}")
async def delete_payment_settings(
    settings_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Delete payment settings."""
    settings_repo = PaymentSettingsRepository(db)

    if not settings_repo.delete(settings_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment settings not found"
        )

    return {"message": "Payment settings deleted successfully"}


# ============== Payer Endpoints ==============

@router.get("/payers", response_model=PaginatedResponse)
async def list_payers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    faculty_id: Optional[int] = None,
    group_id: Optional[int] = None,
    status: Optional[PaymentStatus] = None,
    search: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get paginated list of payers with filters."""
    payer_repo = PayerRepository(db)
    skip = (page - 1) * per_page

    payers, total = payer_repo.get_all(
        skip=skip,
        limit=per_page,
        faculty_id=faculty_id,
        group_id=group_id,
        status=status,
        search=search
    )

    # Convert to response format with computed fields
    items = []
    for payer in payers:
        items.append({
            "id": payer.id,
            "last_name": payer.last_name,
            "first_name": payer.first_name,
            "middle_name": payer.middle_name,
            "full_name": payer.full_name,
            "email": payer.email,
            "phone": payer.phone,
            "telegram": payer.telegram,
            "vk": payer.vk,
            "faculty_id": payer.faculty_id,
            "group_id": payer.group_id,
            "course": payer.course,
            "status": payer.status,
            "membership_start": payer.membership_start,
            "membership_end": payer.membership_end,
            "is_active": payer.is_active,
            "notes": payer.notes,
            "created_at": payer.created_at,
            "updated_at": payer.updated_at,
            "total_paid": payer.total_paid
        })

    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


@router.get("/payers/{payer_id}", response_model=PayerWithDetailsResponse)
async def get_payer(
    payer_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get payer details with faculty, group, and payments."""
    payer_repo = PayerRepository(db)
    payer = payer_repo.get_by_id(payer_id)

    if not payer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payer not found"
        )

    return payer


@router.post("/payers", response_model=PayerResponse)
async def create_payer(
    payer_data: PayerCreate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Create a new payer."""
    payer_repo = PayerRepository(db)
    faculty_repo = FacultyRepository(db)
    group_repo = GroupRepository(db)

    # Validate faculty exists if provided
    if payer_data.faculty_id and not faculty_repo.get_by_id(payer_data.faculty_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Faculty not found"
        )

    # Validate group if provided
    if payer_data.group_id and not group_repo.get_by_id(payer_data.group_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group not found"
        )

    payer = Payer(
        last_name=payer_data.last_name,
        first_name=payer_data.first_name,
        middle_name=payer_data.middle_name,
        email=payer_data.email,
        phone=payer_data.phone,
        telegram=payer_data.telegram,
        vk=payer_data.vk,
        faculty_id=payer_data.faculty_id,
        group_id=payer_data.group_id,
        course=payer_data.course,
        status=payer_data.status,
        membership_start=payer_data.membership_start,
        membership_end=payer_data.membership_end,
        notes=payer_data.notes,
        created_by=current_user.id
    )

    created_payer = payer_repo.create(payer)

    # Return with computed total_paid
    return {
        **created_payer.__dict__,
        "full_name": created_payer.full_name,
        "total_paid": created_payer.total_paid
    }


@router.put("/payers/{payer_id}", response_model=PayerResponse)
async def update_payer(
    payer_id: int,
    payer_data: PayerUpdate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Update a payer."""
    payer_repo = PayerRepository(db)
    payer = payer_repo.get_by_id(payer_id)

    if not payer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payer not found"
        )

    # Update only provided fields
    update_data = payer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payer, field, value)

    updated_payer = payer_repo.update(payer)

    return {
        **updated_payer.__dict__,
        "full_name": updated_payer.full_name,
        "total_paid": updated_payer.total_paid
    }


@router.delete("/payers/{payer_id}")
async def delete_payer(
    payer_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Soft delete a payer."""
    payer_repo = PayerRepository(db)

    if not payer_repo.delete(payer_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payer not found"
        )

    return {"message": "Payer deleted successfully"}


# ============== Debtors Endpoints ==============

@router.get("/debtors", response_model=PaginatedResponse)
async def list_debtors(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get paginated list of debtors (unpaid and partial status)."""
    payer_repo = PayerRepository(db)
    skip = (page - 1) * per_page

    debtors, total = payer_repo.get_debtors(
        skip=skip,
        limit=per_page,
        faculty_id=faculty_id
    )

    items = []
    for payer in debtors:
        items.append({
            "id": payer.id,
            "last_name": payer.last_name,
            "first_name": payer.first_name,
            "middle_name": payer.middle_name,
            "full_name": payer.full_name,
            "email": payer.email,
            "phone": payer.phone,
            "telegram": payer.telegram,
            "vk": payer.vk,
            "faculty_id": payer.faculty_id,
            "group_id": payer.group_id,
            "course": payer.course,
            "status": payer.status,
            "membership_start": payer.membership_start,
            "membership_end": payer.membership_end,
            "is_active": payer.is_active,
            "notes": payer.notes,
            "created_at": payer.created_at,
            "updated_at": payer.updated_at,
            "total_paid": payer.total_paid
        })

    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages
    )


# ============== Payment Endpoints ==============

@router.get("/payers/{payer_id}/payments", response_model=list[PaymentResponse])
async def list_payer_payments(
    payer_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get all payments for a payer."""
    payer_repo = PayerRepository(db)
    payment_repo = PaymentRepository(db)

    if not payer_repo.get_by_id(payer_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payer not found"
        )

    return payment_repo.get_by_payer(payer_id)


@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Create a new payment."""
    payer_repo = PayerRepository(db)
    payment_repo = PaymentRepository(db)

    payer = payer_repo.get_by_id(payment_data.payer_id)
    if not payer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payer not found"
        )

    payment = Payment(
        payer_id=payment_data.payer_id,
        amount=payment_data.amount,
        payment_date=payment_data.payment_date,
        academic_year=payment_data.academic_year,
        semester=payment_data.semester,
        period_start=payment_data.period_start,
        period_end=payment_data.period_end,
        receipt_number=payment_data.receipt_number,
        payment_method=payment_data.payment_method,
        notes=payment_data.notes,
        created_by=current_user.id
    )

    created_payment = payment_repo.create(payment)

    # Update payer status based on payment
    total_paid = payment_repo.get_total_by_payer(payer.id)
    if total_paid > Decimal("0"):
        payer.status = PaymentStatus.PAID  # Simplified logic
        payer_repo.update(payer)

    return created_payment


@router.put("/payments/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Update a payment."""
    payment_repo = PaymentRepository(db)
    payment = payment_repo.get_by_id(payment_id)

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    update_data = payment_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    return payment_repo.update(payment)


@router.delete("/payments/{payment_id}")
async def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_operator)
):
    """Delete a payment."""
    payment_repo = PaymentRepository(db)

    if not payment_repo.delete(payment_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    return {"message": "Payment deleted successfully"}
