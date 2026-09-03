"""
Репозитории.

Главное отличие от прошлой версии: список, поиск, сортировка, постраничная
навигация и вся статистика считаются в SQL. Раньше ФИО и суммы были
зашифрованы, поэтому `get_all` поднимал из базы всех плательщиков со всеми
платежами, расшифровывал каждое поле и только потом резал страницу в Python.
На трёх записях это незаметно, на тысяче — секунды на каждое открытие страницы.

Шифрование теперь частичное (см. backend/core/encryption.py): открытыми
остались ровно те поля, по которым нужно искать и считать.
"""
import logging
from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import Integer, and_, case, func, or_, select
from sqlalchemy.orm import Session, joinedload, object_session

from backend.core.encryption import (
    DecryptionError, decrypt_date, decrypt_field, encrypt_date, encrypt_field,
)
from backend.domain.academic import (
    DEFAULT_EDUCATION_LEVEL, DURATION_YEARS, academic_year_start,
)
from backend.domain.models import (
    AppSettings, AuditLog, Faculty, Payer, Payment, PaymentSettings,
    PaymentStatus, SystemUser,
)

logger = logging.getLogger(__name__)

# Поля, которые лежат в базе зашифрованными.
PAYER_ENCRYPTED_FIELDS = ("email", "phone", "telegram", "vk", "notes")
PAYMENT_ENCRYPTED_FIELDS = ("receipt_number", "notes")


# ---------------------------------------------------------------------------
# Шифрование объектов на месте
# ---------------------------------------------------------------------------

def _safe_expunge(db: Session, obj) -> None:
    """Отцепить объект от сессии, чтобы расшифровка не улетела обратно в базу."""
    if object_session(obj) is not None:
        db.expunge(obj)


def _decrypt_one(obj, field: str, decoder=decrypt_field) -> bool:
    """
    Расшифровать одно поле на месте. False, если ключ не подошёл.

    Поле, зашифрованное чужим ключом, обнуляется, а не отдаётся шифротекстом:
    так проблема видна сразу и испорченное значение не может уехать обратно
    в базу под видом настоящих данных.
    """
    try:
        setattr(obj, field, decoder(getattr(obj, field)))
        return True
    except DecryptionError:
        setattr(obj, field, None)
        logger.error(
            "Поле %s.%s зашифровано другим ключом (id=%s)",
            type(obj).__name__, field, getattr(obj, "id", "?"),
        )
        return False


def encrypt_payer(payer: Payer) -> None:
    """Зашифровать чувствительные поля перед записью."""
    for field in PAYER_ENCRYPTED_FIELDS:
        setattr(payer, field, encrypt_field(getattr(payer, field)))
    payer.date_of_birth = encrypt_date(payer.date_of_birth)


def decrypt_payer(payer: Payer) -> None:
    """Расшифровать чувствительные поля после чтения."""
    ok = True
    for field in PAYER_ENCRYPTED_FIELDS:
        ok &= _decrypt_one(payer, field)
    ok &= _decrypt_one(payer, "date_of_birth", decrypt_date)
    payer.decryption_failed = not ok


def encrypt_payment(payment: Payment) -> None:
    for field in PAYMENT_ENCRYPTED_FIELDS:
        setattr(payment, field, encrypt_field(getattr(payment, field)))


def decrypt_payment(payment: Payment) -> None:
    ok = True
    for field in PAYMENT_ENCRYPTED_FIELDS:
        ok &= _decrypt_one(payment, field)
    payment.decryption_failed = not ok


# ---------------------------------------------------------------------------
# Архив: условие «человек уже выпустился» прямо в SQL
# ---------------------------------------------------------------------------

