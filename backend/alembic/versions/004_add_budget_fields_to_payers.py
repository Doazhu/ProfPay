"""Add budget fields (is_budget, stipend_amount, budget_percent) to payers table.

Revision ID: 004
Revises: 003
Create Date: 2026-02-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('payers', sa.Column('is_budget', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('payers', sa.Column('stipend_amount', sa.Numeric(10, 2), nullable=True))
    op.add_column('payers', sa.Column('budget_percent', sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('payers', 'budget_percent')
    op.drop_column('payers', 'stipend_amount')
    op.drop_column('payers', 'is_budget')
