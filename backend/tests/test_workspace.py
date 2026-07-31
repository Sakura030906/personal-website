from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    ActivityEvent, Article, ArticleNode, ContentChunk, ContentEntry, Document, DocumentNode,
    InboxItem, KnowledgeColumn, KnowledgeColumnNode, KnowledgeNode, ReviewState,
)
from app.routers import admin, articles, knowledge, workspace
from app.schemas import (
    AiWorkflowDecision, ContentEntryIn, InboxItemWrite, InboxPromoteRequest, InboxSuggestionBatch,
    KnowledgeColumnWrite, KnowledgeNodeWrite, ReviewAction, ReviewBatchAction, ReviewTarget,
)
from app.search import search_entries


def make_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return Session(engine)


def test_inbox_capture_promote_trash_and_restore():
    with make_session() as session:
        item = workspace.create_inbox_item(
            InboxItemWrite(title="理解 RRF", body="整理混合检索中的倒数排名融合。", item_type="idea"),
            user="admin@example.com", session=session,
        )
        assert item["visibility"] == "private"
        assert session.scalar(select(ActivityEvent).where(ActivityEvent.action == "captured")) is not None

        promoted = workspace.promote_inbox_item(
            item["id"], InboxPromoteRequest(entity_type="knowledge", tag_names=["RAG"]),
            user="admin@example.com", session=session,
        )
        node = session.get(KnowledgeNode, promoted["id"])
        assert node.title == "理解 RRF"
        assert node.visibility == "private"
        assert session.get(InboxItem, item["id"]).status == "processed"

        workspace.trash_inbox_item(item["id"], user="admin@example.com", session=session)
        assert session.get(InboxItem, item["id"]).deleted_at is not None
        workspace.restore_trash_item("inbox", item["id"], user="admin@example.com", session=session)
        assert session.get(InboxItem, item["id"]).deleted_at is None


def test_inbox_organization_creates_normalized_article_with_links():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="RAG", slug="rag"), _="admin@example.com", session=session,
        )
        node = knowledge.create_node(
            KnowledgeNodeWrite(title="RRF", slug="rrf"), user="admin@example.com", session=session,
        )
        item = workspace.create_inbox_item(
            InboxItemWrite(title="混合检索实践", body="记录 RRF 在混合检索中的使用。"),
            user="admin@example.com", session=session,
        )
        promoted = workspace.promote_inbox_item(
            item["id"], InboxPromoteRequest(
                entity_type="post", column_ids=[column["id"]], primary_column_id=column["id"],
                node_ids=[node["id"]], tag_names=["Retrieval"],
            ),
            user="admin@example.com", session=session,
        )
        article = session.get(Article, promoted["id"])
        assert article is not None
        assert article.visibility == "private"
        assert session.scalar(select(ArticleNode).where(ArticleNode.article_id == article.id, ArticleNode.node_id == node["id"])) is not None


def test_organization_reports_connections_backlinks_and_orphans():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="向量检索", slug="vector-search"), _="admin@example.com", session=session,
        )
        connected = knowledge.create_node(
            KnowledgeNodeWrite(title="Milvus", slug="milvus", column_ids=[column["id"]], primary_column_id=column["id"]),
            user="admin@example.com", session=session,
        )
        orphan = knowledge.create_node(
            KnowledgeNodeWrite(title="孤立节点", slug="orphan"), user="admin@example.com", session=session,
        )
        payload = workspace.workspace_organization(_="admin@example.com", session=session)
        assert payload["stats"]["relations"] == 1
        assert any(item["id"] == orphan["id"] and item["entity_type"] == "knowledge_node" for item in payload["orphans"])
        backlinks = workspace.workspace_backlinks(
            "knowledge_node", connected["id"], _="admin@example.com", session=session,
        )
        assert backlinks["total"] == 1
        assert backlinks["inbound"][0]["source_title"] == "向量检索"


def test_workspace_overview_counts_active_and_trashed_items():
    with make_session() as session:
        first = workspace.create_inbox_item(
            InboxItemWrite(title="待整理"), user="admin@example.com", session=session,
        )
        second = workspace.create_inbox_item(
            InboxItemWrite(title="待删除"), user="admin@example.com", session=session,
        )
        workspace.trash_inbox_item(second["id"], user="admin@example.com", session=session)
        overview = workspace.workspace_overview(_="admin@example.com", session=session)
        assert overview["inbox"] == 1
        assert overview["trash"] == 1


