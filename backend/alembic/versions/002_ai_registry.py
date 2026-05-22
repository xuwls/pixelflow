"""ai provider + model registry tables

Revision ID: 002
Revises: 001
Create Date: 2026-05-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_provider",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column("api_key", sa.Text(), nullable=False, server_default=""),
        sa.Column("base_url", sa.Text(), nullable=True),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_ai_provider_name"),
    )

    op.create_table(
        "ai_model",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("provider_id", sa.BigInteger(), nullable=False),
        sa.Column("capability", sa.String(16), nullable=False),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(128), nullable=False),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("default_params", postgresql.JSONB(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["ai_provider.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider_id", "model_name", name="uq_ai_model_provider_modelname"
        ),
    )
    op.create_index("ix_ai_model_capability", "ai_model", ["capability"])


def downgrade() -> None:
    op.drop_index("ix_ai_model_capability", table_name="ai_model")
    op.drop_table("ai_model")
    op.drop_table("ai_provider")
