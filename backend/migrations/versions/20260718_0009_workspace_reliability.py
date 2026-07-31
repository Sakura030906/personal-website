"""Add inbox, activity log, and soft deletion.

Revision ID: 20260718_0009
Revises: 20260715_0008
"""

from alembic import op
import sqlalchemy as sa


revision = "20260718_0009"
down_revision = "20260715_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table in ("content_entries", "articles", "knowledge_columns", "knowledge_nodes", "documents"):
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "deleted_at" not in columns:
            op.add_column(table, sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
            op.create_index(f"ix_{table}_deleted_at", table, ["deleted_at"])

    tables = set(inspector.get_table_names())
    if "inbox_items" not in tables:
        op.create_table(
            "inbox_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False, server_default=""),
            sa.Column("body", sa.Text(), nullable=False, server_default=""),
            sa.Column("source_url", sa.String(1000), nullable=False, server_default=""),
            sa.Column("item_type", sa.String(32), nullable=False, server_default="note"),
            sa.Column("status", sa.String(32), nullable=False, server_default="inbox"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="private"),
            sa.Column("target_entity_type", sa.String(32), nullable=False, server_default=""),
            sa.Column("target_entity_id", sa.Integer(), nullable=True),
            sa.Column("created_by_email", sa.String(255), nullable=False, server_default=""),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
        for column in ("item_type", "status", "visibility", "deleted_at"):
            op.create_index(f"ix_inbox_items_{column}", "inbox_items", [column])

    if "activity_events" not in tables:
        op.create_table(
            "activity_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("action", sa.String(64), nullable=False),
            sa.Column("entity_type", sa.String(32), nullable=False),
            sa.Column("entity_id", sa.Integer(), nullable=True),
            sa.Column("entity_title", sa.String(255), nullable=False, server_default=""),
            sa.Column("actor_email", sa.String(255), nullable=False, server_default=""),
            sa.Column("detail_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        for column in ("action", "entity_type", "entity_id", "created_at"):
            op.create_index(f"ix_activity_events_{column}", "activity_events", [column])


def downgrade() -> None:
    op.drop_table("activity_events")
    op.drop_table("inbox_items")
    for table in ("documents", "knowledge_nodes", "knowledge_columns", "articles", "content_entries"):
        op.drop_index(f"ix_{table}_deleted_at", table_name=table)
        op.drop_column(table, "deleted_at")