def test_trashed_entry_is_removed_from_search_and_reindexed_after_restore():
    with make_session() as session:
        entry = admin.create_entry(
            ContentEntryIn(
                entity_type="post", slug="rrf-notes", title="RRF 检索笔记",
                content_md="倒数排名融合用于合并多路检索结果。", status="published",
            ),
            user="admin@example.com", session=session,
        )
        assert session.scalar(select(ContentChunk).where(ContentChunk.entry_id == entry.id)) is not None

        admin.delete_entry(entry.id, user="admin@example.com", session=session)
        assert search_entries(session, "倒数排名融合", published_only=True) == []
        assert session.scalar(select(ContentChunk).where(ContentChunk.entry_id == entry.id)) is None

        workspace.restore_trash_item("entry", entry.id, user="admin@example.com", session=session)
        assert session.get(ContentEntry, entry.id).deleted_at is None
        assert session.scalar(select(ContentChunk).where(ContentChunk.entry_id == entry.id)) is not None
        assert search_entries(session, "倒数排名融合", published_only=True)[0].entry.id == entry.id


def test_knowledge_column_delete_moves_it_to_trash_and_restore_keeps_identity():
    with make_session() as session:
        created = articles.create_column(
            KnowledgeColumnWrite(name="向量数据库", slug="vector-database"),
            _="admin@example.com", session=session,
        )
        column_id = created["id"]

        articles.delete_column(column_id, user="admin@example.com", session=session)
        assert session.get(KnowledgeColumn, column_id).deleted_at is not None
        assert articles.list_columns(_="admin@example.com", session=session) == []

        workspace.restore_trash_item("knowledge_column", column_id, user="admin@example.com", session=session)
        restored = session.get(KnowledgeColumn, column_id)
        assert restored.deleted_at is None
        assert restored.slug == "vector-database"


def test_workspace_search_includes_private_drafts_and_normalized_knowledge():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="私有检索专栏", slug="private-retrieval", visibility="private"),
            _="admin@example.com", session=session,
        )
        node = knowledge.create_node(
            KnowledgeNodeWrite(
                title="混合召回策略", slug="hybrid-recall", summary="RRF 与向量召回的组合",
                visibility="private", column_ids=[column["id"]], primary_column_id=column["id"],
            ),
            user="admin@example.com", session=session,
        )
        item = workspace.create_inbox_item(
            InboxItemWrite(title="混合召回文章", body="后台草稿中的混合召回说明。"),
            user="admin@example.com", session=session,
        )
        article = workspace.promote_inbox_item(
            item["id"], InboxPromoteRequest(entity_type="post", visibility="private"),
            user="admin@example.com", session=session,
        )

        result = workspace.workspace_search(
            q="混合召回", entity_type="", limit=30, _="admin@example.com", session=session,
        )
        assert result["total"] == 2
        assert {(entry["entity_type"], entry["id"]) for entry in result["items"]} == {
            ("knowledge_node", node["id"]), ("article", article["id"]),
        }
        assert all(entry["visibility"] == "private" for entry in result["items"])
        assert next(entry for entry in result["items"] if entry["entity_type"] == "article")["status"] == "draft"


def test_review_queue_persists_review_and_snooze_schedule():
    with make_session() as session:
        node = knowledge.create_node(
            KnowledgeNodeWrite(title="间隔复习", slug="spaced-review", visibility="private"),
            user="admin@example.com", session=session,
        )
        initial = workspace.workspace_review(_="admin@example.com", session=session)
        assert initial["stats"]["unreviewed"] == 1
        assert initial["queue"][0]["status"] == "suggested"

        queued = workspace.update_workspace_review(
            "knowledge_node", node["id"], ReviewAction(action="queue", interval_days=7),
            user="admin@example.com", session=session,
        )
        assert queued["status"] == "pending"
        assert workspace.workspace_review(_="admin@example.com", session=session)["stats"]["due"] == 1

        reviewed = workspace.update_workspace_review(
            "knowledge_node", node["id"], ReviewAction(action="reviewed", interval_days=7, note="已理解核心概念"),
            user="admin@example.com", session=session,
        )
        assert reviewed["status"] == "scheduled"
        assert reviewed["repetitions"] == 1
        assert reviewed["note"] == "已理解核心概念"
        assert reviewed["next_review_at"] > reviewed["last_reviewed_at"]
        assert workspace.workspace_review(_="admin@example.com", session=session)["stats"]["due"] == 0

        snoozed = workspace.update_workspace_review(
            "knowledge_node", node["id"], ReviewAction(action="snooze", interval_days=3),
            user="admin@example.com", session=session,
        )
        assert snoozed["repetitions"] == 1
        assert session.scalar(select(ReviewState).where(ReviewState.entity_id == node["id"])).interval_days == 3


