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

验证某份备份归档，不会连接数据库，也不会修改数据：

```bash
npm run backup:verify -- /path/to/portfolio-YYYYMMDDTHHMMSSZ.tar.gz
```

手动备份：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backup python backup_once.py
```

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

```bash
./ops/deploy/verify.sh https://sakura000702.me
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=200 api web backup
```

Prometheus 指标：

```text
https://sakura000702.me/api/metrics
```

升级流程：

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
./ops/deploy/verify.sh https://sakura000702.me
```
