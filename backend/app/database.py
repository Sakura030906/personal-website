from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine_kwargs = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def run_migrations() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "migrations"))
    command.upgrade(config, "head")


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def ensure_runtime_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    required_by_table = {
        "ai_memories": {
            "sources_json": "TEXT DEFAULT '[]'",
            "trace_json": "TEXT DEFAULT '[]'",
            "prompt_context": "TEXT DEFAULT ''",
            "query_plan_json": "TEXT DEFAULT '{}'",
            "grounding_json": "TEXT DEFAULT '{}'",
            "quality_score": "FLOAT DEFAULT 0",
            "generator": "VARCHAR(80) DEFAULT 'local'",
            "latency_ms": "INTEGER DEFAULT 0",
        },
        "content_chunks": {
            "embedding_provider": "VARCHAR(60) DEFAULT 'local'",
            "embedding_model": "VARCHAR(120) DEFAULT 'hash'",
            "embedding_dimensions": "INTEGER DEFAULT 128",
        },
        "agent_runs": {
            "planner_mode": "VARCHAR(40) DEFAULT 'auto'",
            "planner": "VARCHAR(80) DEFAULT 'local'",
            "planner_trace_json": "TEXT DEFAULT '[]'",
            "pending_decision_json": "TEXT DEFAULT '{}'",
            "confirmation_json": "TEXT DEFAULT '{}'",
            "resume_count": "INTEGER DEFAULT 0",
            "failure_category": "VARCHAR(80) DEFAULT ''",
            "prompt_tokens": "INTEGER DEFAULT 0",
            "completion_tokens": "INTEGER DEFAULT 0",
            "estimated_cost_usd": "FLOAT DEFAULT 0",
        },
        "agent_steps": {
            "reason": "TEXT DEFAULT ''",
            "decision_json": "TEXT DEFAULT '{}'",
        },
    }

    with engine.begin() as connection:
        for table_name, required_columns in required_by_table.items():
            if table_name not in table_names:
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_type in required_columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
