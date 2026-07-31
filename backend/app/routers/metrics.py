import json
from datetime import datetime, timezone
from pathlib import Path

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_session
from ..config import settings
from ..models import AgentRun, AgentStep, Asset, ContentEntry, LongTermMemory, ProactiveTask

router = APIRouter()


def require_metrics_token(x_metrics_token: str | None = Header(default=None)) -> None:
    if not settings.metrics_token or not x_metrics_token or not secrets.compare_digest(x_metrics_token, settings.metrics_token):
        raise HTTPException(status_code=404, detail="Not found")


def marker_age_seconds(path: str) -> float:
    marker = Path(path)
    if not marker.is_file():
        return -1
    try:
        value = marker.read_text(encoding="utf-8").strip()
        if value.startswith("{"):
            value = json.loads(value)["completed_at"]
        timestamp = datetime.fromisoformat(value)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - timestamp).total_seconds())
    except (KeyError, ValueError, json.JSONDecodeError, OSError):
        return -1


@router.get("", dependencies=[Depends(require_metrics_token)])
def metrics(session: Session = Depends(get_session)) -> Response:
    total_entries = session.scalar(select(func.count()).select_from(ContentEntry)) or 0
    published_entries = session.scalar(select(func.count()).select_from(ContentEntry).where(ContentEntry.status == "published")) or 0
    draft_entries = session.scalar(select(func.count()).select_from(ContentEntry).where(ContentEntry.status == "draft")) or 0
    assets = session.scalar(select(func.count()).select_from(Asset)) or 0
    run_counts = {
        status: count
        for status, count in session.execute(select(AgentRun.status, func.count(AgentRun.id)).group_by(AgentRun.status))
    }
    failure_counts = {
        category: count
        for category, count in session.execute(
            select(AgentRun.failure_category, func.count(AgentRun.id))
            .where(AgentRun.failure_category != "")
            .group_by(AgentRun.failure_category)
        )
    }
    tool_calls = session.scalar(select(func.count()).select_from(AgentStep).where(AgentStep.status == "completed")) or 0
    prompt_tokens = session.scalar(select(func.sum(AgentRun.prompt_tokens))) or 0
    completion_tokens = session.scalar(select(func.sum(AgentRun.completion_tokens))) or 0
    estimated_cost = session.scalar(select(func.sum(AgentRun.estimated_cost_usd))) or 0
    proactive_counts = {
        status: count
        for status, count in session.execute(select(ProactiveTask.status, func.count(ProactiveTask.id)).group_by(ProactiveTask.status))
    }
    high_priority_tasks = session.scalar(select(func.count()).select_from(ProactiveTask).where(
        ProactiveTask.priority == "high", ProactiveTask.status.in_(["pending", "accepted"]),
    )) or 0
    memory_counts = {
        status: count
        for status, count in session.execute(select(LongTermMemory.status, func.count(LongTermMemory.id)).group_by(LongTermMemory.status))
    }
    backup_age = marker_age_seconds(settings.backup_state_file)
    maintenance_age = marker_age_seconds(settings.maintenance_state_file)
    agent_lines = [
        "# HELP portfolio_agent_runs_total Agent runs by final status.",
        "# TYPE portfolio_agent_runs_total gauge",
        *[f'portfolio_agent_runs_total{{status="{status}"}} {count}' for status, count in sorted(run_counts.items())],
        "# HELP portfolio_agent_failures_total Agent failures by category.",
        "# TYPE portfolio_agent_failures_total gauge",
        *[f'portfolio_agent_failures_total{{category="{category}"}} {count}' for category, count in sorted(failure_counts.items())],
        "# HELP portfolio_agent_tool_calls_total Completed Agent tool calls.",
        "# TYPE portfolio_agent_tool_calls_total gauge",
        f"portfolio_agent_tool_calls_total {tool_calls}",
        "# HELP portfolio_agent_prompt_tokens_total Agent planner and answer prompt tokens.",
        "# TYPE portfolio_agent_prompt_tokens_total gauge",
        f"portfolio_agent_prompt_tokens_total {prompt_tokens}",
        "# HELP portfolio_agent_completion_tokens_total Agent planner and answer completion tokens.",
        "# TYPE portfolio_agent_completion_tokens_total gauge",
        f"portfolio_agent_completion_tokens_total {completion_tokens}",
        "# HELP portfolio_agent_estimated_cost_usd_total Estimated Agent model cost in USD.",
        "# TYPE portfolio_agent_estimated_cost_usd_total gauge",
        f"portfolio_agent_estimated_cost_usd_total {float(estimated_cost):.8f}",
    ]
    body = "\n".join(
        [
            "# HELP portfolio_content_entries_total Total CMS content entries.",
            "# TYPE portfolio_content_entries_total gauge",
            f"portfolio_content_entries_total {total_entries}",
            "# HELP portfolio_content_entries_published Published CMS content entries.",
            "# TYPE portfolio_content_entries_published gauge",
            f"portfolio_content_entries_published {published_entries}",
            "# HELP portfolio_content_entries_draft Draft CMS content entries.",
            "# TYPE portfolio_content_entries_draft gauge",
            f"portfolio_content_entries_draft {draft_entries}",
            "# HELP portfolio_assets_total Uploaded assets.",
            "# TYPE portfolio_assets_total gauge",
            f"portfolio_assets_total {assets}",
            "# HELP portfolio_proactive_tasks_total Proactive knowledge tasks by status.",
            "# TYPE portfolio_proactive_tasks_total gauge",
            *[f'portfolio_proactive_tasks_total{{status="{status}"}} {count}' for status, count in sorted(proactive_counts.items())],
            "# HELP portfolio_proactive_high_priority_open Open high-priority proactive tasks.",
            "# TYPE portfolio_proactive_high_priority_open gauge",
            f"portfolio_proactive_high_priority_open {high_priority_tasks}",
            "# HELP portfolio_long_term_memories_total Long-term memories by status.",
            "# TYPE portfolio_long_term_memories_total gauge",
            *[f'portfolio_long_term_memories_total{{status="{status}"}} {count}' for status, count in sorted(memory_counts.items())],
            "# HELP portfolio_backup_last_success_age_seconds Seconds since the last successful backup; -1 means unavailable.",
            "# TYPE portfolio_backup_last_success_age_seconds gauge",
            f"portfolio_backup_last_success_age_seconds {backup_age:.0f}",
            "# HELP portfolio_maintenance_last_success_age_seconds Seconds since the last successful maintenance cycle; -1 means unavailable.",
            "# TYPE portfolio_maintenance_last_success_age_seconds gauge",
            f"portfolio_maintenance_last_success_age_seconds {maintenance_age:.0f}",
            *agent_lines,
            "",
        ]
    )
    return Response(content=body, media_type="text/plain; version=0.0.4")
