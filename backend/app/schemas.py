from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=10, max_length=200)
    role: Literal["admin", "editor", "viewer"] = "editor"


class UserUpdate(BaseModel):
    role: Literal["admin", "editor", "viewer"] | None = None
    is_active: bool | None = None


class UserPasswordUpdate(BaseModel):
    password: str = Field(min_length=10, max_length=200)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    last_login_at: datetime | None = None


class ContentEntryIn(BaseModel):
    entity_type: str
    slug: str
    title: str
    summary: str = ""
    content_md: str = ""
    metadata_json: str = "{}"
    status: Literal["draft", "published", "archived"] = "draft"
    visibility: Literal["public", "private", "unlisted"] = "public"
    category: str = ""


class ContentEntryUpdate(ContentEntryIn):
    expected_revision: int | None = None


class ContentAutosaveIn(ContentEntryIn):
    expected_revision: int


class ContentEntryOut(ContentEntryIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    revision: int = 1
    created_at: datetime | None = None
    published_at: datetime | None = None
    archived_at: datetime | None = None
    updated_at: datetime | None = None

class ContentDraftOut(BaseModel):
    entry_id: int
    payload: dict
    base_revision: int
    saved_at: datetime | None = None


class ArticleWrite(BaseModel):
    entity_type: Literal["post"] = "post"
    slug: str
    title: str
    summary: str = ""
    content_md: str = ""
    metadata_json: str = "{}"
    status: Literal["draft", "published", "archived"] = "draft"
    visibility: Literal["public", "private", "unlisted"] = "public"
    category: str = ""
    expected_revision: int | None = None


class ArticleAutosave(ArticleWrite):
    expected_revision: int


class KnowledgeColumnWrite(BaseModel):
    name: str
    slug: str
    description: str = ""
    cover_url: str = ""
    icon: str = "book-open"
    visibility: Literal["public", "private", "unlisted"] = "public"
    allow_ai_search: bool = True
    sort_order: int = 0


class KnowledgeNodeWrite(BaseModel):
    title: str
    slug: str
    summary: str = ""
    content_markdown: str = ""
    node_type: Literal["concept", "article", "question", "tool", "project", "reference"] = "concept"
    importance: int = Field(default=3, ge=1, le=5)
    visibility: Literal["public", "private", "unlisted"] = "public"
    allow_ai_search: bool = True
    tag_names: list[str] = Field(default_factory=list)
    column_ids: list[int] = Field(default_factory=list)
    primary_column_id: int | None = None
    article_ids: list[int] = Field(default_factory=list)
    article_relation_type: str = "references"
    expected_revision: int | None = None


class KnowledgeRelationWrite(BaseModel):
    source_node_id: int
    target_node_id: int
    relation_type: Literal[
        "contains", "depends_on", "prerequisite", "related_to", "similar_to",
        "contrasts_with", "uses", "references", "extends"
    ] = "related_to"
    relation_label: str = ""
    description: str = ""
    weight: float = Field(default=1.0, ge=0, le=10)
    direction: Literal["directed", "bidirectional"] = "directed"
    is_active: bool = True
    is_public: bool = True


class DocumentUpdate(BaseModel):
    title: str
    slug: str
    summary: str = ""
    visibility: Literal["public", "private", "unlisted"] = "private"
    allow_ai_search: bool = True
    column_id: int | None = None
    node_ids: list[int] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    expected_revision: int | None = None


class DocumentRechunk(BaseModel):
    chunk_size: int = Field(default=900, ge=200, le=4000)
    chunk_overlap: int = Field(default=150, ge=0, le=1000)


class DocumentChunkUpdate(BaseModel):
    heading: str = ""
    content: str = Field(min_length=1)
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    metadata: dict = Field(default_factory=dict)
    is_enabled: bool = True


class InboxItemWrite(BaseModel):
    title: str = ""
    body: str = ""
    source_url: str = ""
    item_type: Literal["note", "idea", "link", "document"] = "note"
    visibility: Literal["private", "unlisted", "public"] = "private"


class InboxItemUpdate(InboxItemWrite):
    status: Literal["inbox", "processing", "processed", "archived"] = "inbox"


class InboxPromoteRequest(BaseModel):
    entity_type: Literal["post", "knowledge", "project", "reading"] = "knowledge"
    title: str = ""
    slug: str = ""
    summary: str = ""
    visibility: Literal["private", "unlisted", "public"] = "private"
    tag_names: list[str] = Field(default_factory=list)
    column_ids: list[int] = Field(default_factory=list)
    primary_column_id: int | None = None
    node_ids: list[int] = Field(default_factory=list)
    node_type: Literal["concept", "article", "question", "tool", "project", "reference"] = "concept"


class InboxSuggestionBatch(BaseModel):
    item_ids: list[int] = Field(default_factory=list, max_length=25)
    limit: int = Field(default=12, ge=1, le=25)
    mode: Literal["local", "auto"] = "local"


class AiWorkflowDecision(BaseModel):
    item_id: int = Field(ge=1)
    suggestion_id: str = Field(default="", max_length=255)
    decision: Literal["adopted", "rejected"]
    confidence: float = Field(default=0, ge=0, le=1)
    suggested_type: Literal["knowledge", "post", "project", "reading"] = "knowledge"
    note: str = Field(default="", max_length=500)


class ContentEnhancementRequest(BaseModel):
    mode: Literal["local", "auto"] = "local"


class ContentEnhancementApply(BaseModel):
    expected_revision: int = Field(ge=1)
    selected_fields: list[Literal[
        "summary", "tags", "seo_title", "seo_description",
        "related_articles", "related_nodes",
    ]] = Field(default_factory=list, max_length=6)
    proposal: dict = Field(default_factory=dict)


class AiEvalSuiteWrite(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=160)
    eval_type: Literal["rag", "agent"]
    description: str = Field(default="", max_length=1000)
    cases: list[dict] = Field(min_length=1, max_length=50)
    is_active: bool = True


class AiEvalRunRequest(BaseModel):
    mode: Literal["local", "auto"] = "local"
    limit: int = Field(default=5, ge=1, le=10)
    published_only: bool = True


class ReviewAction(BaseModel):
    action: Literal["queue", "reviewed", "snooze"] = "reviewed"
    interval_days: int = Field(default=7, ge=1, le=365)
    note: str = ""


class ReviewTarget(BaseModel):
    entity_type: Literal["article", "knowledge_node", "knowledge_column", "document", "project"]
    entity_id: int = Field(ge=1)


class ReviewBatchAction(ReviewAction):
    targets: list[ReviewTarget] = Field(min_length=1, max_length=100)


class RetrievalScope(BaseModel):
    entity_types: list[Literal["post", "project", "reading", "knowledge_node", "document"]] = Field(default_factory=list)
    column_ids: list[int] = Field(default_factory=list)
    node_ids: list[int] = Field(default_factory=list)
    article_ids: list[int] = Field(default_factory=list)
    document_ids: list[int] = Field(default_factory=list)
    include_graph_neighbors: bool = True


class SearchResult(BaseModel):
    id: int
    entity_type: str
    slug: str
    title: str
    summary: str
    score: float


class SearchEventIn(BaseModel):
    session_id: str = "default"
    source: str = "command"
    event_type: str = "search"
    query: str = ""
    result_count: int = 0
    selected_type: str = ""
    selected_title: str = ""
    selected_href: str = ""


class AskRequest(BaseModel):
    question: str
    limit: int = Field(default=5, ge=1, le=10)
    session_id: str = "default"
    scope: RetrievalScope = Field(default_factory=RetrievalScope)


class AskSource(BaseModel):
    node_id: int | None = None
    document_id: int | None = None
    document_chunk_id: int | None = None
    entity_type: str
    slug: str
    title: str
    summary: str
    category: str = ""
    score: float = 0.0
    retrieval_score: float = 0.0
    context: str = ""
    url: str = ""
    chunk_index: int | None = None
    matched_chunk: str = ""
    lexical_score: int = 0
    vector_score: float = 0.0
    rerank_score: float = 0.0
    rerank_reasons: list[str] = Field(default_factory=list)
    fusion_score: float = 0.0
    matched_queries: list[str] = Field(default_factory=list)
    original_chars: int = 0
    compressed_chars: int = 0
    retrieval_store: str = "local"
    node_type: str = ""
    tags: list[str] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)
    graph_relations: list[str] = Field(default_factory=list)
    related_node_slugs: list[str] = Field(default_factory=list)
    page_start: int | None = None
    page_end: int | None = None


