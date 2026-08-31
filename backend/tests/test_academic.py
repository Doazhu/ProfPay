"""
Расчёт курса и уход в архив.

Проверки построены на данных, которые реально были в системе: три плательщика
ИИТА с группами «1-мд-10», «2-мд-35» и «1-мд-35», заведённые в учебном году
2025-2026.
"""
from datetime import date

import pytest

from backend.domain.academic import (
    academic_year_label, academic_year_start, admission_year_for_course,
    apply_course_to_group_code, current_course, duration_years, is_graduated,
)


@pytest.mark.parametrize("today,expected", [
    (date(2026, 8, 31), "2025-2026"),   # 31 августа — ещё прошлый учебный год
    (date(2026, 9, 1), "2026-2027"),    # 1 сентября — уже новый
    (date(2026, 1, 15), "2025-2026"),
])
def test_academic_year_boundary(today, expected):
    assert academic_year_label(today) == expected


def test_course_grows_every_september():
    """Гом Павел, 1 курс в 2025-2026 — курс поднимается сам, без фоновых задач."""
    admission = 2025
    assert current_course(admission, "bachelor", None, date(2026, 8, 31)) == 1
    assert current_course(admission, "bachelor", None, date(2026, 9, 1)) == 2
    assert current_course(admission, "bachelor", None, date(2028, 9, 1)) == 4


@pytest.mark.parametrize("level,years", [
    ("bachelor", 4), ("specialist", 5), ("master", 2),
])
def test_duration_by_level(level, years):
    assert duration_years(level) == years


@pytest.mark.parametrize("level,graduates_in", [
    ("bachelor", 2029),     # поступил 2025, 4 года -> выпуск к 2029-2030
    ("specialist", 2030),
    ("master", 2027),
])
def test_graduation_year(level, graduates_in):
    assert not is_graduated(2025, level, date(graduates_in - 1, 9, 1))
    assert is_graduated(2025, level, date(graduates_in, 9, 1))


def test_course_does_not_grow_past_graduation():
    """У выпускника остаётся его последний курс, а не бесконечно растущее число."""
    assert current_course(2025, "master", None, date(2035, 9, 1)) == 2


def test_admission_year_round_trip():
    """Так миграция восстанавливает год поступления из старого поля course."""
    for course in (1, 2, 3, 4):
        year = admission_year_for_course(course, date(2026, 8, 31))
        assert current_course(year, "bachelor", None, date(2026, 8, 31)) == course


@pytest.mark.parametrize("code,course,expected", [
    ("1-мд-35", 3, "3-мд-35"),      # первая цифра кода группы — это курс
    ("1-мд-10", 4, "4-мд-10"),
    ("мд-35", 3, "мд-35"),          # без ведущей цифры — не трогаем
    (None, 3, None),
])
def test_group_code_follows_course(code, course, expected):
    assert apply_course_to_group_code(code, course) == expected


def test_legacy_record_without_admission_year():
    """Старая запись, которой год поступления так и не проставили."""
    assert current_course(None, "bachelor", stored_course=2) == 2
    assert not is_graduated(None, "bachelor")


def test_academic_year_start_is_int():
    assert isinstance(academic_year_start(date(2026, 9, 1)), int)
