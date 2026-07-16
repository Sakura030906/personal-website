"""Record the account responsible for each content version.

Revision ID: 20260714_0002
Revises: 20260714_0001
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260714_0002"
down_revision: Union[str, Sequence[str], None] = "20260714_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("content_versions")}
    if "created_by_email" not in columns:
        op.add_column(
            "content_versions",
            sa.Column("created_by_email", sa.String(255), nullable=False, server_default=""),
        )


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("content_versions")}
    if "created_by_email" in columns:
        op.drop_column("content_versions", "created_by_email")
