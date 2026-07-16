from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_session
from ..models import AgentRun, AgentStep, Asset, ContentEntry

router = APIRouter()


@router.get("")
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
            *agent_lines,
            "",
        ]
    )
    return Response(content=body, media_type="text/plain; version=0.0.4")
