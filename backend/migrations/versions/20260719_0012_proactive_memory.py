"""Add proactive tasks and confirmed long-term memories.

Revision ID: 20260719_0012
Revises: 20260719_0011
"""

from alembic import op
import sqlalchemy as sa


revision = "20260719_0012"
down_revision = "20260719_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "proactive_tasks" not in tables:
        op.create_table(
            "proactive_tasks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("fingerprint", sa.String(64), nullable=False),
            sa.Column("task_type", sa.String(40), nullable=False),
            sa.Column("priority", sa.String(16), nullable=False, server_default="medium"),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
            sa.Column("source_type", sa.String(40), nullable=False, server_default=""),
            sa.Column("source_id", sa.Integer(), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("fingerprint", name="uq_proactive_tasks_fingerprint"),
        )
        for column in ("fingerprint", "task_type", "priority", "status", "source_type", "due_at"):
            op.create_index(f"ix_proactive_tasks_{column}", "proactive_tasks", [column])
    if "long_term_memories" not in tables:
        op.create_table(
            "long_term_memories",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("memory_type", sa.String(32), nullable=False, server_default="context"),
            sa.Column("status", sa.String(32), nullable=False, server_default="candidate"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="private"),
            sa.Column("source_type", sa.String(40), nullable=False, server_default="manual"),
            sa.Column("source_id", sa.Integer(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=False, server_default="1"),
            sa.Column("confirmed_by_email", sa.String(255), nullable=False, server_default=""),
            sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        for column in ("memory_type", "status", "visibility"):
            op.create_index(f"ix_long_term_memories_{column}", "long_term_memories", [column])


def downgrade() -> None:
    op.drop_table("long_term_memories")
    op.drop_table("proactive_tasks")
