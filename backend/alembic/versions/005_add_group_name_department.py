"""Add group_name (free-form group code like '1-мд-35') and department (кафедра) to payers.

Revision ID: 005
Revises: 004
Create Date: 2026-02-20
"""
from alembic import op
import sqlalchemy as sa

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # group_name: encrypted free-form group code, e.g. "1-мд-35"
    op.add_column('payers', sa.Column('group_name', sa.Text(), nullable=True))
    # department: encrypted кафедра abbreviation, e.g. "ЦИАТ", optional
    op.add_column('payers', sa.Column('department', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('payers', 'department')
    op.drop_column('payers', 'group_name')
