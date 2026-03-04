"""Convert columns to Text type for encrypted storage.

Revision ID: 006
Revises: 005
Create Date: 2026-03-04

Columns that store encrypted data (Fernet tokens) must be Text, not their
original types (VARCHAR, Numeric, Date).  The runtime migration in
database.py already handles this via ALTER TYPE ... USING, but having an
Alembic migration ensures a clean schema when running from scratch.
"""
from alembic import op
from sqlalchemy import inspect, text
import sqlalchemy as sa

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    """Check if a column exists in a table."""
    conn = op.get_bind()
    insp = inspect(conn)
    columns = [c['name'] for c in insp.get_columns(table)]
    return column in columns


def upgrade() -> None:
    # Payer columns: VARCHAR → Text
    for col in ('last_name', 'first_name', 'middle_name', 'email',
                'phone', 'telegram', 'vk'):
        op.alter_column(
            'payers', col,
            type_=sa.Text(),
            existing_type=sa.String(),
            existing_nullable=True,
        )

    # Payer: Date → Text
    op.alter_column(
        'payers', 'date_of_birth',
        type_=sa.Text(),
        existing_type=sa.Date(),
        existing_nullable=True,
        postgresql_using='date_of_birth::TEXT',
    )

    # Payer: Numeric → Text
    op.alter_column(
        'payers', 'stipend_amount',
        type_=sa.Text(),
        existing_type=sa.Numeric(10, 2),
        existing_nullable=True,
        postgresql_using='stipend_amount::TEXT',
    )
    op.alter_column(
        'payers', 'budget_percent',
        type_=sa.Text(),
        existing_type=sa.Numeric(5, 2),
        existing_nullable=True,
        postgresql_using='budget_percent::TEXT',
    )

    # Payment columns: Numeric/VARCHAR → Text
    op.alter_column(
        'payments', 'amount',
        type_=sa.Text(),
        existing_type=sa.Numeric(10, 2),
        existing_nullable=True,
        postgresql_using='amount::TEXT',
    )
    op.alter_column(
        'payments', 'receipt_number',
        type_=sa.Text(),
        existing_type=sa.String(),
        existing_nullable=True,
    )

    # SystemUser: add encryption key columns if missing
    if not _column_exists('system_users', 'encrypted_master_key'):
        op.add_column('system_users',
                      sa.Column('encrypted_master_key', sa.LargeBinary(), nullable=True))
    if not _column_exists('system_users', 'key_salt'):
        op.add_column('system_users',
                      sa.Column('key_salt', sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column('system_users', 'key_salt')
    op.drop_column('system_users', 'encrypted_master_key')

    op.alter_column('payments', 'receipt_number',
                    type_=sa.String(100), existing_type=sa.Text(), existing_nullable=True)
    op.alter_column('payments', 'amount',
                    type_=sa.Numeric(10, 2), existing_type=sa.Text(), existing_nullable=True,
                    postgresql_using='amount::NUMERIC(10,2)')

    op.alter_column('payers', 'budget_percent',
                    type_=sa.Numeric(5, 2), existing_type=sa.Text(), existing_nullable=True,
                    postgresql_using='budget_percent::NUMERIC(5,2)')
    op.alter_column('payers', 'stipend_amount',
                    type_=sa.Numeric(10, 2), existing_type=sa.Text(), existing_nullable=True,
                    postgresql_using='stipend_amount::NUMERIC(10,2)')
    op.alter_column('payers', 'date_of_birth',
                    type_=sa.Date(), existing_type=sa.Text(), existing_nullable=True,
                    postgresql_using='date_of_birth::DATE')

    for col in ('vk', 'telegram', 'phone', 'email',
                'middle_name', 'first_name', 'last_name'):
        op.alter_column('payers', col,
                        type_=sa.String(), existing_type=sa.Text(), existing_nullable=True)
