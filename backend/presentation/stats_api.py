"""Статистика и журнал изменений."""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.application.schemas import (
    AuditLogResponse, DashboardStats, FacultyStats, MonthlyStats,
)
from backend.core.database import get_db
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
    year: int = Query(default_factory=lambda: datetime.now().year, ge=2000, le=2100),
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role),
):
    return StatsRepository(db).monthly(year)


@router.get("/audit", response_model=list[AuditLogResponse])
async def audit_log(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_admin),
):
    """Журнал изменений. Раньше таблица существовала, но в неё никто не писал."""
    return AuditRepository(db).recent(limit=limit)
