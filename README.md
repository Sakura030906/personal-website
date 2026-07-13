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

后台可以修改首页身份、状态卡片、联系方式、教育经历、工作经历、技术价值观、技术栈、项目作品、博客文章、知识库、学习路线、阅读记录、年度时间线和 AI 能力展示规划。博客文章保存到 `posts` 字段，公网文章页只读展示。

## 文件结构

- `index.html`：公开只读页面结构。
- `styles.css`：公开页面样式。
- `script.js`：公开页面渲染逻辑，读取 `data/site.json`。
- `data/site.json`：可编辑的网站内容。
- `admin/`：本地编辑后台，不会发布到公网。
- `scripts/edit-server.mjs`：本地编辑后台服务。
- `scripts/build.mjs`：生成 Sites 部署产物。

## 内容结构

- `profile`：首页姓名、方向、简介、联系方式和状态卡片。
- `about`：教育经历、工作经历和技术价值观。
- `techStack`：技术栈标签。
- `projects`：项目作品集。
- `posts`：博客文章，支持简单 Markdown。
- `knowledgeBase`：结构化知识库主题。
- `learningMap`：学习路线和学习状态。
- `reading`：阅读记录。
- `timeline`：年度时间线。
- `aiShowcase`：站内 AI 助手规划。

## 发布

修改内容后执行：

```bash
npm run build
```

然后提交、推送、保存 Sites 版本并部署。当前 Sites 项目 ID 已写入 `.openai/hosting.json`。
