"""Complete normalized knowledge nodes and retire legacy knowledge shadows."""

import json
from pathlib import Path
import sys

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.knowledge_rag import rebuild_knowledge_node_index
from app.knowledge_service import NODE_SNAPSHOT_FIELDS, node_dict, payload_hash
from app.models import ContentDraft, ContentEntry, ContentVersion, KnowledgeNode
from app.search import delete_content_entry_index, rebuild_vector_index


KNOWLEDGE_UPDATES = {
    "embedding": {
        "summary": "把文本、图片或其他对象映射为稠密向量，使语义相近的内容在向量空间中保持较小距离。",
        "content": """# Embedding

Embedding 是 RAG 检索的语义表示层。它把查询与知识片段编码为相同维度的向量，再通过余弦相似度或内积比较语义相关性。

## 工程要点

- 文档与查询必须使用同一模型和同一向量维度。
- 更换模型后要重建全部向量，不能混用旧索引。
- 向量应保留模型、维度、内容哈希和更新时间，便于追踪与重建。
- 中文场景要用支持中文语义的模型，并通过真实问题集评估召回质量。

```text
document -> chunk -> embedding -> Milvus
query -> embedding -> vector search -> candidates
```
""",
    },
    "milvus": {
        "summary": "面向大规模向量数据的检索数据库，在本站中负责持久化 Embedding 并提供相似度搜索。",
        "content": """# Milvus

Milvus 是本站 RAG 的向量检索层。关系数据库保存内容、权限和版本，Milvus 保存由内容片段生成的向量，两者通过 chunk id 对齐。

## 本站用法

- `portfolio_chunks` 保存文章、项目和阅读记录的片段向量。
- `portfolio_knowledge_nodes` 独立保存标准化知识节点向量。
- 使用 COSINE 度量检索相似内容，再与关键词分数和重排分数组合。
- 内容修改、恢复或删除时，同步更新对应向量；全量重建用于模型切换和数据修复。

## 边界

Milvus 不是正文数据库。原始 Markdown、版本、权限和关系仍由业务数据库负责，避免把向量库当作唯一事实源。
""",
    },
    "hybrid-search": {
        "summary": "融合关键词检索与向量检索，兼顾术语精确匹配和语义相似召回。",
        "content": """# Hybrid Search

混合检索同时计算关键词相关性与向量相似度。关键词检索擅长命中类名、API 和错误码；向量检索擅长处理自然语言改写与近义表达。

## 本站流程

```text
query expansion
  -> lexical retrieval
  -> Milvus vector retrieval
  -> reciprocal rank fusion
  -> local rerank
  -> grounded context
```

## 调优原则

- 为技术专有名词保留足够高的关键词权重。
- 扩大首次召回数量，再用 Rerank 缩小最终上下文。
- 使用固定评测问题观察 Top-1、Recall@K 和 MRR，而不是只凭主观体验调参。
""",
    },
    "llm-生成": {
        "summary": "让大模型严格基于检索证据组织答案，并输出可验证的来源引用。",
        "content": """# LLM 生成

生成阶段接收用户问题、压缩后的检索片段、知识图谱关系和最近会话记忆。模型的职责是组织证据，不是补写知识库中不存在的事实。

## 约束

- 系统提示明确要求只使用站内上下文。
- 事实陈述附带 `[1]` 形式的来源编号。
- 证据不足时返回缺失信息，不编造答案。
- 上下文被视为不可信数据，不能覆盖系统权限或执行任意指令。

生成后还要检查答案与来源的词项覆盖和引用完整性，将低置信度回答标记为需要补充知识。
""",
    },
    "planning": {
        "summary": "把复杂目标拆分成可执行步骤，并根据每一步的观察结果动态调整后续动作。",
        "content": """# Planning

Planning 用于决定 Agent 下一步应调用哪个工具、需要哪些参数以及何时停止。本站采用逐步决策，而不是一次生成不可变的完整计划。

## 循环

```text
Goal -> Decide -> Tool Call -> Observation -> Replan -> Final Answer
```

## 工程约束

- 工具必须来自白名单，参数要经过 Schema 校验。
- 设置最大步骤数、工具调用数和总超时，防止无限循环。
- 高风险写操作需要人工确认。
- 每一步保存 reason、arguments、observation 和耗时，方便回放与评测。
""",
    },
    "mcp": {
        "summary": "Model Context Protocol 用统一协议向模型暴露工具、资源与提示，降低 Agent 集成外部系统的耦合。",
        "content": """# MCP

MCP 将外部能力抽象为标准的 Tools、Resources 和 Prompts。Agent 不需要为每个系统编写一套专有交互协议，只需连接对应 MCP Server。

## 核心对象

- Tool：可调用动作，包含名称、描述和输入 Schema。
- Resource：可读取的结构化上下文，例如文件、文档或数据库信息。
- Prompt：可复用的任务模板。

## 安全边界

MCP 返回值仍是不可信输入。调用端要限制服务器来源、工具权限、参数范围、超时和结果长度，并对有副作用的工具增加确认步骤。
""",
    },
    "缓存雪崩": {
        "summary": "大量缓存键在短时间同时失效，使请求集中回源数据库并造成级联过载。",
        "content": """# 缓存雪崩

缓存雪崩通常由统一过期时间、Redis 故障或流量突增触发。大量请求同时绕过缓存后，数据库和下游服务可能连续失效。

## 缓解措施

- 为 TTL 增加随机抖动，避免同批键同时过期。
- 热点数据使用逻辑过期，由后台异步刷新。
- 对回源路径做限流、熔断和请求合并。
- Redis 使用高可用部署，并为关键数据准备降级策略。

```text
ttl = base_ttl + random(0, jitter)
```
""",
    },
    "持久化": {
        "summary": "Redis 通过 RDB 快照与 AOF 日志恢复内存数据，需要在恢复速度、数据完整性和磁盘成本之间取舍。",
        "content": """# 持久化

RDB 定期生成全量快照，文件紧凑、恢复较快，但快照间的数据可能丢失。AOF 记录写命令，数据更完整，但文件和重写成本更高。

## 选择

- 纯缓存允许重建时，可以弱化持久化并依赖源数据库。
- 会话、任务状态等不能轻易重建的数据，通常同时开启 RDB 与 AOF。
- `appendfsync everysec` 是性能与最多约一秒数据损失之间的常见平衡。
- 持久化不是备份，仍要做异地备份和恢复演练。
""",
    },
    "过期策略": {
        "summary": "Redis 通过惰性删除与定期删除清理过期键，并在内存不足时按淘汰策略释放空间。",
        "content": """# 过期策略

键到期后不一定立即被物理删除。Redis 在访问键时进行惰性检查，同时周期性抽样删除过期键，以平衡 CPU 消耗与内存回收。

## 内存淘汰

- `noeviction`：内存满后拒绝新增写入。
- `allkeys-lru`：在全部键中淘汰近期最少使用的键。
- `volatile-lru`：只在设置了过期时间的键中淘汰。
- `allkeys-lfu`：优先淘汰访问频率较低的键。

策略应结合数据是否可重建、热点分布和容量告警选择，不能只依赖默认值。
""",
    },
    "schema": {
        "summary": "定义 Milvus Collection 的主键、向量字段及业务元数据，是索引可维护性和过滤能力的基础。",
        "content": """# Schema

Milvus Schema 描述一条向量记录的字段结构。向量维度必须与 Embedding 模型输出一致，主键用于与关系数据库中的 chunk 对齐。

## 本站字段

```text
id: Int64 primary key
vector: FloatVector
entry_id | node_id: Int64
entity_type: VarChar
slug: VarChar
title: VarChar
chunk_index: Int64
```

过滤字段只保留检索所需元数据，完整正文和版本信息仍保存在业务数据库中。更换向量维度需要新建或重建 Collection。
""",
    },
    "ivf_flat": {
        "summary": "先用聚类中心缩小搜索范围，再在候选分区内执行精确距离计算的倒排向量索引。",
        "content": """# IVF_FLAT

IVF_FLAT 在构建时把向量划分到多个聚类分区。查询时只搜索最接近的若干分区，因此比全量扫描更快，同时保留分区内的精确距离计算。

## 关键参数

- `nlist`：聚类分区数量；数据越多通常需要越大的值。
- `nprobe`：查询时探测的分区数量；越大召回率越高，但延迟也越高。

```text
index_type = IVF_FLAT
metric_type = COSINE
nlist = 1024
nprobe = 16
```

参数应通过实际数据集和查询集压测，不能只照搬固定值。
""",
    },
    "hnsw": {
        "summary": "基于多层近邻图进行快速向量搜索，通常提供较高召回率和低查询延迟，但占用更多内存。",
        "content": """# HNSW

HNSW 把向量组织成分层小世界图。查询从稀疏高层快速接近目标区域，再在底层图中扩大候选搜索。

## 关键参数

- `M`：每个节点的最大连接数，影响索引大小和图的连通性。
- `efConstruction`：构建时的候选范围，越大索引质量越高、构建越慢。
- `ef`：查询时的候选范围，越大召回率越高、延迟越高。

HNSW 适合对低延迟和高召回要求较高、且能够承担较大内存成本的场景。
""",
    },
}


