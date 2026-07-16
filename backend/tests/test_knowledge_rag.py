import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.agent_tools import AgentToolContext, explore_knowledge_graph, get_content, search_content
from app.database import Base
from app.knowledge_rag import knowledge_node_index_status, rebuild_knowledge_node_index, search_knowledge_nodes
from app.models import KnowledgeNodeChunk
from app.routers import ai, articles, knowledge
from app.rag_eval import evaluate_retrieval
from app.schemas import AskRequest, KnowledgeColumnWrite, KnowledgeNodeWrite, KnowledgeRelationWrite


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


def create_node(session, title, slug, column_id, *, visibility="public", allow_ai_search=True):
    return knowledge.create_node(
        KnowledgeNodeWrite(
            title=title,
            slug=slug,
            summary=f"{title} 用于企业 RAG 检索系统。",
            content_markdown=f"# {title}\n\n这是 {title} 的标准化知识正文。",
            node_type="concept",
            tag_names=["RAG", "Milvus"],
            column_ids=[column_id],
            primary_column_id=column_id,
            visibility=visibility,
            allow_ai_search=allow_ai_search,
        ),
        user="admin@example.com",
        session=session,
    )


def build_graph(session):
    column = articles.create_column(
        KnowledgeColumnWrite(name="Milvus", slug="milvus", description="向量数据库知识专栏"),
        _="admin@example.com",
        session=session,
    )
    milvus = create_node(session, "Milvus", "milvus-node", column["id"])
    index = create_node(session, "IVF_FLAT", "ivf-flat", column["id"])
    private = create_node(session, "内部索引参数", "private-index", column["id"], visibility="private")
    disabled = create_node(session, "禁用检索节点", "disabled-node", column["id"], allow_ai_search=False)
    knowledge.create_relation(
        KnowledgeRelationWrite(
            source_node_id=milvus["id"],
            target_node_id=index["id"],
            relation_type="uses",
            relation_label="使用索引",
            description="Milvus 检索可使用 IVF_FLAT 索引。",
        ),
        user="admin@example.com",
        session=session,
    )
    knowledge.create_relation(
        KnowledgeRelationWrite(source_node_id=milvus["id"], target_node_id=private["id"]),
        user="admin@example.com",
        session=session,
    )
    knowledge.create_relation(
        KnowledgeRelationWrite(source_node_id=milvus["id"], target_node_id=disabled["id"]),
        user="admin@example.com",
        session=session,
    )
    return milvus, index, private, disabled


def test_standardized_node_search_adds_public_graph_context(session):
    build_graph(session)
    hits = search_knowledge_nodes(session, "Milvus", limit=5)

    assert hits[0].node.slug == "milvus-node"
    assert "# Milvus" in hits[0].payload["content"]
    assert any("IVF_FLAT" in line and "使用索引" in line for line in hits[0].payload["graph_relations"])
    assert "private-index" not in hits[0].payload["related_node_slugs"]
    assert "disabled-node" not in hits[0].payload["related_node_slugs"]
    assert {hit.node.slug for hit in hits}.isdisjoint({"private-index", "disabled-node"})
    assert hits[0].retrieval_store == "knowledge_node_chunks"


def test_node_index_lifecycle_and_full_rebuild(session):
    milvus, _, private, disabled = build_graph(session)
    chunks = list(session.query(KnowledgeNodeChunk).all())

    assert {chunk.node_id for chunk in chunks}.isdisjoint({private["id"], disabled["id"]})
    assert any(chunk.node_id == milvus["id"] and "IVF_FLAT" in chunk.content for chunk in chunks)

    rebuilt = rebuild_knowledge_node_index(session)
    status = knowledge_node_index_status(session)
    assert rebuilt["nodes"] == 2
    assert rebuilt["node_chunks"] >= 2
    assert status["indexed_nodes"] == 2

    knowledge.delete_node(milvus["id"], user="admin@example.com", session=session)
    assert not list(session.query(KnowledgeNodeChunk).filter(KnowledgeNodeChunk.node_id == milvus["id"]))


def test_ai_lab_cites_node_and_includes_graph_in_prompt(session, monkeypatch):
    build_graph(session)
    monkeypatch.setattr(ai, "call_openai_compatible", lambda messages: (None, "local"))

    response = ai.ask(AskRequest(question="Milvus", limit=4, session_id="rag-node-test"), session=session)
    node_source = next(source for source in response.sources if source.entity_type == "knowledge_node" and source.slug == "milvus-node")

    assert node_source.url == "#node-milvus-node"
    assert "ivf-flat" in node_source.related_node_slugs
    assert any("IVF_FLAT" in line for line in node_source.graph_relations)
    assert "Graph relations:" in response.prompt_context
    assert "Milvus 指向 IVF_FLAT" in response.prompt_context
    assert any("standardized node citations" in step for step in response.trace)


def test_ai_lab_rejects_model_citations_outside_source_range(session, monkeypatch):
    build_graph(session)
    monkeypatch.setattr(
        ai,
        "call_openai_compatible",
        lambda messages: ("Milvus 负责向量检索 [99]。", "test-model"),
    )

    response = ai.ask(AskRequest(question="Milvus", limit=1, session_id="invalid-citation-test"), session=session)

    assert response.generator == "grounding-fallback"
    assert response.grounding["invalid_citations"] == []
    assert "[99]" not in response.answer
    assert any("invalidly cited" in step for step in response.trace)


def test_agent_tools_use_standardized_nodes_and_relations(session):
    build_graph(session)
    context = AgentToolContext(session=session, session_id="agent-node-test")

    searched = search_content(context, {"query": "Milvus", "limit": 5})
    node_result = next(item for item in searched["results"] if item["entity_type"] == "knowledge_node")
    detail = get_content(context, {"slug": node_result["slug"], "entity_type": "knowledge_node"})
    graph = explore_knowledge_graph(context, {"slug": node_result["slug"], "entity_type": "knowledge_node"})

    assert detail["found"] is True
    assert detail["content"]["url"] == "#node-milvus-node"
    assert graph["found"] is True
    assert "ivf-flat" in graph["relations"]["related_node_slugs"]
    assert graph["relation_count"] == 1


def test_rag_evaluation_scores_standardized_node_sources(session):
    build_graph(session)
    result = evaluate_retrieval(
        session,
        [{"id": "milvus-node", "question": "Milvus", "expected_terms": [], "expected_slugs": ["milvus-node"]}],
        limit=5,
    )

    assert result["stats"]["expected_hit_rate"] == 1.0
    assert any(
        source["entity_type"] == "knowledge_node" and source["retrieval_store"] == "knowledge_node_chunks"
        for source in result["cases"][0]["sources"]
    )
