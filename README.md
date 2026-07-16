# 个人网站

这是一个公开只读的个人网站，同时提供一个本地编辑后台。

公网访问者只能看到发布后的静态页面，不能修改内容。你在本机运行编辑后台，保存后会写入 `data/site.json`，再重新发布即可更新公网内容。

## 本地预览公开页面

```bash
npm run dev
```

打开：

```text
http://localhost:4173
```

## 本地编辑内容

```bash
npm run edit
```

打开：

```text
http://127.0.0.1:4180
```

编辑后台只监听本机地址 `127.0.0.1`，不会被发布到公网。保存后会更新：

```text
data/site.json
```

后台可以修改首页身份、状态卡片、当前重点、内容地图、联系方式、教育经历、工作经历、技术价值观、技术栈、项目作品、博客文章、知识库、学习路线、阅读记录、年度时间线和 AI Lab。博客文章保存到 `posts` 字段，公网文章页只读展示。

本地编辑器顶部已经接入 FastAPI CMS：

- `登录 CMS`：使用后端 `.env` 里的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`。
- `同步到 CMS`：把当前 `data/site.json` 写入数据库，并自动拆成文章、项目和知识库条目。
- `从 CMS 读取`：从数据库读取当前站点文档，覆盖编辑器里的内容。

编辑器里的 `内容 CMS` 是日常内容维护入口：

- `文章`、`知识库`、`项目` 分开维护，不需要再手动编辑整份 JSON。
- 支持 Markdown 正文和实时预览。
- 支持上传图片或附件，上传后自动插入 Markdown。
- `文档知识库` 支持 PDF、DOCX、Markdown、TXT 的解析、切片编辑、启停、知识节点关联、重新切片和版本恢复；文档原文件不会发布到 OSS 静态站。
- AI Lab 支持限定到指定知识专栏、知识节点、文章或文档进行问答；只召回该范围内相互关联且公开、允许 AI 使用的内容。
- 文档切片已经接入本地向量索引和 Milvus 独立集合，引用会显示文档名、页码并跳转到原文件。
- 支持自动保存；自动草稿与公开正文分离，重新打开时会自动恢复。
- 支持 `draft` / `published` / `archived` 状态和 `public` / `unlisted` / `private` 可见性。
- 手动保存、发布、归档会生成带操作者和原因的版本记录，并可查看差异或恢复旧版本。
- 使用 revision 冲突检测，避免两个浏览器页面静默覆盖彼此的修改。
- 文章已使用独立 `articles` 表，不再和项目、阅读、文档或知识节点混在同一张表。
- 分类和标签会自动归一化到 `categories`、`tags`，文章可以加入多个知识专栏并指定主专栏。
- `知识专栏` 面板可以维护名称、简介、排序、可见性和 AI 检索权限；删除专栏不会删除文章。
- `知识节点与关系` 面板可以维护独立 Markdown 节点、标签、多专栏归属、相关文章和显式关系；每次保存都会记录修订版本。
- 公开知识节点使用 `#node-{slug}` 独立地址，并展示所属专栏、相关文章及双向关系；私有节点和私有关系不会进入公开接口。
- 知识库提供基于 Cytoscape.js 的真实 2D 图谱，支持拖拽、缩放、适应视图、节点搜索以及按专栏、节点类型和关系类型筛选。
- 图谱只读取数据库中的公开节点和显式关系；静态发布前可导出到 `data/site.json`，因此公网阅读不依赖后台 API 在线。
- `写入本地站点 JSON` 会把 CMS 里的文章、知识库和项目同步回 `data/site.json`，再用于静态站点发布。

博客正文支持 Markdown 标题、列表、引用、图片、代码块、Mermaid 代码块和基础 LaTeX 展示。文章支持 `draft` / `published` 状态，公开站点和 RSS 只展示非草稿文章。构建时会自动生成 `feed.xml`、`sitemap.xml` 和 `robots.txt`。

## 文件结构

- `index.html`：公开只读页面结构。
- `styles.css`：公开页面样式。
- `script.js`：公开页面渲染逻辑，读取 `data/site.json`。
- `data/site.json`：可编辑的网站内容。
- `admin/`：本地编辑后台，不会发布到公网。
- `scripts/edit-server.mjs`：本地编辑后台服务。
- `scripts/build.mjs`：生成 Sites 部署产物。
- `backend/`：FastAPI CMS API，本地默认 SQLite，可通过 `DATABASE_URL` 切换 PostgreSQL；不属于当前 OSS 静态站发布文件。

