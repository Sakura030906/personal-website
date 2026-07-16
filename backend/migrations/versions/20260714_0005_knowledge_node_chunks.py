"""Add persisted chunks for standardized knowledge nodes.

Revision ID: 20260714_0005
Revises: 20260714_0004
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260714_0005"
down_revision: Union[str, Sequence[str], None] = "20260714_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "knowledge_node_chunks" in set(sa.inspect(op.get_bind()).get_table_names()):
        return
    op.create_table(
        "knowledge_node_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), nullable=False),
        sa.Column("slug", sa.String(160), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("embedding_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("embedding_provider", sa.String(60), nullable=False, server_default="local"),
        sa.Column("embedding_model", sa.String(120), nullable=False, server_default="hash"),
        sa.Column("embedding_dimensions", sa.Integer(), nullable=False, server_default="128"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_knowledge_node_chunks_node_id", "knowledge_node_chunks", ["node_id"])
    op.create_index("ix_knowledge_node_chunks_slug", "knowledge_node_chunks", ["slug"])
    op.create_index("ix_knowledge_node_chunks_content_hash", "knowledge_node_chunks", ["content_hash"])


def downgrade() -> None:
    if "knowledge_node_chunks" in set(sa.inspect(op.get_bind()).get_table_names()):
        op.drop_table("knowledge_node_chunks")
