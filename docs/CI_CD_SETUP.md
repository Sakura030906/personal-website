# CI/CD 配置与使用

## 目标

仓库包含两条 GitHub Actions 流程：

- `CI`：每次推送和合并请求执行源码、构建、后端测试、安全边界和部署清单检查。
- `Build and release`：仅手动启动，构建三类生产镜像、执行安全扫描、生成 SBOM 和不可变发布清单；只有明确启用部署并通过 `production` 环境审批后才会连接服务器。

生产部署不会使用可变标签定位镜像。工作流会把 ACR 返回的 `sha256` 摘要写入发布清单，服务器按摘要拉取镜像。

## GitHub 仓库配置

### 一次性自动配置

项目提供交互式配置工具：

```bash
npm run release:setup
```

它会通过隐藏输入读取 ACR 密码并直接写入 GitHub Secret，不会把密码保存到文件或命令历史。工具还会创建 `production` 环境、写入服务器变量，并使用
`~/.ssh/github_actions_personal_website` 与本机已经验证的 `known_hosts` 配置部署 SSH。

运行前需要先登录 GitHub CLI：

```bash
gh auth login --with-token
```

配置完成后，仍需在 GitHub 网页中为 `production` 手动启用 `Required reviewers`。只构建模式不需要 Tailscale；正式部署前再补齐 Tailscale OAuth 即可。

### Repository secrets

在 `Settings -> Secrets and variables -> Actions -> Repository secrets` 中配置：

| 名称 | 用途 |
| --- | --- |
| `ACR_USERNAME` | 阿里云容器镜像服务登录用户名 |
| `ACR_PASSWORD` | 阿里云容器镜像服务固定密码或访问凭据 |

### Production environment

在 `Settings -> Environments` 中创建 `production`，启用 `Required reviewers`，至少指定一个审批人。生产服务器相关凭据放在这个环境中，不放在仓库级别。

Environment secrets：

| 名称 | 用途 |
| --- | --- |
| `TAILSCALE_OAUTH_CLIENT_ID` | CI 临时节点加入 Tailnet 的 OAuth Client ID |
| `TAILSCALE_OAUTH_SECRET` | 对应 OAuth Secret，权限只保留 `auth_keys: write` |
| `SERVER_SSH_PRIVATE_KEY` | 专用于 CI 部署的 SSH 私钥 |
| `SERVER_SSH_KNOWN_HOSTS` | 已人工核对的服务器 `known_hosts` 完整记录 |

Environment variables：

| 名称 | 当前值 |
| --- | --- |
| `SERVER_HOST` | `100.110.201.24` |
| `SERVER_USER` | `hongxiang` |
| `SERVER_DEPLOY_PATH` | `/home/hongxiang/deploy/personal-website` |
| `PUBLIC_BASE_URL` | `https://sakura000702.me` |

不要使用 `ssh-keyscan` 在工作流运行时临时信任服务器。`SERVER_SSH_KNOWN_HOSTS` 应从已经验证过的本机 `~/.ssh/known_hosts` 取得，并核对服务器 Ed25519 指纹后再保存。

## Tailscale 最小权限

1. 创建标签 `tag:ci`。
2. 创建 OAuth Client，仅授予创建临时认证节点所需的 `auth_keys: write`。
3. ACL 只允许 `tag:ci` 访问生产服务器的 TCP 22 端口。
4. GitHub Action 创建的是临时节点，流程完成后会自动退出 Tailnet。

## 发版方式

1. 打开 GitHub 仓库的 `Actions`。
2. 选择 `Build and release`。
3. 点击 `Run workflow`。
4. 输入版本号，例如 `2026.08.01`。
5. 只构建镜像时保持 `deploy=false`。
6. 需要正式发布时设置 `deploy=true`，并在确认框输入 `DEPLOY`。
7. 等待代码检查、镜像构建、安全扫描和 SBOM 生成完成。
8. 在 `production` 环境审批页确认发布。
9. 工作流会自动备份、拉取摘要锁定的镜像、部署、验收；验收失败时服务器脚本会恢复上一组应用镜像。

## 产物

每次成功构建保留 30 天：

- `release-<version>`：摘要锁定的生产发布清单。
- `sbom-<version>`：frontend、backend、backup 三个 CycloneDX SBOM。

## 安全边界

- 所有第三方 GitHub Action 都固定到 40 位提交哈希。
- Release 只接受 `hongxiang000702/frontend`、`backend`、`backup` 三个 ACR 仓库。
- 生产部署必须同时满足：手动触发、`deploy=true`、输入 `DEPLOY`、环境审批通过。
- SSH 强制验证已知主机，不允许关闭主机校验。
- 工作流只传递发布清单，不覆盖服务器的 `.env.production`、数据库、上传文件或基础设施配置。
- 数据库只向前迁移；应用镜像可以自动回滚，数据库降级仍需人工恢复备份。
