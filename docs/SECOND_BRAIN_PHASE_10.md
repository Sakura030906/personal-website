# 第二大脑第十轮：主动知识工作流与长期记忆

## 本轮目标

把已有的收件箱、回顾、搜索和 AI 质量信号汇总为每日可执行任务，并建立需要人工确认的长期记忆机制。

## 已完成

- 新增持久化主动任务，支持优先级、去重、完成、忽略和处理记录。
- 每日简报读取真实信号：待整理收件箱、到期回顾、负面 AI 反馈、重复零结果搜索和低质量 RAG 回答。
- 新增长期记忆候选、确认、归档和公开范围控制。
- 后台“AI 反馈与记忆”升级为主动任务与长期记忆工作台。
- AI Lab 仅加载 `active + public` 的已确认长期记忆。
- 私有、候选和已归档记忆不会进入公开 AI 上下文。
- 所有任务和记忆状态变更写入活动日志。

## 数据与接口

- 数据表：`proactive_tasks`、`long_term_memories`。
- 迁移：`20260719_0012_proactive_memory.py`。
- 接口：
  - `GET /admin/proactive/dashboard`
  - `POST /admin/proactive/refresh`
  - `PATCH /admin/proactive/tasks/{id}`
  - `POST /admin/long-term-memories`
  - `PATCH /admin/long-term-memories/{id}`

## 验证

- 后端测试：60 passed。
- Alembic 从空数据库完整升级到 `20260719_0012 (head)`。
- 前端 JavaScript 语法与生产构建通过。
- `git diff --check` 通过。
- 后台桌面与 390px 手机视口无横向溢出，浏览器控制台无错误。

## 下一轮建议

进入可靠性收口：定时执行每日简报、数据库与文件自动备份、任务告警、恢复演练和部署验收。长期记忆后续可增加语义召回，但仍应保持人工确认和可见性边界。
