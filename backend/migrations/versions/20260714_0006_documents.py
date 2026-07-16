"""Add parsed documents and editable document chunks.

Revision ID: 20260714_0006
Revises: 20260714_0005
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260714_0006"
down_revision: Union[str, Sequence[str], None] = "20260714_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "documents" not in tables:
        op.create_table(
            "documents",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(160), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False, server_default=""),
            sa.Column("original_filename", sa.String(255), nullable=False),
            sa.Column("stored_filename", sa.String(255), nullable=False),
            sa.Column("content_type", sa.String(120), nullable=False, server_default="application/octet-stream"),
            sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("file_url", sa.String(500), nullable=False, server_default=""),
            sa.Column("parser", sa.String(40), nullable=False, server_default="text"),
            sa.Column("status", sa.String(32), nullable=False, server_default="processing"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="private"),
            sa.Column("allow_ai_search", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("column_id", sa.Integer(), sa.ForeignKey("knowledge_columns.id"), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),
            sa.Column("parse_error", sa.Text(), nullable=False, server_default=""),
            sa.Column("chunk_size", sa.Integer(), nullable=False, server_default="900"),
            sa.Column("chunk_overlap", sa.Integer(), nullable=False, server_default="150"),
            sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("slug"),
            sa.UniqueConstraint("stored_filename"),
        )
        op.create_index("ix_documents_slug", "documents", ["slug"])
        op.create_index("ix_documents_status", "documents", ["status"])
        op.create_index("ix_documents_visibility", "documents", ["visibility"])
        op.create_index("ix_documents_column_id", "documents", ["column_id"])
    if "document_nodes" not in tables:
        op.create_table(
            "document_nodes",
            sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), primary_key=True),
            sa.Column("node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), primary_key=True),
        )
    if "document_chunks" not in tables:
        op.create_table(
            "document_chunks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=False),
            sa.Column("chunk_index", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("heading", sa.String(255), nullable=False, server_default=""),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column("page_start", sa.Integer(), nullable=True),
            sa.Column("page_end", sa.Integer(), nullable=True),
            sa.Column("metadata_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("embedding_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("embedding_provider", sa.String(60), nullable=False, server_default="local"),
            sa.Column("embedding_model", sa.String(120), nullable=False, server_default="hash"),
            sa.Column("embedding_dimensions", sa.Integer(), nullable=False, server_default="128"),
            sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("content_hash", sa.String(64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
        op.create_index("ix_document_chunks_is_enabled", "document_chunks", ["is_enabled"])
        op.create_index("ix_document_chunks_content_hash", "document_chunks", ["content_hash"])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    for table in ["document_chunks", "document_nodes", "documents"]:
        if table in tables:
            op.drop_table(table)
