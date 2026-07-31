from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import settings
from .database import SessionLocal, engine, run_migrations
from .routers import accounts, admin, admin_runtime, agent, ai, articles, auth, content_admin, documents, evaluation, knowledge, metrics, proactive, public, search, workspace
from .security import ensure_bootstrap_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime_security()
    run_migrations()
    with SessionLocal() as session:
        ensure_bootstrap_admin(session)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Portfolio CMS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(accounts.router, prefix="/admin", tags=["accounts"])
app.include_router(public.router, prefix="/content", tags=["public"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(admin_runtime.router, prefix="/admin", tags=["admin-runtime"])
app.include_router(content_admin.router, prefix="/admin", tags=["content-admin"])
app.include_router(articles.router, prefix="/admin", tags=["articles", "knowledge-columns"])
app.include_router(knowledge.router, prefix="/admin", tags=["knowledge-nodes", "knowledge-relations"])
app.include_router(documents.router, prefix="/admin", tags=["documents"])
app.include_router(workspace.router, prefix="/admin", tags=["workspace"])
app.include_router(evaluation.router, prefix="/admin", tags=["evaluation"])
app.include_router(proactive.router, prefix="/admin", tags=["proactive-memory"])
app.include_router(search.router, prefix="/search", tags=["search"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(agent.router, prefix="/agent", tags=["agent"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    """Report whether the API can reach its primary database."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as error:
        raise HTTPException(status_code=503, detail="Primary database is not ready") from error
    return {"status": "ready"}