## 内容结构

- `profile`：首页姓名、方向、简介、联系方式、状态卡片和当前重点。
- `siteModules`：首页内容地图。
- `about`：教育经历、工作经历和技术价值观。
- `techStack`：技术栈标签。
- `projects`：项目作品集，支持问题背景、架构设想、核心模块、难点和下一步计划。
- `posts`：博客文章，支持简单 Markdown。
- `knowledgeBase`：结构化知识库主题，支持知识节点、示例、关联项目和相关文章。
- `learningMap`：学习路线和学习状态。
- `reading`：阅读记录。
- `timeline`：年度时间线。
- `aiShowcase`：站内 AI 助手规划、能力卡片、示例问答和演进路线。

## 当前能力边界

- 公开站点是只读静态站点，不需要登录。
- 本地编辑器只监听 `127.0.0.1:4180`，不会发布到公网。
- 全站搜索已经可用，支持搜索文章、项目、知识主题和知识节点。
- 知识库支持站内搜索、知识节点、示例代码、关联项目和相关文章。
- AI Lab 会优先调用 `http://127.0.0.1:8000/ai/ask`。后端启动后，它会走文章、知识节点和文档切片的混合检索、范围过滤、Memory、来源引用和 LLM 适配；未限定范围且后端不可用时才退回浏览器本地检索。
- `backend/` 已有可运行 CMS API：登录、独立内容编辑、整站同步、内容 CRUD、发布、文件上传、版本记录、版本恢复、搜索、AI 问答和基础监控。
- 如果部署到阿里云 OSS，只上传 `index.html`、`styles.css`、`script.js`、`assets/`、`data/`、`feed.xml`、`sitemap.xml`、`robots.txt`，不要上传 `admin/` 和 `backend/`。

## 后端 CMS

后端默认使用本地 SQLite，适合开发验证；生产环境改成 PostgreSQL：

```text
DATABASE_URL=postgresql+psycopg://user:password@host:5432/portfolio
JWT_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=your-password
UPLOAD_DIR=./uploads
```

启动：

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

主要接口：

```text
POST /auth/login
GET  /admin/entries
GET  /admin/articles
POST /admin/articles
PATCH /admin/articles/{id}
POST /admin/articles/{id}/autosave
POST /admin/articles/{id}/publish
POST /admin/articles/{id}/archive
GET  /admin/knowledge-columns
POST /admin/knowledge-columns
PATCH /admin/knowledge-columns/{id}
GET  /content/knowledge-graph
POST /admin/entries
PATCH /admin/entries/{id}
POST /admin/entries/{id}/publish
GET  /admin/export
POST /admin/import
GET  /admin/site
POST /admin/site
GET  /admin/versions/{entity_type}/{entity_id}
POST /admin/versions/{version_id}/restore
POST /admin/assets
GET  /content/public
GET  /content/articles
GET  /content/articles/{slug}
GET  /content/columns
GET  /content/columns/{slug}
GET  /content/site
GET  /search?q=RAG
POST /ai/ask
GET  /ai/scopes
GET  /agent/tools
POST /agent/tasks
POST /agent/tasks/{id}/run
GET  /agent/tasks/{id}
GET  /metrics
```

导入当前静态站内容到 CMS：

```bash
cd backend
python scripts/import_site_json.py
```

Docker 本地启动 PostgreSQL + API：

```bash
docker compose up --build
```

当前 `/ai/ask` 已经包含 Embedding 检索、来源引用、Prompt Context 和长期 Memory。可以使用本机 Ollama，也可以配置 OpenAI-compatible 服务；模型不可用时才降级为本地规则回答。

## 生产部署

第八阶段生产基线已经包含：

- PostgreSQL、Milvus、FastAPI 和 Nginx 的隔离 Docker 网络。
- 同域名 `/api` 反向代理，公网前端不会再错误访问访客电脑的 `127.0.0.1`。
- 登录 CMS 的 `/admin/` 入口、上传大小限制、登录与 AI 接口限流和安全响应头。
- PostgreSQL 与上传文件的定时归档、校验、保留策略、恢复脚本和可选 OSS 异地备份。
- 本地或 OSS 上传存储适配、静态站 OSS 发布脚本、Let's Encrypt 申请与续期脚本。
- 生产环境变量预检、容器健康检查和上线验收脚本。

