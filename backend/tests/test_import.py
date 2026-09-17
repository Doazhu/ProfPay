"""
Загрузка плательщиков из таблицы Excel.

Проверяется то, из-за чего загрузка может тихо испортить данные: разбор кода
группы, правдоподобность даты рождения, расчёт года поступления и защита от
повторной загрузки того же файла.
"""
from datetime import date

import openpyxl
import pytest

from backend.domain.academic import EducationLevel
from backend.domain.models import Payer
from backend.tools import import_payers

TODAY = date(2026, 9, 17)   # учебный год 2026-2027 уже начался


def make_file(tmp_path, rows, headers=("п/б", "ФИО", "институт", "группа", "дата рождения", "б/вн")):
    """Собрать таблицу такого же вида, какой присылает профком."""
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(list(headers))
    for index, row in enumerate(rows, start=1):
        sheet.append([index, *row])
    path = tmp_path / "выгрузка.xlsx"
    workbook.save(path)
    return str(path)


# ---------------------------------------------------------------------------
# Разбор кода группы
# ---------------------------------------------------------------------------

def test_group_code_is_lowercased():
    """
    Форма добавления пишет буквы строчными. Без приведения «1-МД-7» и «1-мд-7»
    стали бы разными группами в подсказках и в разбивке по группам.
    """
    name, course, level, warning = import_payers._parse_group("1-МД-7")
    assert (name, course, warning) == ("1-мд-7", 1, None)
    assert level == EducationLevel.BACHELOR.value


def test_master_groups_are_recognised():
    _, _, level, _ = import_payers._parse_group("1-МГ-2")
    assert level == EducationLevel.MASTER.value


def test_group_number_may_have_a_letter():
    """В таблице встречается «2-ТД-17с» — буква на конце номера не ошибка."""
    name, course, _, warning = import_payers._parse_group("2-ТД-17с")
    assert (name, course, warning) == ("2-тд-17с", 2, None)


def test_spaces_and_long_dash_are_tolerated():
    assert import_payers._parse_group(" 3 – ИД – 6 ")[0] == "3-ид-6"


@pytest.mark.parametrize("raw", ["?", "413", "", None, "мд-7"])
def test_unreadable_group_is_reported_not_guessed(raw):
    """Догадываться о группе нельзя: лучше пустое поле и строка в отчёте."""
    name, course, level, warning = import_payers._parse_group(raw)
    assert (name, course, level) == (None, None, None)
    assert warning


def test_course_beyond_duration_raises_the_level():
    """
    Пятикурсник не может быть на четырёхлетней программе. Если оставить
    бакалавриат, запись уйдёт в архив прямо при загрузке и пропадёт
    из списков, должников и статистики.
    """
    _, course, level, warning = import_payers._parse_group("5-ГВ-26")
    assert course == 5
    assert level == EducationLevel.SPECIALIST.value
    assert "проверьте" in warning


# ---------------------------------------------------------------------------
# Дата рождения и форма оплаты
# ---------------------------------------------------------------------------

def test_plausible_birth_date_is_kept():
    parsed, warning = import_payers._parse_birth(date(2007, 10, 3), TODAY)
    assert parsed == date(2007, 10, 3)
    assert warning is None


def test_implausible_birth_date_is_dropped():
    """
    Excel подставляет текущий год, если ввели только день и месяц. Записать
    такую дату в карточку хуже, чем оставить поле пустым: ошибка перестанет
    быть заметной.
    """
    parsed, warning = import_payers._parse_birth(date(2026, 2, 19), TODAY)
    assert parsed is None
    assert "неправдоподобна" in warning


def test_birth_date_as_text_is_parsed():
    parsed, _ = import_payers._parse_birth("15.11.2006", TODAY)
    assert parsed == date(2006, 11, 15)


@pytest.mark.parametrize("raw,expected", [("б", True), ("Б", True), ("вн", False), ("ВН.", False)])
def test_budget_mark(raw, expected):
    assert import_payers._parse_budget(raw)[0] is expected


def test_unknown_budget_mark_falls_back_and_warns():
    is_budget, warning = import_payers._parse_budget("хз")
    assert is_budget is False
    assert warning


# ---------------------------------------------------------------------------
# Чтение файла целиком
# ---------------------------------------------------------------------------

def test_reads_rows_and_splits_the_name(tmp_path):
    path = make_file(tmp_path, [
        ("Соколенко Полина Алексеевна", "ИПИ", "3-ИД-6", date(2006, 11, 15), "б"),
        ("Коротков Никита Алексеевич", "ИИТА", "1-МД-7", date(2008, 7, 8), "вн"),
    ])
    rows, skipped = import_payers.read_rows(path, TODAY)

    assert skipped == []
    assert [r.last_name for r in rows] == ["Соколенко", "Коротков"]
    assert rows[0].middle_name == "Алексеевна"
    assert rows[0].is_budget is True
    assert rows[1].is_budget is False


def test_name_without_patronymic_is_accepted(tmp_path):
    path = make_file(tmp_path, [("Иванов Пётр", "ИИТА", "1-МД-7", date(2008, 7, 8), "б")])
    rows, skipped = import_payers.read_rows(path, TODAY)
    assert skipped == []
    assert rows[0].middle_name is None


def test_blank_tail_rows_are_ignored(tmp_path):
    """
    В хвосте таблиц тянется сквозная нумерация без данных. Это не ошибки,
    и в отчёте о них писать нечего.
    """
    path = make_file(tmp_path, [
        ("Иванов Пётр Сергеевич", "ИИТА", "1-МД-7", date(2008, 7, 8), "б"),
        (None, None, None, None, None),
        (None, None, None, None, None),
    ])
    rows, skipped = import_payers.read_rows(path, TODAY)
    assert len(rows) == 1
    assert skipped == []


