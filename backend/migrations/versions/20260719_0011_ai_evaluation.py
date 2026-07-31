"""Add persistent AI evaluation suites and runs.

Revision ID: 20260719_0011
Revises: 20260718_0010
"""

from alembic import op
import sqlalchemy as sa


revision = "20260719_0011"
down_revision = "20260718_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = inspector.get_table_names()
    if "ai_eval_suites" not in tables:
        op.create_table(
            "ai_eval_suites",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(160), nullable=False),
            sa.Column("eval_type", sa.String(32), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("cases_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_by_email", sa.String(255), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("slug", name="uq_ai_eval_suites_slug"),
        )
        op.create_index("ix_ai_eval_suites_slug", "ai_eval_suites", ["slug"])
        op.create_index("ix_ai_eval_suites_eval_type", "ai_eval_suites", ["eval_type"])
        op.create_index("ix_ai_eval_suites_is_active", "ai_eval_suites", ["is_active"])
    if "ai_eval_runs" not in tables:
        op.create_table(
            "ai_eval_runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("suite_id", sa.Integer(), sa.ForeignKey("ai_eval_suites.id"), nullable=False),
            sa.Column("eval_type", sa.String(32), nullable=False),
            sa.Column("suite_version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("mode", sa.String(32), nullable=False, server_default="local"),
            sa.Column("status", sa.String(32), nullable=False, server_default="completed"),
            sa.Column("metrics_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("result_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("regression_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_by_email", sa.String(255), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        for column in ("suite_id", "eval_type", "mode", "status", "created_at"):
            op.create_index(f"ix_ai_eval_runs_{column}", "ai_eval_runs", [column])


def downgrade() -> None:
    op.drop_table("ai_eval_runs")
    op.drop_table("ai_eval_suites")
