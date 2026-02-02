"""baseline initial schema

Revision ID: 001_baseline
Revises: 
Create Date: 2026-02-02 05:00:00.000000

This is a baseline migration for an existing database.
The database schema was already created via SQLAlchemy's create_all().
This migration does nothing but establishes a starting point for Alembic tracking.

To apply: alembic stamp 001_baseline
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_baseline'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Empty upgrade - database already has all tables.
    This migration only marks the starting point for Alembic.
    """
    pass


def downgrade() -> None:
    """
    Empty downgrade - we don't want to drop existing tables.
    """
    pass