def test_batch_review_updates_multiple_entities_and_daily_summary():
    with make_session() as session:
        first = knowledge.create_node(
            KnowledgeNodeWrite(title="向量索引", slug="vector-index", visibility="private"),
            user="admin@example.com", session=session,
        )
        second = knowledge.create_node(
            KnowledgeNodeWrite(title="混合检索", slug="hybrid-search", visibility="private"),
            user="admin@example.com", session=session,
        )
        targets = [
            ReviewTarget(entity_type="knowledge_node", entity_id=first["id"]),
            ReviewTarget(entity_type="knowledge_node", entity_id=second["id"]),
        ]
        queued = workspace.batch_workspace_review(
            ReviewBatchAction(action="queue", interval_days=14, targets=targets),
            user="admin@example.com", session=session,
        )
        assert queued["updated"] == 2
        assert all(item["status"] == "pending" for item in queued["items"])

        reviewed = workspace.batch_workspace_review(
            ReviewBatchAction(action="reviewed", interval_days=14, note="完成批量复习", targets=targets),
            user="admin@example.com", session=session,
        )
        assert reviewed["updated"] == 2
        assert all(item["repetitions"] == 1 and item["note"] == "完成批量复习" for item in reviewed["items"])

        dashboard = workspace.workspace_review(_="admin@example.com", session=session)
        assert dashboard["daily_summary"]["reviewed_today"] == 2
        assert dashboard["daily_summary"]["review_streak"] == 1
        assert dashboard["stats"]["reviewed"] == 2
        assert len(dashboard["upcoming"]) == 2


def test_maintenance_report_uses_real_activity_and_finds_knowledge_debt():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="RAG 工程", slug="rag-engineering", description="检索增强生成实践"),
            _="admin@example.com", session=session,
        )
        node = knowledge.create_node(
            KnowledgeNodeWrite(title="RRF", slug="rrf", summary="", content_markdown="", visibility="private"),
            user="admin@example.com", session=session,
        )
        item = workspace.create_inbox_item(
            InboxItemWrite(title="待整理的 Milvus 索引笔记", body="IVF_FLAT 与 HNSW 对比。"),
            user="admin@example.com", session=session,
        )
        workspace.update_workspace_review(
            "knowledge_node", node["id"], ReviewAction(action="queue", interval_days=7),
            user="admin@example.com", session=session,
        )

        payload = workspace.workspace_maintenance(days=7, _="admin@example.com", session=session)
        report = payload["report"]
        maintenance = payload["maintenance"]

        assert report["period"]["days"] == 7
        assert report["summary"]["captured"] == 1
        assert report["summary"]["active_days"] == 1
        assert len(report["trend"]) == 7
        assert maintenance["stats"]["total"] >= 4
        task_ids = {task["id"] for task in maintenance["tasks"]}
        assert f"review:knowledge_node:{node['id']}" in task_ids
        assert f"summary:knowledge_node:{node['id']}" in task_ids
        assert f"content:knowledge_node:{node['id']}" in task_ids
        assert f"inbox:{item['id']}" in task_ids
        assert any(task["category"] == "relationship" for task in maintenance["tasks"])
        assert column["id"]


def test_local_ai_organizer_suggests_private_normalized_knowledge_links():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="向量数据库", slug="vector-database", description="Milvus 与向量检索"),
            _="admin@example.com", session=session,
        )
        node = knowledge.create_node(
            KnowledgeNodeWrite(
                title="Milvus 索引", slug="milvus-index", summary="HNSW 与 IVF_FLAT 索引策略",
                content_markdown="比较不同向量索引的召回率和查询延迟。", column_ids=[column["id"]],
                primary_column_id=column["id"], visibility="private",
            ),
            user="admin@example.com", session=session,
        )
        item = workspace.create_inbox_item(
            InboxItemWrite(
                title="Milvus HNSW 实践",
                body="总结 Milvus 向量检索中的 HNSW 参数和混合检索实践。",
                item_type="note",
            ),
            user="admin@example.com", session=session,
        )

        result = workspace.suggest_inbox_organization(
            item["id"], mode="local", _="admin@example.com", session=session,
        )
        suggestion = result["suggestion"]

        assert result["model_applied"] is False
        assert result["generator"] == "local/rule-assisted"
        assert suggestion["visibility"] == "private"
        assert suggestion["title"] == "Milvus HNSW 实践"
        assert "Milvus" in suggestion["tag_names"]
        assert column["id"] in suggestion["column_ids"]
        assert node["id"] in suggestion["node_ids"]
        assert suggestion["confidence"] > 0.5