def test_column_order_does_not_matter(tmp_path):
    """Таблицу собирают заново каждый год — колонки ищутся по названию."""
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Группа", "Б/ВН", "Ф.И.О.", "Дата рождения", "Институт"])
    sheet.append(["1-ТД-15", "б", "Золотухина Елизавета Евгеньевна", date(2005, 9, 17), "ИТМ"])
    path = tmp_path / "другой-порядок.xlsx"
    workbook.save(path)

    rows, skipped = import_payers.read_rows(str(path), TODAY)
    assert skipped == []
    assert rows[0].last_name == "Золотухина"
    assert rows[0].group_name == "1-тд-15"
    assert rows[0].faculty_short == "ИТМ"


def test_row_numbers_match_the_spreadsheet(tmp_path):
    """Номер в отчёте должен искаться в Excel, а не считаться от начала данных."""
    path = make_file(tmp_path, [
        (None, None, None, None, None),
        ("Иванов Пётр Сергеевич", "ИИТА", "?", date(2008, 7, 8), "б"),
    ])
    rows, _ = import_payers.read_rows(path, TODAY)
    assert rows[0].line == 3   # заголовок + пустая строка + эта


# ---------------------------------------------------------------------------
# Запись в базу
# ---------------------------------------------------------------------------

def test_import_writes_payers(tmp_path, db, faculty):
    path = make_file(tmp_path, [
        ("Соколенко Полина Алексеевна", "ИИТА", "1-ИД-6", date(2006, 11, 15), "б"),
        ("Коротков Никита Алексеевич", "ИИТА", "1-МГ-7", date(2008, 7, 8), "вн"),
    ])
    assert import_payers.main([path, "--apply"]) == 0

    payers = {p.last_name: p for p in db.query(Payer).all()}
    assert set(payers) == {"Соколенко", "Коротков"}

    polina = payers["Соколенко"]
    assert polina.group_name == "1-ид-6"
    assert polina.faculty_id == faculty.id
    assert polina.is_budget is True
    assert polina.education_level == EducationLevel.BACHELOR.value
    # Курс 1 в учебном году 2026-2027 — значит поступление в 2026-м.
    assert polina.admission_year == import_payers.academic_year_start()
    assert polina.date_of_birth.startswith("gAAAAA")   # дата рождения шифруется

    assert payers["Коротков"].education_level == EducationLevel.MASTER.value


def test_dry_run_writes_nothing(tmp_path, db, faculty):
    path = make_file(tmp_path, [("Иванов Пётр Сергеевич", "ИИТА", "1-МД-7", date(2008, 7, 8), "б")])
    assert import_payers.main([path]) == 0
    assert db.query(Payer).count() == 0


def test_second_run_does_not_duplicate(tmp_path, db, faculty):
    """Файл присылают повторно с добавленными строками — старые не должны задваиваться."""
    path = make_file(tmp_path, [("Иванов Пётр Сергеевич", "ИИТА", "1-МД-7", date(2008, 7, 8), "б")])
    import_payers.main([path, "--apply"])
    import_payers.main([path, "--apply"])
    assert db.query(Payer).count() == 1


def test_unknown_faculty_is_left_empty_by_default(tmp_path, db, faculty):
    """Справочник не должен засоряться опечатками — институт заводится по флагу."""
    path = make_file(tmp_path, [("Иванов Пётр Сергеевич", "ВШТЭ", "1-МД-7", date(2008, 7, 8), "б")])
    import_payers.main([path, "--apply"])

    payer = db.query(Payer).one()
    assert payer.faculty_id is None

    from backend.domain.models import Faculty
    assert db.query(Faculty).filter(Faculty.short_name == "ВШТЭ").first() is None


def test_faculty_is_created_on_demand(tmp_path, db, faculty):
    path = make_file(tmp_path, [("Иванов Пётр Сергеевич", "ВШТЭ", "1-МД-7", date(2008, 7, 8), "б")])
    import_payers.main([path, "--apply", "--create-faculties"])

    from backend.domain.models import Faculty
    created = db.query(Faculty).filter(Faculty.short_name == "ВШТЭ").one()
    assert db.query(Payer).one().faculty_id == created.id


def test_broken_row_still_loads_the_rest(tmp_path, db, faculty):
    """
    Одна строка без ФИО не должна отменять загрузку остальных трёхсот —
    но и молча превращаться в пустую карточку тоже.
    """
    path = make_file(tmp_path, [
        ("Иванов Пётр Сергеевич", "ИИТА", "1-МД-7", date(2008, 7, 8), "б"),
        (None, "ИИТА", "1-МД-8", date(2008, 7, 8), "б"),
        ("Петров Иван Сергеевич", "ИИТА", "?", date(2008, 7, 8), "б"),
    ])
    import_payers.main([path, "--apply"])

    payers = {p.last_name: p for p in db.query(Payer).all()}
    assert set(payers) == {"Иванов", "Петров"}
    # Группу не угадали — поле осталось пустым, а не заполнилось мусором.
    assert payers["Петров"].group_name is None
    assert payers["Петров"].admission_year is None


def test_nobody_lands_in_the_archive_on_import(tmp_path, db, faculty):
    """Пятикурсник не должен исчезнуть из списков в момент загрузки."""
    path = make_file(tmp_path, [("Вовенда София Викторовна", "ИИТА", "5-ГВ-26", date(2003, 5, 1), "б")])
    import_payers.main([path, "--apply"])

    payer = db.query(Payer).one()
    assert payer.is_archived is False
    assert payer.computed_course == 5
