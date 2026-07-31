# 生产部署验收记录（2026-07-31）

## 结论

`2026.07.31-security1` 已部署到生产服务器，数据库已迁移到
`20260720_0013`，公开网站、管理后台、API、PostgreSQL、Milvus、
MinIO、备份和维护服务均已通过验收。

公开地址：

- 网站：`https://sakura000702.me/`
- 后台：`https://sakura000702.me/admin/`

## 本次发现的两个独立根因

### 1. 生产 Compose 启动方式错误

旧部署只使用了 `docker-compose.acr.yml`。这个文件只是镜像覆盖层，
不包含完整的环境变量、命令、依赖关系、健康检查、网络和数据卷。

直接启动覆盖层造成：

- MinIO 只执行了默认入口，未执行 `minio server /minio_data`。
- Milvus 缺少 `milvus run standalone` 命令和依赖配置。
- 备份容器缺少 PostgreSQL 密码等运行参数。
- 线上容器虽然部分处于运行状态，实际配置与本地完整 Compose 不一致。

正确命令必须同时加载基础文件和 ACR 覆盖层：

```bash
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.acr.yml \
  --env-file .env.production \
  up -d --no-build
```

### 2. Cloudflare Tunnel 的 QUIC 连接不稳定

容器部署完成后，服务器本机访问 `http://127.0.0.1/` 一直返回 `200`，
但公网短暂返回 Cloudflare `1033`。`cloudflared` 日志显示 QUIC 连接反复出现
`timeout: no recent network activity`，Cloudflare 没有可用的稳定连接。

处理方式：

- 保留原系统级 Tunnel，不修改凭据。
- 额外启动使用 `--protocol http2` 的连接。
- 使用 `ops/cloudflared/ensure-http2.sh` 检查并拉起 HTTP/2 连接。
- 服务器用户 `crontab` 已配置开机启动和每分钟健康守护。

恢复后公网持续返回 `HTTP/2 200`。该措施不把 Cloudflare 凭据写入仓库。

## 数据保护

升级前在服务器创建了独立手工备份：

```text
/home/hongxiang/deploy/personal-website/backups/manual-20260731/
```

包含：

- `database.dump`
  - SHA-256：`c16f7c91b3142cd8afad5111852cc9cc32cad0d44fc9b7bac4b67f721081e4c7`
- `uploads.tar.gz`
  - SHA-256：`4ad94a1305eeda916839ee09d28a0721785e98d1b3b03e9cd56ec6a56538669e`
- 升级前 Compose、Nginx 和环境配置副本。

`pg_restore -l` 已成功读取数据库备份，共 261 个 TOC 条目。

新备份容器随后完成了一次真实备份和隔离恢复演练：

- 归档：`/backups/portfolio-20260730T211016Z.tar.gz`
- 校验：通过。
- 恢复：通过，共检测到 36 张表。
- 演练没有覆盖生产数据库。

## 生产镜像

三个镜像均为 `linux/amd64`，已经推送到阿里云 ACR：

- `frontend:2026.07.31-security1`
  - `sha256:fd067335646124fed848980c42cd3094b27060fff0c4101d6f8890ab80fbffbd`
- `backend:2026.07.31-security1`
  - `sha256:f953eced5641734367b6c51486290f1b8c25e10e7390963d4bbca9c6acfe5fae`
- `backup:2026.07.31-security1`
  - `sha256:f70a0ec55d62980ffb7a7b8f8ca4666cf33ff750b4d0af9f1a17668c5f556136`

版本和完整镜像地址记录在 `ops/deploy/release-2026.07.31.env`。

## 生产验收结果

以下 8 个服务全部处于运行状态：

- API：healthy
- Web：healthy
- PostgreSQL：healthy
- Milvus：healthy
- MinIO：running
- etcd：running
- backup：healthy
- maintenance：healthy

自动验收结果：