def test_maintenance_detects_duplicate_nodes_and_unlinked_relationships():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="向量检索", slug="vector-retrieval", description="索引与召回"),
            _="admin@example.com", session=session,
        )
        duplicate_a = knowledge.create_node(
            KnowledgeNodeWrite(
                title="Embedding 向量嵌入", slug="embedding-vector-a",
                summary="把文本转换为可检索的稠密向量", content_markdown="Embedding 是 RAG 检索的基础。",
                column_ids=[column["id"]], primary_column_id=column["id"], visibility="private",
            ), user="admin@example.com", session=session,
        )
        duplicate_b = knowledge.create_node(
            KnowledgeNodeWrite(
                title="Embedding向量嵌入", slug="embedding-vector-b",
                summary="把文本转换为可检索的稠密向量", content_markdown="Embedding 是 RAG 检索的基础。",
                column_ids=[column["id"]], primary_column_id=column["id"], visibility="private",
            ), user="admin@example.com", session=session,
        )
        milvus = knowledge.create_node(
            KnowledgeNodeWrite(
                title="Milvus 向量索引", slug="milvus-vector-index",
                summary="使用 HNSW 索引检索 Embedding 向量", content_markdown="Milvus 保存向量并完成近似最近邻召回。",
                column_ids=[column["id"]], primary_column_id=column["id"], visibility="private",
            ), user="admin@example.com", session=session,
        )

        payload = workspace.workspace_maintenance(days=7, _="admin@example.com", session=session)
        opportunities = payload["opportunities"]

        assert opportunities["scanned_nodes"] == 3
        duplicate_pairs = {
            frozenset((item["source_id"], item["target_id"]))
            for item in opportunities["duplicates"]
        }
        assert frozenset((duplicate_a["id"], duplicate_b["id"])) in duplicate_pairs
        relation_pairs = {
            frozenset((item["source_id"], item["target_id"]))
            for item in opportunities["relations"]
        }
        assert any(milvus["id"] in pair for pair in relation_pairs)


def test_ai_workflow_batches_suggestions_and_tracks_human_decisions():
    with make_session() as session:
        column = articles.create_column(
            KnowledgeColumnWrite(name="RAG", slug="rag", description="Milvus 混合检索"),
            _="admin@example.com", session=session,
        )
        knowledge.create_node(
            KnowledgeNodeWrite(
                title="Milvus", slug="milvus-workflow", summary="向量数据库与混合检索",
                content_markdown="Milvus 用于保存 Embedding 并执行向量召回。",
                column_ids=[column["id"]], primary_column_id=column["id"], visibility="private",
            ), user="admin@example.com", session=session,
        )
        first = workspace.create_inbox_item(
            InboxItemWrite(title="Milvus 检索笔记", body="记录 Milvus HNSW 和混合检索参数。"),
            user="admin@example.com", session=session,
        )
        second = workspace.create_inbox_item(
            InboxItemWrite(title="RAG 实践复盘", body="总结 RAG 检索、重排和引用效果。"),
            user="admin@example.com", session=session,
        )

        batch = workspace.batch_inbox_suggestions(
            InboxSuggestionBatch(item_ids=[second["id"], first["id"]], mode="local"),
            user="admin@example.com", session=session,
        )
        assert batch["processed"] == 2
        assert [row["item"]["id"] for row in batch["items"]] == [second["id"], first["id"]]
        assert all(row["suggestion"]["visibility"] == "private" for row in batch["items"])

        before = workspace.workspace_ai_workflow(limit=20, _="admin@example.com", session=session)
        assert before["stats"]["pending"] == 2
        assert before["stats"]["tag_coverage"] > 0
        assert before["stats"]["relation_coverage"] > 0
        assert before["stats"]["evaluated"] == 0

        decision = workspace.record_ai_workflow_decision(
            AiWorkflowDecision(
                item_id=first["id"], suggestion_id=f"inbox:{first['id']}", decision="adopted",
                confidence=0.82, suggested_type="knowledge", note="采用后继续人工确认",
            ), user="admin@example.com", session=session,
        )
        assert decision["status"] == "adopted"
        assert decision["quality"]["adoption_rate"] == 1
        event = session.scalar(select(ActivityEvent).where(ActivityEvent.action == "ai_suggestion_adopted"))
        assert event is not None
        assert "采用后继续人工确认" in event.detail_json