class AskResponse(BaseModel):
    answer: str
    sources: list[AskSource]
    trace: list[str]
    prompt_context: str
    memory_id: int | None = None
    generator: str = "local"
    quality_score: float = 0
    latency_ms: int = 0
    query_plan: dict = Field(default_factory=dict)
    grounding: dict = Field(default_factory=dict)
    scope: dict = Field(default_factory=dict)


class AiFeedbackIn(BaseModel):
    memory_id: int | None = None
    session_id: str = "default"
    rating: str
    reason: str = ""
    note: str = ""


class AiFeedbackOut(BaseModel):
    id: int
    memory_id: int | None = None
    session_id: str
    rating: str
    reason: str = ""
    note: str = ""
    question: str = ""
    created_at: str


class MemoryOut(BaseModel):
    id: int
    session_id: str
    question: str
    answer: str
    source_slugs: list[str]
    sources: list[AskSource] = Field(default_factory=list)
    trace: list[str] = Field(default_factory=list)
    prompt_context: str = ""
    query_plan: dict = Field(default_factory=dict)
    grounding: dict = Field(default_factory=dict)
    quality_score: float = 0
    generator: str = "local"
    latency_ms: int = 0
    created_at: str


class SiteDocument(BaseModel):
    data: dict


class AgentTaskCreate(BaseModel):
    goal: str = Field(min_length=2, max_length=1000)
    session_id: str = Field(default="default", max_length=120)
    max_steps: int = Field(default=6, ge=1, le=12)


