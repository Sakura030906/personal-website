from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./portfolio.db"
    environment: str = "development"
    jwt_secret: str = "change-me"
    auth_cookie_secure: bool = False
    metrics_token: str = ""
    upload_dir: str = "./uploads"
    asset_max_bytes: int = 10485760
    image_max_pixels: int = 40000000
    storage_backend: str = "local"
    oss_region: str = ""
    oss_endpoint: str = ""
    oss_bucket: str = ""
    oss_object_prefix: str = "portfolio"
    oss_public_base_url: str = ""
    document_max_bytes: int = 26214400
    document_chunk_size: int = 900
    document_chunk_overlap: int = 150
    admin_email: str = ""
    admin_password: str = ""
    cors_origins: str = "http://127.0.0.1:4180,http://localhost:4180,http://127.0.0.1:4173,http://localhost:4173"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4.1-mini"
    llm_provider: str = "auto"
    llm_timeout_seconds: int = 30
    llm_input_cost_per_million: float = 0.0
    llm_output_cost_per_million: float = 0.0
    embedding_provider: str = "local"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 128
    embedding_timeout_seconds: int = 30
    embedding_batch_size: int = 64
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_embedding_model: str = "bge-m3"
    ollama_chat_model: str = "qwen3.5:2b"
    vector_store: str = "local"
    milvus_uri: str = "http://localhost:19530"
    milvus_token: str = ""
    milvus_collection: str = "portfolio_chunks"
    milvus_node_collection: str = "portfolio_knowledge_nodes"
    milvus_document_collection: str = "portfolio_documents"
    milvus_metric_type: str = "COSINE"
    rag_eval_path: str = "./rag_eval.json"
    rag_lexical_weight: float = 1.0
    rag_vector_weight: float = 12.0
    rag_entry_vector_weight: float = 10.0
    rag_min_score: float = 0.15
    rag_milvus_expand: int = 5
    rag_reranker: str = "local"
    rag_rerank_top_k: int = 20
    rag_rerank_weight: float = 4.0
    rag_query_expansion: str = "local"
    rag_multi_query_limit: int = 4
    rag_fusion_k: int = 60
    rag_fusion_weight: float = 20.0
    rag_context_max_chars: int = 700
    rag_evidence_threshold: float = 0.18
    rag_claim_support_threshold: float = 0.16
    rag_min_answer_support: float = 0.25
    agent_max_steps: int = 6
    agent_max_tool_calls: int = 8
    agent_timeout_seconds: int = 30
    agent_tool_result_chars: int = 8000
    agent_planner_provider: str = "auto"
    agent_planner_model: str = ""
    agent_planner_timeout_seconds: int = 20
    agent_planner_observation_chars: int = 12000
    agent_eval_path: str = "./agent_eval.json"
    maintenance_state_file: str = "./maintenance-state/status.json"
    backup_state_file: str = "./backup-state/.last-success"

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def validate_runtime_security(self) -> None:
        if not self.is_production:
            return
        errors: list[str] = []
        if self.jwt_secret == "change-me" or len(self.jwt_secret) < 32:
            errors.append("JWT_SECRET must be a unique value with at least 32 characters")
        if not self.metrics_token or len(self.metrics_token) < 24:
            errors.append("METRICS_TOKEN must contain at least 24 characters")
        if not self.auth_cookie_secure:
            errors.append("AUTH_COOKIE_SECURE must be true in production")
        if "*" in {item.strip() for item in self.cors_origins.split(",")}:
            errors.append("CORS_ORIGINS cannot contain * in production")
        if self.admin_password and (
            len(self.admin_password) < 12
            or self.admin_password in {"change-me", "replace-with-a-strong-password"}
        ):
            errors.append("ADMIN_PASSWORD is too weak for production bootstrap")
        if errors:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))

settings = Settings()
