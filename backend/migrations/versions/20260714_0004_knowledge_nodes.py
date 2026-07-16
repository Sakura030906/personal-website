"""Create normalized knowledge nodes and relations.

Revision ID: 20260714_0004
Revises: 20260714_0003
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260714_0004"
down_revision: Union[str, Sequence[str], None] = "20260714_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    if "knowledge_nodes" not in existing:
        op.create_table(
            "knowledge_nodes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(160), nullable=False, unique=True),
            sa.Column("summary", sa.Text(), nullable=False, server_default=""),
            sa.Column("content_markdown", sa.Text(), nullable=False, server_default=""),
            sa.Column("node_type", sa.String(32), nullable=False, server_default="concept"),
            sa.Column("importance", sa.Integer(), nullable=False, server_default="3"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="public"),
            sa.Column("allow_ai_search", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_knowledge_nodes_slug", "knowledge_nodes", ["slug"])
        op.create_index("ix_knowledge_nodes_node_type", "knowledge_nodes", ["node_type"])
        op.create_index("ix_knowledge_nodes_visibility", "knowledge_nodes", ["visibility"])

    existing = set(sa.inspect(bind).get_table_names())
    if "node_tags" not in existing:
        op.create_table(
            "node_tags",
            sa.Column("node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), primary_key=True),
            sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id"), primary_key=True),
        )
    if "knowledge_column_nodes" not in existing:
        op.create_table(
            "knowledge_column_nodes",
            sa.Column("column_id", sa.Integer(), sa.ForeignKey("knowledge_columns.id"), primary_key=True),
            sa.Column("node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), primary_key=True),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
    if "article_nodes" not in existing:
        op.create_table(
            "article_nodes",
            sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), primary_key=True),
            sa.Column("node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), primary_key=True),
            sa.Column("relation_type", sa.String(40), nullable=False, server_default="references"),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
    if "knowledge_relations" not in existing:
        op.create_table(
            "knowledge_relations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("source_node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), nullable=False),
            sa.Column("target_node_id", sa.Integer(), sa.ForeignKey("knowledge_nodes.id"), nullable=False),
            sa.Column("relation_type", sa.String(40), nullable=False, server_default="related_to"),
            sa.Column("relation_label", sa.String(120), nullable=False, server_default=""),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("weight", sa.Float(), nullable=False, server_default="1"),
            sa.Column("direction", sa.String(24), nullable=False, server_default="directed"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("source_node_id", "target_node_id", "relation_type", name="uq_knowledge_relation"),
        )
        op.create_index("ix_knowledge_relations_source_node_id", "knowledge_relations", ["source_node_id"])
        op.create_index("ix_knowledge_relations_target_node_id", "knowledge_relations", ["target_node_id"])
        op.create_index("ix_knowledge_relations_relation_type", "knowledge_relations", ["relation_type"])


def downgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for table in ["knowledge_relations", "article_nodes", "knowledge_column_nodes", "node_tags", "knowledge_nodes"]:
        if table in existing:
            op.drop_table(table)
