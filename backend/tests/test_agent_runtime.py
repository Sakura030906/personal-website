import json
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.agent_runtime import execute_agent_run
from app.agent_tools import TOOLS
from app.config import settings
from app.database import Base
from app.models import AgentRun, AgentStep, ContentEntry


class AgentRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.session = self.Session()
        self.session.add_all(
            [
                ContentEntry(
                    entity_type="knowledge",
                    slug="redis",
                    title="Redis",
                    summary="Redis 是内存键值数据库，适合缓存和会话。",
                    content_md="Redis 适合缓存、会话和低延迟键值访问。",
                    status="published",
                ),
                ContentEntry(
                    entity_type="knowledge",
                    slug="milvus",
                    title="Milvus",
                    summary="Milvus 是向量数据库，适合语义检索和 RAG。",
                    content_md="Milvus 适合向量索引、相似度检索和 RAG。",
                    status="published",
                ),
            ]
        )
        self.session.commit()
        self.previous_provider = settings.agent_planner_provider
        settings.agent_planner_provider = "local"

    def tearDown(self):
        settings.agent_planner_provider = self.previous_provider
        TOOLS["compare_content"].requires_confirmation = False
        self.session.close()
        self.engine.dispose()

    def create_run(self, status="pending"):
        run = AgentRun(
            session_id="runtime-test",
            goal="比较 Redis 和 Milvus 的用途",
            scope="public",
            status=status,
            planner="local",
            max_steps=6,
        )
        self.session.add(run)
        self.session.commit()
        self.session.refresh(run)
        return run

    def run_without_model(self, run, resume=False):
        with patch(
            "app.agent_synthesis.call_openai_compatible_with_usage",
            return_value=(None, "local", {"prompt_tokens": 0, "completion_tokens": 0, "estimated_cost_usd": 0}),
        ):
            return execute_agent_run(self.session, run, resume=resume)

    def test_comparison_uses_specialized_tool(self):
        run = self.run_without_model(self.create_run())
        steps = list(
            self.session.scalars(
                select(AgentStep).where(AgentStep.run_id == run.id).order_by(AgentStep.step_index)
            )
        )
        result = json.loads(run.result_json)
        self.assertEqual([step.tool_name for step in steps], ["search_content", "compare_content"])
        self.assertEqual(run.status, "completed")
        self.assertIn("[1]", result["answer"])
        self.assertIn("[2]", result["answer"])

    def test_resume_keeps_completed_steps(self):
        run = self.create_run(status="failed")
        search_output = {
            "query": run.goal,
            "count": 2,
            "results": [
                {"entity_type": "knowledge", "slug": "redis", "title": "Redis", "summary": "缓存", "score": 1},
                {"entity_type": "knowledge", "slug": "milvus", "title": "Milvus", "summary": "向量检索", "score": 1},
            ],
        }
        first_step = AgentStep(
            run_id=run.id,
            step_index=0,
            tool_name="search_content",
            reason="已完成检索",
            decision_json="{}",
            status="completed",
            input_json=json.dumps({"query": run.goal, "limit": 5}, ensure_ascii=False),
            output_json=json.dumps(search_output, ensure_ascii=False),
        )
        self.session.add(first_step)
        self.session.commit()
        first_step_id = first_step.id

        run = self.run_without_model(run, resume=True)
        steps = list(
            self.session.scalars(
                select(AgentStep).where(AgentStep.run_id == run.id).order_by(AgentStep.step_index)
            )
        )
        self.assertEqual([step.tool_name for step in steps], ["search_content", "compare_content"])
        self.assertEqual(steps[0].id, first_step_id)
        self.assertEqual(run.resume_count, 1)
        self.assertEqual(run.status, "completed")

    def test_cancel_before_start(self):
        run = self.create_run(status="cancel_requested")
        run = self.run_without_model(run)
        self.assertEqual(run.status, "cancelled")
        self.assertEqual(json.loads(run.result_json)["generator"], "cancelled")

    def test_confirmation_pauses_and_resumes(self):
        TOOLS["compare_content"].requires_confirmation = True
        run = self.run_without_model(self.create_run())
        self.assertEqual(run.status, "awaiting_confirmation")
        pending = json.loads(run.pending_decision_json)
        self.assertEqual(pending["tool"], "compare_content")

        run.confirmation_json = json.dumps({"approved": True, "signature": pending["signature"]})
        run.status = "queued"
        self.session.commit()
        run = self.run_without_model(run, resume=True)
        self.assertEqual(run.status, "completed")
        self.assertEqual(run.resume_count, 1)


if __name__ == "__main__":
    unittest.main()
