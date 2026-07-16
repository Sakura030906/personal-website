import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.agent_eval import evaluate_agent
from app.config import settings
from app.database import Base
from app.llm import model_usage
from app.models import ContentEntry


class AgentEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)()
        self.session.add_all(
            [
                ContentEntry(
                    entity_type="knowledge",
                    slug="redis",
                    title="Redis",
                    summary="Redis 是内存键值数据库，适合缓存。",
                    content_md="Redis 提供低延迟缓存和会话存储。",
                    status="published",
                ),
                ContentEntry(
                    entity_type="knowledge",
                    slug="milvus",
                    title="Milvus",
                    summary="Milvus 是向量数据库，适合 RAG 检索。",
                    content_md="Milvus 提供向量索引和相似度检索。",
                    status="published",
                ),
            ]
        )
        self.session.commit()

    def tearDown(self):
        self.session.close()
        self.engine.dispose()

    def test_agent_eval_scores_tool_paths(self):
        result = evaluate_agent(
            self.session,
            [
                {
                    "id": "compare",
                    "goal": "比较 Redis 和 Milvus 的用途",
                    "category": "routing",
                    "expected_tools": ["search_content", "compare_content"],
                    "expected_slugs": [],
                    "expected_status": "completed",
                    "min_quality": 0,
                    "max_latency_ms": 0,
                },
                {
                    "id": "recent",
                    "goal": "查看最近发布的内容",
                    "category": "routing",
                    "expected_tools": ["list_recent_content"],
                    "expected_slugs": [],
                    "expected_status": "completed",
                    "min_quality": 0,
                    "max_latency_ms": 0,
                },
            ],
            planner_mode="local",
        )
        self.assertEqual(result["stats"]["success_rate"], 1.0)
        self.assertEqual(result["stats"]["tool_path_rate"], 1.0)
        self.assertEqual(result["stats"]["estimated_cost_usd"], 0)
        self.assertEqual(result["cases"][1]["tools"], ["list_recent_content"])

    def test_model_usage_calculates_configured_cost(self):
        old_input = settings.llm_input_cost_per_million
        old_output = settings.llm_output_cost_per_million
        settings.llm_input_cost_per_million = 2
        settings.llm_output_cost_per_million = 8
        try:
            usage = model_usage({"usage": {"prompt_tokens": 1000, "completion_tokens": 500}})
        finally:
            settings.llm_input_cost_per_million = old_input
            settings.llm_output_cost_per_million = old_output
        self.assertEqual(usage["estimated_cost_usd"], 0.006)


if __name__ == "__main__":
    unittest.main()
