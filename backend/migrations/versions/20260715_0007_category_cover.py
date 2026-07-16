"""add article category cover

Revision ID: 20260715_0007
Revises: 20260714_0006
"""

from typing import Sequence, Union

from sqlalchemy import inspect
import sqlalchemy as sa
from alembic import op


revision: str = "20260715_0007"
down_revision: Union[str, None] = "20260714_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    columns = {
        column["name"]
        for column in inspector.get_columns("categories")
    }

    if "cover_url" not in columns:
        op.add_column(
            "categories",
            sa.Column(
                "cover_url",
                sa.String(length=500),
                nullable=False,
                server_default="",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    columns = {
        column["name"]
        for column in inspector.get_columns("categories")
    }

    if "cover_url" in columns:
        op.drop_column("categories", "cover_url")
