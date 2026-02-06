"""Add date_of_birth to payers table.

Revision ID: 003
Revises: 002
Create Date: 2026-02-06
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('payers', sa.Column('date_of_birth', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('payers', 'date_of_birth')