完整步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

本机 Ollama（无需外部 API Key）：

```text
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen3.5:2b
EMBEDDING_PROVIDER=ollama
OLLAMA_EMBEDDING_MODEL=bge-m3
EMBEDDING_DIMENSIONS=1024
```

首次使用前确认 `ollama list` 中存在聊天模型与 Embedding 模型。切换模型后必须重建索引。

RAG 默认使用本地 embedding 和数据库内 chunk 检索，适合开发和离线演示：

```text
EMBEDDING_PROVIDER=local
VECTOR_STORE=local
```

切换真实 Embedding 时配置：

```text
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BATCH_SIZE=64
```

切换 embedding 模型或维度后，需要在后台 `RAG Index` 点击 `重建索引`，否则旧 chunk 的向量维度可能和新查询向量不一致。

如果要切换到 Milvus，先启动 Docker 服务，再配置：

```text
VECTOR_STORE=milvus
MILVUS_URI=http://localhost:19530
MILVUS_COLLECTION=portfolio_chunks
MILVUS_NODE_COLLECTION=portfolio_knowledge_nodes
MILVUS_DOCUMENT_COLLECTION=portfolio_documents
```

如果 API 在 Docker 内运行，`MILVUS_URI` 使用：

```text
MILVUS_URI=http://milvus:19530
```

本地开发也可以使用 Milvus Lite 文件库，不需要先启动 Docker：

```text
VECTOR_STORE=milvus
MILVUS_URI=./portfolio-milvus-lite.db
```

后台 `RAG Index` 支持查看当前 Embedding、Vector DB 状态，点击 `重建索引` 会把 CMS 内容重新切片并同步到 Milvus；点击 `运行评测` 可以用默认问题检查召回质量。

RAG 评测集在 `backend/rag_eval.json`，可以持续加入真实问题：

```json
{
  "id": "milvus-rag",
  "question": "Milvus 在 RAG 系统里负责什么？",
  "expected_terms": ["milvus", "rag", "向量", "检索"],
  "expected_slugs": ["milvus-rag"]
}
```

后台评测会输出 Answer Rate、Hit Rate、Top1 和 MRR，用来判断检索质量是否真的变好。

检索调参可以通过环境变量控制：

```text
RAG_LEXICAL_WEIGHT=1.0
RAG_VECTOR_WEIGHT=12.0
RAG_ENTRY_VECTOR_WEIGHT=10.0
RAG_MIN_SCORE=0.15
RAG_MILVUS_EXPAND=5
RAG_RERANKER=local
RAG_RERANK_TOP_K=20
RAG_RERANK_WEIGHT=4.0
RAG_QUERY_EXPANSION=local
RAG_MULTI_QUERY_LIMIT=4
RAG_FUSION_K=60
RAG_FUSION_WEIGHT=20.0
RAG_CONTEXT_MAX_CHARS=700
RAG_EVIDENCE_THRESHOLD=0.18
RAG_CLAIM_SUPPORT_THRESHOLD=0.16
RAG_MIN_ANSWER_SUPPORT=0.25
```

`RAG_RERANKER=local` 会在混合召回后，根据标题匹配、查询词覆盖和完整短语命中重排前 20 个候选。后台会分别展示召回分、重排分和最终分。

`RAG_QUERY_EXPANSION=local` 会识别 RAG、Milvus、Redis、Agent、Memory、Embedding、Transformer、FastAPI、LLM 等技术概念，生成最多 4 条中英文检索表达。各路结果使用 RRF 融合、去重后再进入 Reranker；AI 回答会返回 Query Plan、命中的子查询和融合分数。

上下文压缩器会从每条来源中保留最多 700 个与问题最相关的字符。Grounding Guard 会在生成前判断站内证据是否充分，证据不足时直接拒答，不调用外部模型；生成后 Citation Verifier 会统计得到来源支持的回答句子、引用覆盖率和无效引用。外部模型失败或回答支持率低于阈值时，接口会自动切换到站内可解释答案。报告会保存到长期 Memory 和后台 AI Runs。

Agent Runtime 当前提供公网只读任务，支持 `search_content`、`list_recent_content`、`get_content`、`compare_content`、`explore_knowledge_graph`、`recall_memory` 六个白名单工具。任务和每一步工具调用都会保存状态、输入、输出、耗时与错误；默认最多 6 步、8 次工具调用、30 秒，不提供写入、文件系统或代码执行工具。

