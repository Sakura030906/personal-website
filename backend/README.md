# 后台升级蓝图

这个目录是可运行的后台 CMS API，目标是把当前 `data/site.json` 逐步升级为真正的 CMS：

- FastAPI 提供管理接口。
- 默认 SQLite 便于本地验证，生产环境通过 `DATABASE_URL` 切换 PostgreSQL。
- JWT 登录保护后台接口，需要配置 `ADMIN_EMAIL` / `ADMIN_PASSWORD`。
- Markdown 内容支持自动草稿、手动保存、发布、归档、可见性和完整版本历史。
- 文章、分类、标签、知识专栏、知识节点和节点关系使用独立数据表；`ContentEntry` 只作为旧内容与检索兼容层。
- 普通附件和文档原文件保存到 `UPLOAD_DIR`；文档正文、可编辑切片、向量元数据和版本历史保存在数据库中。生产环境可把原文件目录替换为对象存储。
- 整站 JSON 可以同步进数据库，并自动拆成文章、项目、知识库条目供搜索和 AI 使用。
- AI 问答支持按专栏、知识节点、文章或文档限定检索范围，并统一检索文章、标准化知识节点和文档切片。
- 回答会返回可跳转的来源引用、文档页码、检索范围、Memory，以及 OpenAI-compatible/Ollama LLM 生成信息。

当前公开网站仍然是静态只读站点。这个后端用于本地或服务器管理内容，不能直接放到 OSS 静态网站里运行。

生产环境可以使用 `STORAGE_BACKEND=oss` 将新上传的图片和文档发布到阿里云 OSS；本地副本仍用于文档解析与灾备。生产 Compose 还包含 PostgreSQL 和上传目录的定时备份、SHA-256 校验、恢复命令和可选 OSS 异地备份，详见项目根目录 `DEPLOYMENT.md`。

## 建议表结构

```sql
users(id, email, password_hash, role, created_at)
posts(id, slug, title, summary, content_md, status, category, published_at, updated_at)
projects(id, slug, name, summary, content_md, status, sort_order, updated_at)
knowledge_nodes(id, slug, title, summary, content_markdown, node_type, importance, visibility, revision, updated_at)
knowledge_relations(id, source_node_id, target_node_id, relation_type, direction, weight, is_public)
knowledge_column_nodes(column_id, node_id, is_primary, sort_order)
article_nodes(article_id, node_id, relation_type, sort_order)
assets(id, filename, content_type, size_bytes, url, created_at)
content_versions(id, entity_type, entity_id, snapshot_json, created_by, created_at)
tags(id, name, slug)
taggings(id, tag_id, entity_type, entity_id)
```

## API 草案

```text
POST   /auth/login
GET    /content/public
GET    /admin/posts
POST   /admin/posts
PATCH  /admin/posts/{id}
POST   /admin/posts/{id}/publish
GET    /admin/projects
POST   /admin/projects
PATCH  /admin/projects/{id}
GET    /admin/knowledge
POST   /admin/knowledge
PATCH  /admin/knowledge/{id}
POST   /admin/assets
GET    /admin/versions/{entity_type}/{entity_id}
POST   /admin/versions/{version_id}/restore
```

## 运行方式

本地运行：

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

数据库连接放到 `.env`：

```text
DATABASE_URL=sqlite:///./portfolio.db
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your-password
UPLOAD_DIR=./uploads
STORAGE_BACKEND=local
OSS_REGION=cn-shanghai
OSS_ENDPOINT=https://oss-cn-shanghai.aliyuncs.com
OSS_BUCKET=
OSS_OBJECT_PREFIX=portfolio
OSS_PUBLIC_BASE_URL=
DOCUMENT_MAX_BYTES=26214400
DOCUMENT_CHUNK_SIZE=900
DOCUMENT_CHUNK_OVERLAP=150
CORS_ORIGINS=http://127.0.0.1:4180,http://localhost:4180,http://127.0.0.1:4173,http://localhost:4173
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
LLM_PROVIDER=auto
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen3.5:2b
OLLAMA_EMBEDDING_MODEL=bge-m3
VECTOR_STORE=local
MILVUS_DOCUMENT_COLLECTION=portfolio_documents
```

本机已有 Ollama 模型时，可设置 `LLM_PROVIDER=ollama` 与 `EMBEDDING_PROVIDER=ollama`，无需外部 API Key。使用 `bge-m3` 时向量维度为 1024，切换后必须重建全部索引。

生产环境把 `DATABASE_URL` 换成 PostgreSQL：

```text
DATABASE_URL=postgresql+psycopg://user:password@host:5432/portfolio
```

## 已实现接口

```text
POST   /auth/login
GET    /content/public
GET    /search?q=RAG
POST   /ai/ask
GET    /ai/scopes
GET    /metrics
GET    /health
GET    /ready
GET    /admin/entries
POST   /admin/entries
PATCH  /admin/entries/{id}
POST   /admin/entries/{id}/publish
POST   /admin/entries/{id}/archive
GET    /admin/entries/{id}/draft
POST   /admin/entries/{id}/autosave
DELETE /admin/entries/{id}
GET    /admin/export
POST   /admin/import
GET    /admin/site
POST   /admin/site
GET    /admin/versions/{entity_type}/{entity_id}
GET    /admin/versions/{version_id}/diff
POST   /admin/versions/{version_id}/restore
POST   /admin/assets
GET    /content/articles
GET    /content/articles/{slug}
GET    /content/columns
GET    /content/columns/{slug}
GET    /content/nodes
GET    /content/nodes/{slug}
GET    /content/knowledge-graph
GET    /admin/documents
POST   /admin/documents
GET    /admin/documents/{id}
PATCH  /admin/documents/{id}
POST   /admin/documents/{id}/toggle
POST   /admin/documents/{id}/rechunk
PATCH  /admin/document-chunks/{id}
GET    /admin/documents/{id}/versions
POST   /admin/documents/versions/{version_id}/restore
DELETE /admin/documents/{id}
```

