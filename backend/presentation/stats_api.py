"""
Statistics and Reports API endpoints.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.application.schemas import (
    DashboardStats, FacultyStats, MonthlyStats
)
from backend.domain.models import SystemUser
from backend.infrastructure.repositories import StatsRepository
from backend.presentation.dependencies import require_any_role


router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get overall dashboard statistics."""
    stats_repo = StatsRepository(db)
    return stats_repo.get_dashboard_stats()


@router.get("/by-faculty", response_model=list[FacultyStats])
async def get_faculty_stats(
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get statistics grouped by faculty."""
    stats_repo = StatsRepository(db)
    return stats_repo.get_faculty_stats()


@router.get("/monthly", response_model=list[MonthlyStats])
async def get_monthly_stats(
    year: int = Query(default_factory=lambda: datetime.now().year),
    db: Session = Depends(get_db),
    current_user: SystemUser = Depends(require_any_role)
):
    """Get monthly payment statistics for a year."""
    stats_repo = StatsRepository(db)
    return stats_repo.get_monthly_stats(year)
