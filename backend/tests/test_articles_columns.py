import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Article, ArticleDraft, ArticleTag, Category, KnowledgeColumn, Tag
from app.routers import articles, public
from app.schemas import ArticleAutosave, ArticleWrite, KnowledgeColumnWrite
from app.site_sync import sync_site_document


@pytest.fixture()
def session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    Base.metadata.drop_all(engine)


def article_payload(column_id=None, **overrides):
    metadata = {
        "tags": ["RAG", "FastAPI"],
        "seoTitle": "RAG 工程实践",
        "seoDescription": "测试独立文章模型",
        "cover": "/uploads/rag.png",
        "columnCover": "/uploads/rag-column.png",
        "columnDescription": "AI 工程文章专栏",
        "bodyFontSize": 20,
        "allowAiSearch": True,
        "columnIds": [column_id] if column_id else [],
        "primaryColumnId": column_id,
    }
    payload = {
        "entity_type": "post",
        "slug": "rag-engineering",
        "title": "RAG 工程实践",
        "summary": "文章摘要",
        "content_md": "# RAG\n\n正式正文",
        "metadata_json": json.dumps(metadata, ensure_ascii=False),
        "status": "draft",
        "visibility": "public",
        "category": "AI 工程",
    }
    payload.update(overrides)
    return payload


def create_column(session):
    return articles.create_column(
        KnowledgeColumnWrite(
            name="RAG 系统",
            slug="rag-systems",
            description="检索增强生成知识专栏",
            sort_order=1,
        ),
        _="admin@example.com",
        session=session,
    )


def test_article_taxonomy_column_and_public_reading(session):
    column = create_column(session)
    created = articles.create_article(
        ArticleWrite(**article_payload(column["id"])),
        user="admin@example.com",
        session=session,
    )
    assert created["category"] == "AI 工程"
    assert created["tags"] == ["FastAPI", "RAG"]
    assert created["columnIds"] == [column["id"]]
    category = session.scalar(select(Category).where(Category.name == "AI 工程"))
    assert category is not None
    assert category.cover_url == "/uploads/rag-column.png"
    assert created["columnCover"] == "/uploads/rag-column.png"
    assert created["columnDescription"] == "AI 工程文章专栏"
    assert created["bodyFontSize"] == 20
    assert len(list(session.scalars(select(Tag)))) == 2
    assert len(list(session.scalars(select(ArticleTag)))) == 2

    published = articles.publish_article(created["id"], user="admin@example.com", session=session)
    assert published["status"] == "published"
    assert public.public_articles(session=session)["total"] == 1
    detail = public.public_article("rag-engineering", session=session)
    assert detail["columns"][0]["slug"] == "rag-systems"
    column_detail = public.public_column("rag-systems", session=session)
    assert column_detail["article_count"] == 1
    assert column_detail["articles"][0]["slug"] == "rag-engineering"


def test_article_autosave_conflict_and_archive(session):
    created = articles.create_article(
        ArticleWrite(**article_payload()),
        user="admin@example.com",
        session=session,
    )
    draft_data = article_payload(title="自动草稿", content_md="尚未确认的正文")
    draft = articles.autosave_article(
        created["id"],
        ArticleAutosave(**draft_data, expected_revision=1),
        user="admin@example.com",
        session=session,
    )
    canonical = session.get(Article, created["id"])
    assert canonical.title == "RAG 工程实践"
    assert draft["payload"]["title"] == "自动草稿"
    assert session.scalar(select(ArticleDraft).where(ArticleDraft.article_id == created["id"])) is not None

    saved = articles.update_article(
        created["id"],
        ArticleWrite(**draft_data, expected_revision=1),
        user="admin@example.com",
        session=session,
    )
    assert saved["revision"] == 2
    assert session.scalar(select(ArticleDraft).where(ArticleDraft.article_id == created["id"])) is None

    with pytest.raises(HTTPException) as exc:
        articles.update_article(
            created["id"],
            ArticleWrite(**draft_data, expected_revision=1),
            user="admin@example.com",
            session=session,
        )
    assert exc.value.status_code == 409

    articles.publish_article(created["id"], user="admin@example.com", session=session)
    assert public.public_articles(session=session)["total"] == 1
    archived = articles.archive_article(created["id"], user="admin@example.com", session=session)
    assert archived["status"] == "archived"
    assert public.public_articles(session=session)["total"] == 0


def test_site_json_posts_sync_into_normalized_articles(session):
    sync_site_document(
        session,
        {
            "posts": [
                {
                    "title": "同步文章",
                    "slug": "synced-article",
                    "summary": "来自旧 JSON 的文章",
                    "content": "# 同步正文",
                    "status": "published",
                    "visibility": "public",
                    "category": "迁移",
                    "tags": ["CMS"],
                }
            ]
        },
    )
    session.commit()

    article = session.scalar(select(Article).where(Article.slug == "synced-article"))
    assert article is not None
    assert article.status == "published"
    assert public.public_article("synced-article", session=session)["tags"] == ["CMS"]