def graduated_clause():
    """
    Курс = начало учебного года − год поступления + 1, значит выпуск наступает,
    когда admission_year < начало_года + 1 − срок_обучения. Считаем в SQL,
    чтобы архив не приходилось отфильтровывать после выборки всей таблицы.
    Уровень не проставлен — считаем бакалавриатом.
    """
    base_year = academic_year_start()
    conditions = []
    for level, duration in DURATION_YEARS.items():
        level_match = Payer.education_level == level.value
        if level == DEFAULT_EDUCATION_LEVEL:
            level_match = or_(level_match, Payer.education_level.is_(None))
        conditions.append(and_(
            level_match,
            Payer.admission_year.isnot(None),
            Payer.admission_year < base_year + 1 - duration,
        ))
    return or_(*conditions)


def _paid_totals_subquery():
    """Сумма платежей по каждому плательщику — один агрегат на весь запрос."""
    return (
        select(
            Payment.payer_id.label("payer_id"),
            func.coalesce(func.sum(Payment.amount), 0).label("total"),
        )
        .group_by(Payment.payer_id)
        .subquery()
    )


class UserRepository:
    """Пользователи системы."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[SystemUser]:
        return self.db.query(SystemUser).filter(SystemUser.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[SystemUser]:
        return self.db.query(SystemUser).filter(SystemUser.username == username).first()

    def get_by_email(self, email: str) -> Optional[SystemUser]:
        """Поиск по почте без учёта регистра — иначе «Ivan@» и «ivan@» разойдутся."""
        return self.db.query(SystemUser).filter(
            func.lower(SystemUser.email) == (email or "").strip().lower()
        ).first()

    def get_by_login(self, login: str) -> Optional[SystemUser]:
        """Вход разрешён и по логину, и по почте — так привычнее бухгалтеру."""
        return self.get_by_username(login) or self.get_by_email(login)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[SystemUser]:
        return self.db.query(SystemUser).order_by(SystemUser.id).offset(skip).limit(limit).all()

    def count_active_admins(self, exclude_id: Optional[int] = None) -> int:
        """Сколько остаётся администраторов — чтобы не остаться без единого."""
        from backend.domain.models import UserRole
        query = self.db.query(func.count(SystemUser.id)).filter(
            SystemUser.role == UserRole.ADMIN,
            SystemUser.is_active.is_(True),
        )
        if exclude_id is not None:
            query = query.filter(SystemUser.id != exclude_id)
        return query.scalar() or 0

    def create(self, user: SystemUser) -> SystemUser:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def save(self, user: SystemUser) -> SystemUser:
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user_id: int) -> bool:
        user = self.get_by_id(user_id)
        if not user:
            return False
        self.db.delete(user)
        self.db.commit()
        return True


class FacultyRepository:
    """Деректораты."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, faculty_id: int) -> Optional[Faculty]:
        return self.db.query(Faculty).filter(Faculty.id == faculty_id).first()

    def get_all(self, active_only: bool = True) -> List[Faculty]:
        query = self.db.query(Faculty)
        if active_only:
            query = query.filter(Faculty.is_active.is_(True))
        return query.order_by(Faculty.name).all()

    def count_payers(self, faculty_id: int) -> int:
        return self.db.query(func.count(Payer.id)).filter(
            Payer.faculty_id == faculty_id
        ).scalar() or 0

    def create(self, faculty: Faculty) -> Faculty:
        self.db.add(faculty)
        self.db.commit()
        self.db.refresh(faculty)
        return faculty

    def save(self, faculty: Faculty) -> Faculty:
        self.db.commit()
        self.db.refresh(faculty)
        return faculty

    def deactivate(self, faculty_id: int) -> bool:
        faculty = self.get_by_id(faculty_id)
        if not faculty:
            return False
        faculty.is_active = False
        self.db.commit()
        return True

    def delete(self, faculty_id: int) -> bool:
        """Удалять можно только пустой деректорат — иначе плательщики осиротеют."""
        faculty = self.get_by_id(faculty_id)
        if not faculty or self.count_payers(faculty_id) > 0:
            return False
        self.db.delete(faculty)
        self.db.commit()
        return True