Agent 采用“执行一步、读取观察、重新规划”的动态循环，而不是预先写死全部步骤。配置了 `OPENAI_API_KEY` 时，`auto` 模式会使用 OpenAI-compatible Chat Completions 接口选择下一步；模型不可用、返回格式错误或请求了白名单外工具时，会自动降级到本地规划器。工具输出始终被视为不可信数据，不能改变系统权限。

```text
AGENT_PLANNER_PROVIDER=auto
AGENT_PLANNER_MODEL=
AGENT_PLANNER_TIMEOUT_SECONDS=20
AGENT_PLANNER_OBSERVATION_CHARS=12000
AGENT_EVAL_PATH=./agent_eval.json
LLM_INPUT_COST_PER_MILLION=0
LLM_OUTPUT_COST_PER_MILLION=0
```

`AGENT_PLANNER_PROVIDER` 可设为 `auto`、`openai` 或 `local`。`AGENT_PLANNER_MODEL` 留空时复用 `OPENAI_MODEL`；生产环境建议保留工具调用次数、总时长和结果长度限制。

任务结束后，Agent 会把工具观察合并为可信来源，经过 Evidence Guard、带编号引用的答案生成和 Citation Verifier，再返回 `quality_score`、`grounding`、`generator` 与耗时。模型答案缺少站内支持时会降级为本地引用答案；最终结果会进入长期 Memory。CMS 的 `Agent Runs` 面板可以审计规划轨迹、工具输入输出、停止原因、失败分类、token 和估算成本。

Agent 任务支持异步生命周期：`POST /agent/tasks/{id}/start` 启动后，前端轮询 `GET /agent/tasks/{id}` 显示最新步骤；运行中可 `cancel`，失败或取消后可 `retry`，恢复时保留已经成功的工具观察。未来需要敏感能力的工具可以声明 `requires_confirmation`，运行时会暂停为 `awaiting_confirmation`，通过 `confirm` 批准或拒绝。所有任务操作必须同时匹配创建任务时的 `session_id`。

比较型目标会优先调用 `compare_content`，一次读取两到三条已发布内容，减少重复工具调用并为差异分析提供完整依据。

Agent 回归评测集位于 `backend/agent_eval.json`。后台 `Agent Runs` 点击 `运行评测` 后，会固定使用本地规划与本地生成，验证任务状态、工具路径、来源命中、答案质量和延迟，因此不会消耗外部模型额度。正常请求的模型成本按 `LLM_INPUT_COST_PER_MILLION` 和 `LLM_OUTPUT_COST_PER_MILLION` 估算，并通过 CMS 与 `/metrics` 暴露。

`运行评测` 会同时对比 `balanced`、`semantic`、`keyword`、`no-rerank` 和 `single-query`，后台会按 MRR、Top1、Hit Rate 排出当前最优配置，也能分别判断查询扩展和重排是否带来提升。

## 设计方向

当前视觉方向是“克制型技术编辑部风格”：减少大面积渐变、Emoji 和强阴影，使用低饱和配色、清晰排版、少量重点卡片和更强的信息层级。首页只承担快速说明“我是谁、在做什么、有什么项目、最近写了什么”，更完整的知识库、路线和 AI Lab 放到独立页面深入阅读。

当前首页继续向“项目优先”收敛：首屏重点不是个人头像，而是 `Building AI Agent Systems.` 和正在构建的项目控制台；首页只保留 Hero、精选项目、最近文章、Now 和页脚。

## 自定义域名

目标域名是 `sakura000702.me`。当前 Sites 仍显示 `pending_validation`。DNS 应配置：

- `@` A 记录：`172.66.3.26`
- `@` A 记录：`162.159.143.30`
- `_openai-site-verification` TXT：`openai-site-verification=U5W2Fxwa51nSLjrrO0065b3AtLxt1_KPKog5u9jFHqs`
- `_cf-custom-hostname` TXT：`6d6051da-4586-440c-a0e1-75a2e0d408d3`

如果 `dig +short sakura000702.me A` 仍返回 `198.18.2.123`，说明阿里云 DNS 记录还没有正确指向 Sites。

## 发布

修改内容后执行：

```bash
npm run build
```

然后提交、推送、保存 Sites 版本并部署。当前 Sites 项目 ID 已写入 `.openai/hosting.json`。
