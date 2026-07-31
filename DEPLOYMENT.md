# 生产部署

这套部署用于一台 Linux 服务器，提供公开网站、登录 CMS、FastAPI、PostgreSQL、Milvus、自动备份和 HTTPS。公网只开放 `80` 和 `443`；数据库、Milvus 和 API 原始端口只存在于 Docker 内网。

## 1. 服务器准备

建议从 `4 vCPU / 8 GB RAM / 80 GB SSD` 起步。若暂时不运行 Milvus，可把 `VECTOR_STORE` 改成 `local` 并在 Compose 中停用 Milvus、etcd 和 MinIO，较小的服务器也能运行。

在阿里云 DNS 中，把以下记录指向服务器公网 IP：

```text
@    A    服务器公网 IPv4
www  A    服务器公网 IPv4
```

服务器安全组只开放：

```text
22/tcp   仅你的固定 IP
80/tcp   0.0.0.0/0
443/tcp  0.0.0.0/0
```

安装 Docker Engine 与 Docker Compose Plugin，并把项目放到服务器。

## 2. 生产环境变量

```bash
cp .env.production.example .env.production
openssl rand -hex 32
```

把生成的随机值分别设置为 `POSTGRES_PASSWORD`、`JWT_SECRET` 和 `MILVUS_MINIO_SECRET_KEY`，并设置独立的 `ADMIN_PASSWORD`。不要提交 `.env.production`。

`ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 只负责首次启动时在 PostgreSQL 中创建第一个管理员。创建完成后，登录会查询数据库中的账号和密码哈希；修改环境变量不会覆盖已有账号。首次登录后应在后台“账号与权限”中修改密码，并从该页面创建编辑者或只读账号。

上线前检查：

```bash
npm run deploy:check
```

生产 API 的 `/ready` 会检查 PostgreSQL 连接；`/health` 只用于进程存活检查。两者通过 Nginx 暴露为 `/api/ready` 和 `/api/health`。

## 3. 启动

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

首次导入当前 `data/site.json`：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api python scripts/import_site_json.py
```

导入只需要执行一次。此后在后台新增或修改的文章、专栏、知识节点、版本和账号都会直接写入服务器 PostgreSQL，不再依赖开发电脑上的 JSON 文件。

访问地址：

```text
公开网站  http://sakura000702.me
管理后台  http://sakura000702.me/admin/
API 文档  http://sakura000702.me/api/docs
```

## 4. HTTPS

确认域名已解析到服务器且 HTTP 可以访问，然后运行：

```bash
LETSENCRYPT_EMAIL=你的邮箱 ./ops/deploy/enable-https.sh
```

脚本会申请 `sakura000702.me` 与 `www.sakura000702.me` 证书，加载 TLS 配置并热重载 Nginx。将续期命令加入服务器 `cron`，每天执行一次：

```text
17 3 * * * cd /path/to/site && ./ops/deploy/renew-https.sh >> /var/log/portfolio-certbot.log 2>&1
```

## 5. 备份与恢复

`backup` 容器启动后立即执行一次备份，之后按 `BACKUP_INTERVAL_SECONDS` 定时执行。每份归档包含：

- PostgreSQL custom-format dump。
- `uploads` 文件目录。
- 创建时间和 SHA-256 校验信息。

默认保留最近 14 份，归档位于 Docker `backups` volume。查看日志：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs backup
```

服务器上的数据归属和账号权限详见 [`docs/SERVER_DATA_AND_ACCOUNTS.md`](docs/SERVER_DATA_AND_ACCOUNTS.md)。

验证某份备份归档，不会连接数据库，也不会修改数据：

```bash
npm run backup:verify -- /path/to/portfolio-YYYYMMDDTHHMMSSZ.tar.gz
```

手动备份：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backup python backup_once.py
```

完整恢复演练会把归档恢复到一次性临时数据库，检查表结构后立即删除临时数据库，不会改动生产库：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backup \
  python restore_drill.py /backups/portfolio-YYYYMMDDTHHMMSSZ.tar.gz
