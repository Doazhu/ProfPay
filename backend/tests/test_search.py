"""
Поиск в списке плательщиков.

Ищут так, как видят и как набирают: «Иванов Иван», «3-мд-35» (хотя в базе
«1-мд-35»), «Ренев» вместо «Ренёв», иногда — в английской раскладке.
"""
from itertools import product

from backend.domain.academic import academic_year_start
from backend.domain.models import Payer
from backend.infrastructure.repositories import course_expr, group_code_expr
from backend.tests.test_api import API, make_payer


def found(client, text, **params):
    response = client.get(f"{API}/payers", params={"search": text, **params})
    assert response.status_code == 200, response.text
    return sorted(p["full_name"] for p in response.json()["items"])


def test_group_code_in_sql_matches_the_model(db):
    """
    Код группы в SQL и в модели обязаны совпадать: список показывает
    Payer.group_code, а ищет по group_code_expr. Разойдутся — поиск
    перестанет находить то, что видно на экране.
    """
    base = academic_year_start()
    groups = [None, "", "1-мд-35", "12-аб-3", "мд-35", "3мд"]
    levels = [None, "", "bachelor", "specialist", "master", "непонятно"]
    years = [None, base + 1, base, base - 1, base - 3, base - 4, base - 10]
    legacy_courses = [None, 2]

    for i, (group, level, year, legacy) in enumerate(product(groups, levels, years, legacy_courses)):
        db.add(Payer(
            last_name=f"Фамилия{i}", first_name="Имя", group_name=group,
            education_level=level, admission_year=year, course=legacy,
        ))
    db.commit()

    sql = {row.id: (row.code, row.course)
           for row in db.query(Payer.id, group_code_expr().label("code"),
                               course_expr().label("course"))}
    for payer in db.query(Payer):
        assert sql[payer.id] == (payer.group_code, payer.computed_course), (
            payer.group_name, payer.education_level, payer.admission_year, payer.course,
        )


def ranked(client, text, **params):
    response = client.get(f"{API}/payers", params={"search": text, **params})
    assert response.status_code == 200, response.text
    return [p["full_name"] for p in response.json()["items"]]


def test_several_words_in_any_order(auth_client, faculty):
    """Раньше вся строка искалась в каждом поле целиком — «Иванов Иван» не находил никого."""
    make_payer(auth_client, faculty.id, last_name="Иванов", first_name="Иван",
               middle_name="Игоревич", email=None)
    make_payer(auth_client, faculty.id, last_name="Петров", first_name="Иван",
               middle_name=None, email=None)

    assert found(auth_client, "Иванов Иван") == ["Иванов Иван Игоревич"]
    assert found(auth_client, "иван петров") == ["Петров Иван"]
    assert found(auth_client, "Иванов Сергей") == []


def test_initials(auth_client, faculty):
    """Инициал — начало имени или отчества, а не любая «и» в фамилии."""
    make_payer(auth_client, faculty.id, last_name="Иванов", first_name="Иван",
               middle_name="Игоревич", email=None)
    make_payer(auth_client, faculty.id, last_name="Иванов", first_name="Пётр",
               middle_name=None, email=None)

    assert found(auth_client, "Иванов И.И.") == ["Иванов Иван Игоревич"]
    assert found(auth_client, "Иванов П") == ["Иванов Пётр"]
    assert found(auth_client, "иванов") == ["Иванов Иван Игоревич", "Иванов Пётр"]


def test_exact_name_comes_first(auth_client, faculty):
    """
    «иван» — ещё и начало фамилии «Иванов», поэтому Иванов Пётр тоже
    находится. Но первым должен стоять тот, кого искали.
    """
    make_payer(auth_client, faculty.id, last_name="Иванов", first_name="Пётр",
               middle_name=None, email=None)
    make_payer(auth_client, faculty.id, last_name="Иванов", first_name="Иван",
               middle_name=None, email=None)
    make_payer(auth_client, faculty.id, last_name="Аиванов", first_name="Иван",
               middle_name=None, email=None)

    assert ranked(auth_client, "Иванов Иван") == ["Иванов Иван", "Иванов Пётр", "Аиванов Иван"]


