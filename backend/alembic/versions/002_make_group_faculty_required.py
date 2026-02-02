"""make group faculty_id required

Revision ID: 002_faculty_fk
Revises: 001_baseline
Create Date: 2026-02-02 05:10:00.000000

This migration makes faculty_id required for student_groups:
1. Creates a default faculty if needed
2. Updates NULL faculty_id values to default faculty
3. Makes faculty_id NOT NULL
4. Creates foreign key constraint with explicit name
5. Creates index on faculty_id for performance
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '002_faculty_fk'
down_revision: Union[str, None] = '001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Make faculty_id required for student_groups.
    """
    # Get connection for raw SQL operations
    conn = op.get_bind()
    
    # Step 1: Create default faculty if it doesn't exist
    # Check if default faculty exists
    result = conn.execute(
        text("SELECT id FROM faculties WHERE short_name = 'Н/У' LIMIT 1")
    )
    default_faculty = result.fetchone()
    
    if not default_faculty:
        # Create default faculty
        result = conn.execute(
            text("""
                INSERT INTO faculties (name, short_name, is_active, created_at)
                VALUES ('Не указан', 'Н/У', true, NOW())
                RETURNING id
            """)
        )
        default_faculty_id = result.fetchone()[0]
    else:
        default_faculty_id = default_faculty[0]
    
    # Step 2: Update existing groups without faculty to use default faculty
    conn.execute(
        text(f"""
            UPDATE student_groups
            SET faculty_id = {default_faculty_id}
            WHERE faculty_id IS NULL
        """)
    )
    
    # Step 3: Make faculty_id NOT NULL
    op.alter_column(
        'student_groups',
        'faculty_id',
        existing_type=sa.Integer(),
        nullable=False
    )
    
    # Step 4: Create foreign key constraint with explicit name
    # First check if constraint already exists (in case of re-run)
    result = conn.execute(
        text("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'student_groups' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'fk_student_groups_faculty_id_faculties'
        """)
    )
    
    if not result.fetchone():
        op.create_foreign_key(
            'fk_student_groups_faculty_id_faculties',  # Explicit constraint name
            'student_groups',  # Source table
            'faculties',  # Target table
            ['faculty_id'],  # Source columns
            ['id'],  # Target columns
            ondelete='RESTRICT'  # Prevent deleting faculty with groups
        )
    
    # Step 5: Create index on faculty_id if it doesn't exist
    # Check if index exists
    result = conn.execute(
        text("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'student_groups' 
            AND indexname = 'ix_student_groups_faculty_id'
        """)
    )
    
    if not result.fetchone():
        op.create_index(
            'ix_student_groups_faculty_id',
            'student_groups',
            ['faculty_id']
        )


def downgrade() -> None:
    """
    Revert faculty_id to nullable and remove constraints.
    WARNING: This will not restore original NULL values.
    """
    # Step 1: Drop index
    op.drop_index('ix_student_groups_faculty_id', table_name='student_groups')
    
    # Step 2: Drop foreign key constraint (by explicit name)
    op.drop_constraint(
        'fk_student_groups_faculty_id_faculties',
        'student_groups',
        type_='foreignkey'
    )
    
    # Step 3: Make faculty_id nullable again
    op.alter_column(
        'student_groups',
        'faculty_id',
        existing_type=sa.Integer(),
        nullable=True
    )
    
    # Note: We don't delete the default faculty or set values back to NULL
    # as we don't know which groups originally had NULL values