- `/`：`200`
- `/admin/`：`200`
- `/api/health`：`200`
- `/api/ready`：`200`
- `/data/site.json`：`200`
- 匿名 `/api/metrics`：`404`
- 携带正确 Metrics Token：`200`
- CSS：`styles.29b00f76d2e4.css`，`200`
- JS：`app.314f6369a35b.js`，`200`
- HTTPS 证书：有效期至 2026-10-11
- 数据库版本：`20260720_0013`
- 完整 `acceptance.sh`：通过

浏览器能够加载正确页面标题“晏宏翔 | AI Agent / RAG 方向”。Codex 内置浏览器
的截图命令自身发生超时，因此本次视觉验收以真实浏览器加载、公开 HTTP 响应、
哈希静态资源和接口验收共同覆盖；不是站点返回错误。

## 后续运维规则

1. ACR 部署始终同时加载 `docker-compose.prod.yml` 和
   `docker-compose.acr.yml`。
2. 数据库迁移前必须保留一份可读取的 dump 和 uploads 快照。
3. 至少保留上一版镜像标签，确认新版本稳定后再清理。
4. 每次部署运行完整的 `ops/deploy/acceptance.sh`。
5. Cloudflare 公开访问出现 `1033` 时，先检查 HTTP/2 connector 和
   `cloudflared-http2.log`，再检查应用容器；不要先回滚业务代码。
6. 不提交 `.env.production`、Cloudflare credentials 或任何生产密钥。

## 发布自动化演练

部署完成后新增并实测了一键发布与回滚工具：

- `ops/deploy/release-common.sh`
- `ops/deploy/release.sh`
- `ops/deploy/rollback.sh`

2026-07-31 使用当前生产镜像执行了一次无版本变化的真实发布演练：

- 发布前备份：`/backups/portfolio-20260731T014045Z.tar.gz`
- 备份校验：通过
- ACR 镜像拉取：通过
- Compose 发布：通过
- 8 个生产服务：全部正常
- 完整公网验收：通过
- 当前版本记录：`.deploy-state/current-release.env`
- 上一版本记录：`.deploy-state/previous-release.env`

后续发布只需要提供新的 release manifest。验收失败时脚本会自动恢复上一组
前端、后端和备份镜像；手动回滚失败时也会尝试恢复回滚前的运行镜像。
数据库不会自动 downgrade，不兼容迁移仍需使用发布前备份恢复。

## CI/CD 自动化验收

2026-07-31 完成 GitHub Actions 自动发布链路：

- CI 和 Release 使用的第三方 Action 全部固定到 40 位提交哈希。
- Release 仅支持手动触发，正式部署必须输入 `DEPLOY`。
- 生产部署绑定 `production` 环境，可配置 Required reviewers。
- 三个业务镜像分别构建并执行 Trivy 高危、严重漏洞阻断扫描。
- 三个镜像分别生成 CycloneDX SBOM，随工作流产物保留 30 天。
- 发布清单使用 ACR 镜像摘要，不依赖可被覆盖的版本标签。
- 服务器端拒绝非指定 ACR 命名空间、错误仓库、非法标签和非法摘要。
- GitHub Runner 通过 Tailscale 临时节点访问服务器，并强制 SSH 主机校验。

本地验收：

- `npm run check`：通过。
- 后端测试：72 项通过。
- GitHub Actions YAML 与 actionlint 语义检查：通过。
- frontend、backend、backup 三份 Dockerfile 的 Buildx 检查：通过，无警告。
- 有效摘要清单：通过。
- 外部镜像仓库清单：被正确拒绝。

服务器验收：

- 新版 `release-common.sh` 语法检查：通过。
- 当前生产清单计划检查：通过。
- 8 个服务仍全部运行，6 个带健康检查的服务均为 healthy。
- 公网首页、`/healthz` 和 `/admin/`：均返回 `200`。

工作流已经具备运行条件，但首次自动发布前仍需按
`docs/CI_CD_SETUP.md` 在 GitHub 仓库中配置 Secrets、Variables、
Tailscale `tag:ci` ACL 和 production 审批人。
