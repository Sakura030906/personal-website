# 第二大脑第十一轮：可靠性与部署收口

## 本轮目标

让主动工作流可以无人值守运行，并把备份、恢复、监控和发布验收变成可重复执行的工程流程。

## 已完成

- 新增独立 `maintenance` 服务，启动时执行一次，之后按周期生成主动知识简报。
- 维护进程写入原子状态文件，并提供容器健康检查。
- 备份失败和维护失败支持可选 JSON Webhook 告警。
- 高优先级主动任务超过阈值时支持告警。
- 新增 PostgreSQL 一次性临时库恢复演练，不触碰生产数据库。
- 备份可通过配置选择在归档后自动执行恢复演练。
- API 新增备份年龄、维护年龄、主动任务和长期记忆 Prometheus 指标。
- API 只读挂载备份与维护状态，避免写权限扩大。
- 部署验收新增核心服务、静态 CSS/JS 资源完整性、备份标记和维护标记检查。
- 生产环境预检新增备份周期、保留数量和维护周期校验。

## 关键命令

```bash
npm run maintenance:once
npm run backup:verify -- /path/to/archive.tar.gz
npm run backup:drill -- /path/to/archive.tar.gz
npm run deploy:check
npm run deploy:verify -- https://sakura000702.me
```

## 验证结果

- 后端测试：63 passed。
- 维护进程在全新迁移数据库上完成真实单次运行，健康检查通过。
- 恢复演练测试确认使用一次性数据库，并在结束后执行删除。
- Docker Compose 生产配置与 ACR 覆盖配置解析通过。
- 生产环境变量预检使用有效样例通过。
- 前端构建、JavaScript 语法、Python 编译、Shell 语法与 `git diff --check` 均通过。

## 尚需在服务器执行

- 构建并发布包含本轮代码的新 backend/backup 镜像。
- 启动新增 `maintenance` 服务。
- 对一份真实生产备份执行首次恢复演练。
- 配置告警 Webhook（可选）。
- 运行完整生产验收命令并记录结果。

这些步骤需要真实服务器和生产归档，不能用本地模拟结果替代。