class PayerRepository:
    """Плательщики. Все выборки — в SQL."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payer_id: int) -> Optional[Payer]:
        payer = (
            self.db.query(Payer)
            .options(joinedload(Payer.faculty), joinedload(Payer.payments))
            .filter(Payer.id == payer_id)
            .first()
        )
        if payer is None:
            return None

        payments = list(payer.payments)
        for p in payments:
            _safe_expunge(self.db, p)
        _safe_expunge(self.db, payer)

        decrypt_payer(payer)
        for p in payments:
            decrypt_payment(p)
        payer.total_paid = sum((p.amount for p in payments if p.amount), Decimal("0"))
        return payer

    def list(
        self,
        skip: int = 0,
        limit: int = 20,
        faculty_id: Optional[int] = None,
        status: Optional[PaymentStatus] = None,
        search: Optional[str] = None,
        active_only: bool = True,
        archived: Optional[bool] = False,
        debtors_only: bool = False,
    ) -> Tuple[List[Payer], int]:
        """
        Страница списка плательщиков и общее количество.

        Поиск идёт по ФИО, группе и кафедре — они хранятся открытыми.
        По почте и телефону искать нельзя: они зашифрованы, и SQL по ним
        ничего не найдёт. На практике бухгалтер ищет по фамилии и группе.
        """
        paid = _paid_totals_subquery()
        query = (
            self.db.query(Payer, func.coalesce(paid.c.total, 0).label("total_paid"))
            .outerjoin(paid, Payer.id == paid.c.payer_id)
            .options(joinedload(Payer.faculty))
        )

        if active_only:
            query = query.filter(Payer.is_active.is_(True))
        if faculty_id:
            query = query.filter(Payer.faculty_id == faculty_id)
        if status:
            query = query.filter(Payer.status == status)
        if debtors_only:
            query = query.filter(Payer.status.in_([PaymentStatus.UNPAID, PaymentStatus.PARTIAL]))
        if archived is not None:
            clause = graduated_clause()
            query = query.filter(clause if archived else ~clause)

        if search:
            # ILIKE, а не lower()+LIKE: у Postgres lower() знает про кириллицу,
            # а нам ещё нужно, чтобы то же выражение работало в тестах на SQLite.
            pattern = f"%{search.strip()}%"
            query = query.filter(or_(
                Payer.last_name.ilike(pattern),
                Payer.first_name.ilike(pattern),
                func.coalesce(Payer.middle_name, "").ilike(pattern),
                func.coalesce(Payer.group_name, "").ilike(pattern),
                func.coalesce(Payer.department, "").ilike(pattern),
            ))

        total = query.order_by(None).count()

        rows = (
            query.order_by(Payer.last_name, Payer.first_name, Payer.id)
            .offset(skip)
            .limit(limit)
            .all()
        )

        payers: List[Payer] = []
        for payer, total_paid in rows:
            _safe_expunge(self.db, payer)
            decrypt_payer(payer)
            payer.total_paid = Decimal(total_paid or 0)
            payers.append(payer)

        return payers, total

    def create(self, payer: Payer) -> Payer:
        encrypt_payer(payer)
        self.db.add(payer)
        self.db.commit()
        self.db.refresh(payer)
        _safe_expunge(self.db, payer)
        decrypt_payer(payer)
        payer.total_paid = Decimal("0")
        return payer

    def save(self, payer: Payer) -> Payer:
        """Ожидает объект в открытом виде, привязанный к сессии."""
        encrypt_payer(payer)
        self.db.commit()
        self.db.refresh(payer)
        total = self.total_paid(payer.id)
        _safe_expunge(self.db, payer)
        decrypt_payer(payer)
        payer.total_paid = total
        return payer

    def group_hints(self, faculty_id: Optional[int] = None) -> List[dict]:
        """
        Уже заведённые группы и кафедры при них.

        Нужно, чтобы при вводе новой записи кафедра подставлялась сама:
        внутри одного деректората группа почти всегда относится к одной
        кафедре, и перенабирать её руками на каждой записи бессмысленно.
        Работает только потому, что группа и кафедра теперь не зашифрованы.
        """
        query = (
            self.db.query(
                Payer.group_name,
                Payer.faculty_id,
                Payer.department,
                Payer.education_level,
                func.count(Payer.id).label("count"),
                func.max(Payer.admission_year).label("latest_year"),
            )
            .filter(Payer.group_name.isnot(None), Payer.is_active.is_(True))
            .group_by(Payer.group_name, Payer.faculty_id, Payer.department, Payer.education_level)
            .order_by(func.count(Payer.id).desc())
        )
        if faculty_id:
            query = query.filter(Payer.faculty_id == faculty_id)

        return [
            {
                "group_name": row.group_name,
                "faculty_id": row.faculty_id,
                "department": row.department,
                "education_level": row.education_level or "bachelor",
                "count": row.count,
                "latest_admission_year": row.latest_year,
            }
            for row in query.limit(300).all()
        ]

    def total_paid(self, payer_id: int) -> Decimal:
        """Сумма платежей одним запросом — суммы больше не зашифрованы."""
        return Decimal(self.db.query(
            func.coalesce(func.sum(Payment.amount), 0)
        ).filter(Payment.payer_id == payer_id).scalar() or 0)

    def deactivate(self, payer_id: int) -> bool:
        payer = self.db.query(Payer).filter(Payer.id == payer_id).first()
        if not payer:
            return False
        payer.is_active = False
        self.db.commit()
        return True

    def delete(self, payer_id: int) -> bool:
        """Полное удаление вместе с платежами (cascade на связи)."""
        payer = self.db.query(Payer).filter(Payer.id == payer_id).first()
        if not payer:
            return False
        self.db.delete(payer)
        self.db.commit()
        return True


class PaymentRepository:
    """Платежи."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, payment_id: int) -> Optional[Payment]:
        payment = self.db.query(Payment).filter(Payment.id == payment_id).first()
        if payment:
            _safe_expunge(self.db, payment)
            decrypt_payment(payment)
        return payment

    def get_by_payer(self, payer_id: int) -> List[Payment]:
        payments = (
            self.db.query(Payment)
            .filter(Payment.payer_id == payer_id)
            .order_by(Payment.payment_date.desc(), Payment.id.desc())
            .all()
        )
        for p in payments:
            _safe_expunge(self.db, p)
            decrypt_payment(p)
        return payments

    def create(self, payment: Payment) -> Payment:
        encrypt_payment(payment)
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        _safe_expunge(self.db, payment)
        decrypt_payment(payment)
        return payment

    def save(self, payment: Payment) -> Payment:
        encrypt_payment(payment)
        self.db.commit()
        self.db.refresh(payment)
        _safe_expunge(self.db, payment)
        decrypt_payment(payment)
        return payment

    def delete(self, payment_id: int) -> bool:
        payment = self.db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            return False
        self.db.delete(payment)
        self.db.commit()
        return True


