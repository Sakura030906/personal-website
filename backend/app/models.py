from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContentEntry(Base):
    __tablename__ = "content_entries"
    __table_args__ = (UniqueConstraint("entity_type", "slug", name="uq_content_entity_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    slug: Mapped[str] = mapped_column(String(160), index=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text, default="")
    content_md: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    visibility: Mapped[str] = mapped_column(String(32), default="public")
    category: Mapped[str] = mapped_column(String(80), default="")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ContentDraft(Base):
    __tablename__ = "content_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("content_entries.id"), unique=True, index=True)
    payload_json: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    base_revision: Mapped[int] = mapped_column(Integer, default=1)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    cover_url: Mapped[str] = mapped_column(String(500), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    content_markdown: Mapped[str] = mapped_column(Text, default="")
    content_html: Mapped[str] = mapped_column(Text, default="")
    cover_url: Mapped[str] = mapped_column(String(500), default="")
    seo_title: Mapped[str] = mapped_column(String(255), default="")
    seo_description: Mapped[str] = mapped_column(Text, default="")
    canonical_url: Mapped[str] = mapped_column(String(500), default="")
    body_font_size: Mapped[int] = mapped_column(Integer, default=18)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    visibility: Mapped[str] = mapped_column(String(32), default="public", index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True, index=True)
    is_top: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_ai_search: Mapped[bool] = mapped_column(Boolean, default=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ArticleDraft(Base):
    __tablename__ = "article_drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    article_id: Mapped[int] = mapped_column(ForeignKey("articles.id"), unique=True, index=True)
    payload_json: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    base_revision: Mapped[int] = mapped_column(Integer, default=1)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class KnowledgeColumn(Base):
    __tablename__ = "knowledge_columns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    cover_url: Mapped[str] = mapped_column(String(500), default="")
    icon: Mapped[str] = mapped_column(String(80), default="book-open")
    visibility: Mapped[str] = mapped_column(String(32), default="public", index=True)
    allow_ai_search: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ArticleTag(Base):
    __tablename__ = "article_tags"

    article_id: Mapped[int] = mapped_column(ForeignKey("articles.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)


class ArticleColumn(Base):
    __tablename__ = "article_columns"

    article_id: Mapped[int] = mapped_column(ForeignKey("articles.id"), primary_key=True)
    column_id: Mapped[int] = mapped_column(ForeignKey("knowledge_columns.id"), primary_key=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    content_markdown: Mapped[str] = mapped_column(Text, default="")
    node_type: Mapped[str] = mapped_column(String(32), default="concept", index=True)
    importance: Mapped[int] = mapped_column(Integer, default=3)
    visibility: Mapped[str] = mapped_column(String(32), default="public", index=True)
    allow_ai_search: Mapped[bool] = mapped_column(Boolean, default=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NodeTag(Base):
    __tablename__ = "node_tags"

    node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), primary_key=True)


class KnowledgeColumnNode(Base):
    __tablename__ = "knowledge_column_nodes"

    column_id: Mapped[int] = mapped_column(ForeignKey("knowledge_columns.id"), primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), primary_key=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ArticleNode(Base):
    __tablename__ = "article_nodes"

    article_id: Mapped[int] = mapped_column(ForeignKey("articles.id"), primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), primary_key=True)
    relation_type: Mapped[str] = mapped_column(String(40), default="references")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class KnowledgeRelation(Base):
    __tablename__ = "knowledge_relations"
    __table_args__ = (
        UniqueConstraint("source_node_id", "target_node_id", "relation_type", name="uq_knowledge_relation"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), index=True)
    target_node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), index=True)
    relation_type: Mapped[str] = mapped_column(String(40), default="related_to", index=True)
    relation_label: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    direction: Mapped[str] = mapped_column(String(24), default="directed")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class KnowledgeNodeChunk(Base):
    __tablename__ = "knowledge_node_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), index=True)
    slug: Mapped[str] = mapped_column(String(160), index=True)
    title: Mapped[str] = mapped_column(String(255))
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, default="")
    embedding_json: Mapped[str] = mapped_column(Text, default="[]")
    embedding_provider: Mapped[str] = mapped_column(String(60), default="local")
    embedding_model: Mapped[str] = mapped_column(String(120), default="hash")
    embedding_dimensions: Mapped[int] = mapped_column(Integer, default=128)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_filename: Mapped[str] = mapped_column(String(255), unique=True)
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    file_url: Mapped[str] = mapped_column(String(500), default="")
    parser: Mapped[str] = mapped_column(String(40), default="text")
    status: Mapped[str] = mapped_column(String(32), default="processing", index=True)
    visibility: Mapped[str] = mapped_column(String(32), default="private", index=True)
    allow_ai_search: Mapped[bool] = mapped_column(Boolean, default=True)
    column_id: Mapped[int | None] = mapped_column(ForeignKey("knowledge_columns.id"), nullable=True, index=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    parse_error: Mapped[str] = mapped_column(Text, default="")
    chunk_size: Mapped[int] = mapped_column(Integer, default=900)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=150)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DocumentNode(Base):
    __tablename__ = "document_nodes"

    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), primary_key=True)
    node_id: Mapped[int] = mapped_column(ForeignKey("knowledge_nodes.id"), primary_key=True)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    heading: Mapped[str] = mapped_column(String(255), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    embedding_json: Mapped[str] = mapped_column(Text, default="[]")
    embedding_provider: Mapped[str] = mapped_column(String(60), default="local")
    embedding_model: Mapped[str] = mapped_column(String(120), default="hash")
    embedding_dimensions: Mapped[int] = mapped_column(Integer, default=128)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ContentChunk(Base):
    __tablename__ = "content_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("content_entries.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    slug: Mapped[str] = mapped_column(String(160), index=True)
    title: Mapped[str] = mapped_column(String(255))
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, default="")
    embedding_json: Mapped[str] = mapped_column(Text, default="[]")
    embedding_provider: Mapped[str] = mapped_column(String(60), default="local")
    embedding_model: Mapped[str] = mapped_column(String(120), default="hash")
    embedding_dimensions: Mapped[int] = mapped_column(Integer, default=128)
    token_count: Mapped[int] = mapped_column(Integer, default=0)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContentVersion(Base):
    __tablename__ = "content_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(32), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    snapshot_json: Mapped[str] = mapped_column(Text)
    snapshot_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    reason: Mapped[str] = mapped_column(String(40), default="manual_save")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_email: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiMemory(Base):
    __tablename__ = "ai_memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(120), index=True, default="default")
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    source_slugs: Mapped[str] = mapped_column(Text, default="[]")
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    trace_json: Mapped[str] = mapped_column(Text, default="[]")
    prompt_context: Mapped[str] = mapped_column(Text, default="")
    query_plan_json: Mapped[str] = mapped_column(Text, default="{}")
    grounding_json: Mapped[str] = mapped_column(Text, default="{}")
    quality_score: Mapped[float] = mapped_column(Float, default=0)
    generator: Mapped[str] = mapped_column(String(80), default="local")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiFeedback(Base):
    __tablename__ = "ai_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    memory_id: Mapped[int | None] = mapped_column(ForeignKey("ai_memories.id"), nullable=True, index=True)
    session_id: Mapped[str] = mapped_column(String(120), index=True, default="default")
    rating: Mapped[str] = mapped_column(String(32), index=True)
    reason: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    question: Mapped[str] = mapped_column(Text, default="")
    answer: Mapped[str] = mapped_column(Text, default="")
    source_slugs: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContentOpsTaskState(Base):
    __tablename__ = "content_ops_task_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), index=True, default="ignored")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SearchEvent(Base):
    __tablename__ = "search_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(120), index=True, default="default")
    source: Mapped[str] = mapped_column(String(80), index=True, default="command")
    event_type: Mapped[str] = mapped_column(String(40), index=True, default="search")
    query: Mapped[str] = mapped_column(String(255), index=True, default="")
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    selected_type: Mapped[str] = mapped_column(String(80), default="")
    selected_title: Mapped[str] = mapped_column(String(255), default="")
    selected_href: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(120), index=True, default="default")
    goal: Mapped[str] = mapped_column(Text)
    scope: Mapped[str] = mapped_column(String(32), default="public")
    status: Mapped[str] = mapped_column(String(32), index=True, default="pending")
    planner_mode: Mapped[str] = mapped_column(String(40), default="auto")
    planner: Mapped[str] = mapped_column(String(80), default="local")
    plan_json: Mapped[str] = mapped_column(Text, default="[]")
    planner_trace_json: Mapped[str] = mapped_column(Text, default="[]")
    pending_decision_json: Mapped[str] = mapped_column(Text, default="{}")
    confirmation_json: Mapped[str] = mapped_column(Text, default="{}")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    error: Mapped[str] = mapped_column(Text, default="")
    failure_category: Mapped[str] = mapped_column(String(80), default="")
    max_steps: Mapped[int] = mapped_column(Integer, default=6)
    tool_calls: Mapped[int] = mapped_column(Integer, default=0)
    resume_count: Mapped[int] = mapped_column(Integer, default=0)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentStep(Base):
    __tablename__ = "agent_steps"
    __table_args__ = (UniqueConstraint("run_id", "step_index", name="uq_agent_run_step"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id"), index=True)
    step_index: Mapped[int] = mapped_column(Integer)
    tool_name: Mapped[str] = mapped_column(String(100), index=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    decision_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="pending")
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    output_json: Mapped[str] = mapped_column(Text, default="{}")
    error: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
