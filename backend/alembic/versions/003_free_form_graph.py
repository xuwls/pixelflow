"""free-form node graph schema

Revision ID: 003
Revises: 002
Create Date: 2026-05-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── workflow_node: drop pipeline-specific columns/constraints, add free-form columns ──
    # Use raw SQL to tolerate partially-migrated schemas
    op.execute("ALTER TABLE workflow_node DROP CONSTRAINT IF EXISTS uq_project_node_type")
    op.execute("ALTER TABLE workflow_node DROP CONSTRAINT IF EXISTS uq_project_node_index")

    # Wipe legacy pipeline rows — old projects' nodes are not migratable to the new model.
    op.execute("DELETE FROM workflow_node")

    # Add free-form columns if they don't already exist
    for col_sql in [
        "ALTER TABLE workflow_node ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'text'",
        "ALTER TABLE workflow_node ADD COLUMN IF NOT EXISTS title VARCHAR(255)",
        "ALTER TABLE workflow_node ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION NOT NULL DEFAULT 0",
        "ALTER TABLE workflow_node ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION NOT NULL DEFAULT 0",
        "ALTER TABLE workflow_node ADD COLUMN IF NOT EXISTS prompt TEXT",
    ]:
        op.execute(col_sql)

    # status default changes pending → idle for free-form nodes
    op.execute("ALTER TABLE workflow_node ALTER COLUMN status SET DEFAULT 'idle'")

    # Drop legacy columns if they exist
    for col in ["node_type", "node_index", "input_json", "canvas_x", "canvas_y"]:
        op.execute(f"ALTER TABLE workflow_node DROP COLUMN IF EXISTS {col}")

    # ── workflow_edge: new table ─────────────────────────────────────────
    op.create_table(
        "workflow_edge",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("source_node_id", sa.BigInteger(), nullable=False),
        sa.Column("target_node_id", sa.BigInteger(), nullable=False),
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
        sa.ForeignKeyConstraint(["project_id"], ["project.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_node_id"], ["workflow_node.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_node_id"], ["workflow_node.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_node_id", "target_node_id", name="uq_edge_source_target"
        ),
    )
    op.create_index(
        "ix_workflow_edge_project", "workflow_edge", ["project_id"], unique=False
    )

    # ── workflow_run: per-node runs ──────────────────────────────────────
    op.add_column(
        "workflow_run", sa.Column("node_id", sa.BigInteger(), nullable=True)
    )
    op.create_foreign_key(
        "fk_workflow_run_node",
        "workflow_run",
        "workflow_node",
        ["node_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_workflow_run_node", "workflow_run", type_="foreignkey")
    op.drop_column("workflow_run", "node_id")

    op.drop_index("ix_workflow_edge_project", table_name="workflow_edge")
    op.drop_table("workflow_edge")

    op.add_column(
        "workflow_node",
        sa.Column("input_json", sa.dialects.postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "workflow_node",
        sa.Column("node_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "workflow_node",
        sa.Column("node_type", sa.String(64), nullable=False, server_default="text"),
    )
    op.alter_column(
        "workflow_node",
        "status",
        server_default="pending",
        existing_type=sa.String(32),
        existing_nullable=False,
    )
    op.drop_column("workflow_node", "prompt")
    op.drop_column("workflow_node", "position_y")
    op.drop_column("workflow_node", "position_x")
    op.drop_column("workflow_node", "title")
    op.drop_column("workflow_node", "kind")

    op.create_unique_constraint(
        "uq_project_node_index", "workflow_node", ["project_id", "node_index"]
    )
    op.create_unique_constraint(
        "uq_project_node_type", "workflow_node", ["project_id", "node_type"]
    )
