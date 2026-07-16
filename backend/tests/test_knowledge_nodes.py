import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Article, ArticleNode, ContentVersion, KnowledgeNode, KnowledgeRelation
from app.routers import articles, knowledge, public
from app.schemas import KnowledgeColumnWrite, KnowledgeNodeWrite, KnowledgeRelationWrite


@pytest.fixture()
def session():
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    Base.metadata.drop_all(engine)


def create_column(session):
    return articles.create_column(
        KnowledgeColumnWrite(name="RAG", slug="rag", description="检索增强生成"),
        _="admin@example.com", session=session,
    )


def node_payload(title, slug, column_id=None, visibility="public"):
    return KnowledgeNodeWrite(
        title=title, slug=slug, summary=f"{title} 摘要", content_markdown=f"# {title}",
        tag_names=["RAG"], column_ids=[column_id] if column_id else [],
        primary_column_id=column_id, visibility=visibility,
    )


def test_node_taxonomy_version_and_public_detail(session):
    column = create_column(session)
    created = knowledge.create_node(node_payload("Hybrid Search", "hybrid-search", column["id"]), user="admin@example.com", session=session)
    assert created["columns"][0]["slug"] == "rag"
    assert created["tag_names"] == ["RAG"]
    assert public.public_nodes(session=session)["total"] == 1
    assert public.public_node("hybrid-search", session=session)["title"] == "Hybrid Search"
    assert public.public_column("rag", session=session)["node_count"] == 1

    updated = knowledge.update_node(
        created["id"], node_payload("Hybrid Search", "hybrid-search", column["id"]).model_copy(update={"summary": "更新后的摘要", "expected_revision": 1}),
        user="admin@example.com", session=session,
    )
    assert updated["revision"] == 2
    assert len(list(session.scalars(select(ContentVersion).where(ContentVersion.entity_type == "knowledge_node")))) == 2

    first_version = session.scalar(select(ContentVersion).where(
        ContentVersion.entity_type == "knowledge_node", ContentVersion.entity_id == created["id"], ContentVersion.reason == "created",
    ))
    restored = knowledge.restore_node_version(first_version.id, user="admin@example.com", session=session)
    assert restored["summary"] == "Hybrid Search 摘要"
    assert restored["revision"] == 3

    with pytest.raises(HTTPException) as conflict:
        knowledge.update_node(created["id"], node_payload("冲突", "hybrid-search").model_copy(update={"expected_revision": 1}), user="admin@example.com", session=session)
    assert conflict.value.status_code == 409


def test_relation_is_bidirectional_in_public_read_model(session):
    first = knowledge.create_node(node_payload("RAG", "rag-node"), user="admin@example.com", session=session)
    second = knowledge.create_node(node_payload("Milvus", "milvus"), user="admin@example.com", session=session)
    relation = knowledge.create_relation(
        KnowledgeRelationWrite(source_node_id=first["id"], target_node_id=second["id"], relation_type="uses", relation_label="向量检索"),
        user="admin@example.com", session=session,
    )
    assert relation["source"]["title"] == "RAG"
    rag = public.public_node("rag-node", session=session)
    milvus = public.public_node("milvus", session=session)
    assert rag["relations"][0]["perspective"] == "outgoing"
    assert milvus["relations"][0]["perspective"] == "incoming"
    assert milvus["relations"][0]["other_node"]["title"] == "RAG"
    graph = public.public_knowledge_graph(session=session)
    assert graph["stats"] == {"node_count": 2, "edge_count": 1, "connected_node_count": 2}
    assert graph["edges"][0]["relation_type"] == "uses"
    assert {node["title"] for node in graph["nodes"]} == {"RAG", "Milvus"}


def test_private_nodes_and_relations_do_not_leak(session):
    public_node = knowledge.create_node(node_payload("公开", "public-node"), user="admin@example.com", session=session)
    private_node = knowledge.create_node(node_payload("私有", "private-node", visibility="private"), user="admin@example.com", session=session)
    knowledge.create_relation(
        KnowledgeRelationWrite(source_node_id=public_node["id"], target_node_id=private_node["id"]),
        user="admin@example.com", session=session,
    )
    assert public.public_nodes(session=session)["total"] == 1
    assert public.public_node("public-node", session=session)["relations"] == []
    with pytest.raises(HTTPException) as missing:
        public.public_node("private-node", session=session)
    assert missing.value.status_code == 404
    graph = public.public_knowledge_graph(session=session)
    assert [node["title"] for node in graph["nodes"]] == ["公开"]
    assert graph["edges"] == []


def test_graph_filters_by_column_type_relation_and_query(session):
    column = create_column(session)
    rag = knowledge.create_node(node_payload("RAG Pipeline", "rag-pipeline", column["id"]), user="admin@example.com", session=session)
    tool = knowledge.create_node(node_payload("Milvus Tool", "milvus-tool", column["id"]).model_copy(update={"node_type": "tool"}), user="admin@example.com", session=session)
    other = knowledge.create_node(node_payload("Other", "other"), user="admin@example.com", session=session)
    knowledge.create_relation(KnowledgeRelationWrite(source_node_id=rag["id"], target_node_id=tool["id"], relation_type="uses"), user="admin@example.com", session=session)
    knowledge.create_relation(KnowledgeRelationWrite(source_node_id=rag["id"], target_node_id=other["id"], relation_type="related_to"), user="admin@example.com", session=session)
    by_column = public.public_knowledge_graph(column="rag", session=session)
    assert {node["title"] for node in by_column["nodes"]} == {"RAG Pipeline", "Milvus Tool"}
    assert len(by_column["edges"]) == 1
    by_type = public.public_knowledge_graph(node_type="tool", session=session)
    assert [node["title"] for node in by_type["nodes"]] == ["Milvus Tool"]
    by_relation = public.public_knowledge_graph(relation_type="uses", session=session)
    assert [edge["relation_type"] for edge in by_relation["edges"]] == ["uses"]
    by_query = public.public_knowledge_graph(q="Milvus", session=session)
    assert [node["title"] for node in by_query["nodes"]] == ["Milvus Tool"]


def test_private_node_does_not_leak_through_public_article(session):
    private_node = knowledge.create_node(node_payload("私有资料", "private-reference", visibility="private"), user="admin@example.com", session=session)
    article = Article(title="公开文章", slug="public-article", status="published", visibility="public")
    session.add(article)
    session.flush()
    session.add(ArticleNode(article_id=article.id, node_id=private_node["id"], relation_type="references"))
    session.commit()
    payload = public.public_article("public-article", session=session)
    assert payload["nodes"] == []
    assert "私有资料" not in payload["metadata_json"]


def test_delete_node_removes_relations_but_keeps_version(session):
    first = knowledge.create_node(node_payload("A", "a"), user="admin@example.com", session=session)
    second = knowledge.create_node(node_payload("B", "b"), user="admin@example.com", session=session)
    knowledge.create_relation(KnowledgeRelationWrite(source_node_id=first["id"], target_node_id=second["id"]), user="admin@example.com", session=session)
    knowledge.delete_node(first["id"], user="admin@example.com", session=session)
    assert session.get(KnowledgeNode, first["id"]) is None
    assert session.scalar(select(KnowledgeRelation)) is None
    assert session.scalar(select(ContentVersion).where(ContentVersion.entity_type == "knowledge_node", ContentVersion.entity_id == first["id"])) is not None
