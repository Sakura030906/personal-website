"""Create normalized articles, taxonomy, and knowledge columns.

Revision ID: 20260714_0003
Revises: 20260714_0002
Create Date: 2026-07-14
"""
import json
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260714_0003"
down_revision: Union[str, Sequence[str], None] = "20260714_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def slugify(value: str) -> str:
    slug = re.sub(r"[^\w\u4e00-\u9fa5-]+", "-", (value or "").strip().lower())
    return re.sub(r"-+", "-", slug).strip("-")[:120] or "general"


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())

    if "categories" not in existing:
        op.create_table(
            "categories",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(80), nullable=False),
            sa.Column("slug", sa.String(120), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("name"),
            sa.UniqueConstraint("slug"),
        )
        op.create_index("ix_categories_name", "categories", ["name"])
        op.create_index("ix_categories_slug", "categories", ["slug"])

    if "tags" not in existing:
        op.create_table(
            "tags",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(80), nullable=False),
            sa.Column("slug", sa.String(120), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("name"),
            sa.UniqueConstraint("slug"),
        )
        op.create_index("ix_tags_name", "tags", ["name"])
        op.create_index("ix_tags_slug", "tags", ["slug"])

    if "knowledge_columns" not in existing:
        op.create_table(
            "knowledge_columns",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(160), nullable=False),
            sa.Column("slug", sa.String(160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("cover_url", sa.String(500), nullable=False, server_default=""),
            sa.Column("icon", sa.String(80), nullable=False, server_default="book-open"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="public"),
            sa.Column("allow_ai_search", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("slug"),
        )
        op.create_index("ix_knowledge_columns_slug", "knowledge_columns", ["slug"])
        op.create_index("ix_knowledge_columns_visibility", "knowledge_columns", ["visibility"])

    if "articles" not in existing:
        op.create_table(
            "articles",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("slug", sa.String(160), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False, server_default=""),
            sa.Column("content_markdown", sa.Text(), nullable=False, server_default=""),
            sa.Column("content_html", sa.Text(), nullable=False, server_default=""),
            sa.Column("cover_url", sa.String(500), nullable=False, server_default=""),
            sa.Column("seo_title", sa.String(255), nullable=False, server_default=""),
            sa.Column("seo_description", sa.Text(), nullable=False, server_default=""),
            sa.Column("canonical_url", sa.String(500), nullable=False, server_default=""),
            sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
            sa.Column("visibility", sa.String(32), nullable=False, server_default="public"),
            sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=True),
            sa.Column("is_top", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("allow_ai_search", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("revision", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("slug"),
        )
        op.create_index("ix_articles_slug", "articles", ["slug"])
        op.create_index("ix_articles_status", "articles", ["status"])
        op.create_index("ix_articles_visibility", "articles", ["visibility"])
        op.create_index("ix_articles_category_id", "articles", ["category_id"])

    existing = set(sa.inspect(bind).get_table_names())
    if "article_drafts" not in existing:
        op.create_table(
            "article_drafts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), nullable=False),
            sa.Column("payload_json", sa.Text(), nullable=False),
            sa.Column("content_hash", sa.String(64), nullable=False),
            sa.Column("base_revision", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("article_id"),
        )
        op.create_index("ix_article_drafts_article_id", "article_drafts", ["article_id"])
        op.create_index("ix_article_drafts_content_hash", "article_drafts", ["content_hash"])

    if "article_tags" not in existing:
        op.create_table(
            "article_tags",
            sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), primary_key=True),
            sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id"), primary_key=True),
        )

    if "article_columns" not in existing:
        op.create_table(
            "article_columns",
            sa.Column("article_id", sa.Integer(), sa.ForeignKey("articles.id"), primary_key=True),
            sa.Column("column_id", sa.Integer(), sa.ForeignKey("knowledge_columns.id"), primary_key=True),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )

    migrate_legacy_posts(bind)


def migrate_legacy_posts(bind) -> None:
    tables = set(sa.inspect(bind).get_table_names())
    if "content_entries" not in tables:
        return
    metadata = sa.MetaData()
    entries = sa.Table("content_entries", metadata, autoload_with=bind)
    articles = sa.Table("articles", metadata, autoload_with=bind)
    categories = sa.Table("categories", metadata, autoload_with=bind)
    tags = sa.Table("tags", metadata, autoload_with=bind)
    article_tags = sa.Table("article_tags", metadata, autoload_with=bind)

    for row in bind.execute(sa.select(entries).where(entries.c.entity_type == "post")).mappings():
        if bind.execute(sa.select(articles.c.id).where(articles.c.slug == row["slug"])).first():
            continue
        category_id = None
        category_name = (row.get("category") or "").strip()
        if category_name:
            category_id = bind.execute(sa.select(categories.c.id).where(categories.c.name == category_name)).scalar()
            if category_id is None:
                result = bind.execute(categories.insert().values(name=category_name, slug=slugify(category_name)))
                category_id = result.inserted_primary_key[0]
        try:
            extra = json.loads(row.get("metadata_json") or "{}")
        except json.JSONDecodeError:
            extra = {}
        result = bind.execute(
            articles.insert().values(
                title=row["title"],
                slug=row["slug"],
                summary=row.get("summary") or "",
                content_markdown=row.get("content_md") or "",
                cover_url=extra.get("cover", ""),
                seo_title=extra.get("seoTitle", ""),
                seo_description=extra.get("seoDescription", ""),
                canonical_url=extra.get("canonical", ""),
                status=row.get("status") or "draft",
                visibility=row.get("visibility") or "public",
                category_id=category_id,
                revision=row.get("revision") or 1,
                created_at=row.get("created_at"),
                published_at=row.get("published_at"),
                archived_at=row.get("archived_at"),
                updated_at=row.get("updated_at"),
            )
        )
        article_id = result.inserted_primary_key[0]
        for tag_name in extra.get("tags", []):
            tag_name = str(tag_name).strip()
            if not tag_name:
                continue
            tag_id = bind.execute(sa.select(tags.c.id).where(tags.c.name == tag_name)).scalar()
            if tag_id is None:
                tag_result = bind.execute(tags.insert().values(name=tag_name, slug=slugify(tag_name)))
                tag_id = tag_result.inserted_primary_key[0]
            bind.execute(article_tags.insert().values(article_id=article_id, tag_id=tag_id))


def downgrade() -> None:
    for table in ["article_columns", "article_tags", "article_drafts", "articles", "knowledge_columns", "tags", "categories"]:
        if table in sa.inspect(op.get_bind()).get_table_names():
            op.drop_table(table)
