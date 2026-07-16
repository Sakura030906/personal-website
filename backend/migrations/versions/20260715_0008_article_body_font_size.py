from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260715_0008"
down_revision = "20260715_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {
        column["name"]
        for column in inspect(bind).get_columns("articles")
    }

    if "body_font_size" not in columns:
        op.add_column(
            "articles",
            sa.Column(
                "body_font_size",
                sa.Integer(),
                nullable=False,
                server_default="18",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    columns = {
        column["name"]
        for column in inspect(bind).get_columns("articles")
    }

    if "body_font_size" in columns:
        op.drop_column("articles", "body_font_size")