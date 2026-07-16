"""Establish the content reliability baseline.

Revision ID: 20260714_0001
Revises:
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.database import Base
from app import models  # noqa: F401


revision: str = "20260714_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def column_names(bind, table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table_name)}


def index_names(bind, table_name: str) -> set[str]:
    return {index["name"] for index in sa.inspect(bind).get_indexes(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    entry_columns = column_names(bind, "content_entries")
    if "visibility" not in entry_columns:
        op.add_column("content_entries", sa.Column("visibility", sa.String(32), nullable=False, server_default="public"))
    if "revision" not in entry_columns:
        op.add_column("content_entries", sa.Column("revision", sa.Integer(), nullable=False, server_default="1"))
    if "archived_at" not in entry_columns:
        op.add_column("content_entries", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))

    version_columns = column_names(bind, "content_versions")
    if "snapshot_hash" not in version_columns:
        op.add_column("content_versions", sa.Column("snapshot_hash", sa.String(64), nullable=False, server_default=""))
    if "reason" not in version_columns:
        op.add_column("content_versions", sa.Column("reason", sa.String(40), nullable=False, server_default="manual_save"))
    if "created_by_email" not in version_columns:
        op.add_column("content_versions", sa.Column("created_by_email", sa.String(255), nullable=False, server_default=""))

    version_indexes = index_names(bind, "content_versions")
    if "ix_content_versions_snapshot_hash" not in version_indexes:
        op.create_index("ix_content_versions_snapshot_hash", "content_versions", ["snapshot_hash"])


def downgrade() -> None:
    bind = op.get_bind()
    if "content_drafts" in sa.inspect(bind).get_table_names():
        op.drop_table("content_drafts")
    version_columns = column_names(bind, "content_versions")
    if "created_by_email" in version_columns:
        op.drop_column("content_versions", "created_by_email")
    if "reason" in version_columns:
        op.drop_column("content_versions", "reason")
    if "snapshot_hash" in version_columns:
        op.drop_column("content_versions", "snapshot_hash")
    entry_columns = column_names(bind, "content_entries")
    if "archived_at" in entry_columns:
        op.drop_column("content_entries", "archived_at")
    if "revision" in entry_columns:
        op.drop_column("content_entries", "revision")
    if "visibility" in entry_columns:
        op.drop_column("content_entries", "visibility")
