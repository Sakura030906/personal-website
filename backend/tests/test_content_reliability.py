import json

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import ContentDraft, ContentEntry, ContentVersion
from app.routers import admin, public
from app.schemas import ContentAutosaveIn, ContentEntryIn, ContentEntryUpdate


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


def entry_input(**overrides):
    payload = {
        "entity_type": "post",
        "slug": "reliable-content",
        "title": "已发布正文",
        "summary": "原摘要",
        "content_md": "第一版正文",
        "metadata_json": json.dumps({"tags": ["CMS"]}, ensure_ascii=False),
        "status": "draft",
        "visibility": "public",
        "category": "工程实践",
    }
    payload.update(overrides)
    return ContentEntryIn(**payload)


def test_autosave_is_separate_from_canonical_content(session):
    entry = admin.create_entry(entry_input(), user="admin@example.com", session=session)
    draft_payload = entry_input(title="自动草稿标题", content_md="尚未确认的正文").model_dump()

    draft = admin.autosave_entry(
        entry.id,
        ContentAutosaveIn(**draft_payload, expected_revision=entry.revision),
        user="admin@example.com",
        session=session,
    )

    canonical = session.get(ContentEntry, entry.id)
    assert canonical.title == "已发布正文"
    assert canonical.content_md == "第一版正文"
    assert draft.payload["title"] == "自动草稿标题"
    assert session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry.id)) is not None
    autosave_version = session.scalar(
        select(ContentVersion)
        .where(ContentVersion.entity_id == entry.id, ContentVersion.reason == "autosave")
        .order_by(ContentVersion.id.desc())
    )
    assert autosave_version.created_by_email == "admin@example.com"


def test_manual_save_clears_draft_and_rejects_stale_revision(session):
    entry = admin.create_entry(entry_input(), user="admin@example.com", session=session)
    payload = entry_input(title="自动草稿").model_dump()
    admin.autosave_entry(
        entry.id,
        ContentAutosaveIn(**payload, expected_revision=1),
        user="admin@example.com",
        session=session,
    )

    saved = admin.update_entry(
        entry.id,
        ContentEntryUpdate(**payload, expected_revision=1),
        user="admin@example.com",
        session=session,
    )
    assert saved.revision == 2
    assert saved.title == "自动草稿"
    assert session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry.id)) is None

    with pytest.raises(HTTPException) as exc:
        admin.update_entry(
            entry.id,
            ContentEntryUpdate(**payload, expected_revision=1),
            user="admin@example.com",
            session=session,
        )
    assert exc.value.status_code == 409


def test_visibility_publish_archive_and_restore(session):
    entry = admin.create_entry(entry_input(), user="admin@example.com", session=session)
    published = admin.publish_entry(entry.id, user="admin@example.com", session=session)
    assert published.status == "published"

    archived = admin.archive_entry(entry.id, user="admin@example.com", session=session)
    assert archived.status == "archived"

    created_version = session.scalar(
        select(ContentVersion)
        .where(ContentVersion.entity_id == entry.id, ContentVersion.reason == "created")
        .order_by(ContentVersion.id.asc())
    )
    restored = admin.restore_version(
        created_version.id,
        user="admin@example.com",
        session=session,
    )
    assert restored.status == "draft"
    assert restored.revision == 4


def test_version_diff_reports_changed_fields(session):
    entry = admin.create_entry(entry_input(), user="admin@example.com", session=session)
    created_version = session.scalar(
        select(ContentVersion).where(ContentVersion.entity_id == entry.id, ContentVersion.reason == "created")
    )
    update = entry_input(title="第二版", content_md="第一版正文\n新增一行").model_dump()
    admin.update_entry(
        entry.id,
        ContentEntryUpdate(**update, expected_revision=1),
        user="admin@example.com",
        session=session,
    )

    diff = admin.version_diff(created_version.id, _="admin@example.com", session=session)
    assert "title" in diff["changed_fields"]
    assert "content_md" in diff["changed_fields"]
    assert "+新增一行" in diff["content_diff"]


def test_permanent_delete_cleans_drafts_versions_and_index(session):
    entry = admin.create_entry(entry_input(), user="admin@example.com", session=session)
    payload = entry_input(title="待删除草稿").model_dump()
    admin.autosave_entry(
        entry.id,
        ContentAutosaveIn(**payload, expected_revision=1),
        user="admin@example.com",
        session=session,
    )

    admin.delete_entry(entry.id, _="admin@example.com", session=session)

    assert session.get(ContentEntry, entry.id) is None
    assert session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry.id)) is None
    assert session.scalar(select(ContentVersion).where(ContentVersion.entity_id == entry.id)) is None