def save_node_version(session, node: KnowledgeNode) -> None:
    current = node_dict(session, node, include_relations=False)
    snapshot = {key: current.get(key) for key in NODE_SNAPSHOT_FIELDS}
    session.add(ContentVersion(
        entity_type="knowledge_node",
        entity_id=node.id,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False, sort_keys=True, default=str),
        snapshot_hash=payload_hash(snapshot),
        reason="content_enrichment_migration",
        created_by_email="system@knowledge-migration",
    ))


def retire_legacy_knowledge(session) -> int:
    entries = list(session.scalars(select(ContentEntry).where(ContentEntry.entity_type == "knowledge")))
    for entry in entries:
        snapshot = {
            "entity_type": entry.entity_type,
            "slug": entry.slug,
            "title": entry.title,
            "summary": entry.summary,
            "content_md": entry.content_md,
            "metadata_json": entry.metadata_json,
            "status": entry.status,
            "visibility": entry.visibility,
            "category": entry.category,
            "revision": entry.revision,
        }
        session.add(ContentVersion(
            entity_type="legacy_knowledge",
            entity_id=entry.id,
            snapshot_json=json.dumps(snapshot, ensure_ascii=False, sort_keys=True, default=str),
            snapshot_hash=payload_hash(snapshot),
            reason="migrated_to_normalized_knowledge",
            created_by_email="system@knowledge-migration",
        ))
        delete_content_entry_index(session, entry.id)
        draft = session.scalar(select(ContentDraft).where(ContentDraft.entry_id == entry.id))
        if draft:
            session.delete(draft)
        session.delete(entry)
    session.flush()
    return len(entries)


def main() -> None:
    with SessionLocal() as session:
        updated = 0
        for slug, values in KNOWLEDGE_UPDATES.items():
            node = session.scalar(select(KnowledgeNode).where(KnowledgeNode.slug == slug))
            if not node:
                continue
            if node.summary.strip() == values["summary"] and node.content_markdown.strip() == values["content"].strip():
                continue
            save_node_version(session, node)
            node.summary = values["summary"]
            node.content_markdown = values["content"].strip()
            node.revision += 1
            updated += 1

        retired = retire_legacy_knowledge(session)
        session.commit()
        content_index = rebuild_vector_index(session)
        node_index = rebuild_knowledge_node_index(session)
        print(json.dumps({
            "updated_nodes": updated,
            "retired_legacy_knowledge": retired,
            "content_index": content_index,
            "knowledge_node_index": node_index,
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
