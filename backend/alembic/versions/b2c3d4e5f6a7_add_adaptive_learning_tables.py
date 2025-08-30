"""
Add adaptive learning tables: prompts, prompt_assignments, learning_analyses

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2025-08-30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names(schema="public")


def _index_exists(inspector: Inspector, table_name: str, index_name: str) -> bool:
    try:
        for idx in inspector.get_indexes(table_name, schema="public"):
            if idx.get("name") == index_name:
                return True
    except Exception:
        # Fallback for dialects that don't support schema kw here
        for idx in inspector.get_indexes(table_name):
            if idx.get("name") == index_name:
                return True
    return False


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    # prompts
    if not _table_exists(inspector, "prompts"):
        op.create_table(
            "prompts",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("base_variant", sa.Text(), nullable=True),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("metadata", sa.JSON(), nullable=True),
            sa.Column(
                "scope",
                sa.String(length=32),
                sa.CheckConstraint("scope IN ('global','user','conversation','cohort')"),
                nullable=False,
                server_default=sa.text("'global'"),
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("created_by", sa.UUID(), nullable=True),
            sa.Column("parent_prompt_id", sa.UUID(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.ForeignKeyConstraint(["parent_prompt_id"], ["prompts.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    # prompts indexes
    if not _index_exists(inspector, "prompts", "ix_prompts_scope_is_active"):
        op.create_index("ix_prompts_scope_is_active", "prompts", ["scope", "is_active"], unique=False)

    # prompt_assignments
    if not _table_exists(inspector, "prompt_assignments"):
        op.create_table(
            "prompt_assignments",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("scope", sa.String(length=32), sa.CheckConstraint("scope IN ('global','user','conversation','cohort')"), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=True),
            sa.Column("conversation_id", sa.UUID(), nullable=True),
            sa.Column("prompt_id", sa.UUID(), nullable=False),
            sa.Column("effective_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["prompt_id"], ["prompts.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    # prompt_assignments indexes
    if not _index_exists(inspector, "prompt_assignments", "ix_prompt_assignments_scope"):
        op.create_index("ix_prompt_assignments_scope", "prompt_assignments", ["scope"], unique=False)
    if not _index_exists(inspector, "prompt_assignments", "ix_prompt_assignments_user_id"):
        op.create_index("ix_prompt_assignments_user_id", "prompt_assignments", ["user_id"], unique=False)
    if not _index_exists(inspector, "prompt_assignments", "ix_prompt_assignments_conversation_id"):
        op.create_index("ix_prompt_assignments_conversation_id", "prompt_assignments", ["conversation_id"], unique=False)

    # learning_analyses
    if not _table_exists(inspector, "learning_analyses"):
        op.create_table(
            "learning_analyses",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("conversation_id", sa.UUID(), nullable=False),
            sa.Column("transcript", sa.JSON(), nullable=False),
            sa.Column("features", sa.JSON(), nullable=False),
            sa.Column("highlights", sa.JSON(), nullable=True),
            sa.Column("connections", sa.JSON(), nullable=True),
            sa.Column("prompt_suggestions", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    # learning_analyses composite index
    if not _index_exists(inspector, "learning_analyses", "ix_learning_analyses_user_conversation"):
        op.create_index(
            "ix_learning_analyses_user_conversation",
            "learning_analyses",
            ["user_id", "conversation_id"],
            unique=False,
        )


def downgrade() -> None:
    # Drop indexes then tables to satisfy dependencies
    try:
        op.drop_index("ix_learning_analyses_user_conversation", table_name="learning_analyses")
    except Exception:
        pass
    try:
        op.drop_table("learning_analyses")
    except Exception:
        pass

    for idx in [
        "ix_prompt_assignments_conversation_id",
        "ix_prompt_assignments_user_id",
        "ix_prompt_assignments_scope",
    ]:
        try:
            op.drop_index(idx, table_name="prompt_assignments")
        except Exception:
            pass
    try:
        op.drop_table("prompt_assignments")
    except Exception:
        pass

    try:
        op.drop_index("ix_prompts_scope_is_active", table_name="prompts")
    except Exception:
        pass
    try:
        op.drop_table("prompts")
    except Exception:
        pass


