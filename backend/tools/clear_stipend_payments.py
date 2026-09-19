"""
Снять платежи «Удержание из стипендии».

Недолго существовала версия, в которой бюджетнику записывался настоящий
платёж на сумму взноса за год. От этого отказались: профком денег с бюджетника
не получает — взнос удерживает бухгалтерия вуза из стипендии. Такие записи
завышали «Собрано средств» и отчётность, поэтому их надо убрать.

Сейчас бюджетник просто числится оплаченным, пока состоит в профкоме,
и никаких платежей для этого не заводится.

Сначала вхолостую, ничего не меняет:

    python -m backend.tools.clear_stipend_payments

Посмотрели, сколько найдено, — тогда с удалением:

    python -m backend.tools.clear_stipend_payments --apply

Трогает только платежи с этой отметкой. Внесённые руками не затрагиваются,
даже если их вносили бюджетнику.
"""
from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy import func

from backend.core.database import SessionLocal
from backend.domain.models import Payer, Payment, PaymentStatus, SystemUser, UserRole
from backend.infrastructure.repositories import AuditRepository

# Отметка, которую ставила та версия. По ней платежи и находятся.
WITHHELD_FROM_STIPEND = "Удержание из стипендии"


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Снять платежи «Удержание из стипендии», записанные автоматически",
    )
    parser.add_argument("--apply", action="store_true",
                        help="удалить (без флага — только показать, сколько найдено)")
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        found = db.query(
            func.count(Payment.id), func.coalesce(func.sum(Payment.amount), 0)
        ).filter(Payment.payment_method == WITHHELD_FROM_STIPEND).one()
        count, total = int(found[0]), Decimal(found[1] or 0)

        print(f"Платежей с отметкой «{WITHHELD_FROM_STIPEND}»: {count}")
        print(f"На сумму: {total} ₽ — именно на столько завышено «Собрано средств»")

        if count == 0:
            print("\nУдалять нечего.")
            return 0

        if not args.apply:
            print("\nРежим просмотра. Ничего не удалено. "
                  "Повторите с --apply, чтобы снять эти платежи.")
            return 0

        payer_ids = [
            row[0] for row in db.query(Payment.payer_id)
            .filter(Payment.payment_method == WITHHELD_FROM_STIPEND).distinct().all()
        ]

        db.query(Payment).filter(
            Payment.payment_method == WITHHELD_FROM_STIPEND
        ).delete(synchronize_session=False)

        # Статус пересчитывать построчно незачем: бюджетник и так числится
        # оплаченным, а платник без платежей — должником.
        db.query(Payer).filter(
            Payer.id.in_(payer_ids), Payer.is_budget.is_(True)
        ).update({Payer.status: PaymentStatus.PAID}, synchronize_session=False)
        db.query(Payer).filter(
            Payer.id.in_(payer_ids), Payer.is_budget.is_(False)
        ).update({Payer.status: PaymentStatus.UNPAID}, synchronize_session=False)

        db.commit()
        print(f"\nСнято платежей: {count}")

        admin = db.query(SystemUser).filter(
            SystemUser.role == UserRole.ADMIN, SystemUser.is_active.is_(True)
        ).order_by(SystemUser.id).first()
        if admin:
            AuditRepository(db).record(
                "cleanup", "payment", None, admin.id,
                f"Сняты автоматические платежи из стипендии: {count} на {total} ₽", None,
            )
        return 0
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