```

确认数据库账号具备创建临时数据库的权限后，可设置 `BACKUP_RESTORE_DRILL_ENABLED=true`，让每次备份自动执行恢复演练。个人站建议先保持 `false`，每月手动执行一次，避免每天产生额外 I/O。

恢复会覆盖数据库内容，执行前先停止 API：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production stop api
docker compose -f docker-compose.prod.yml --env-file .env.production exec backup \
  python restore.py /backups/portfolio-YYYYMMDDTHHMMSSZ.tar.gz --confirm
docker compose -f docker-compose.prod.yml --env-file .env.production start api
```

启用 OSS 异地备份：

```text
BACKUP_OSS_ENABLED=true
OSS_REGION=cn-shanghai
OSS_ENDPOINT=https://oss-cn-shanghai.aliyuncs.com
OSS_BUCKET=你的 Bucket
OSS_ACCESS_KEY_ID=RAM 用户 AccessKey ID
OSS_ACCESS_KEY_SECRET=RAM 用户 AccessKey Secret
```

建议在 OSS 控制台为 `portfolio/backups/` 配置生命周期规则，例如 30 天后转低频、180 天后删除。

## 6. OSS 文件存储

默认 `STORAGE_BACKEND=local`，上传文件保存在 Docker volume。如果改为 `oss`，CMS 新上传的图片和文档会同时保留本地解析副本，并把公开 URL 写成 OSS 地址：

```text
STORAGE_BACKEND=oss
OSS_PUBLIC_BASE_URL=https://你的文件域名
```

RAM 用户至少需要目标前缀的 `PutObject` 和 `DeleteObject` 权限。不要使用阿里云主账号 AccessKey。

只发布纯静态站到 OSS 时，在本机执行：

```bash
npm run publish:oss:dry-run
npm run publish:oss
```

纯 OSS 静态站不能运行 FastAPI、CMS、PostgreSQL 或 AI Lab 服务端能力；完整系统应部署在 ECS，OSS 作为静态文件或上传文件存储。

## 7. 验收与运维

`maintenance` 服务启动后立即生成一次主动知识简报，之后按 `MAINTENANCE_INTERVAL_SECONDS` 执行。它会把收件箱、到期回顾、搜索缺口和低质量问答转成后台任务。

可选告警配置：

```text
ALERT_WEBHOOK_URL=https://你的告警接收地址
ALERT_HIGH_PRIORITY_TASKS=10
```

备份失败、维护周期失败，或高优先级任务超过阈值时会发送 JSON Webhook。未配置 URL 时不会向外部发送任何数据。

```bash
./ops/deploy/verify.sh https://sakura000702.me
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 api web backup maintenance
```

Prometheus 指标：

```bash
curl -H "X-Metrics-Token: $METRICS_TOKEN" \
  https://sakura000702.me/api/metrics
```

未携带令牌的请求必须返回 `404`。`ops/deploy/verify.sh` 会从
`METRICS_TOKEN` 环境变量或 `ENV_FILE` 指向的生产配置中读取令牌，
不会把令牌打印到验收日志。

重点关注：

```text
portfolio_backup_last_success_age_seconds
portfolio_maintenance_last_success_age_seconds
portfolio_proactive_high_priority_open
portfolio_proactive_tasks_total
portfolio_long_term_memories_total
```

完整生产验收会检查核心容器、API、后台、数据文件、CSS/JS 哈希资源及 HTTPS 证书：

```bash
npm run deploy:verify -- https://sakura000702.me
```

升级流程：

```bash
git pull
python3 ops/deploy/preflight.py .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production exec backup \
  python backup_once.py
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
ENV_FILE=.env.production \
COMPOSE_OVERRIDE_FILE=docker-compose.acr.yml \
./ops/deploy/acceptance.sh https://sakura000702.me
```

