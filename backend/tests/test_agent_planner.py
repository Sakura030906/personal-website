from types import SimpleNamespace
import unittest
from unittest.mock import patch

from app.agent_planner import PlannerDecision, next_planner_decision
from app.agent_synthesis import collect_observations, synthesize_agent_answer
from app.agent_tools import AgentToolContext, execute_tool
from app.config import settings


class AgentPlannerTests(unittest.TestCase):
    def test_optional_tool_input_may_be_omitted(self):
        session = SimpleNamespace()
        with patch("app.agent_tools.search_entries", return_value=[]):
            result = execute_tool(
                "search_content",
                AgentToolContext(session=session, session_id="test"),
                {"query": "Milvus"},
            )
        self.assertEqual(result["count"], 0)

    def test_required_tool_input_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Missing required tool input: slug"):
            execute_tool(
                "get_content",
                AgentToolContext(session=SimpleNamespace(), session_id="test"),
                {},
            )

    def test_disallowed_model_tool_falls_back_to_read_only_planner(self):
        previous_provider = settings.agent_planner_provider
        settings.agent_planner_provider = "openai"
        try:
            with patch(
                "app.agent_planner.call_model_planner",
                return_value=PlannerDecision(
                    action="tool",
                    tool="delete_everything",
                    arguments={},
                    provider="fake-model",
                ),
            ):
                decision = next_planner_decision("查找 Milvus 内容", [])
        finally:
            settings.agent_planner_provider = previous_provider

        self.assertEqual(decision.tool, "search_content")
        self.assertEqual(decision.provider, "local-fallback")

    def test_agent_synthesis_uses_fetched_content_and_citations(self):
        history = [
            {
                "tool": "search_content",
                "status": "completed",
                "output": {
                    "results": [
                        {
                            "entity_type": "knowledge",
                            "slug": "redis",
                            "title": "Redis",
                            "summary": "Redis 是内存键值数据库，适合缓存。",
                            "matched_chunk": "Redis 提供低延迟键值访问。",
                            "score": 0.9,
                        },
                        {
                            "entity_type": "knowledge",
                            "slug": "milvus",
                            "title": "Milvus",
                            "summary": "Milvus 是向量数据库，适合语义检索。",
                            "matched_chunk": "Milvus 提供向量索引与相似度检索。",
                            "score": 0.8,
                        },
                    ]
                },
            },
            {
                "tool": "get_content",
                "status": "completed",
                "output": {
                    "found": True,
                    "content": {
                        "entity_type": "knowledge",
                        "slug": "redis",
                        "title": "Redis",
                        "summary": "Redis 是内存键值数据库，适合缓存。",
                        "content": "Redis 适合缓存、会话和低延迟键值访问。",
                        "category": "database",
                    },
                },
            },
        ]
        sources, memories, relations = collect_observations(history)
        self.assertEqual(len(sources), 2)
        self.assertIn("低延迟", sources[0]["context"])
        self.assertEqual(memories, [])
        self.assertEqual(relations, [])

        with patch(
            "app.agent_synthesis.call_openai_compatible_with_usage",
            return_value=(None, "local", {"prompt_tokens": 0, "completion_tokens": 0, "estimated_cost_usd": 0}),
        ):
            result = synthesize_agent_answer("比较 Redis 和 Milvus 的用途", history)
        self.assertEqual(result["generator"], "local-agent")
        self.assertIn("[1]", result["answer"])
        self.assertIn("[2]", result["answer"])
        self.assertEqual(result["grounding"]["status"], "grounded")
        self.assertEqual(result["grounding"]["citation_coverage"], 1.0)


if __name__ == "__main__":
    unittest.main()
