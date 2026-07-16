from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.document_service import parse_and_rechunk
from app.models import Document, KnowledgeColumn
from app.routers import ai
from app.schemas import AskRequest, RetrievalScope


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


def parsed_document(session: Session, tmp_path: Path, *, title: str, slug: str, content: str, visibility: str, column_id: int | None = None):
    source = tmp_path / f"{slug}.md"
    source.write_text(f"# {title}\n\n{content}", encoding="utf-8")
    document = Document(
        title=title,
        slug=slug,
        original_filename=source.name,
        stored_filename=source.name,
        content_type="text/markdown",
        file_url=f"/uploads/documents/{source.name}",
        visibility=visibility,
        allow_ai_search=True,
        status="processing",
        column_id=column_id,
        chunk_size=400,
        chunk_overlap=40,
    )
    session.add(document)
    session.flush()
    parse_and_rechunk(session, document, source)
    session.commit()
    return document


def test_document_only_scope_returns_chunk_citation(session, tmp_path):
    document = parsed_document(
        session,
        tmp_path,
        title="RAG Import Guide",
        slug="rag-import-guide",
        content="The copper-orchid pipeline validates metadata before vector indexing.",
        visibility="public",
    )
    parsed_document(
        session,
        tmp_path,
        title="Unrelated Guide",
        slug="unrelated-guide",
        content="The copper-orchid phrase also appears here but this document is outside the selected scope.",
        visibility="public",
    )

    response = ai.ask(
        AskRequest(
            question="What does the copper-orchid pipeline validate?",
            limit=5,
            session_id="document-scope",
            scope=RetrievalScope(entity_types=["document"], document_ids=[document.id]),
        ),
        session=session,
    )

    assert response.sources
    assert {source.document_id for source in response.sources} == {document.id}
    assert response.sources[0].document_chunk_id is not None
    assert response.sources[0].url.startswith("/uploads/documents/rag-import-guide.md")
    assert response.scope["resolved_document_ids"] == [document.id]


def test_column_scope_resolves_public_document(session, tmp_path):
    column = KnowledgeColumn(name="Agent Memory", slug="agent-memory", visibility="public", allow_ai_search=True)
    session.add(column)
    session.flush()
    document = parsed_document(
        session,
        tmp_path,
        title="Memory Notes",
        slug="memory-notes",
        content="The silver-maple memory policy keeps durable facts separate from session context.",
        visibility="public",
        column_id=column.id,
    )

    response = ai.ask(
        AskRequest(
            question="What does the silver-maple memory policy do?",
            scope=RetrievalScope(column_ids=[column.id]),
        ),
        session=session,
    )
    assert any(source.document_id == document.id for source in response.sources)
    assert response.scope["resolved_document_ids"] == [document.id]


def test_private_document_never_enters_public_scope(session, tmp_path):
    private_document = parsed_document(
        session,
        tmp_path,
        title="Private Operations",
        slug="private-operations",
        content="The violet-anchor credential is private and must never be cited.",
        visibility="private",
    )

    response = ai.ask(
        AskRequest(
            question="What is the violet-anchor credential?",
            scope=RetrievalScope(entity_types=["document"], document_ids=[private_document.id]),
        ),
        session=session,
    )
    assert response.sources == []
    assert response.generator == "guardrail"
    options = ai.public_retrieval_scopes(session=session)
    assert all(item["id"] != private_document.id for item in options["documents"])


def test_chinese_question_is_grounded_by_document_terms(session, tmp_path):
    document = parsed_document(
        session,
        tmp_path,
        title="文档知识库说明",
        slug="document-library-guide",
        content="文档知识库支持 PDF、DOCX、Markdown 和 TXT 文件，并在上传后自动生成可编辑切片。",
        visibility="public",
    )
    response = ai.ask(
        AskRequest(
            question="文档知识库支持哪些文件格式？",
            scope=RetrievalScope(entity_types=["document"], document_ids=[document.id]),
        ),
        session=session,
    )
    assert response.grounding["status"] == "grounded"
    assert response.sources[0].document_id == document.id
    assert response.sources[0].lexical_score > 0
