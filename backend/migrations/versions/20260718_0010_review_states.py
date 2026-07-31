"""Add persistent review scheduling.

Revision ID: 20260718_0010
Revises: 20260718_0009
"""

from alembic import op
import sqlalchemy as sa


revision = "20260718_0010"
down_revision = "20260718_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "review_states" in inspector.get_table_names():
        return
    op.create_table(
        "review_states",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_type", sa.String(32), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("entity_type", "entity_id", name="uq_review_state_entity"),
    )
    for column in ("entity_type", "entity_id", "status", "next_review_at"):
        op.create_index(f"ix_review_states_{column}", "review_states", [column])


def downgrade() -> None:
    op.drop_table("review_states")
