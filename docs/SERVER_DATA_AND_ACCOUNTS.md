# 服务器数据与账号系统

## 1. 数据存储位置

生产环境以服务器为唯一正式数据源。浏览器和开发电脑不保存文章正文、知识节点、版本历史或上传文件。

| 数据 | 正式存储位置 | 是否备份 |
| --- | --- | --- |
| 账号、文章、专栏、知识节点、关系、草稿、版本、活动记录、AI Memory | PostgreSQL 的 `postgres-data` Docker volume | 是 |
| 图片、附件、原始文档 | `uploads` Docker volume；启用 OSS 后公开文件进入 OSS | 是 |
| 向量索引 | Milvus 的 `milvus-data`、`milvus-etcd`、`milvus-minio` volumes | 可从正文重建 |
| 前端登录状态 | 浏览器只保存 API 地址、邮箱提示和 JWT | 不包含业务正文 |
| `data/site.json` | 首次迁移和开发兜底 | 不是生产主数据源 |

`STORAGE_BACKEND=local` 的 `local` 指服务器 Docker volume，不是你的 Mac。文件仍然保存在服务器上。文件量变大或需要 CDN 时，再切换到 `STORAGE_BACKEND=oss`。

## 2. 保存与读取流程

```text
后台编辑器
  -> HTTPS /api/admin/*
  -> FastAPI 鉴权与权限检查
  -> PostgreSQL 写入正文、状态和版本
  -> uploads volume / OSS 写入图片与文档

公开网站
  -> HTTPS /api/content/site
  -> HTTPS /api/content/public
  -> 只读取已发布内容
```

后台的“保存站点设置到服务器”、文章自动保存、发布、版本恢复、知识节点和账号操作都调用 FastAPI。旧的“同步整份本地 JSON”入口已经移除。

## 3. 账号与权限

首次启动时，应用读取：

```text
ADMIN_EMAIL
ADMIN_PASSWORD
JWT_SECRET
```

如果 PostgreSQL 中还没有 `ADMIN_EMAIL` 对应账号，系统会创建首个管理员并保存密码哈希。已有账号不会被环境变量覆盖。

| 角色 | 权限 |
| --- | --- |
| `admin` | 使用 CMS、管理内容和 AI 系统、创建和停用账号、重置密码 |
| `editor` | 使用 CMS 和内容/知识/AI 管理功能，不能管理账号 |
| `viewer` | 只读公开网站，不能调用后台写接口 |

密码只以 PBKDF2-SHA256 哈希形式保存在数据库。JWT 默认有效 8 小时；修改密码、管理员重置密码或停用账号后，旧 JWT 会立即失效。

## 4. 上线后的日常使用

1. 打开 `https://sakura000702.me/admin/`。
2. 使用首个管理员账号登录。
3. 在“账号与权限”修改自己的初始密码。
4. 需要多人使用时创建独立账号，不共享管理员密码。
5. 在后台编辑并发布；数据会直接写入服务器。
6. 定期检查 `backup` 容器日志并执行恢复演练。

不要在 Git 中提交 `.env.production`、AccessKey、数据库密码或 JWT 密钥。

## 5. 持久化与服务器重启

`docker-compose.prod.yml` 使用具名 volumes：

```text
postgres-data
uploads
backups
milvus-data
milvus-etcd
milvus-minio
```

正常执行 `docker compose up -d --build`、重启容器或升级镜像不会删除这些数据。不要运行 `docker compose down -v`，其中 `-v` 会删除具名 volumes。

## 6. 备份边界

自动备份包含 PostgreSQL dump 和 `uploads` 文件。建议同时启用 OSS 异地备份，并每月至少执行一次恢复演练。Milvus 索引不是唯一事实来源；即使索引丢失，也应能由 PostgreSQL 正文和文档重新构建。
