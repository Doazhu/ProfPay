"""
Учебный календарь: текущий учебный год, расчёт курса, выпуск в архив.

Курс нигде не хранится как «замороженное» число — он вычисляется из года
поступления и текущей даты, поэтому 1 сентября все переходят на курс выше
сами, без фоновых задач и без правки базы.
"""
from __future__ import annotations

import enum
import re
from datetime import date
from typing import Optional

# Учебный год начинается 1 сентября: с сентября 2025 по август 2026 — это 2025-2026.
ACADEMIC_YEAR_START_MONTH = 9


class EducationLevel(str, enum.Enum):
    """Уровень образования — от него зависит, сколько курсов до выпуска."""
    BACHELOR = "bachelor"        # бакалавриат — 4 года
    SPECIALIST = "specialist"    # специалитет — 5 лет
    MASTER = "master"            # магистратура — 2 года


DURATION_YEARS: dict[EducationLevel, int] = {
    EducationLevel.BACHELOR: 4,
    EducationLevel.SPECIALIST: 5,
    EducationLevel.MASTER: 2,
}

DEFAULT_EDUCATION_LEVEL = EducationLevel.BACHELOR

# Человекочитаемые подписи для интерфейса и выгрузки в Excel.
LEVEL_LABELS: dict[EducationLevel, str] = {
    EducationLevel.BACHELOR: "Бакалавриат",
    EducationLevel.SPECIALIST: "Специалитет",
    EducationLevel.MASTER: "Магистратура",
}


def parse_level(value: Optional[str]) -> EducationLevel:
    """Привести значение из БД к EducationLevel, с откатом на бакалавриат."""
    if not value:
        return DEFAULT_EDUCATION_LEVEL
    try:
        return EducationLevel(value)
    except ValueError:
        return DEFAULT_EDUCATION_LEVEL


def duration_years(level: Optional[str]) -> int:
    """Сколько курсов длится обучение на этом уровне."""
    return DURATION_YEARS[parse_level(level)]


def academic_year_start(today: Optional[date] = None) -> int:
    """Год начала текущего учебного года: 2025 для учебного года 2025-2026."""
    today = today or date.today()
    return today.year if today.month >= ACADEMIC_YEAR_START_MONTH else today.year - 1


def academic_year_label(today: Optional[date] = None) -> str:
    """Текущий учебный год строкой: "2025-2026"."""
    year = academic_year_start(today)
    return f"{year}-{year + 1}"


def raw_course(admission_year: Optional[int], today: Optional[date] = None) -> Optional[int]:
    """
    Номер курса без ограничения сверху: 1 в год поступления, дальше +1 каждый сентябрь.

    Может вернуть число больше срока обучения (человек уже выпустился) или
    ноль и меньше (поступление ещё впереди).
    """
    if admission_year is None:
        return None
    return academic_year_start(today) - admission_year + 1


def is_graduated(
    admission_year: Optional[int],
    level: Optional[str],
    today: Optional[date] = None,
) -> bool:
    """Обучение закончилось — человек уходит в архив."""
    course = raw_course(admission_year, today)
    if course is None:
        return False
    return course > duration_years(level)


def current_course(
    admission_year: Optional[int],
    level: Optional[str],
    stored_course: Optional[int] = None,
    today: Optional[date] = None,
) -> Optional[int]:
    """
    Курс для показа в интерфейсе.

    Ограничен сроком обучения: у выпускника остаётся его последний курс,
    а не растущее до бесконечности число. Для старых записей без года
    поступления возвращается то, что лежит в БД.
    """
    course = raw_course(admission_year, today)
    if course is None:
        return stored_course
    return max(1, min(course, duration_years(level)))


def admission_year_for_course(
    course: int,
    today: Optional[date] = None,
) -> int:
    """Обратный расчёт: на каком курсе человек сейчас → когда он поступил."""
    return academic_year_start(today) - (course - 1)


def apply_course_to_group_code(group_code: Optional[str], course: Optional[int]) -> Optional[str]:
    """
    Подставить актуальный курс в код группы: "1-мд-35" + курс 3 → "3-мд-35".

    Первая цифра кода группы и есть курс, поэтому она пересчитывается вместе с ним.
    Код без ведущей цифры возвращается как есть.
    """
    if not group_code or course is None:
        return group_code
    if not re.match(r"^\d", group_code):
        return group_code
    return re.sub(r"^\d+", str(course), group_code, count=1)