文档知识库支持 PDF、DOCX、Markdown 和 TXT，单文件默认上限 25 MB。上传后会提取正文、按标题或页码切片并生成 Embedding；后台可以编辑或停用单个切片、关联知识专栏与知识节点、重新切片和恢复历史版本。文档默认是 `private`，只有状态为 `ready`、可见性为 `public`、允许 AI 检索且切片启用时才会进入公开 RAG。文档元数据、切片状态或正文变化后会同步更新本地索引或独立的 Milvus 文档集合。

## 范围检索

`GET /ai/scopes` 只返回允许 AI 检索的公开专栏、知识节点、文章和文档。`POST /ai/ask` 的 `scope` 可以传入：

```json
{
  "entity_types": ["knowledge_node", "document"],
  "column_ids": [1],
  "node_ids": [],
  "article_ids": [],
  "document_ids": [],
  "include_graph_neighbors": true
}
```

选择专栏、节点、文章或文档后，后端会沿显式关联解析允许检索的内容集合，并继续执行公开状态与 AI 权限过滤。没有选择范围时才执行全库检索。AI Lab 会保存当前范围选择，回答来源可跳转到文章、节点详情或带页码的原文档。

第二阶段文章与专栏接口：

```text
GET    /admin/articles
POST   /admin/articles
PATCH  /admin/articles/{id}
GET    /admin/articles/{id}/draft
POST   /admin/articles/{id}/autosave
POST   /admin/articles/{id}/publish
POST   /admin/articles/{id}/archive
GET    /admin/articles/{id}/versions
GET    /admin/knowledge-columns
POST   /admin/knowledge-columns
PATCH  /admin/knowledge-columns/{id}
DELETE /admin/knowledge-columns/{id}
```

初始化现有真实知识主题为专栏：

```bash
cd backend
python scripts/seed_knowledge_columns.py
```

第三阶段知识节点与关系接口：

```text
GET/POST        /admin/knowledge-nodes
PATCH/DELETE    /admin/knowledge-nodes/{id}
GET             /admin/knowledge-nodes/{id}/versions
POST            /admin/knowledge-nodes/versions/{version_id}/restore
GET/POST        /admin/knowledge-relations
PATCH/DELETE    /admin/knowledge-relations/{id}
```

将 `data/site.json` 中已有 RAG、Agent、Redis 和 Milvus 笔记迁移为独立节点：

```bash
cd backend
python scripts/seed_knowledge_nodes.py
```

迁移脚本是幂等的，只采用已有标题、说明、示例和显式链接，不生成虚假统计。

发布静态站之前，把公开节点和关系导出为无需 API 也能读取的快照：

```bash
cd backend
python scripts/export_public_knowledge.py
cd ..
npm run build
```

## 内容可靠性

- 编辑器停顿约 1.8 秒后保存自动草稿，自动草稿不会覆盖公开版本。
- 手动保存会写入正式内容、增加 `revision` 并清除对应自动草稿。
- 两个页面同时编辑时，旧 `revision` 的保存请求返回 `409`，避免静默覆盖。
- `draft`、`published`、`archived` 是内容生命周期；`public`、`unlisted`、`private` 控制可见性。
- 创建、自动保存、手动保存、发布、归档和恢复前都会写入版本记录，并记录管理员账号。
- 服务启动时自动执行 Alembic 迁移；也可以在部署前手动运行 `alembic upgrade head`。

运行测试：

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

Agent 运行记录包含失败分类、输入/输出 token 与估算成本。管理员可通过 `POST /admin/agent/evaluate` 运行 `agent_eval.json` 回归集；Prometheus 指标位于 `/metrics`。

同步当前静态站内容：

```bash
python scripts/import_site_json.py
```

## Docker 运行

从项目根目录启动 PostgreSQL + API：

```bash
docker compose up --build
```

默认服务：

```text
API: http://127.0.0.1:8000
Readiness: http://127.0.0.1:8000/ready
PostgreSQL: 127.0.0.1:5432
Metrics: http://127.0.0.1:8000/metrics
```

`docker-compose.yml` 里的默认账号只适合本地开发，部署前必须修改：

```text
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
POSTGRES_PASSWORD
```

## AI 层边界

当前 `/ai/ask` 是可解释的 RAG 接口：

- 使用本地 Embedding + 关键词混合检索相关来源。
- 返回 trace、sources 和 prompt_context。
- 保存 session 级长期 Memory。
- 配置 `OPENAI_API_KEY` 后调用 OpenAI-compatible Chat Completions；未配置时返回本地可解释答案。

真实 AI 的完整链路：

```text
query -> embedding -> vector search -> memory -> prompt -> LLM -> answer + sources
```

推荐演进：

```text
PostgreSQL full text search
-> pgvector / Milvus
-> Rerank
-> OpenAI-compatible LLM
-> Long-term memory
```