class PaymentSettingsRepository:
    """Суммы взносов по годам."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, settings_id: int) -> Optional[PaymentSettings]:
        return self.db.query(PaymentSettings).filter(PaymentSettings.id == settings_id).first()

    def get_by_year(self, academic_year: str) -> Optional[PaymentSettings]:
        return self.db.query(PaymentSettings).filter(
            PaymentSettings.academic_year == academic_year
        ).first()

    def get_current(self) -> Optional[PaymentSettings]:
        return self.db.query(PaymentSettings).filter(
            PaymentSettings.is_active.is_(True)
        ).order_by(PaymentSettings.academic_year.desc()).first()

    def get_all(self) -> List[PaymentSettings]:
        return self.db.query(PaymentSettings).order_by(PaymentSettings.academic_year.desc()).all()

    def create(self, item: PaymentSettings) -> PaymentSettings:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def save(self, item: PaymentSettings) -> PaymentSettings:
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete(self, settings_id: int) -> bool:
        item = self.get_by_id(settings_id)
        if not item:
            return False
        self.db.delete(item)
        self.db.commit()
        return True


# Ключ настройки «второй фактор обязателен для всех».
TOTP_POLICY_KEY = "require_totp"

# Значения, которые считаются «да». Настройку правят и руками в базе, поэтому
# принимаем несколько привычных написаний, а не одно.
_TRUTHY = {"1", "true", "yes", "on", "да"}


class AppSettingsRepository:
    """Настройки ключ-значение."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_key(self, key: str) -> Optional[AppSettings]:
        return self.db.query(AppSettings).filter(AppSettings.key == key).first()

    def get_value(self, key: str, default: Optional[str] = None) -> Optional[str]:
        setting = self.get_by_key(key)
        return setting.value if setting else default

    def get_bool(self, key: str, default: bool) -> bool:
        raw = self.get_value(key)
        if raw is None:
            return default
        return raw.strip().lower() in _TRUTHY

    def totp_required(self) -> bool:
        """
        Обязателен ли второй фактор всем пользователям.

        По умолчанию — да. Учётные записи здесь дают доступ к персональным
        данным студентов, и пароль в качестве единственной защиты для них
        мало. Администратор может выключить требование в настройках.
        """
        return self.get_bool(TOTP_POLICY_KEY, default=True)

    def set_totp_required(self, value: bool) -> None:
        self.set(
            TOTP_POLICY_KEY,
            "true" if value else "false",
            "Требовать второй фактор от всех пользователей",
        )

    def set(self, key: str, value: str, description: Optional[str] = None) -> AppSettings:
        setting = self.get_by_key(key)
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = AppSettings(key=key, value=value, description=description)
            self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting


class StatsRepository:
    """
    Статистика. Целиком в SQL: суммы больше не зашифрованы, поэтому считать
    их построчно в Python больше не нужно.
    """

    def __init__(self, db: Session):
        self.db = db

    def dashboard(self) -> dict:
        active = Payer.is_active.is_(True)
        not_archived = ~graduated_clause()

        counts = dict(
            self.db.query(Payer.status, func.count(Payer.id))
            .filter(active, not_archived)
            .group_by(Payer.status)
            .all()
        )

        total_payers = sum(counts.values())
        total_paid = self.db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar() or 0
        archived = self.db.query(func.count(Payer.id)).filter(
            active, graduated_clause()
        ).scalar() or 0

        return {
            "total_payers": total_payers,
            "active_payers": total_payers,
            "archived_payers": archived,
            "total_debtors": counts.get(PaymentStatus.UNPAID, 0) + counts.get(PaymentStatus.PARTIAL, 0),
            "total_paid_amount": Decimal(total_paid),
            "paid_count": counts.get(PaymentStatus.PAID, 0),
            "partial_count": counts.get(PaymentStatus.PARTIAL, 0),
            "unpaid_count": counts.get(PaymentStatus.UNPAID, 0),
            "exempt_count": counts.get(PaymentStatus.EXEMPT, 0),
        }

    def by_faculty(self) -> List[dict]:
        """Один запрос с агрегатами вместо выгрузки всех платежей в память."""
        payer_join = and_(
            Payer.faculty_id == Faculty.id,
            Payer.is_active.is_(True),
            ~graduated_clause(),
        )
        rows = (
            self.db.query(
                Faculty.id,
                Faculty.name,
                Faculty.short_name,
                func.count(Payer.id).label("total"),
                func.coalesce(func.sum(case((Payer.status == PaymentStatus.PAID, 1), else_=0)), 0).label("paid"),
                # Должник — и тот, кто не платил вовсе, и тот, кто внёс часть.
                # Так же считает сводка наверху панели и раздел «Должники»;
                # раньше здесь были только UNPAID, и на одном экране под одной
                # подписью стояли разные числа.
                func.coalesce(func.sum(case((
                    Payer.status.in_([PaymentStatus.UNPAID, PaymentStatus.PARTIAL]), 1
                ), else_=0)), 0).label("debtors"),
            )
            .outerjoin(Payer, payer_join)
            .filter(Faculty.is_active.is_(True))
            .group_by(Faculty.id, Faculty.name, Faculty.short_name)
            .order_by(Faculty.name)
            .all()
        )

        amounts = dict(
            self.db.query(Payer.faculty_id, func.coalesce(func.sum(Payment.amount), 0))
            .join(Payment, Payment.payer_id == Payer.id)
            .filter(Payer.faculty_id.isnot(None))
            .group_by(Payer.faculty_id)
            .all()
        )

        return [
            {
                "faculty_id": row.id,
                "faculty_name": row.short_name or row.name,
                "total_payers": row.total or 0,
                "paid_count": row.paid or 0,
                "debtors_count": row.debtors or 0,
                "total_amount": Decimal(amounts.get(row.id, 0)),
            }
            for row in rows
        ]

    def academic_years_with_data(self) -> List[str]:
        """
        Учебные годы, по которым есть платежи.

        Нужно, чтобы в отчётах выбирались только годы, где что-то было,
        а не жёстко «четыре последних календарных».
        """
        rows = self.db.query(Payment.academic_year).filter(
            Payment.academic_year.isnot(None)
        ).distinct().all()
        return sorted({row[0] for row in rows if row[0]}, reverse=True)

    def monthly_by_academic_year(self, academic_year: str) -> List[dict]:
        """
        Помесячно за учебный год: сентябрь предыдущего по август следующего.

        Раньше отчёт строился по календарному году, и осенний семестр
        отваливался: платежи октября 2025 относятся к 2025-2026, но в отчёт
        «за 2026» не попадали. Из-за этого в конце лета отчёт выглядел пустым.
        """
        try:
            start_year = int(academic_year.split("-")[0])
        except (ValueError, IndexError, AttributeError):
            return []

        period_start = date(start_year, 9, 1)
        period_end = date(start_year + 1, 8, 31)

        rows = (
            self.db.query(
                func.extract("year", Payment.payment_date).cast(Integer).label("y"),
                func.extract("month", Payment.payment_date).cast(Integer).label("m"),
                func.count(Payment.id).label("cnt"),
                func.coalesce(func.sum(Payment.amount), 0).label("total"),
            )
            .filter(Payment.payment_date >= period_start, Payment.payment_date <= period_end)
            .group_by("y", "m")
            .all()
        )
        found = {(int(r.y), int(r.m)): r for r in rows}

        # Все двенадцать месяцев подряд, включая пустые: иначе на графике
        # пропуски выглядят как отсутствие периода, а не как нулевой сбор.
        result = []
        for offset in range(12):
            month = 9 + offset
            year = start_year + (month - 1) // 12
            month = (month - 1) % 12 + 1
            row = found.get((year, month))
            result.append({
                "month": f"{year}-{month:02d}",
                "payments_count": row.cnt if row else 0,
                "total_amount": Decimal(row.total) if row else Decimal("0"),
            })
        return result

    def monthly(self, year: int) -> List[dict]:
        month = func.extract("month", Payment.payment_date).cast(Integer)
        rows = (
            self.db.query(
                month.label("month"),
                func.count(Payment.id).label("cnt"),
                func.coalesce(func.sum(Payment.amount), 0).label("total"),
            )
            .filter(func.extract("year", Payment.payment_date) == year)
            .group_by(month)
            .order_by(month)
            .all()
        )
        return [
            {
                "month": f"{year}-{int(row.month):02d}",
                "payments_count": row.cnt,
                "total_amount": Decimal(row.total),
            }
            for row in rows
        ]


class AuditRepository:
    """Журнал изменений."""

    def __init__(self, db: Session):
        self.db = db

    def record(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        user_id: Optional[int] = None,
        summary: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        Записать событие. Описание шифруется — в нём могут быть персональные данные.

        Журнал не должен ронять основную операцию, поэтому ошибки записи
        только логируются.
        """
        try:
            self.db.add(AuditLog(
                user_id=user_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                summary=encrypt_field(summary),
                ip_address=ip_address,
            ))
            self.db.commit()
        except Exception:
            self.db.rollback()
            logger.exception("Не удалось записать событие в журнал")

    def recent(self, limit: int = 100) -> List[AuditLog]:
        logs = self.db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
        for log in logs:
            _safe_expunge(self.db, log)
            _decrypt_one(log, "summary")
        return logs
