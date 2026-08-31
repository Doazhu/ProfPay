"""Статистика и журнал изменений."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.application.schemas import (
    AuditLogResponse, DashboardStats, FacultyStats, MonthlyStats,
)
from backend.core.database import get_db
from backend.domain.academic import academic_year_label
from backend.domain.models import SystemUser
from backend.infrastructure.repositories import AuditRepository, StatsRepository
from backend.presentation.dependencies import require_admin, require_any_role

router = APIRouter(prefix="/stats", tags=["Статистика"])


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role),
):
    return StatsRepository(db).dashboard()


@router.get("/by-faculty", response_model=list[FacultyStats])
async def by_faculty(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role),
):
    return StatsRepository(db).by_faculty()


@router.get("/monthly", response_model=list[MonthlyStats])
async def monthly(
    academic_year: Optional[str] = Query(
        None, pattern=r"^\d{4}-\d{4}$",
        description="Учебный год «2025-2026». По умолчанию — текущий.",
    ),
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role),
):
    """
    Помесячный сбор за учебный год: сентябрь–август.

    Раньше считалось по календарному году, и осенний семестр выпадал:
    платежи октября 2025 относятся к 2025-2026, но в отчёт «за 2026»
    не попадали, и к концу лета отчёт выглядел пустым.
    """
    return StatsRepository(db).monthly_by_academic_year(academic_year or academic_year_label())


@router.get("/academic-years", response_model=list[str])
async def academic_years(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role),
):
    """
    Учебные годы для выбора в отчётах: те, где есть платежи, плюс текущий.

    Текущий добавляется всегда — иначе в начале сентября, пока никто ещё
    не платил, выбирать было бы нечего.
    """
    current = academic_year_label()
    years = StatsRepository(db).academic_years_with_data()
    if current not in years:
        years.insert(0, current)
    return sorted(years, reverse=True)


@router.get("/audit", response_model=list[AuditLogResponse])
async def audit_log(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Журнал изменений. Раньше таблица существовала, но в неё никто не писал."""
    return AuditRepository(db).recent(limit=limit)
