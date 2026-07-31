# 安全与性能加固记录（2026-07-22）

## 已完成

- 真实 SQLite 数据库先在副本演练，再从 `20260718_0010` 升级到 `20260720_0013`；升级前备份位于 `backups/migration-rehearsals/`。
- 生产启动校验会阻断弱 JWT、未保护的 Metrics、不安全 Cookie、通配 CORS 和弱管理员引导密码。
- 后台登录改用 `HttpOnly + SameSite=Lax + Secure(生产)` Cookie，前端不再把 JWT 写入 `localStorage`。
- AI 会话由服务器签名 Cookie 绑定；客户端传入的 `session_id` 不再决定可访问的会话。
- `/metrics` 必须携带 `X-Metrics-Token`，未配置或不匹配时统一返回 404。
- 图片上传实行大小限制、MIME 对照、真实格式检测、图片解码和像素上限；文档上传校验扩展名、MIME 与 PDF/DOCX 文件签名。
- Markdown 链接与图片采用协议白名单，拒绝 `javascript:` 等可执行协议。
- Git 忽略并清理 Python 缓存、数据库备份、编辑器交换文件和生成 chunk。
- 安全源码导出器默认排除环境文件、数据库、上传内容、备份、构建产物和缓存，并在导出前扫描常见密钥格式。
- 前端采用 ESM 代码分割：首屏包约 111 KB；约 422 KB 的 Cytoscape 仅进入知识图谱时加载。
- `npm run check` 统一执行安全检查、生产配置结构检查、前端构建和后端测试；GitHub Actions 使用同一入口。

## 常用命令

```bash
# 安全演练，不修改真实数据库
python3 ops/deploy/migrate_sqlite_safely.py

# 演练成功后升级真实数据库
python3 ops/deploy/migrate_sqlite_safely.py --apply

# 生成不含运行数据和密钥的源码包
npm run export:source

# 本地与 CI 的统一检查
npm run check

# 部署前验证真实环境文件
python3 ops/deploy/preflight.py .env.production
```

Prometheus 抓取时必须设置请求头：

```text
X-Metrics-Token: <METRICS_TOKEN>
```

## 仍需人工协调的密钥轮换

当前本地 `.env.production` 中的 `MILVUS_MINIO_SECRET_KEY` 仍是占位值。MinIO 密钥和已存在的数据卷、服务器环境绑定，不能只修改本地文件；应在维护窗口内同步更新服务器环境和 MinIO 配置，再重新部署并验证读取。若历史压缩包包含管理员密码，还必须在后台“账号安全”页面修改密码；仅修改 `ADMIN_PASSWORD` 不会覆盖数据库中已有账号的密码哈希。
