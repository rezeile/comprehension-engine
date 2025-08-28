"""
add attachments column to conversation_turns

Revision ID: a1b2c3d4e5f6
Revises: e1f333ae33fd
Create Date: 2025-08-27
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e1f333ae33fd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('conversation_turns', sa.Column('attachments', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('conversation_turns', 'attachments')