API 启动时会自动执行 Alembic 迁移。升级前的手工备份和验收脚本均成功后，
才应清理旧镜像；至少保留上一版镜像标签和最近一份已通过恢复演练的备份。

使用阿里云 ACR 镜像时，拉取和启动命令为：

```bash
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.acr.yml \
  --env-file .env.production \
  pull api web backup maintenance

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.acr.yml \
  --env-file .env.production \
  up -d --no-build
```

`docker-compose.acr.yml` 只是镜像覆盖层，不能单独启动。单独使用它会丢失
基础文件中的环境变量、命令、依赖关系、网络和数据卷，导致 MinIO、Milvus
和备份服务运行异常。

## 8. Cloudflare Tunnel

当域名通过 Cloudflare Tunnel 暴露时，服务器 Nginx 使用
`ops/nginx/cloudflare-http.conf`，由 Cloudflare 负责公网 TLS，源站保持 HTTP。
不要在源站强制 HTTPS 跳转，否则可能产生重定向循环。

部分网络环境下 QUIC/UDP 长连接会反复超时，表现为公网返回 Cloudflare
`1033`，但服务器本机访问 Nginx 仍然是 `200`。这种情况下使用 HTTP/2：

```bash
./ops/cloudflared/ensure-http2.sh
```

服务器可配置开机启动和每分钟守护：

```text
@reboot /path/to/site/ops/cloudflared/ensure-http2.sh
* * * * * /path/to/site/ops/cloudflared/ensure-http2.sh
```

脚本只读取服务器已有的 `/etc/cloudflared/config.yml`，不会复制或提交
Cloudflare credentials。排查顺序：

```bash
curl -I http://127.0.0.1/
pgrep -a cloudflared
tail -n 100 ~/cloudflared-http2.log
curl -I https://sakura000702.me/
```

## 9. 一键发布与回滚

每个版本使用独立的发布清单记录前端、后端和备份镜像，例如：

```text
ops/deploy/release-2026.07.31.env
```

先在本地检查发布计划，不连接服务器、不修改容器：

```bash
npm run check:deploy
```

在服务器项目目录执行正式发布：

```bash
npm run deploy:release -- \
  ops/deploy/release-2026.07.31.env \
  https://sakura000702.me
```

发布脚本依次执行：

1. 验证生产环境变量和完整 Compose 配置。
2. 记录当前运行镜像到 `.deploy-state/previous-release.env`。
3. 创建发布前数据库与 uploads 备份。
4. 拉取清单中的 ACR 镜像。
5. 更新 API、Web、backup 和 maintenance。
6. 执行完整生产验收。
7. 验收失败时自动恢复上一组应用镜像。

手动回滚到上一个已记录版本：

```bash
npm run deploy:rollback -- \
  .deploy-state/previous-release.env \
  https://sakura000702.me
```

镜像回滚不会自动执行 Alembic downgrade。数据库迁移应保持向后兼容；如果某次
迁移不可兼容，必须按验收报告中的备份路径人工恢复数据库和 uploads。

## 10. GitHub Actions 自动发布

`.github/workflows/release.yml` 提供手动触发的安全发布流程：

1. 执行完整源码检查和 Trivy 源码扫描。
2. 构建并推送 frontend、backend、backup 三个 `linux/amd64` 镜像。
3. 阻断存在未修复的高危或严重漏洞的镜像。
4. 为每个镜像生成 CycloneDX SBOM。
5. 使用 ACR 返回的 `sha256` 摘要生成不可变发布清单。
6. 仅在 `deploy=true`、确认值为 `DEPLOY` 且 `production` 环境审批通过后部署。
7. 通过 Tailscale 临时 CI 节点和已核对的 SSH 主机密钥连接生产服务器。

首次使用前需要在 GitHub 配置 ACR、Tailscale、SSH 和 production 环境审批。
完整配置及操作步骤见 `docs/CI_CD_SETUP.md`。