class AgentConfirmation(BaseModel):
    approved: bool


class AgentStepOut(BaseModel):
    id: int
    step_index: int
    tool_name: str
    reason: str = ""
    planner: str = "local"
    status: str
    input: dict = Field(default_factory=dict)
    output: dict = Field(default_factory=dict)
    error: str = ""
    duration_ms: int = 0


class AgentTaskOut(BaseModel):
    id: int
    session_id: str
    goal: str
    scope: str
    status: str
    planner_mode: str = "auto"
    planner: str = "local"
    plan: list[dict] = Field(default_factory=list)
    planner_trace: list[dict] = Field(default_factory=list)
    result: dict = Field(default_factory=dict)
    error: str = ""
    failure_category: str = ""
    max_steps: int
    tool_calls: int
    resume_count: int = 0
    pending_confirmation: dict = Field(default_factory=dict)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated_cost_usd: float = 0
    steps: list[AgentStepOut] = Field(default_factory=list)
    started_at: str = ""
    completed_at: str = ""
    created_at: str = ""


class ProactiveTaskAction(BaseModel):
    status: Literal["pending", "accepted", "completed", "dismissed"]
    note: str = ""


class LongTermMemoryWrite(BaseModel):
    title: str
    content: str
    memory_type: Literal["preference", "fact", "goal", "lesson", "context"] = "context"
    visibility: Literal["private", "public"] = "private"
    status: Literal["candidate", "active", "archived"] = "candidate"
    source_type: str = "manual"
    source_id: int | None = None
    confidence: float = Field(default=1.0, ge=0, le=1)


class LongTermMemoryAction(BaseModel):
    status: Literal["candidate", "active", "archived"]
    visibility: Literal["private", "public"] | None = None


class AgentToolOut(BaseModel):
    name: str
    description: str
    scope: str
    input_schema: dict = Field(default_factory=dict)
    requires_confirmation: bool = False