def test_yo_and_ye_are_the_same(auth_client, faculty):
    make_payer(auth_client, faculty.id, email=None)  # Ренёв Александр Дмитриевич
    make_payer(auth_client, faculty.id, last_name="Семенова", first_name="Алена",
               middle_name=None, email=None)

    assert found(auth_client, "Ренев") == ["Ренёв Александр Дмитриевич"]
    assert found(auth_client, "Семёнова Алёна") == ["Семенова Алена"]


def test_group_is_found_by_the_code_on_screen(auth_client, faculty):
    """
    В базе группа записана с первого курса, а в списке — с текущим.
    Искать надо по тому, что видно на экране.
    """
    base = academic_year_start()
    make_payer(auth_client, faculty.id, last_name="Третьекурсник", email=None,
               group_name="1-мд-35", admission_year=base - 2)
    make_payer(auth_client, faculty.id, last_name="Первокурсник", email=None,
               group_name="1-мд-7", admission_year=base)

    assert found(auth_client, "3-мд-35") == ["Третьекурсник Александр Дмитриевич"]
    assert found(auth_client, "3мд35") == ["Третьекурсник Александр Дмитриевич"]
    assert found(auth_client, "3-МД") == ["Третьекурсник Александр Дмитриевич"]
    assert found(auth_client, "1-мд") == ["Первокурсник Александр Дмитриевич"]
    assert found(auth_client, "Третьекурсник 1-мд-35") == []


def test_graduate_is_found_by_the_last_course(auth_client, faculty):
    """У выпускника в списке последний курс — по нему он и находится в архиве."""
    make_payer(auth_client, faculty.id, last_name="Выпускник", email=None,
               group_name="1-мд-35", admission_year=academic_year_start() - 6)

    assert found(auth_client, "4-мд-35", archive="all") == ["Выпускник Александр Дмитриевич"]


def test_department(auth_client, faculty):
    make_payer(auth_client, faculty.id, email=None)  # кафедра ЦИАТ

    assert found(auth_client, "циат") == ["Ренёв Александр Дмитриевич"]


def test_wrong_keyboard_layout(auth_client, faculty):
    """Забыли переключить раскладку: «bdfyjd» — это «иванов»."""
    make_payer(auth_client, faculty.id, last_name="Иванов", email=None,
               group_name="1-ит-7")
    make_payer(auth_client, faculty.id, last_name="Бобров", email=None,
               group_name="1-мд-35")

    assert found(auth_client, "bdfyjd") == ["Иванов Александр Дмитриевич"]
    # «,» и «.» в этой раскладке — буквы «б» и «ю», а не разделители.
    assert found(auth_client, ",j,hjd") == ["Бобров Александр Дмитриевич"]
    assert found(auth_client, "1-vl-35") == ["Бобров Александр Дмитриевич"]


def test_wildcards_are_plain_characters(auth_client, faculty):
    """«%» и «_» в запросе — просто символы, а не «что угодно»."""
    make_payer(auth_client, faculty.id, email=None)

    assert found(auth_client, "%") == []
    assert found(auth_client, "_") == []
    assert found(auth_client, "Ре_ёв") == []


def test_blank_query_is_no_filter(auth_client, faculty):
    make_payer(auth_client, faculty.id, email=None)

    assert found(auth_client, "   ") == ["Ренёв Александр Дмитриевич"]
    assert found(auth_client, " , . ") == ["Ренёв Александр Дмитриевич"]


def test_debtors_search(auth_client, faculty, year_settings):
    make_payer(auth_client, faculty.id, last_name="Должник", email=None)
    make_payer(auth_client, faculty.id, last_name="Другой", email=None)

    response = auth_client.get(f"{API}/debtors", params={"search": "должник"}).json()
    assert [p["last_name"] for p in response["items"]] == ["Должник"]
