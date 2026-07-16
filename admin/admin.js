let state;
let cmsToken = localStorage.getItem("portfolio.cms.token") || "";

const cmsConfig = {
  api: localStorage.getItem("portfolio.cms.api")
    || (["127.0.0.1", "localhost", ""].includes(window.location.hostname) ? "http://127.0.0.1:8000" : `${window.location.origin}/api`),
  email: localStorage.getItem("portfolio.cms.email") || "",
};

let activeEntityType = "post";
let cmsEntries = [];
let activeEntry = null;
let aiRuns = [];
let activeAiRun = null;
let agentRuns = [];
let activeAgentRun = null;
let agentEvaluation = null;
let ragIndex = null;
let ragEvaluation = null;
let aiFeedback = null;
let contentOps = null;
let searchAnalytics = null;
let contentGaps = null;
let relationSuggestionPayload = null;
let relationHealth = null;
let publishWorkflow = null;
let knowledgeColumns = [];
let activeKnowledgeColumn = null;
let knowledgeNodes = [];
let activeKnowledgeNode = null;
let knowledgeRelations = [];
let activeKnowledgeRelation = null;
let knowledgeArticles = [];
let documents = [];
let activeDocument = null;
let autosaveTimer = null;
let autosaveDirty = false;
let autosaveInFlight = false;
let suppressEditorEvents = false;
let activeAdminRoute = "dashboard";
let cmsWorkspaceMode = "list";

const adminRouteTitles = {
  dashboard: "控制台",
  articles: "文章管理",
  "article-columns": "文章专栏",
  projects: "项目管理",
  "knowledge-columns": "知识专栏",
  "knowledge-nodes": "知识节点",
  "knowledge-relations": "知识关系",
  documents: "文档知识库",
  rag: "RAG 管理",
  agent: "Agent 运行",
  experiments: "实验评测",
  "ai-feedback": "AI 反馈与记忆",
  files: "图片与文件",
  versions: "版本与流程",
  publishing: "网站发布",
  security: "账号安全",
  "site-settings": "网站设置",
  runtime: "运行状态",
};

const entityLabels = {
  post: "文章",
  knowledge: "知识库",
  knowledge_node: "知识节点",
  project: "项目",
  reading: "阅读",
  document: "文档",
};

const keywordKeys = {
  post: "tags",
  knowledge: "items",
  project: "stack",
  reading: "highlights",
};

const keywordLabels = {
  post: "标签，逗号分隔",
  knowledge: "知识点，逗号分隔",
  project: "技术栈，逗号分隔",
  reading: "摘录 / 要点，逗号分隔",
};

const templates = {
  "profile.status": { label: "当前状态", value: "内容" },
  "profile.contacts": { label: "Email", value: "name@example.com", href: "mailto:name@example.com" },
  "profile.focus": { label: "当前重点", value: "重点内容", note: "说明。" },
  siteModules: { title: "模块名称", description: "模块说明。" },
  "about.education": {
    title: "学校名称",
    meta: "专业 · 学历 · 时间",
    description: "教育经历说明。",
  },
  "about.experience": {
    title: "公司名称",
    meta: "职位 · 时间",
    description: "工作经历说明。",
  },
  "about.values": "新的价值观或原则",
  techStack: "新技术",
  projects: {
    name: "项目名称",
    slug: "project-slug",
    status: "规划中",
    summary: "项目简介。",
    stack: ["Tech"],
    tagline: "一句话价值。",
    visual: {
      label: "Project Console",
      metric: "Metric",
      status: "MVP",
      items: ["Step"],
    },
    problem: "问题背景。",
    architecture: "架构设想。",
    architectureDiagram: ["Client", "API", "Database"],
    directoryTree: ["app/main.py"],
    techChoices: ["技术选型"],
    databaseDesign: ["表设计"],
    apiExamples: ["接口示例"],
    deployment: ["部署方式"],
    performance: ["性能目标"],
    modules: ["模块"],
    details: ["项目要点"],
    evidence: ["当前证据"],
    challenges: ["难点"],
    pitfalls: ["踩坑"],
    nextSteps: ["下一步"],
    github: "",
    demo: "",
  },
  posts: {
    title: "新文章标题",
    slug: "new-post",
    status: "draft",
    category: "技术学习",
    date: new Date().toISOString().slice(0, 10),
    summary: "文章摘要。",
    tags: ["学习"],
    seoTitle: "",
    seoDescription: "",
    canonical: "",
    cover: "",
    content: "在这里写正文。\n\n支持简单 Markdown：## 小标题、- 列表、```代码块```。",
  },
  knowledgeBase: {
    topic: "新主题",
    summary: "主题说明。",
    items: ["知识点"],
    relatedProjects: [],
    relatedKnowledge: [],
    relatedReading: [],
    relatedPosts: [],
    notes: [{ name: "知识点", description: "说明。", example: "", links: [] }],
  },
  learningMap: {
    layer: "新层级",
    items: [{ name: "学习项", status: "未开始" }],
  },
  reading: {
    title: "书名",
    author: "作者",
    status: "想读",
    progress: 0,
    note: "阅读备注。",
    relatedKnowledge: [],
    relatedProjects: [],
    relatedPosts: [],
    highlights: [],
  },
  timeline: { time: "2026", event: "新的阶段记录。" },
  "aiShowcase.pipeline": "新节点",
  "aiShowcase.capabilities": { title: "能力名称", description: "能力说明。" },
  "aiShowcase.examples": { question: "示例问题", answer: "示例回答。" },
  "aiShowcase.roadmap": "下一步计划",
};

const listNames = [
  "profile.status",
  "profile.contacts",
  "profile.focus",
  "siteModules",
  "about.education",
  "about.experience",
  "about.values",
  "techStack",
  "projects",
  "posts",
  "knowledgeBase",
  "learningMap",
  "reading",
  "timeline",
  "aiShowcase.pipeline",
  "aiShowcase.capabilities",
  "aiShowcase.examples",
  "aiShowcase.roadmap",
];

function getByPath(path) {
  return path.split(".").reduce((target, key) => target?.[key], state);
}

function setByPath(path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let target = state;
  for (const key of keys) {
    target[key] ||= {};
    target = target[key];
  }
  target[last] = value;
}

function ensureList(path) {
  if (!Array.isArray(getByPath(path))) setByPath(path, []);
  return getByPath(path);
}

function field(label, value, onInput, rows = 1) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = rows > 1 ? document.createElement("textarea") : document.createElement("input");
  if (rows > 1) input.rows = rows;
  input.value = Array.isArray(value) ? value.join(", ") : value || "";
  input.addEventListener("input", () => onInput(input.value));
  wrapper.append(input);
  return wrapper;
}

function jsonField(label, value, onInput, rows = 8) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = document.createElement("textarea");
  input.rows = rows;
  input.value = JSON.stringify(value || [], null, 2);
  input.addEventListener("input", () => {
    try {
      input.classList.remove("is-invalid");
      onInput(JSON.parse(input.value || "[]"));
    } catch {
      input.classList.add("is-invalid");
    }
  });
  wrapper.append(input);
  return wrapper;
}

function itemShell(title, onRemove) {
  const item = document.createElement("div");
  item.className = "item";
  const head = document.createElement("div");
  head.className = "item-head";
  head.innerHTML = `<strong>${title}</strong>`;
  const remove = document.createElement("button");
  remove.className = "remove";
  remove.type = "button";
  remove.textContent = "删除";
  remove.addEventListener("click", onRemove);
  head.append(remove);
  item.append(head);
  return item;
}

function splitValues(value) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderSimpleString(item, list, index) {
  item.append(field("内容", list[index], (value) => (list[index] = value), 2));
}

function renderTitleMetaDescription(item, entry) {
  item.append(
    field("标题", entry.title, (value) => (entry.title = value)),
    field("副标题/时间", entry.meta, (value) => (entry.meta = value)),
    field("说明", entry.description, (value) => (entry.description = value), 4),
  );
}

function renderList(path) {
  const target = document.querySelector(`[data-list="${path}"]`);
  if (!target) return;
  target.innerHTML = "";

  const list = ensureList(path);
  list.forEach((entry, index) => {
    const item = itemShell(`${path} #${index + 1}`, () => {
      list.splice(index, 1);
      render();
    });

    if (["about.values", "techStack", "aiShowcase.pipeline", "aiShowcase.roadmap"].includes(path)) {
      renderSimpleString(item, list, index);
    }

    if (path === "profile.status") {
      item.append(
        field("名称", entry.label, (value) => (entry.label = value)),
        field("内容", entry.value, (value) => (entry.value = value)),
      );
    }

    if (path === "profile.contacts") {
      item.append(
        field("类型", entry.label, (value) => (entry.label = value)),
        field("显示内容", entry.value, (value) => (entry.value = value)),
        field("链接", entry.href, (value) => (entry.href = value)),
      );
    }

    if (path === "profile.focus") {
      item.append(
        field("标签", entry.label, (value) => (entry.label = value)),
        field("重点", entry.value, (value) => (entry.value = value)),
        field("说明", entry.note, (value) => (entry.note = value), 3),
      );
    }

    if (path === "siteModules" || path === "aiShowcase.capabilities") {
      item.append(
        field("标题", entry.title, (value) => (entry.title = value)),
        field("说明", entry.description, (value) => (entry.description = value), 3),
      );
    }

    if (path === "aiShowcase.examples") {
      item.append(
        field("问题", entry.question, (value) => (entry.question = value)),
        field("回答", entry.answer, (value) => (entry.answer = value), 4),
      );
    }

    if (path === "about.education" || path === "about.experience") {
      renderTitleMetaDescription(item, entry);
    }

    if (path === "projects") {
      item.append(
        field("项目名", entry.name, (value) => (entry.name = value)),
        field("URL 标识", entry.slug, (value) => (entry.slug = value)),
        field("状态", entry.status, (value) => (entry.status = value)),
        field("一句话价值", entry.tagline, (value) => (entry.tagline = value)),
        field("简介", entry.summary, (value) => (entry.summary = value), 3),
        field("预览标题", entry.visual?.label, (value) => {
          entry.visual ||= {};
          entry.visual.label = value;
        }),
        field("预览指标", entry.visual?.metric, (value) => {
          entry.visual ||= {};
          entry.visual.metric = value;
        }),
        field("预览状态", entry.visual?.status, (value) => {
          entry.visual ||= {};
          entry.visual.status = value;
        }),
        field("预览节点，逗号分隔", entry.visual?.items || [], (value) => {
          entry.visual ||= {};
          entry.visual.items = splitValues(value);
        }),
        field("问题背景", entry.problem, (value) => (entry.problem = value), 4),
        field("架构设想", entry.architecture, (value) => (entry.architecture = value), 4),
        field("架构图节点，逗号分隔", entry.architectureDiagram || [], (value) => {
          entry.architectureDiagram = splitValues(value);
        }),
        field("目录结构，逗号分隔", entry.directoryTree || [], (value) => {
          entry.directoryTree = splitValues(value);
        }),
        field("技术选型，逗号分隔", entry.techChoices || [], (value) => {
          entry.techChoices = splitValues(value);
        }),
        field("数据库设计，逗号分隔", entry.databaseDesign || [], (value) => {
          entry.databaseDesign = splitValues(value);
        }),
        field("API，逗号分隔", entry.apiExamples || [], (value) => {
          entry.apiExamples = splitValues(value);
        }),
        field("部署，逗号分隔", entry.deployment || [], (value) => {
          entry.deployment = splitValues(value);
        }),
        field("性能目标，逗号分隔", entry.performance || [], (value) => {
          entry.performance = splitValues(value);
        }),
        field("技术栈，逗号分隔", entry.stack || [], (value) => {
          entry.stack = splitValues(value);
        }),
        field("核心模块，逗号分隔", entry.modules || [], (value) => {
          entry.modules = splitValues(value);
        }),
        field("项目要点，逗号分隔", entry.details || [], (value) => {
          entry.details = splitValues(value);
        }),
        field("当前证据，逗号分隔", entry.evidence || [], (value) => {
          entry.evidence = splitValues(value);
        }),
        field("主要难点，逗号分隔", entry.challenges || [], (value) => {
          entry.challenges = splitValues(value);
        }),
        field("踩坑，逗号分隔", entry.pitfalls || [], (value) => {
          entry.pitfalls = splitValues(value);
        }),
        field("下一步，逗号分隔", entry.nextSteps || [], (value) => {
          entry.nextSteps = splitValues(value);
        }),
        field("GitHub 链接", entry.github, (value) => (entry.github = value)),
        field("Demo 链接", entry.demo, (value) => (entry.demo = value)),
      );
    }

    if (path === "posts") {
      item.append(
        field("标题", entry.title, (value) => (entry.title = value)),
        field("URL 标识", entry.slug, (value) => (entry.slug = value)),
        field("状态 draft/published", entry.status || "draft", (value) => (entry.status = value)),
        field("分类", entry.category, (value) => (entry.category = value)),
        field("日期", entry.date, (value) => (entry.date = value)),
        field("摘要", entry.summary, (value) => (entry.summary = value), 3),
        field("标签，逗号分隔", entry.tags || [], (value) => {
          entry.tags = splitValues(value);
        }),
        field("SEO 标题", entry.seoTitle || "", (value) => (entry.seoTitle = value)),
        field("SEO 描述", entry.seoDescription || "", (value) => (entry.seoDescription = value), 3),
        field("Canonical URL", entry.canonical || "", (value) => (entry.canonical = value)),
        field("封面图 URL", entry.cover || "", (value) => (entry.cover = value)),
        field("正文", entry.content, (value) => (entry.content = value), 12),
      );
    }

    if (path === "knowledgeBase") {
      item.append(
        field("主题", entry.topic, (value) => (entry.topic = value)),
        field("说明", entry.summary, (value) => (entry.summary = value), 3),
        field("知识点，逗号分隔", entry.items || [], (value) => {
          entry.items = splitValues(value);
        }),
        field("关联项目，逗号分隔", entry.relatedProjects || [], (value) => {
          entry.relatedProjects = splitValues(value);
        }),
        field("相关知识，逗号分隔", entry.relatedKnowledge || [], (value) => {
          entry.relatedKnowledge = splitValues(value);
        }),
        field("阅读材料，逗号分隔", entry.relatedReading || [], (value) => {
          entry.relatedReading = splitValues(value);
        }),
        field("相关文章，逗号分隔", entry.relatedPosts || [], (value) => {
          entry.relatedPosts = splitValues(value);
        }),
        jsonField(
          "知识节点 JSON",
          entry.notes || [],
          (value) => {
            entry.notes = Array.isArray(value) ? value : [];
          },
          10,
        ),
      );
    }

    if (path === "learningMap") {
      item.append(
        field("层级", entry.layer, (value) => (entry.layer = value)),
        field(
          "学习项，格式：名称:状态，逗号分隔",
          (entry.items || []).map((current) => `${current.name}:${current.status}`),
          (value) => {
            entry.items = splitValues(value).map((current) => {
              const [name, status = "未开始"] = current.split(":").map((part) => part.trim());
              return { name, status };
            });
          },
          3,
        ),
      );
    }

    if (path === "reading") {
      item.append(
        field("书名", entry.title, (value) => (entry.title = value)),
        field("作者", entry.author, (value) => (entry.author = value)),
        field("状态", entry.status, (value) => (entry.status = value)),
        field("进度 0-100", entry.progress ?? 0, (value) => (entry.progress = Number(value) || 0)),
        field("备注", entry.note, (value) => (entry.note = value), 3),
        field("相关知识，逗号分隔", entry.relatedKnowledge || [], (value) => {
          entry.relatedKnowledge = splitValues(value);
        }),
        field("关联项目，逗号分隔", entry.relatedProjects || [], (value) => {
          entry.relatedProjects = splitValues(value);
        }),
        field("相关文章，逗号分隔", entry.relatedPosts || [], (value) => {
          entry.relatedPosts = splitValues(value);
        }),
        field("摘录/要点，逗号分隔", entry.highlights || [], (value) => {
          entry.highlights = splitValues(value);
        }, 3),
      );
    }

    if (path === "timeline") {
      item.append(
        field("时间", entry.time, (value) => (entry.time = value)),
        field("事件", entry.event, (value) => (entry.event = value), 3),
      );
    }

    target.append(item);
  });
}

function render() {
  document.querySelectorAll("[data-path]").forEach((input) => {
    input.value = getByPath(input.dataset.path) || "";
    input.oninput = () => setByPath(input.dataset.path, input.value);
  });

  document.querySelectorAll("[data-json-path]").forEach((input) => {
    input.value = JSON.stringify(getByPath(input.dataset.jsonPath) || {}, null, 2);
    input.oninput = () => {
      try {
        input.classList.remove("is-invalid");
        setByPath(input.dataset.jsonPath, JSON.parse(input.value || "{}"));
      } catch {
        input.classList.add("is-invalid");
      }
    };
  });

  listNames.forEach(renderList);
  renderHealthDashboard();
  renderAdminDashboard();
}

function configureAdminPages() {
  const pageMap = {
    "cms-panel": "security publishing",
    "health-panel": "runtime",
    "content-ops-panel": "runtime",
    "ai-runs-panel": "rag ai-feedback",
    "agent-runs-panel": "agent experiments",
    "ai-feedback-panel": "ai-feedback",
    "rag-index-panel": "rag experiments",
    "document-library-panel": "documents files",
    "search-analytics-panel": "runtime",
    "content-gaps-panel": "runtime",
    "relation-health-panel": "runtime",
    "publish-workflow-panel": "versions publishing",
    "knowledge-column-panel": "knowledge-columns article-columns",
    "knowledge-node-panel": "knowledge-nodes knowledge-relations",
    "content-cms-panel": "articles projects versions",
  };
  document.querySelectorAll(".admin-workspace > .panel").forEach((panel) => {
    const matchedClass = Object.keys(pageMap).find((className) => panel.classList.contains(className));
    panel.dataset.adminPages = matchedClass ? pageMap[matchedClass] : "site-settings";
  });
  const editor = document.querySelector(".cms-editor");
  if (editor && !editor.querySelector(".cms-editor-page-head")) {
    editor.insertAdjacentHTML("afterbegin", `
      <header class="cms-editor-page-head">
        <button type="button" data-cms-editor-back>‹ 返回列表</button>
        <div><span data-cms-editor-breadcrumb>内容管理</span><h2 data-cms-editor-title>内容编辑</h2></div>
      </header>
    `);
  }
}

function setCmsWorkspaceMode(mode = "list") {
  cmsWorkspaceMode = mode === "editor" ? "editor" : "list";
  const panel = document.querySelector(".content-cms-panel");
  if (!panel) return;
  panel.classList.toggle("is-list-mode", cmsWorkspaceMode === "list");
  panel.classList.toggle("is-editor-mode", cmsWorkspaceMode === "editor");
  const editorTitle = document.querySelector("[data-cms-editor-title]");
  const breadcrumb = document.querySelector("[data-cms-editor-breadcrumb]");
  if (editorTitle) editorTitle.textContent = activeEntry?.title || `新建${entityLabels[activeEntityType] || "内容"}`;
  if (breadcrumb) breadcrumb.textContent = `${adminRouteTitles[activeAdminRoute] || "内容管理"} / ${activeEntry?.id ? "编辑" : "新建"}`;
}

function adminRouteEntity(route) {
  return { articles: "post", projects: "project", versions: "post" }[route] || "";
}

function updateKnowledgeRouteLayout(route) {
  const panel = document.querySelector(".knowledge-node-panel");
  if (panel) {
    panel.querySelector(".node-manager").hidden = route === "knowledge-relations";
    panel.querySelector(".relation-manager").hidden = route === "knowledge-nodes";
    const title = panel.querySelector(".panel-title h2");
    const description = panel.querySelector(".panel-title p");
    if (route === "knowledge-relations") {
      title.textContent = "知识关系";
      description.textContent = "建立专栏内部与跨专栏节点关系，控制方向、公开状态和权重。";
    } else {
      title.textContent = "知识节点";
      description.textContent = "创建可独立阅读的知识单元，并管理正文、标签、所属专栏和版本。";
    }
  }

  const columnPanel = document.querySelector(".knowledge-column-panel");
  if (columnPanel) {
    const title = columnPanel.querySelector(".panel-title h2");
    const description = columnPanel.querySelector(".panel-title p");
    const articleMode = route === "article-columns";
    title.textContent = articleMode ? "文章专栏" : "知识专栏";
    description.textContent = articleMode
      ? "管理文章长期主题空间；文章可以加入多个专栏并指定主专栏。"
      : "管理独立知识空间、可见性、排序和 AI 检索权限。";
  }
}

async function navigateAdminRoute(route, { updateHash = true } = {}) {
  const nextRoute = adminRouteTitles[route] ? route : "dashboard";
  activeAdminRoute = nextRoute;
  document.body.dataset.adminRoute = nextRoute;
  document.querySelector("[data-admin-page-title]").textContent = adminRouteTitles[nextRoute];
  document.querySelectorAll("[data-admin-route]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminRoute === nextRoute);
  });
  document.querySelector("[data-admin-page='dashboard']").hidden = nextRoute !== "dashboard";
  document.querySelectorAll(".admin-workspace > .panel").forEach((panel) => {
    panel.hidden = !(panel.dataset.adminPages || "").split(" ").includes(nextRoute);
  });
  updateKnowledgeRouteLayout(nextRoute);
  if (["articles", "projects", "versions"].includes(nextRoute)) {
    const contentPanel = document.querySelector(".content-cms-panel");
    const title = contentPanel?.querySelector(":scope > .panel-title h2");
    const description = contentPanel?.querySelector(":scope > .panel-title p");
    if (title) title.textContent = nextRoute === "projects" ? "项目管理" : nextRoute === "versions" ? "内容版本" : "文章管理";
    if (description) description.textContent = nextRoute === "projects"
      ? "管理项目状态、技术栈、工程证据和公开展示内容。"
      : nextRoute === "versions"
        ? "查看内容编辑器中的自动保存、发布版本和恢复记录。"
        : "管理文章、草稿、Markdown 正文、封面、SEO 和发布状态。";
    setCmsWorkspaceMode(nextRoute === "versions" ? "editor" : "list");
  }

  const entityType = adminRouteEntity(nextRoute);
  if (entityType && entityType !== activeEntityType) {
    await performAutosave();
    activeEntityType = entityType;
    document.querySelectorAll("[data-entity-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.entityTab === activeEntityType);
    });
    if (cmsToken) await loadEntries();
    else {
      setEntryForm(defaultEntry(activeEntityType));
      renderEntryList();
    }
  }

  if (updateHash && window.location.hash.slice(1) !== nextRoute) {
    history.pushState(null, "", `#${nextRoute}`);
  }
  document.querySelector(".admin-workspace")?.scrollTo?.({ top: 0, behavior: "instant" });
  renderAdminDashboard();
}

function renderAdminDashboard() {
  const statsTarget = document.querySelector("[data-admin-dashboard-stats]");
  if (!statsTarget || !state) return;
  const postEntries = cmsEntries.length
    ? cmsEntries.filter((entry) => entry.entity_type === "post")
    : (state.posts || []).map((post, index) => ({ id: `local-${index}`, title: post.title, status: post.status, updated_at: post.date, entity_type: "post" }));
  const draftCount = postEntries.filter((entry) => entry.status === "draft").length;
  const publishedCount = postEntries.filter((entry) => entry.status === "published").length;
  const nodeCount = knowledgeNodes.length || (state.knowledgeNodes || []).length;
  const pendingDocuments = documents.filter((item) => !["ready", "indexed"].includes(item.status)).length;
  const dashboardStats = [
    ["□", "草稿文章", draftCount, "继续编辑与发布"],
    ["⌘", "知识节点", nodeCount, `${knowledgeRelations.length || state.knowledgeGraph?.edges?.length || 0} 条关系`],
    ["▣", "待处理文档", pendingDocuments, `${documents.length} 份文档记录`],
    ["◇", "最近 Agent 运行", agentRuns.length, "当前加载的审计任务"],
  ];
  statsTarget.innerHTML = dashboardStats.map(([icon, label, value, note], index) => `<article data-tone="${["green", "green", "amber", "blue"][index]}"><i>${icon}</i><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div></article>`).join("");

  const recentTarget = document.querySelector("[data-admin-recent-content]");
  if (recentTarget) {
    const recent = [
      ...postEntries.map((entry) => ({ title: entry.title, type: "文章", status: entry.status || "draft", date: entry.updated_at || entry.date || "" })),
      ...(knowledgeNodes.length ? knowledgeNodes : state.knowledgeNodes || []).slice(0, 6).map((node) => ({ title: node.title, type: "知识节点", status: node.visibility || "public", date: node.updated_at || "" })),
      ...(state.changelog || []).slice(0, 3).map((item) => ({ title: `${item.version} ${item.title}`, type: "系统", status: "updated", date: item.date || "" })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
    recentTarget.innerHTML = `
      <div class="dashboard-table-head"><span>标题</span><span>类型</span><span>状态</span><span>更新时间</span></div>
      ${recent.map((item) => `<article><strong>${escapeHtml(item.title || "未命名")}</strong><span>${escapeHtml(item.type)}</span><em>${escapeHtml(item.status)}</em><time>${escapeHtml(formatDateTime(item.date) || item.date || "最近")}</time></article>`).join("")}
    `;
  }

  const publishTarget = document.querySelector("[data-admin-publish-summary]");
  if (publishTarget) {
    const total = Math.max(1, draftCount + publishedCount);
    publishTarget.innerHTML = `
      <div class="dashboard-progress-row"><span>Draft</span><i><b style="width:${Math.round((draftCount / total) * 100)}%"></b></i><strong>${draftCount}</strong></div>
      <div class="dashboard-progress-row published"><span>Published</span><i><b style="width:${Math.round((publishedCount / total) * 100)}%"></b></i><strong>${publishedCount}</strong></div>
      <small>总计文章：${draftCount + publishedCount} 篇</small>
    `;
  }

  const ragTarget = document.querySelector("[data-admin-rag-summary]");
  if (ragTarget) {
    const vectorStore = ragIndex?.stats?.vector_store || {};
    ragTarget.innerHTML = `
      <div class="dashboard-status-row"><span>Local 索引</span><strong><i></i>${ragIndex ? "正常" : "等待连接"}</strong></div>
      <div class="dashboard-status-row"><span>Milvus 向量库</span><strong><i></i>${escapeHtml(vectorStore.status || vectorStore.active || "未读取")}</strong></div>
      <small>${ragIndex?.stats?.last_indexed ? `最后同步：${escapeHtml(formatDateTime(ragIndex.stats.last_indexed))}` : "登录 CMS 后读取实时索引状态"}</small>
    `;
  }

  const activityTarget = document.querySelector("[data-admin-activity-summary]");
  if (activityTarget) {
    activityTarget.innerHTML = (state.changelog || []).slice(0, 4).map((item) => `<article><i></i><time>${escapeHtml(item.date || "")}</time><span>发布 ${escapeHtml(item.version)} ${escapeHtml(item.title)}</span></article>`).join("");
  }
}

function countKnowledgeNodesForHealth() {
  return (state.knowledgeBase || []).reduce((total, group) => total + 1 + (group.items || []).length + (group.notes || []).length, 0);
}

function contentWordCount() {
  return (state.posts || []).reduce((total, post) => total + String(post.content || "").replace(/\s+/g, "").length, 0);
}

function healthIssue(severity, title, detail, action = "") {
  return { severity, title, detail, action };
}

function buildHealthReport() {
  const posts = state.posts || [];
  const publishedPosts = posts.filter((post) => post.status !== "draft");
  const draftPosts = posts.filter((post) => post.status === "draft");
  const projects = state.projects || [];
  const knowledge = state.knowledgeBase || [];
  const reading = state.reading || [];
  const cmsDrafts = cmsEntries.filter((entry) => entry.status === "draft").length;
  const cmsPublished = cmsEntries.filter((entry) => entry.status === "published").length;
  const issues = [];

  posts.forEach((post) => {
    if (post.status !== "draft" && !post.summary) {
      issues.push(healthIssue("warning", `文章缺少摘要：${post.title}`, "摘要会影响列表展示、SEO 描述和 AI Lab 检索质量。", "补充 summary"));
    }
    if (post.status !== "draft" && !post.seoDescription && !post.summary) {
      issues.push(healthIssue("warning", `文章缺少 SEO 描述：${post.title}`, "建议至少填写 summary 或 seoDescription。", "补充 SEO"));
    }
    if (post.status !== "draft" && !(post.tags || []).length) {
      issues.push(healthIssue("info", `文章缺少标签：${post.title}`, "标签会用于筛选、搜索和相关文章联动。", "添加 tags"));
    }
  });

  knowledge.forEach((group) => {
    const relationCount = [
      ...(group.relatedKnowledge || []),
      ...(group.relatedProjects || []),
      ...(group.relatedReading || []),
      ...(group.relatedPosts || []),
    ].length;
    if (!relationCount) {
      issues.push(healthIssue("warning", `知识主题没有关联：${group.topic}`, "没有关联的知识节点不会形成知识网络。", "补充 relatedKnowledge / relatedProjects"));
    }
    if (!(group.notes || []).length) {
      issues.push(healthIssue("info", `知识主题缺少笔记：${group.topic}`, "建议至少补 1 条可复用知识节点。", "添加 notes"));
    }
  });

  projects.forEach((project) => {
    if (!project.github && !project.demo && project.status !== "规划中") {
      issues.push(healthIssue("info", `项目缺少链接：${project.name}`, "真实 GitHub 或 Demo 会提升可信度。", "补充链接"));
    }
  });

  reading.forEach((book) => {
    if (![...(book.relatedKnowledge || []), ...(book.relatedProjects || [])].length) {
      issues.push(healthIssue("info", `阅读记录没有关联：${book.title}`, "关联知识或项目后，Reading 才能进入知识网络。", "补充关联"));
    }
  });

  return {
    stats: [
      ["文章", posts.length, `${publishedPosts.length} 已发布 / ${draftPosts.length} 草稿`],
      ["知识节点", countKnowledgeNodesForHealth(), `${knowledge.length} 个主题`],
      ["阅读", reading.length, `${reading.filter((item) => item.status === "在读").length} 在读`],
      ["项目", projects.length, "项目先保持真实进度"],
      ["写作字数", contentWordCount().toLocaleString("zh-CN"), "来自文章正文"],
      ["CMS", cmsEntries.length || "-", cmsEntries.length ? `${cmsPublished} 发布 / ${cmsDrafts} 草稿` : "未加载 CMS"],
    ],
    issues,
  };
}

function renderHealthDashboard() {
  const statTarget = document.querySelector("[data-health-stats]");
  const issueTarget = document.querySelector("[data-health-issues]");
  if (!statTarget || !issueTarget || !state) return;
  const report = buildHealthReport();

  statTarget.innerHTML = report.stats
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  issueTarget.innerHTML = report.issues.length
    ? `
      <h3>待处理事项</h3>
      ${report.issues
        .slice(0, 12)
        .map(
          (issue) => `
            <article class="health-issue ${escapeHtml(issue.severity)}">
              <span>${escapeHtml(issue.severity)}</span>
              <div>
                <strong>${escapeHtml(issue.title)}</strong>
                <p>${escapeHtml(issue.detail)}</p>
              </div>
              <em>${escapeHtml(issue.action)}</em>
            </article>
          `,
        )
        .join("")}
    `
    : `<div class="empty success">当前没有明显内容健康问题。</div>`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function emptyKnowledgeColumn() {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    cover_url: "",
    icon: "book-open",
    visibility: "public",
    allow_ai_search: true,
    sort_order: 0,
  };
}

function setColumnForm(column = emptyKnowledgeColumn()) {
  activeKnowledgeColumn = column;
  document.querySelector("[data-column-name]").value = column.name || "";
  document.querySelector("[data-column-slug]").value = column.slug || "";
  document.querySelector("[data-column-description]").value = column.description || "";
  document.querySelector("[data-column-cover]").value = column.cover_url || "";
  document.querySelector("[data-column-icon]").value = column.icon || "book-open";
  document.querySelector("[data-column-visibility]").value = column.visibility || "public";
  document.querySelector("[data-column-ai-search]").checked = column.allow_ai_search !== false;
  document.querySelector("[data-column-sort]").value = Number(column.sort_order) || 0;
}

function readColumnForm() {
  const name = document.querySelector("[data-column-name]").value.trim();
  return {
    name,
    slug: document.querySelector("[data-column-slug]").value.trim() || slugify(name),
    description: document.querySelector("[data-column-description]").value.trim(),
    cover_url: document.querySelector("[data-column-cover]").value.trim(),
    icon: document.querySelector("[data-column-icon]").value.trim() || "book-open",
    visibility: document.querySelector("[data-column-visibility]").value,
    allow_ai_search: document.querySelector("[data-column-ai-search]").checked,
    sort_order: Number(document.querySelector("[data-column-sort]").value) || 0,
  };
}

function renderColumnList() {
  const target = document.querySelector("[data-column-list]");
  if (!target) return;
  target.innerHTML = knowledgeColumns.length
    ? knowledgeColumns.map((column) => `
        <button type="button" data-column-id="${column.id}" class="${activeKnowledgeColumn?.id === column.id ? "is-active" : ""}">
          <strong>${escapeHtml(column.name)}</strong>
          <small>${escapeHtml(column.visibility)} · ${column.article_count || 0} 篇文章</small>
        </button>
      `).join("")
    : `<p class="empty">暂无专栏，可以新建第一个专栏。</p>`;
}

function renderArticleColumnEditor(metadata = {}) {
  const target = document.querySelector("[data-entry-columns]");
  const primary = document.querySelector("[data-entry-primary-column]");
  if (!target || !primary) return;
  const selected = new Set((metadata.columnIds || []).map(Number));
  target.innerHTML = knowledgeColumns.length
    ? knowledgeColumns.map((column) => `
        <label><input type="checkbox" value="${column.id}" ${selected.has(column.id) ? "checked" : ""} />${escapeHtml(column.name)}</label>
      `).join("")
    : `<span>暂无专栏，请先在上方创建。</span>`;
  primary.innerHTML = `<option value="">未指定</option>${knowledgeColumns
    .filter((column) => selected.has(column.id))
    .map((column) => `<option value="${column.id}" ${Number(metadata.primaryColumnId) === column.id ? "selected" : ""}>${escapeHtml(column.name)}</option>`)
    .join("")}`;
}

async function loadKnowledgeColumns() {
  knowledgeColumns = await cmsRequest("/admin/knowledge-columns");
  if (activeKnowledgeColumn?.id) {
    activeKnowledgeColumn = knowledgeColumns.find((column) => column.id === activeKnowledgeColumn.id) || knowledgeColumns[0] || emptyKnowledgeColumn();
  } else {
    activeKnowledgeColumn = knowledgeColumns[0] || emptyKnowledgeColumn();
  }
  setColumnForm(activeKnowledgeColumn);
  renderColumnList();
  renderArticleColumnEditor(parseMetadata(activeEntry));
}

async function saveKnowledgeColumn() {
  const payload = readColumnForm();
  if (!payload.name) throw new Error("请填写专栏名称");
  const path = activeKnowledgeColumn?.id ? `/admin/knowledge-columns/${activeKnowledgeColumn.id}` : "/admin/knowledge-columns";
  const method = activeKnowledgeColumn?.id ? "PATCH" : "POST";
  activeKnowledgeColumn = await cmsRequest(path, { method, body: JSON.stringify(payload) });
  showToast("专栏已保存");
  await loadKnowledgeColumns();
}

async function deleteKnowledgeColumn() {
  if (!activeKnowledgeColumn?.id) return;
  if (!confirm(`确定删除专栏「${activeKnowledgeColumn.name}」吗？文章本身不会被删除。`)) return;
  await cmsRequest(`/admin/knowledge-columns/${activeKnowledgeColumn.id}`, { method: "DELETE" });
  activeKnowledgeColumn = null;
  showToast("专栏已删除，文章仍然保留");
  await loadKnowledgeColumns();
}

function emptyKnowledgeNode() {
  return { id: null, title: "", slug: "", summary: "", content_markdown: "", node_type: "concept", importance: 3, visibility: "public", allow_ai_search: true, revision: 1, tag_names: [], column_ids: [], primary_column_id: null, article_ids: [] };
}

function setKnowledgeNodeForm(node = emptyKnowledgeNode()) {
  activeKnowledgeNode = node;
  document.querySelector("[data-node-title]").value = node.title || "";
  document.querySelector("[data-node-slug]").value = node.slug || "";
  document.querySelector("[data-node-summary]").value = node.summary || "";
  document.querySelector("[data-node-content]").value = node.content_markdown || "";
  document.querySelector("[data-node-type]").value = node.node_type || "concept";
  document.querySelector("[data-node-importance]").value = Number(node.importance) || 3;
  document.querySelector("[data-node-visibility]").value = node.visibility || "public";
  document.querySelector("[data-node-ai-search]").checked = node.allow_ai_search !== false;
  document.querySelector("[data-node-tags]").value = (node.tag_names || []).join(", ");
  renderKnowledgeNodeLinks(node);
  const note = document.querySelector("[data-node-version-note]");
  note.textContent = node.id ? `revision ${node.revision || 1}` : "新节点尚未保存";
}

function renderKnowledgeNodeLinks(node = emptyKnowledgeNode()) {
  const selectedColumns = new Set((node.column_ids || []).map(Number));
  const columns = document.querySelector("[data-node-columns]");
  columns.innerHTML = knowledgeColumns.length ? knowledgeColumns.map((column) => `<label><input type="checkbox" value="${column.id}" ${selectedColumns.has(column.id) ? "checked" : ""} />${escapeHtml(column.name)}</label>`).join("") : "<span>暂无专栏</span>";
  const primary = document.querySelector("[data-node-primary-column]");
  primary.innerHTML = `<option value="">未指定</option>${knowledgeColumns.filter((column) => selectedColumns.has(column.id)).map((column) => `<option value="${column.id}" ${Number(node.primary_column_id) === column.id ? "selected" : ""}>${escapeHtml(column.name)}</option>`).join("")}`;
  const selectedArticles = new Set((node.article_ids || []).map(Number));
  document.querySelector("[data-node-articles]").innerHTML = knowledgeArticles.length ? knowledgeArticles.map((article) => `<label><input type="checkbox" value="${article.id}" ${selectedArticles.has(article.id) ? "checked" : ""} />${escapeHtml(article.title)}</label>`).join("") : "<span>暂无文章</span>";
}

function readKnowledgeNodeForm() {
  const title = document.querySelector("[data-node-title]").value.trim();
  const columnIds = [...document.querySelectorAll("[data-node-columns] input:checked")].map((input) => Number(input.value));
  return {
    title,
    slug: document.querySelector("[data-node-slug]").value.trim() || slugify(title),
    summary: document.querySelector("[data-node-summary]").value.trim(),
    content_markdown: document.querySelector("[data-node-content]").value,
    node_type: document.querySelector("[data-node-type]").value,
    importance: Number(document.querySelector("[data-node-importance]").value) || 3,
    visibility: document.querySelector("[data-node-visibility]").value,
    allow_ai_search: document.querySelector("[data-node-ai-search]").checked,
    tag_names: splitValues(document.querySelector("[data-node-tags]").value),
    column_ids: columnIds,
    primary_column_id: Number(document.querySelector("[data-node-primary-column]").value) || null,
    article_ids: [...document.querySelectorAll("[data-node-articles] input:checked")].map((input) => Number(input.value)),
    article_relation_type: "references",
    expected_revision: activeKnowledgeNode?.id ? activeKnowledgeNode.revision : null,
  };
}

function renderKnowledgeNodeList() {
  const target = document.querySelector("[data-node-list]");
  target.innerHTML = knowledgeNodes.length ? knowledgeNodes.map((node) => `<button type="button" data-node-id="${node.id}" class="${activeKnowledgeNode?.id === node.id ? "is-active" : ""}"><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.node_type)} · ${escapeHtml(node.visibility)} · ${node.relations?.length || 0} 条关系</small></button>`).join("") : `<p class="empty">暂无知识节点。</p>`;
}

function emptyKnowledgeRelation() {
  return { id: null, source_node_id: knowledgeNodes[0]?.id || null, target_node_id: knowledgeNodes[1]?.id || null, relation_type: "related_to", relation_label: "", description: "", weight: 1, direction: "directed", is_active: true, is_public: true };
}

function renderRelationSelects(relation = emptyKnowledgeRelation()) {
  const options = knowledgeNodes.map((node) => `<option value="${node.id}">${escapeHtml(node.title)}</option>`).join("");
  document.querySelector("[data-node-relation-source]").innerHTML = options;
  document.querySelector("[data-node-relation-target]").innerHTML = options;
  if (relation.source_node_id) document.querySelector("[data-node-relation-source]").value = relation.source_node_id;
  if (relation.target_node_id) document.querySelector("[data-node-relation-target]").value = relation.target_node_id;
}

function setKnowledgeRelationForm(relation = emptyKnowledgeRelation()) {
  activeKnowledgeRelation = relation;
  renderRelationSelects(relation);
  document.querySelector("[data-node-relation-type]").value = relation.relation_type || "related_to";
  document.querySelector("[data-node-relation-direction]").value = relation.direction || "directed";
  document.querySelector("[data-node-relation-label]").value = relation.relation_label || "";
  document.querySelector("[data-node-relation-description]").value = relation.description || "";
  document.querySelector("[data-node-relation-weight]").value = Number(relation.weight) || 1;
  document.querySelector("[data-node-relation-active]").checked = relation.is_active !== false;
  document.querySelector("[data-node-relation-public]").checked = relation.is_public !== false;
}

function renderKnowledgeRelationList() {
  const target = document.querySelector("[data-node-relation-list]");
  target.innerHTML = knowledgeRelations.length ? knowledgeRelations.map((relation) => `<button type="button" data-node-relation-id="${relation.id}" class="${activeKnowledgeRelation?.id === relation.id ? "is-active" : ""}"><strong>${escapeHtml(relation.source?.title || "?")} → ${escapeHtml(relation.target?.title || "?")}</strong><small>${escapeHtml(relation.relation_type)} · ${relation.is_public ? "公开" : "私有"}</small></button>`).join("") : `<p class="empty">暂无节点关系。</p>`;
}

async function loadKnowledgeGraphData() {
  [knowledgeNodes, knowledgeRelations, knowledgeArticles] = await Promise.all([
    cmsRequest("/admin/knowledge-nodes"), cmsRequest("/admin/knowledge-relations"), cmsRequest("/admin/articles"),
  ]);
  activeKnowledgeNode = activeKnowledgeNode?.id ? knowledgeNodes.find((node) => node.id === activeKnowledgeNode.id) : knowledgeNodes[0];
  activeKnowledgeRelation = activeKnowledgeRelation?.id ? knowledgeRelations.find((relation) => relation.id === activeKnowledgeRelation.id) : knowledgeRelations[0];
  setKnowledgeNodeForm(activeKnowledgeNode || emptyKnowledgeNode());
  setKnowledgeRelationForm(activeKnowledgeRelation || emptyKnowledgeRelation());
  renderKnowledgeNodeList();
  renderKnowledgeRelationList();
  await loadKnowledgeNodeVersions();
  renderAdminDashboard();
}

async function loadKnowledgeNodeVersions() {
  const target = document.querySelector("[data-node-version-list]");
  if (!activeKnowledgeNode?.id) {
    target.innerHTML = `<p class="empty">保存后会记录节点版本。</p>`;
    return;
  }
  const versions = await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}/versions`);
  target.innerHTML = versions.length ? versions.map((version) => `<article><div><strong>${escapeHtml(version.reason)}</strong><span>${escapeHtml(formatDateTime(version.created_at))} · ${escapeHtml(version.created_by_email || "system")}</span></div><button type="button" data-node-version-restore="${version.id}">恢复</button></article>`).join("") : `<p class="empty">暂无版本。</p>`;
}

async function restoreKnowledgeNodeVersion(versionId) {
  if (!confirm("确定恢复这个知识节点版本吗？当前内容会先自动保存为一个版本。")) return;
  activeKnowledgeNode = await cmsRequest(`/admin/knowledge-nodes/versions/${versionId}/restore`, { method: "POST" });
  showToast("知识节点版本已恢复");
  await loadKnowledgeGraphData();
}

async function saveKnowledgeNode() {
  const payload = readKnowledgeNodeForm();
  if (!payload.title) throw new Error("请填写节点标题");
  const path = activeKnowledgeNode?.id ? `/admin/knowledge-nodes/${activeKnowledgeNode.id}` : "/admin/knowledge-nodes";
  activeKnowledgeNode = await cmsRequest(path, { method: activeKnowledgeNode?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  showToast("知识节点已保存并记录版本");
  await loadKnowledgeGraphData();
}

async function deleteKnowledgeNode() {
  if (!activeKnowledgeNode?.id || !confirm(`确定删除「${activeKnowledgeNode.title}」及其关系吗？`)) return;
  await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}`, { method: "DELETE" });
  activeKnowledgeNode = null;
  showToast("节点已删除，删除前版本已保留");
  await loadKnowledgeGraphData();
}

function readKnowledgeRelationForm() {
  return { source_node_id: Number(document.querySelector("[data-node-relation-source]").value), target_node_id: Number(document.querySelector("[data-node-relation-target]").value), relation_type: document.querySelector("[data-node-relation-type]").value, direction: document.querySelector("[data-node-relation-direction]").value, relation_label: document.querySelector("[data-node-relation-label]").value.trim(), description: document.querySelector("[data-node-relation-description]").value.trim(), weight: Number(document.querySelector("[data-node-relation-weight]").value) || 1, is_active: document.querySelector("[data-node-relation-active]").checked, is_public: document.querySelector("[data-node-relation-public]").checked };
}

async function saveKnowledgeRelation() {
  const payload = readKnowledgeRelationForm();
  if (!payload.source_node_id || !payload.target_node_id) throw new Error("请先创建至少两个节点");
  const path = activeKnowledgeRelation?.id ? `/admin/knowledge-relations/${activeKnowledgeRelation.id}` : "/admin/knowledge-relations";
  activeKnowledgeRelation = await cmsRequest(path, { method: activeKnowledgeRelation?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  showToast("节点关系已保存");
  await loadKnowledgeGraphData();
}

async function deleteKnowledgeRelation() {
  if (!activeKnowledgeRelation?.id) return;
  await cmsRequest(`/admin/knowledge-relations/${activeKnowledgeRelation.id}`, { method: "DELETE" });
  activeKnowledgeRelation = null;
  showToast("节点关系已删除");
  await loadKnowledgeGraphData();
}

function renderAiRunStats(stats = {}) {
  const target = document.querySelector("[data-ai-run-stats]");
  if (!target) return;
  const rows = [
    ["Runs", stats.total ?? 0, "最近问答数量"],
    ["Quality", stats.avg_quality ?? 0, "平均引用质量"],
    ["Latency", `${stats.avg_latency_ms ?? 0}ms`, "平均服务端延迟"],
    ["Local", stats.local_runs ?? 0, "本地生成"],
    ["LLM", stats.llm_runs ?? 0, "模型生成"],
  ];
  target.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");
}

function renderAiRunList() {
  const target = document.querySelector("[data-ai-run-list]");
  if (!target) return;
  target.innerHTML = aiRuns.length
    ? aiRuns
        .map(
          (run) => `
            <button type="button" data-ai-run-id="${run.id}" class="${activeAiRun?.id === run.id ? "is-active" : ""}">
              <span>${escapeHtml(formatDateTime(run.created_at))}</span>
              <strong>${escapeHtml(run.question)}</strong>
              <small>Q ${escapeHtml(run.quality_score)} · ${escapeHtml(run.latency_ms)}ms · ${escapeHtml(run.generator)} · ${escapeHtml((run.sources || []).length)} sources</small>
            </button>
          `,
        )
        .join("")
    : `<p class="empty">暂无 AI Runs。先到公开站 AI Lab 提问一次。</p>`;
}

function renderAiRunDetail(run = activeAiRun) {
  const target = document.querySelector("[data-ai-run-detail]");
  if (!target) return;
  if (!run) {
    target.innerHTML = `<p class="empty">选择一条问答日志查看详情。</p>`;
    return;
  }
  const sources = run.sources || [];
  const trace = run.trace || [];
  const queryPlan = run.query_plan || {};
  const grounding = run.grounding || {};
  target.innerHTML = `
    <div class="ai-run-detail-head">
      <div>
        <span>#${escapeHtml(run.id)} · ${escapeHtml(formatDateTime(run.created_at))}</span>
        <h3>${escapeHtml(run.question)}</h3>
      </div>
      <div class="ai-run-metrics">
        <span>Quality <strong>${escapeHtml(run.quality_score)}</strong></span>
        <span>Latency <strong>${escapeHtml(run.latency_ms)}ms</strong></span>
        <span>Generator <strong>${escapeHtml(run.generator)}</strong></span>
        <span>Grounding <strong>${escapeHtml(grounding.status || "legacy")}</strong></span>
        <span>Support <strong>${Math.round((Number(grounding.support_score) || 0) * 100)}%</strong></span>
      </div>
    </div>
    <section>
      <h4>Answer</h4>
      <p>${escapeHtml(run.answer)}</p>
    </section>
    <section>
      <h4>Sources</h4>
      ${
        sources.length
          ? sources
              .map(
                (source) => `
                  <div class="ai-run-source">
                    <strong>${escapeHtml(source.title || source.slug)}</strong>
                    <span>${escapeHtml(source.entity_type)} · ${escapeHtml(source.slug)} · score ${escapeHtml(source.score)} · fusion ${escapeHtml(source.fusion_score ?? 0)} · rerank ${escapeHtml(source.rerank_score ?? 0)} · context ${escapeHtml(source.compressed_chars ?? 0)}/${escapeHtml(source.original_chars ?? 0)} chars · chunk ${escapeHtml(source.chunk_index ?? "-")} · lex ${escapeHtml(source.lexical_score ?? 0)} · vec ${escapeHtml(source.vector_score ?? 0)}</span>
                    <p>${escapeHtml(source.summary || "")}</p>
                    ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a>` : ""}
                    ${(source.matched_chunk || source.context) ? `<blockquote>${escapeHtml(source.matched_chunk || source.context)}</blockquote>` : ""}
                  </div>
                `,
              )
              .join("")
          : `<p class="empty">没有引用来源。</p>`
      }
    </section>
    <section>
      <h4>Grounding Report</h4>
      <p>${escapeHtml(grounding.reason || "旧记录没有校验报告。")}</p>
      <p>Evidence ${Math.round((Number(grounding.confidence) || 0) * 100)}% · Claims ${escapeHtml(grounding.supported_claims ?? 0)}/${escapeHtml(grounding.total_claims ?? 0)} · Citations ${Math.round((Number(grounding.citation_coverage) || 0) * 100)}%</p>
      ${(grounding.invalid_citations || []).length ? `<p>无效引用：${escapeHtml(grounding.invalid_citations.join(", "))}</p>` : ""}
      ${(grounding.unsupported_claims || []).length ? `<ul>${grounding.unsupported_claims.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </section>
    <section>
      <h4>Query Plan</h4>
      ${(queryPlan.queries || []).length
        ? `<ol>${queryPlan.queries.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
           <p>${escapeHtml((queryPlan.concepts || []).join(" · "))}</p>`
        : `<p class="empty">这条历史记录没有 Query Plan。</p>`}
    </section>
    <section>
      <h4>Trace</h4>
      ${
        trace.length
          ? `<ol>${trace.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
          : `<p class="empty">没有 trace。</p>`
      }
    </section>
    <details class="advanced-json" open>
      <summary>Prompt Context</summary>
      <pre>${escapeHtml(run.prompt_context || "")}</pre>
    </details>
  `;
}

function renderAgentRunStats(stats = {}) {
  const target = document.querySelector("[data-agent-run-stats]");
  if (!target) return;
  const rows = [
    ["Runs", stats.total ?? 0, "最近任务数量"],
    ["Success", `${Math.round((Number(stats.success_rate) || 0) * 100)}%`, `${stats.completed ?? 0} 成功`],
    ["Failed", stats.failed ?? 0, "执行失败"],
    ["Quality", stats.avg_quality ?? 0, "平均答案质量"],
    ["P95", `${stats.p95_latency_ms ?? 0}ms`, `平均 ${stats.avg_latency_ms ?? 0}ms`],
    ["Tools", stats.tool_calls ?? 0, "工具调用总数"],
    ["Tokens", (stats.prompt_tokens ?? 0) + (stats.completion_tokens ?? 0), "输入 + 输出"],
    ["Cost", `$${Number(stats.estimated_cost_usd || 0).toFixed(6)}`, "模型估算成本"],
  ];
  target.innerHTML = rows.map(([label, value, note]) => `
    <article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></article>
  `).join("");
}

function renderAgentEvaluation(payload = agentEvaluation) {
  const target = document.querySelector("[data-agent-eval-results]");
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">运行评测后查看 Agent 工具路由、来源、质量和延迟。</p>`;
    return;
  }
  const stats = payload.stats || {};
  target.innerHTML = `
    <div class="rag-eval-summary">
      <strong>Agent Eval ${Math.round((Number(stats.success_rate) || 0) * 100)}%</strong>
      <span>${escapeHtml(stats.passed ?? 0)}/${escapeHtml(stats.cases ?? 0)} passed</span>
      <span>Tool path ${Math.round((Number(stats.tool_path_rate) || 0) * 100)}%</span>
      <span>Sources ${Math.round((Number(stats.source_hit_rate) || 0) * 100)}%</span>
      <span>Avg ${escapeHtml(stats.avg_latency_ms ?? 0)}ms</span>
      <span>Cost $${Number(stats.estimated_cost_usd || 0).toFixed(6)}</span>
    </div>
    ${(payload.cases || []).map((item) => `
      <article class="rag-eval-case ${item.success ? "hit" : "miss"}">
        <div>
          <span>${escapeHtml(item.category)} · ${item.success ? "PASS" : "FAIL"} · run #${escapeHtml(item.run_id)}</span>
          <h3>${escapeHtml(item.goal)}</h3>
          <p>${escapeHtml((item.tools || []).join(" → ") || "没有完成工具调用")}</p>
          <small>Q ${escapeHtml(item.quality_score)} · ${escapeHtml(item.latency_ms)}ms${(item.missing_tools || []).length ? ` · 缺少工具：${escapeHtml(item.missing_tools.join(", "))}` : ""}${(item.missing_slugs || []).length ? ` · 缺少来源：${escapeHtml(item.missing_slugs.join(", "))}` : ""}</small>
        </div>
      </article>
    `).join("")}
  `;
}

function renderAgentRunList() {
  const target = document.querySelector("[data-agent-run-list]");
  if (!target) return;
  target.innerHTML = agentRuns.length
    ? agentRuns.map((run) => `
        <button type="button" data-agent-run-id="${run.id}" class="${activeAgentRun?.id === run.id ? "is-active" : ""}">
          <span>${escapeHtml(formatDateTime(run.created_at))}</span>
          <strong>${escapeHtml(run.goal)}</strong>
          <small>${escapeHtml(run.status)} · ${escapeHtml(run.planner)} · ${escapeHtml(run.tool_calls)} tools · ${escapeHtml((run.prompt_tokens || 0) + (run.completion_tokens || 0))} tokens · Q ${escapeHtml(run.result?.quality_score ?? 0)}</small>
        </button>
      `).join("")
    : `<p class="empty">暂无 Agent Runs。先到公开站 AI Lab 执行一次任务。</p>`;
}

function renderAgentRunDetail(run = activeAgentRun) {
  const target = document.querySelector("[data-agent-run-detail]");
  if (!target) return;
  if (!run) {
    target.innerHTML = `<p class="empty">选择一条 Agent 任务查看详情。</p>`;
    return;
  }
  const result = run.result || {};
  const grounding = result.grounding || {};
  const sources = result.sources || [];
  const steps = run.steps || [];
  target.innerHTML = `
    <div class="ai-run-detail-head">
      <div><span>#${escapeHtml(run.id)} · ${escapeHtml(formatDateTime(run.created_at))}</span><h3>${escapeHtml(run.goal)}</h3></div>
      <div class="ai-run-metrics">
        <span>Status <strong>${escapeHtml(run.status)}</strong></span>
        <span>Planner <strong>${escapeHtml(run.planner)}</strong></span>
        <span>Mode <strong>${escapeHtml(run.planner_mode)}</strong></span>
        <span>Quality <strong>${escapeHtml(result.quality_score ?? 0)}</strong></span>
        <span>Generator <strong>${escapeHtml(result.generator || "-")}</strong></span>
        <span>Grounding <strong>${escapeHtml(grounding.status || "-")}</strong></span>
        <span>Support <strong>${Math.round((Number(grounding.support_score) || 0) * 100)}%</strong></span>
        <span>Resumes <strong>${escapeHtml(run.resume_count || 0)}</strong></span>
        <span>Tokens <strong>${escapeHtml((run.prompt_tokens || 0) + (run.completion_tokens || 0))}</strong></span>
        <span>Cost <strong>$${Number(run.estimated_cost_usd || 0).toFixed(6)}</strong></span>
        ${run.failure_category ? `<span>Failure <strong>${escapeHtml(run.failure_category)}</strong></span>` : ""}
      </div>
    </div>
    <section><h4>Answer</h4><p>${escapeHtml(result.answer || run.error || "尚无结果")}</p></section>
    <section>
      <h4>Execution Steps</h4>
      ${steps.length ? steps.map((step) => `
        <div class="ai-run-source">
          <strong>Step ${escapeHtml(Number(step.step_index) + 1)} · ${escapeHtml(step.tool_name)}</strong>
          <span>${escapeHtml(step.status)} · ${escapeHtml(step.duration_ms)}ms · ${escapeHtml(step.decision?.provider || run.planner)}</span>
          <p>${escapeHtml(step.reason || "")}</p>
          <pre>${escapeHtml(JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2))}</pre>
        </div>
      `).join("") : `<p class="empty">没有工具步骤。</p>`}
    </section>
    <section>
      <h4>Sources</h4>
      ${sources.length ? sources.map((source, index) => `
        <div class="ai-run-source"><strong>[${index + 1}] ${escapeHtml(source.title || source.slug)}</strong><span>${escapeHtml(source.entity_type)} · ${escapeHtml(source.slug)} · score ${escapeHtml(source.score ?? 0)}</span><p>${escapeHtml(source.summary || source.context || "")}</p></div>
      `).join("") : `<p class="empty">没有可用来源。</p>`}
    </section>
    <section><h4>Planner Trace</h4><pre>${escapeHtml(JSON.stringify(run.planner_trace || [], null, 2))}</pre></section>
    <section><h4>Stop Reason</h4><p>${escapeHtml(result.stop_reason || run.error || "-")}</p></section>
    ${(run.pending_confirmation && Object.keys(run.pending_confirmation).length) ? `<section><h4>Pending Confirmation</h4><pre>${escapeHtml(JSON.stringify(run.pending_confirmation, null, 2))}</pre></section>` : ""}
  `;
}

function renderRagIndex(payload = ragIndex) {
  const statsTarget = document.querySelector("[data-rag-index-stats]");
  const listTarget = document.querySelector("[data-rag-index-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载 RAG 索引状态。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const embedding = stats.embedding || {};
  const llm = stats.llm || {};
  const vectorStore = stats.vector_store || {};
  const reranker = stats.reranker || {};
  const queryExpansion = stats.query_expansion || {};
  const groundingConfig = stats.grounding || {};
  const embeddingProfiles = stats.embedding_profiles || [];
  const rows = [
    ["Chunks", stats.chunks ?? 0, "已索引片段"],
    ["Node Chunks", stats.node_chunks ?? 0, "标准化知识片段"],
    ["Nodes", stats.indexed_nodes ?? 0, "已索引知识节点"],
    ["Documents", stats.indexed_documents ?? 0, `${stats.document_chunks ?? 0} 个启用切片`],
    ["Indexed", stats.indexed_entries ?? 0, "已覆盖内容"],
    ["Sources", stats.source_entries ?? 0, "可索引内容"],
    ["Published", stats.published_entries ?? 0, "已发布内容"],
    ["Coverage", `${Math.round((Number(stats.coverage) || 0) * 100)}%`, "索引覆盖率"],
    ["Embedding", embedding.active_provider || "local", embedding.model || "hash"],
    ["LLM", llm.active_provider || "local", llm.model || "rule fallback"],
    ["Vector DB", vectorStore.active || "local", vectorStore.status || "local"],
    ["Milvus Rows", vectorStore.row_count ?? 0, `${vectorStore.node_row_count ?? 0} node · ${vectorStore.document_row_count ?? 0} document vectors`],
    ["Reranker", reranker.provider || "off", `top ${reranker.top_k ?? "-"} · weight ${reranker.weight ?? 0}`],
    ["Multi Query", queryExpansion.provider || "off", `${queryExpansion.max_queries ?? 1} queries · RRF ${queryExpansion.fusion_k ?? "-"}`],
    ["Grounding", `${Math.round((Number(groundingConfig.evidence_threshold) || 0) * 100)}%`, `${groundingConfig.context_max_chars ?? "-"} chars · answer ${groundingConfig.min_answer_support ?? "-"}`],
    ["Dim", embedding.dimensions ?? "-", "向量维度"],
    ["Updated", stats.last_indexed ? formatDateTime(stats.last_indexed) : "未建立", "最近索引时间"],
  ];
  statsTarget.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  listTarget.innerHTML = (payload.recent_chunks || []).length
    ? payload.recent_chunks
        .map(
          (chunk) => `
            <article class="rag-index-chunk">
              <div>
                <span>${escapeHtml(entityLabels[chunk.entity_type] || chunk.entity_type)} · ${escapeHtml(chunk.slug)} · #${escapeHtml(chunk.chunk_index)}</span>
                <h3>${escapeHtml(chunk.title)}</h3>
                <p>${escapeHtml(chunk.content)}</p>
                <small>${escapeHtml(chunk.token_count)} tokens · ${escapeHtml(formatDateTime(chunk.updated_at))}</small>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty">还没有索引。点击“重建索引”生成内容片段。</p>`;
  if (embeddingProfiles.length) {
    listTarget.insertAdjacentHTML(
      "afterbegin",
      `<div class="rag-profile-list">
        ${embeddingProfiles
          .map(
            (profile) => `
              <span>${escapeHtml(profile.provider)} · ${escapeHtml(profile.model)} · ${escapeHtml(profile.dimensions)}d · ${escapeHtml(profile.chunks)} chunks</span>
            `,
          )
          .join("")}
      </div>`,
    );
  }
  renderRagEvaluation();
}

function renderRagEvaluation(payload = ragEvaluation) {
  const target = document.querySelector("[data-rag-eval-list]");
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">运行评测后查看 RAG 召回质量。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const tuning = payload.tuning || stats.tuning || {};
  const comparisons = payload.comparisons || [];
  const rows = [
    ["Cases", stats.cases ?? 0, "评测问题"],
    ["Answer Rate", `${Math.round((Number(stats.answer_rate) || 0) * 100)}%`, "有召回来源"],
    ["Hit Rate", `${Math.round((Number(stats.expected_hit_rate) || 0) * 100)}%`, "期望词命中"],
    ["Top1", `${Math.round((Number(stats.top1_hit_rate) || 0) * 100)}%`, "第一名命中"],
    ["MRR", stats.mrr ?? 0, "平均倒数排名"],
    ["Avg Score", stats.avg_top_score ?? 0, "平均 Top 分数"],
  ];
  target.innerHTML = `
    <div class="rag-eval-stats">
      ${rows
        .map(
          ([label, value, note]) => `
            <article>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(note)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="rag-tuning-summary">
      <span>Current</span>
      <strong>${escapeHtml(tuning.name || "default")}</strong>
      <p>lexical ${escapeHtml(tuning.lexical_weight ?? "-")} · vector ${escapeHtml(tuning.vector_weight ?? "-")} · multi-query ${escapeHtml(tuning.query_expansion ?? "off")} × ${escapeHtml(tuning.multi_query_limit ?? 1)} · reranker ${escapeHtml(tuning.reranker ?? "off")} × ${escapeHtml(tuning.rerank_weight ?? 0)}</p>
    </div>
    ${
      comparisons.length
        ? `<div class="rag-comparison-list">
            ${comparisons
              .map(
                (item, index) => `
                  <article class="${index === 0 ? "is-best" : ""}">
                    <span>${index === 0 ? "Best" : "Config"}</span>
                    <strong>${escapeHtml(item.name)}</strong>
                    <p>MRR ${escapeHtml(item.stats?.mrr ?? 0)} · Top1 ${Math.round((Number(item.stats?.top1_hit_rate) || 0) * 100)}% · Hit ${Math.round((Number(item.stats?.expected_hit_rate) || 0) * 100)}%</p>
                    <small>lex ${escapeHtml(item.tuning?.lexical_weight ?? "-")} · vec ${escapeHtml(item.tuning?.vector_weight ?? "-")} · query ${escapeHtml(item.tuning?.query_expansion ?? "off")} × ${escapeHtml(item.tuning?.multi_query_limit ?? 1)} · rerank ${escapeHtml(item.tuning?.reranker ?? "off")} × ${escapeHtml(item.tuning?.rerank_weight ?? 0)}</small>
                  </article>
                `,
              )
              .join("")}
          </div>`
        : ""
    }
    <div class="rag-eval-cases">
      ${(payload.cases || [])
        .map(
          (item) => `
            <article class="rag-eval-case ${item.expected_hit === false ? "is-miss" : ""}">
              <div>
                <span>${item.expected_hit === null ? "未设置期望词" : item.expected_hit ? "命中" : "未命中"} · ${escapeHtml(item.source_count)} sources</span>
                <h3>${escapeHtml(item.question)}</h3>
                ${
                  item.top_source
                    ? `<p>Top: ${escapeHtml(item.top_source.title)} · ${escapeHtml(item.top_source.retrieval_store || "local")} · rank ${escapeHtml(item.expected_rank || "-")} · final ${escapeHtml(item.top_source.score)} · retrieve ${escapeHtml(item.top_source.retrieval_score ?? "-")} · fusion ${escapeHtml(item.top_source.fusion_score ?? 0)} · rerank ${escapeHtml(item.top_source.rerank_score ?? 0)} ${escapeHtml((item.top_source.rerank_reasons || []).join(" / "))} · queries ${escapeHtml((item.top_source.matched_queries || []).join(" / "))} · ${escapeHtml(item.top_source.matched_chunk || "")}</p>`
                    : `<p>没有召回来源，需要补充知识节点或文章。</p>`
                }
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderAiFeedback(payload = aiFeedback) {
  const statsTarget = document.querySelector("[data-ai-feedback-stats]");
  const listTarget = document.querySelector("[data-ai-feedback-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载 AI 反馈。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Feedback", stats.feedback ?? 0, "反馈总数"],
    ["Useful", stats.useful ?? 0, "有用"],
    ["Not Useful", stats.not_useful ?? 0, "无用"],
    ["Helpful", `${Math.round((Number(stats.helpful_rate) || 0) * 100)}%`, "有用率"],
    ["Low Quality", stats.low_quality_runs ?? 0, "低质量问答"],
    ["Issues", stats.issues ?? 0, "改进线索"],
  ];
  statsTarget.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  listTarget.innerHTML = (payload.issues || []).length
    ? payload.issues
        .map(
          (issue, index) => `
            <article class="ai-feedback-issue ${escapeHtml(issue.kind)}">
              <div>
                <span>${escapeHtml(issue.kind)} · ${escapeHtml(issue.reason || "feedback")} · ${escapeHtml(issue.count)} 次</span>
                <h3>${escapeHtml(issue.suggested_title || issue.question)}</h3>
                <p>${escapeHtml(issue.question)}</p>
                <small>来源：${escapeHtml((issue.source_slugs || []).join(" / ") || "无引用")} · ${escapeHtml(formatDateTime(issue.last_seen))}</small>
              </div>
              <div class="actions left">
                <button type="button" data-ai-feedback-draft="${index}" data-ai-feedback-type="${escapeHtml(issue.suggested_type || "post")}">生成草稿</button>
                <button type="button" data-ai-feedback-draft="${index}" data-ai-feedback-type="knowledge">知识节点</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty success">暂时没有 AI 反馈改进项。</p>`;
}

function renderContentOps(payload = contentOps) {
  const statsTarget = document.querySelector("[data-content-ops-stats]");
  const boardTarget = document.querySelector("[data-content-ops-board]");
  if (!statsTarget || !boardTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    boardTarget.innerHTML = `<p class="empty">登录 CMS 后加载 Content Ops。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Tasks", stats.tasks ?? 0, "总任务"],
    ["High", stats.high ?? 0, "高优先级"],
    ["Medium", stats.medium ?? 0, "中优先级"],
    ["Hidden", stats.hidden ?? 0, "已完成/忽略"],
    ["Search", stats.search_gaps ?? 0, "搜索缺口"],
    ["AI", stats.ai_issues ?? 0, "AI 改进项"],
    ["Relation", stats.relation_issues ?? 0, "关系问题"],
  ];
  statsTarget.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  const labels = { high: "High", medium: "Medium", low: "Low" };
  const tasks = payload.tasks || [];
  boardTarget.innerHTML = Object.entries(labels)
    .map(([priority, label]) => {
      const currentTasks = tasks.filter((task) => task.priority === priority);
      return `
        <section class="content-ops-column ${escapeHtml(priority)}">
          <h3>${escapeHtml(label)} <span>${currentTasks.length}</span></h3>
          <div>
            ${
              currentTasks.length
                ? currentTasks
                    .map((task, index) => {
                      const globalIndex = tasks.indexOf(task);
                      return `
                        <article class="content-ops-task">
                          <span>${escapeHtml(task.source)} · ${escapeHtml(task.meta || "")}</span>
                          <strong>${escapeHtml(task.title)}</strong>
                          <p>${escapeHtml(task.detail || "")}</p>
                          <div class="content-ops-actions">
                            <button type="button" data-content-ops-task="${globalIndex}">${escapeHtml(contentOpsActionLabel(task.action?.kind))}</button>
                            <button type="button" data-content-ops-state="${globalIndex}" data-content-ops-status="done">完成</button>
                            <button type="button" data-content-ops-state="${globalIndex}" data-content-ops-status="ignored">忽略</button>
                          </div>
                        </article>
                      `;
                    })
                    .join("")
                : `<p class="empty">暂无任务。</p>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function contentOpsActionLabel(kind) {
  return {
    create_gap_draft: "生成草稿",
    create_feedback_draft: "生成草稿",
    fix_relation: "修复反链",
    review_relation: "查看问题",
    open_entry: "打开编辑",
    publish_entry: "发布",
  }[kind] || "处理";
}

function renderSearchAnalytics(payload = searchAnalytics) {
  const statsTarget = document.querySelector("[data-search-analytics-stats]");
  const topTarget = document.querySelector("[data-top-search-queries]");
  const emptyTarget = document.querySelector("[data-empty-search-queries]");
  const recentTarget = document.querySelector("[data-recent-search-events]");
  if (!statsTarget || !topTarget || !emptyTarget || !recentTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    topTarget.innerHTML = `<p class="empty">登录 CMS 后加载搜索分析。</p>`;
    emptyTarget.innerHTML = `<p class="empty">暂无数据。</p>`;
    recentTarget.innerHTML = `<p class="empty">暂无数据。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Events", stats.events ?? 0, "总事件"],
    ["Searches", stats.searches ?? 0, "搜索次数"],
    ["Clicks", stats.clicks ?? 0, "点击次数"],
    ["No Result", stats.no_results ?? 0, "无结果搜索"],
    ["CTR", stats.click_rate ?? 0, "点击率"],
  ];
  statsTarget.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  topTarget.innerHTML = (payload.top_queries || []).length
    ? payload.top_queries
        .map(
          (item) => `
            <div class="analytics-row">
              <strong>${escapeHtml(item.query)}</strong>
              <span>${escapeHtml(item.count)} 次 · ${escapeHtml((item.sources || []).join(" / "))} · 无结果 ${escapeHtml(item.no_result)}</span>
            </div>
          `,
        )
        .join("")
    : `<p class="empty">暂无热门关键词。</p>`;

  emptyTarget.innerHTML = (payload.no_result_queries || []).length
    ? payload.no_result_queries
        .map(
          (item) => `
            <div class="analytics-row warning">
              <strong>${escapeHtml(item.query)}</strong>
              <span>${escapeHtml(item.count)} 次没有结果，适合补文章或知识节点。</span>
            </div>
          `,
        )
        .join("")
    : `<p class="empty success">暂时没有无结果搜索。</p>`;

  recentTarget.innerHTML = (payload.recent_events || []).length
    ? payload.recent_events
        .slice(0, 18)
        .map(
          (event) => `
            <div class="analytics-row">
              <strong>${escapeHtml(event.query || event.selected_title || "-")}</strong>
              <span>${escapeHtml(event.event_type)} · ${escapeHtml(event.source)} · ${escapeHtml(event.result_count)} results · ${escapeHtml(formatDateTime(event.created_at))}</span>
              ${event.selected_title ? `<small>→ ${escapeHtml(event.selected_type)} · ${escapeHtml(event.selected_title)}</small>` : ""}
            </div>
          `,
        )
        .join("")
    : `<p class="empty">暂无最近事件。</p>`;
}

function renderContentGaps(payload = contentGaps) {
  const statsTarget = document.querySelector("[data-content-gap-stats]");
  const listTarget = document.querySelector("[data-content-gap-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载内容缺口。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Gaps", stats.gaps ?? 0, "待补内容"],
    ["High", stats.high ?? 0, "高优先级"],
    ["Medium", stats.medium ?? 0, "中优先级"],
    ["Low", stats.low ?? 0, "低优先级"],
  ];
  statsTarget.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  listTarget.innerHTML = (payload.gaps || []).length
    ? payload.gaps
        .map(
          (gap, index) => `
            <article class="content-gap ${escapeHtml(gap.priority)}">
              <div>
                <span>${escapeHtml(gap.priority)} · ${escapeHtml(gap.suggested_type)} · ${escapeHtml(gap.count)} 次</span>
                <h3>${escapeHtml(gap.suggested_title || gap.query)}</h3>
                <p>${escapeHtml(gap.reason)}</p>
                <small>搜索词：${escapeHtml(gap.query)} · 来源：${escapeHtml((gap.sources || []).join(" / "))} · ${escapeHtml(formatDateTime(gap.last_seen))}</small>
              </div>
              <div class="actions left">
                <button type="button" data-gap-draft="${index}" data-gap-type="${escapeHtml(gap.suggested_type)}">生成草稿</button>
                <button type="button" data-gap-draft="${index}" data-gap-type="post">文章</button>
                <button type="button" data-gap-draft="${index}" data-gap-type="knowledge">知识节点</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty success">暂时没有明显内容缺口。</p>`;
}

function renderRelationHealth(payload = relationHealth) {
  const statsTarget = document.querySelector("[data-relation-health-stats]");
  const listTarget = document.querySelector("[data-relation-health-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载关系健康检查。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Entries", stats.entries ?? 0, "参与检查"],
    ["Issues", stats.issues ?? 0, "关系问题"],
    ["Backlinks", stats.missing_backlinks ?? 0, "缺失反链"],
    ["Targets", stats.missing_targets ?? 0, "目标不存在"],
  ];
  statsTarget.innerHTML = rows
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  listTarget.innerHTML = (payload.issues || []).length
    ? payload.issues
        .map(
          (issue, index) => `
            <article class="relation-health-issue ${escapeHtml(issue.kind)}">
              <div>
                <span>${escapeHtml(issue.kind)} · ${escapeHtml(issue.source_type)} → ${escapeHtml(issue.target_type)}</span>
                <h3>${escapeHtml(issue.source_title)} → ${escapeHtml(issue.target_title)}</h3>
                <p>${escapeHtml(issue.message)}</p>
                ${issue.missing_field ? `<small>需要在目标条目的 ${escapeHtml(issue.missing_field)} 中加入：${escapeHtml(issue.missing_value)}</small>` : ""}
              </div>
              ${
                issue.kind === "missing_backlink"
                  ? `<button type="button" data-relation-fix="${index}">修复反链</button>`
                  : `<em>需要手动确认目标是否已改名</em>`
              }
            </article>
          `,
        )
        .join("")
    : `<p class="empty success">关系网络是双向的，暂时没有明显问题。</p>`;
}

function renderPublishWorkflow(payload = publishWorkflow) {
  const statsTarget = document.querySelector("[data-publish-workflow-stats]");
  const boardTarget = document.querySelector("[data-publish-board]");
  if (!statsTarget || !boardTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    boardTarget.innerHTML = `<p class="empty">登录 CMS 后加载发布流程。</p>`;
    return;
  }

  const labels = {
    draft: "草稿",
    needs_content: "待补正文",
    needs_seo: "待补 SEO",
    needs_relations: "待补关系",
    ready: "可发布",
    published: "已发布",
  };
  const columns = payload.columns || {};
  const stats = payload.stats || {};
  statsTarget.innerHTML = Object.entries(labels)
    .map(
      ([key, label]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(stats[key] ?? 0)}</strong>
          <p>${escapeHtml(key)}</p>
        </article>
      `,
    )
    .join("");

  boardTarget.innerHTML = Object.entries(labels)
    .map(([key, label]) => {
      const entries = columns[key] || [];
      return `
        <section class="publish-column ${escapeHtml(key)}">
          <h3>${escapeHtml(label)} <span>${entries.length}</span></h3>
          <div>
            ${
              entries.length
                ? entries
                    .map(
                      (entry) => `
                        <article class="publish-card">
                          <span>${escapeHtml(entityLabels[entry.entity_type] || entry.entity_type)} · ${escapeHtml(entry.status)}</span>
                          <strong>${escapeHtml(entry.title)}</strong>
                          <p>${escapeHtml(entry.summary || entry.slug)}</p>
                          ${
                            (entry.blockers || []).length
                              ? `<ul>${entry.blockers.map((blocker) => `<li>${escapeHtml(blocker.message)}</li>`).join("")}</ul>`
                              : `<small>没有阻塞项。</small>`
                          }
                          <div class="actions left">
                            <button type="button" data-workflow-open="${entry.id}" data-workflow-type="${escapeHtml(entry.entity_type)}">编辑</button>
                            ${
                              key === "ready"
                                ? `<button type="button" data-workflow-publish="${entry.id}" data-workflow-type="${escapeHtml(entry.entity_type)}">发布</button>`
                                : ""
                            }
                          </div>
                        </article>
                      `,
                    )
                    .join("")
                : `<p class="empty">暂无内容。</p>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

function parseMetadata(entry) {
  return parseJson(entry?.metadata_json, {});
}

function parseArrayJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return null;
  }
}

function stringifyMetadata(value) {
  return JSON.stringify(value || {}, null, 2);
}

function uniqueValues(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function currentEntryDraftForSuggestion() {
  let metadata = {};
  const metadataInput = document.querySelector("[data-entry-metadata]");
  if (metadataInput) metadata = parseJson(metadataInput.value, {});
  return {
    id: activeEntry?.id || null,
    entity_type: activeEntityType,
    title: document.querySelector("[data-entry-title]")?.value.trim() || activeEntry?.title || "",
    summary: document.querySelector("[data-entry-summary]")?.value.trim() || "",
    category: document.querySelector("[data-entry-category]")?.value.trim() || "",
    content_md: document.querySelector("[data-entry-content]")?.value || "",
    metadata_json: JSON.stringify(metadata),
  };
}

function renderAutoRelationSuggestions(payload = relationSuggestionPayload) {
  const target = document.querySelector("[data-auto-relation-results]");
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">保存或填写内容后，可以点击推荐关联。</p>`;
    return;
  }

  const labels = { project: "项目", knowledge: "知识", post: "文章", reading: "阅读" };
  const groups = payload.groups || {};
  const sections = ["project", "knowledge", "post", "reading"].map((type) => {
    const items = groups[type] || [];
    return `
      <article>
        <h4>${labels[type]}</h4>
        ${
          items.length
            ? items
                .map(
                  (item) => `
                    <button type="button" data-relation-item="${escapeHtml(item.id)}" data-relation-type="${escapeHtml(type)}">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.category || item.slug)} · score ${escapeHtml(item.score)}</span>
                    </button>
                  `,
                )
                .join("")
            : `<p class="empty">暂无推荐。</p>`
        }
      </article>
    `;
  });
  target.innerHTML = sections.join("");
}

function relationItemsByType(type) {
  return relationSuggestionPayload?.groups?.[type] || [];
}

function applyRelationItems(type, items) {
  if (!items.length) return;
  const metadataInput = document.querySelector("[data-entry-metadata]");
  const metadata = parseJson(metadataInput.value, {});
  const titles = items.map((item) => item.title);

  if (type === "project") {
    metadata.relatedProjects = uniqueValues([...(metadata.relatedProjects || []), ...titles]);
    document.querySelector("[data-entry-related]").value = metadata.relatedProjects.join(", ");
  }
  if (type === "knowledge") {
    metadata.relatedKnowledge = uniqueValues([...(metadata.relatedKnowledge || []), ...titles]);
    document.querySelector("[data-entry-related-knowledge]").value = metadata.relatedKnowledge.join(", ");
  }
  if (type === "post") {
    metadata.relatedPosts = uniqueValues([...(metadata.relatedPosts || []), ...titles]);
    document.querySelector("[data-entry-related-posts]").value = metadata.relatedPosts.join(", ");
  }
  if (type === "reading") {
    metadata.relatedReading = uniqueValues([...(metadata.relatedReading || []), ...titles]);
    document.querySelector("[data-entry-related-reading]").value = metadata.relatedReading.join(", ");
  }

  metadataInput.value = stringifyMetadata(metadata);
  if (activeEntityType === "knowledge") renderRelationSuggestions(metadata);
}

function applyAllRelationSuggestions() {
  ["project", "knowledge", "post", "reading"].forEach((type) => applyRelationItems(type, relationItemsByType(type).slice(0, type === "knowledge" ? 5 : 3)));
  showToast("已应用推荐关联");
}

function markdownToHtml(markdown = "") {
  const lines = String(markdown).split("\n");
  const html = [];
  let inCode = false;
  let codeLines = [];
  let inList = false;

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("");
}

function defaultEntry(entityType = activeEntityType) {
  const label = entityLabels[entityType];
  const slug = `${entityType}-${Date.now()}`;
  const metadata =
    entityType === "post"
      ? { date: new Date().toISOString().slice(0, 10), tags: [], seoTitle: "", seoDescription: "", canonical: "", cover: "" }
      : entityType === "project"
        ? { stack: [], github: "", demo: "", status: "规划中" }
        : entityType === "reading"
          ? { author: "", status: "想读", progress: 0, highlights: [], relatedKnowledge: [], relatedProjects: [], relatedPosts: [] }
          : { items: [], relatedProjects: [], relatedKnowledge: [], relatedReading: [], relatedPosts: [], notes: [] };

  return {
    id: null,
    entity_type: entityType,
    slug,
    title: `新${label}`,
    summary: "",
    content_md: "",
    metadata_json: stringifyMetadata(metadata),
    status: "draft",
    visibility: "public",
    revision: 1,
    category: entityType === "post" ? "技术学习" : label,
  };
}

function relationSuggestions(metadata = {}) {
  const knowledge = (state?.knowledgeBase || []).map((item) => item.topic).filter(Boolean);
  const projects = (state?.projects || []).map((item) => item.name).filter(Boolean);
  const reading = (state?.reading || []).map((item) => item.title).filter(Boolean);
  const posts = (state?.posts || []).map((item) => item.title).filter(Boolean);
  const selected = [
    ...(metadata.relatedKnowledge || []),
    ...(metadata.relatedProjects || []),
    ...(metadata.relatedReading || []),
    ...(metadata.relatedPosts || []),
  ];
  return { knowledge, projects, reading, posts, selected };
}

function renderRelationSuggestions(metadata = {}) {
  const target = document.querySelector("[data-relation-suggestions]");
  if (!target) return;
  const groups = relationSuggestions(metadata);
  const chips = [
    ...groups.knowledge.slice(0, 8).map((item) => ["知识", item]),
    ...groups.projects.slice(0, 6).map((item) => ["项目", item]),
    ...groups.reading.slice(0, 4).map((item) => ["阅读", item]),
    ...groups.posts.slice(0, 4).map((item) => ["文章", item]),
  ];
  target.innerHTML = chips.length
    ? `
      <strong>可用关联</strong>
      <div>
        ${chips.map(([type, item]) => `<span class="${groups.selected.includes(item) ? "is-selected" : ""}">${escapeHtml(type)} · ${escapeHtml(item)}</span>`).join("")}
      </div>
    `
    : `<p class="empty">添加项目、阅读或文章后，这里会显示可关联内容。</p>`;
}

function toggleKnowledgeRelationEditor(metadata = {}) {
  const panel = document.querySelector("[data-knowledge-relation-editor]");
  if (!panel) return;
  const isKnowledge = activeEntityType === "knowledge";
  panel.hidden = !isKnowledge;
  document.querySelector("[data-entry-related]").closest("label").firstChild.textContent = isKnowledge ? "关联项目" : "关联项目";
  if (isKnowledge) renderRelationSuggestions(metadata);
}

function togglePostSeoEditor() {
  const panel = document.querySelector("[data-post-seo-editor]");
  if (panel) panel.hidden = activeEntityType !== "post";
}

function syncMetadataPreviewFromFields() {
  const metadataInput = document.querySelector("[data-entry-metadata]");
  if (!metadataInput) return;
  const metadata = parseJson(metadataInput.value, null);
  if (metadata === null) return;

  const keywordKey = keywordKeys[activeEntityType] || "tags";
  metadata[keywordKey] = splitValues(document.querySelector("[data-entry-keywords]").value);
  metadata.relatedProjects = splitValues(document.querySelector("[data-entry-related]").value);

  if (activeEntityType === "post") {
    metadata.seoTitle = document.querySelector("[data-entry-seo-title]").value.trim();
    metadata.seoDescription = document.querySelector("[data-entry-seo-description]").value.trim();
    metadata.canonical = document.querySelector("[data-entry-canonical]").value.trim();
    metadata.cover = document.querySelector("[data-entry-cover]").value.trim();
    metadata.columnCover = document.querySelector("[data-entry-column-cover]").value.trim();
    metadata.columnDescription = document.querySelector("[data-entry-column-description]").value.trim();
    metadata.bodyFontSize = Math.max(14, Math.min(24, Number(document.querySelector("[data-entry-body-font-size]").value) || 18));
    metadata.columnIds = [...document.querySelectorAll("[data-entry-columns] input:checked")].map((input) => Number(input.value));
    const primaryColumn = document.querySelector("[data-entry-primary-column]").value;
    metadata.primaryColumnId = primaryColumn ? Number(primaryColumn) : null;
  }

  if (activeEntityType === "knowledge") {
    metadata.relatedKnowledge = splitValues(document.querySelector("[data-entry-related-knowledge]").value);
    metadata.relatedReading = splitValues(document.querySelector("[data-entry-related-reading]").value);
    metadata.relatedPosts = splitValues(document.querySelector("[data-entry-related-posts]").value);
    metadata.noteLinks = splitValues(document.querySelector("[data-entry-note-links]").value);
    const notesInput = document.querySelector("[data-entry-notes-json]");
    const notes = parseArrayJson(notesInput.value, []);
    if (notes !== null) {
      notesInput.classList.remove("is-invalid");
      metadata.notes = notes;
    } else {
      notesInput.classList.add("is-invalid");
    }
  }

  metadataInput.value = stringifyMetadata(metadata);
  if (activeEntityType === "knowledge") renderRelationSuggestions(metadata);
  if (activeEntityType === "post") renderArticleColumnEditor(metadata);
}

function setAutosaveStatus(message, state = "idle") {
  const target = document.querySelector("[data-autosave-status]");
  if (!target) return;
  target.textContent = message;
  target.dataset.state = state;
}

function setEntryForm(entry, draftPayload = null, draftSavedAt = "") {
  suppressEditorEvents = true;
  window.clearTimeout(autosaveTimer);
  autosaveDirty = false;
  activeEntry = entry || defaultEntry();
  relationSuggestionPayload = null;
  const displayedEntry = draftPayload ? { ...activeEntry, ...draftPayload } : activeEntry;
  const metadata = parseMetadata(displayedEntry);
  const keywordKey = keywordKeys[displayedEntry.entity_type] || "tags";

  document.querySelector("[data-entry-title]").value = displayedEntry.title || "";
  document.querySelector("[data-entry-slug]").value = displayedEntry.slug || "";
  document.querySelector("[data-entry-category]").value = displayedEntry.category || "";
  document.querySelector("[data-entry-status]").value = displayedEntry.status || "draft";
  document.querySelector("[data-entry-visibility]").value = displayedEntry.visibility || "public";
  document.querySelector("[data-entry-summary]").value = displayedEntry.summary || "";
  document.querySelector("[data-entry-content]").value = displayedEntry.content_md || "";
  document.querySelector("[data-entry-metadata]").value = stringifyMetadata(metadata);
  document.querySelector("[data-entry-keywords]").value = (metadata[keywordKey] || []).join(", ");
  document.querySelector("[data-entry-related]").value = (metadata.relatedProjects || []).join(", ");
  document.querySelector("[data-entry-seo-title]").value = metadata.seoTitle || "";
  document.querySelector("[data-entry-seo-description]").value = metadata.seoDescription || "";
  document.querySelector("[data-entry-canonical]").value = metadata.canonical || "";
  document.querySelector("[data-entry-cover]").value = metadata.cover || "";
  document.querySelector("[data-entry-column-cover]").value = metadata.columnCover || "";
  document.querySelector("[data-entry-column-description]").value = metadata.columnDescription || "";
  document.querySelector("[data-entry-body-font-size]").value = metadata.bodyFontSize || 18;
  renderArticleColumnEditor(metadata);
  document.querySelector("[data-entry-related-knowledge]").value = (metadata.relatedKnowledge || []).join(", ");
  document.querySelector("[data-entry-related-reading]").value = (metadata.relatedReading || []).join(", ");
  document.querySelector("[data-entry-related-posts]").value = (metadata.relatedPosts || []).join(", ");
  document.querySelector("[data-entry-note-links]").value = (metadata.noteLinks || []).join(", ");
  document.querySelector("[data-entry-notes-json]").value = JSON.stringify(metadata.notes || [], null, 2);
  document.querySelector("[data-keywords-label]").firstChild.textContent = keywordLabels[displayedEntry.entity_type] || "标签，逗号分隔";
  toggleKnowledgeRelationEditor(metadata);
  togglePostSeoEditor();
  renderMarkdownPreview();
  renderVersionList([]);
  renderAutoRelationSuggestions();
  document.querySelector("[data-version-diff]").hidden = true;
  setAutosaveStatus(
    draftPayload ? `已恢复自动草稿 · ${formatDateTime(draftSavedAt)}` : activeEntry.id ? `已保存 · revision ${activeEntry.revision || 1}` : "输入后自动创建草稿",
    draftPayload ? "saved" : "idle",
  );
  suppressEditorEvents = false;
}

function readEntryForm() {
  const metadataInput = document.querySelector("[data-entry-metadata]");
  const metadata = parseJson(metadataInput.value, null);
  if (metadata === null) {
    metadataInput.classList.add("is-invalid");
    throw new Error("元数据 JSON 格式不正确");
  }
  metadataInput.classList.remove("is-invalid");

  const keywordKey = keywordKeys[activeEntityType] || "tags";
  metadata[keywordKey] = splitValues(document.querySelector("[data-entry-keywords]").value);
  metadata.relatedProjects = splitValues(document.querySelector("[data-entry-related]").value);
  if (activeEntityType === "post") {
    metadata.seoTitle = document.querySelector("[data-entry-seo-title]").value.trim();
    metadata.seoDescription = document.querySelector("[data-entry-seo-description]").value.trim();
    metadata.canonical = document.querySelector("[data-entry-canonical]").value.trim();
    metadata.cover = document.querySelector("[data-entry-cover]").value.trim();
    metadata.columnCover = document.querySelector("[data-entry-column-cover]").value.trim();
    metadata.columnDescription = document.querySelector("[data-entry-column-description]").value.trim();
    metadata.bodyFontSize = Math.max(14, Math.min(24, Number(document.querySelector("[data-entry-body-font-size]").value) || 18));
    metadata.columnIds = [...document.querySelectorAll("[data-entry-columns] input:checked")].map((input) => Number(input.value));
    const primaryColumn = document.querySelector("[data-entry-primary-column]").value;
    metadata.primaryColumnId = primaryColumn ? Number(primaryColumn) : null;
  }
  if (activeEntityType === "knowledge") {
    metadata.relatedKnowledge = splitValues(document.querySelector("[data-entry-related-knowledge]").value);
    metadata.relatedReading = splitValues(document.querySelector("[data-entry-related-reading]").value);
    metadata.relatedPosts = splitValues(document.querySelector("[data-entry-related-posts]").value);
    metadata.noteLinks = splitValues(document.querySelector("[data-entry-note-links]").value);
    const notesInput = document.querySelector("[data-entry-notes-json]");
    const notes = parseArrayJson(notesInput.value, []);
    if (notes === null) {
      notesInput.classList.add("is-invalid");
      throw new Error("知识节点 JSON 格式不正确");
    }
    notesInput.classList.remove("is-invalid");
    metadata.notes = notes;
  }

  const title = document.querySelector("[data-entry-title]").value.trim();
  const slug = document.querySelector("[data-entry-slug]").value.trim() || slugify(title);

  return {
    entity_type: activeEntityType,
    slug,
    title,
    summary: document.querySelector("[data-entry-summary]").value.trim(),
    content_md: document.querySelector("[data-entry-content]").value,
    metadata_json: JSON.stringify(metadata),
    status: document.querySelector("[data-entry-status]").value,
    visibility: document.querySelector("[data-entry-visibility]").value,
    category: document.querySelector("[data-entry-category]").value.trim(),
  };
}

function renderMarkdownPreview() {
  const target = document.querySelector("[data-markdown-preview]");
  if (!target) return;
  target.innerHTML = markdownToHtml(document.querySelector("[data-entry-content]")?.value || "");
}

function renderEntryList() {
  const target = document.querySelector("[data-entry-list]");
  if (!target) return;
  const entries = cmsEntries.filter((entry) => entry.entity_type === activeEntityType);
  target.innerHTML = entries.length
    ? `
      <div class="entry-table-head"><span>标题</span><span>分类</span><span>状态</span><span>更新时间</span></div>
      ${entries
        .map(
          (entry) => `
            <button type="button" data-entry-id="${entry.id}" class="${activeEntry?.id === entry.id ? "is-active" : ""}">
              <strong>${escapeHtml(entry.title)}</strong>
              <span>${escapeHtml(entry.category || "-")}</span>
              <em>${escapeHtml(entry.status)}</em>
              <time>${escapeHtml(formatDateTime(entry.updated_at || entry.created_at) || "-")}</time>
            </button>
          `,
        )
        .join("")}
    `
    : `<p class="empty">暂无${entityLabels[activeEntityType]}，可以点击新建。</p>`;
}

function renderVersionList(versions) {
  const target = document.querySelector("[data-version-list]");
  if (!target) return;
  target.innerHTML = versions.length
    ? versions
        .map((version) => {
          const snapshot = parseJson(version.snapshot_json, {});
          const reasons = {
            created: "创建",
            autosave: "自动保存",
            manual_save: "手动保存",
            published: "发布",
            archived: "归档",
            before_restore: "恢复前备份",
          };
          return `
            <div class="version-row">
              <div>
                <strong>${escapeHtml(snapshot.title || "未命名版本")}</strong>
                <small>${escapeHtml(reasons[version.reason] || version.reason || "保存")} · ${escapeHtml(formatDateTime(version.created_at))}</small>
              </div>
              <div class="version-actions">
                <button type="button" data-version-diff="${version.id}">查看差异</button>
                <button type="button" data-version-restore="${version.id}">恢复</button>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="empty">暂无版本记录。</p>`;
}

async function loadEntries() {
  const [articleEntries, legacyEntries] = await Promise.all([
    cmsRequest("/admin/articles"),
    cmsRequest("/admin/entries"),
  ]);
  cmsEntries = [...articleEntries, ...legacyEntries.filter((entry) => entry.entity_type !== "post")];
  renderHealthDashboard();
  const entries = cmsEntries.filter((entry) => entry.entity_type === activeEntityType);
  if (activeEntry?.id) {
    activeEntry = cmsEntries.find((entry) => entry.id === activeEntry.id) || entries[0] || defaultEntry();
  } else {
    activeEntry = entries[0] || defaultEntry();
  }
  renderEntryList();
  setEntryForm(activeEntry);
  if (activeEntry.id) {
    await loadEntryDraft(activeEntry);
    await loadVersions();
  }
  renderAdminDashboard();
}

async function loadAiRuns() {
  const sessionId = document.querySelector("[data-ai-runs-session]")?.value.trim();
  const query = new URLSearchParams({ limit: "30" });
  if (sessionId) query.set("session_id", sessionId);
  const payload = await cmsRequest(`/admin/ai-runs?${query.toString()}`);
  aiRuns = payload.runs || [];
  activeAiRun = aiRuns[0] || null;
  renderAiRunStats(payload.stats || {});
  renderAiRunList();
  renderAiRunDetail();
}

async function loadAgentRuns() {
  const sessionId = document.querySelector("[data-agent-runs-session]")?.value.trim();
  const query = new URLSearchParams({ limit: "30" });
  if (sessionId) query.set("session_id", sessionId);
  const payload = await cmsRequest(`/admin/agent-runs?${query.toString()}`);
  agentRuns = payload.runs || [];
  activeAgentRun = agentRuns[0] || null;
  renderAgentRunStats(payload.stats || {});
  renderAgentRunList();
  renderAgentRunDetail();
  renderAdminDashboard();
}

async function evaluateAgentSuite() {
  agentEvaluation = await cmsRequest("/admin/agent/evaluate", {
    method: "POST",
    body: JSON.stringify({ planner_mode: "local" }),
  });
  renderAgentEvaluation();
  await loadAgentRuns();
  showToast("Agent 评测完成");
}

async function loadRagIndex() {
  ragIndex = await cmsRequest("/admin/rag/status");
  renderRagIndex();
  renderAdminDashboard();
}

async function rebuildRagIndex() {
  await cmsRequest("/admin/rag/rebuild", { method: "POST" });
  showToast("RAG 索引已重建");
  await loadRagIndex();
}

async function evaluateRagIndex() {
  ragEvaluation = await cmsRequest("/admin/rag/evaluate", {
    method: "POST",
    body: JSON.stringify({}),
  });
  showToast("RAG 评测完成");
  renderRagEvaluation();
}

async function loadAiFeedback() {
  aiFeedback = await cmsRequest("/admin/ai-feedback?limit=80");
  renderAiFeedback();
}

async function loadContentOps() {
  contentOps = await cmsRequest("/admin/content-ops");
  renderContentOps();
}

async function refreshOpsDependencies() {
  await loadContentOps();
  await loadRagIndex();
  await loadAiFeedback();
  await loadContentGaps();
  await loadRelationHealth();
  await loadPublishWorkflow();
}

async function setContentOpsTaskState(index, status = "ignored") {
  const task = contentOps?.tasks?.[Number(index)];
  if (!task?.id) return;
  await cmsRequest("/admin/content-ops/task-state", {
    method: "POST",
    body: JSON.stringify({
      task_id: task.id,
      status,
    }),
  });
  showToast(status === "done" ? "任务已完成" : "任务已忽略");
  await loadContentOps();
}

async function createAiFeedbackDraft(index, entityType) {
  const issue = aiFeedback?.issues?.[Number(index)];
  if (!issue) return;
  const draft = await cmsRequest("/admin/ai-feedback/draft", {
    method: "POST",
    body: JSON.stringify({
      feedback_id: issue.feedback_id,
      question: issue.question,
      title: issue.suggested_title,
      entity_type: entityType || issue.suggested_type || "post",
    }),
  });
  showToast(`已生成反馈草稿：${draft.title}`);
  activeEntityType = draft.entity_type;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  await loadEntries();
  activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
  setEntryForm(activeEntry);
  renderEntryList();
  await loadAiFeedback();
  await loadRagIndex();
  await loadPublishWorkflow();
}

async function handleContentOpsTask(index) {
  const task = contentOps?.tasks?.[Number(index)];
  const action = task?.action || {};
  if (!task || !action.kind) return;

  if (action.kind === "create_gap_draft") {
    const draft = await cmsRequest("/admin/content-gaps/draft", {
      method: "POST",
      body: JSON.stringify({
        query: action.query,
        title: action.title,
        entity_type: action.entity_type || "post",
      }),
    });
    showToast(`已生成草稿：${draft.title}`);
    activeEntityType = draft.entity_type;
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
    setEntryForm(activeEntry);
    renderEntryList();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
    return;
  }

  if (action.kind === "create_feedback_draft") {
    const draft = await cmsRequest("/admin/ai-feedback/draft", {
      method: "POST",
      body: JSON.stringify({
        feedback_id: action.feedback_id,
        question: action.question,
        title: action.title,
        entity_type: action.entity_type || "post",
      }),
    });
    showToast(`已生成反馈草稿：${draft.title}`);
    activeEntityType = draft.entity_type;
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
    setEntryForm(activeEntry);
    renderEntryList();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
    return;
  }

  if (action.kind === "fix_relation") {
    await cmsRequest("/admin/relation-health/fix", {
      method: "POST",
      body: JSON.stringify({
        target_id: action.target_id,
        missing_field: action.missing_field,
        missing_value: action.missing_value,
      }),
    });
    showToast("反向关联已修复");
    await loadEntries();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
    return;
  }

  if (action.kind === "open_entry" || action.kind === "review_relation") {
    if (action.entry_id) {
      await openWorkflowEntry(action.entry_id, action.entity_type);
    }
    showToast(action.kind === "review_relation" ? "需要手动确认关系目标" : "已打开编辑项");
    return;
  }

  if (action.kind === "publish_entry") {
    const path = action.entity_type === "post"
      ? `/admin/articles/${action.entry_id}/publish`
      : `/admin/entries/${action.entry_id}/publish`;
    await cmsRequest(path, { method: "POST" });
    showToast("已发布");
    await loadEntries();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
  }
}

async function loadSearchAnalytics() {
  searchAnalytics = await cmsRequest("/admin/search-analytics?limit=100");
  renderSearchAnalytics();
}

async function loadContentGaps() {
  contentGaps = await cmsRequest("/admin/content-gaps?limit=20");
  renderContentGaps();
}

async function loadRelationHealth() {
  relationHealth = await cmsRequest("/admin/relation-health");
  renderRelationHealth();
}

async function loadPublishWorkflow() {
  publishWorkflow = await cmsRequest("/admin/publish-workflow");
  renderPublishWorkflow();
}

async function loadRelationSuggestions() {
  relationSuggestionPayload = await cmsRequest("/admin/relation-suggestions", {
    method: "POST",
    body: JSON.stringify(currentEntryDraftForSuggestion()),
  });
  renderAutoRelationSuggestions();
  showToast("关联推荐已刷新");
}

async function fixRelationIssue(index) {
  const issue = relationHealth?.issues?.[Number(index)];
  if (!issue || issue.kind !== "missing_backlink") return;
  await cmsRequest("/admin/relation-health/fix", {
    method: "POST",
    body: JSON.stringify({
      target_id: issue.target_id,
      missing_field: issue.missing_field,
      missing_value: issue.missing_value,
    }),
  });
  showToast("反向关联已修复");
  await loadEntries();
  await loadRagIndex();
  await loadRelationHealth();
  await loadContentOps();
  renderHealthDashboard();
}

async function openWorkflowEntry(entryId, entityType) {
  activeEntityType = entityType;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  await loadEntries();
  activeEntry = cmsEntries.find((entry) => String(entry.id) === String(entryId)) || activeEntry;
  setEntryForm(activeEntry);
  renderEntryList();
  if (activeEntry?.id) await loadVersions();
  showToast("已打开编辑项");
}

async function publishWorkflowEntry(entryId, entityType) {
  const path = entityType === "post" ? `/admin/articles/${entryId}/publish` : `/admin/entries/${entryId}/publish`;
  await cmsRequest(path, { method: "POST" });
  showToast("已发布");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadRelationHealth();
  await loadContentOps();
  activeEntityType = entityType || activeEntityType;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  renderEntryList();
}

async function createGapDraft(index, entityType) {
  const gap = contentGaps?.gaps?.[Number(index)];
  if (!gap) return;
  const draft = await cmsRequest("/admin/content-gaps/draft", {
    method: "POST",
    body: JSON.stringify({
      query: gap.query,
      title: gap.suggested_title,
      entity_type: entityType || gap.suggested_type,
    }),
  });
  showToast(`已生成草稿：${draft.title}`);
  activeEntityType = draft.entity_type;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  await loadEntries();
  activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
  setEntryForm(activeEntry);
  renderEntryList();
  await loadContentGaps();
  await loadSearchAnalytics();
  await loadRagIndex();
  await loadRelationHealth();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function saveEntry(forceStatus) {
  window.clearTimeout(autosaveTimer);
  setAutosaveStatus("正在保存…", "saving");
  const payload = readEntryForm();
  if (forceStatus) payload.status = forceStatus;
  const isArticle = activeEntityType === "post";
  const path = isArticle
    ? activeEntry?.id ? `/admin/articles/${activeEntry.id}` : "/admin/articles"
    : activeEntry?.id ? `/admin/entries/${activeEntry.id}` : "/admin/entries";
  const method = activeEntry?.id ? "PATCH" : "POST";
  if (activeEntry?.id) payload.expected_revision = activeEntry.revision;
  const saved = await cmsRequest(path, {
    method,
    body: JSON.stringify(payload),
  });
  activeEntry = saved;
  autosaveDirty = false;
  setAutosaveStatus(`已保存 · revision ${saved.revision}`, "saved");
  showToast("内容已保存");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function publishEntry() {
  if (!activeEntry?.id) {
    await saveEntry("draft");
  } else {
    await saveEntry();
  }
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}/publish` : `/admin/entries/${activeEntry.id}/publish`;
  activeEntry = await cmsRequest(path, { method: "POST" });
  showToast("已发布");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function archiveEntry() {
  if (!activeEntry?.id) {
    showToast("新内容尚未保存，无需归档");
    return;
  }
  if (!confirm(`确定归档「${activeEntry.title}」吗？归档后不会在公开网站显示。`)) return;
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}/archive` : `/admin/entries/${activeEntry.id}/archive`;
  activeEntry = await cmsRequest(path, { method: "POST" });
  autosaveDirty = false;
  showToast("已归档，可从 CMS 列表继续查看和恢复");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function deleteEntry() {
  if (!activeEntry?.id) {
    setEntryForm(defaultEntry());
    return;
  }
  if (!confirm(`确定删除「${activeEntry.title}」吗？`)) return;
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}` : `/admin/entries/${activeEntry.id}`;
  await cmsRequest(path, { method: "DELETE" });
  activeEntry = null;
  showToast("已删除");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function loadVersions() {
  if (!activeEntry?.id) {
    renderVersionList([]);
    return;
  }
  const path = activeEntityType === "post"
    ? `/admin/articles/${activeEntry.id}/versions`
    : `/admin/versions/${activeEntry.entity_type}/${activeEntry.id}`;
  const versions = await cmsRequest(path);
  renderVersionList(versions);
}

async function loadEntryDraft(entry = activeEntry) {
  if (!entry?.id) return;
  const path = activeEntityType === "post" ? `/admin/articles/${entry.id}/draft` : `/admin/entries/${entry.id}/draft`;
  const draft = await cmsRequest(path);
  if (draft?.payload) setEntryForm(entry, draft.payload, draft.saved_at);
}

async function loadVersionDiff(versionId) {
  const path = activeEntityType === "post" ? `/admin/articles/versions/${versionId}/diff` : `/admin/versions/${versionId}/diff`;
  const diff = await cmsRequest(path);
  const target = document.querySelector("[data-version-diff]");
  const fields = (diff.changed_fields || []).join("、") || "无字段变化";
  target.textContent = `变更字段：${fields}\n\n${diff.content_diff || "正文没有变化。"}`;
  target.hidden = false;
}

async function restoreVersion(versionId) {
  const path = activeEntityType === "post" ? `/admin/articles/versions/${versionId}/restore` : `/admin/versions/${versionId}/restore`;
  activeEntry = await cmsRequest(path, { method: "POST" });
  showToast("已恢复版本");
  await loadEntries();
  await loadRagIndex();
  await loadContentOps();
}

function scheduleEntryAutosave() {
  if (suppressEditorEvents || !cmsToken) return;
  autosaveDirty = true;
  setAutosaveStatus("有未保存修改", "dirty");
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => guarded(performAutosave), 1800);
}

async function performAutosave() {
  if (!autosaveDirty || autosaveInFlight || !cmsToken) return;
  const payload = readEntryForm();
  if (!payload.title) {
    setAutosaveStatus("填写标题后自动保存", "idle");
    return;
  }

  autosaveInFlight = true;
  setAutosaveStatus("正在自动保存…", "saving");
  try {
    if (!activeEntry?.id) {
      const initialPayload = { ...payload, status: "draft" };
      const createPath = activeEntityType === "post" ? "/admin/articles" : "/admin/entries";
      activeEntry = await cmsRequest(createPath, {
        method: "POST",
        body: JSON.stringify(initialPayload),
      });
      cmsEntries.unshift(activeEntry);
      renderEntryList();
    }

    const autosavePath = activeEntityType === "post"
      ? `/admin/articles/${activeEntry.id}/autosave`
      : `/admin/entries/${activeEntry.id}/autosave`;
    const draft = await cmsRequest(autosavePath, {
      method: "POST",
      body: JSON.stringify({ ...payload, expected_revision: activeEntry.revision }),
    });
    autosaveDirty = false;
    setAutosaveStatus(`自动草稿已保存 · ${formatDateTime(draft.saved_at)}`, "saved");
  } catch (error) {
    if (error?.status === 409) {
      setAutosaveStatus("检测到其他页面的修改，请刷新后继续", "conflict");
    } else {
      setAutosaveStatus("自动保存失败，将继续保留当前输入", "error");
    }
    throw error;
  } finally {
    autosaveInFlight = false;
  }
}

function insertIntoContent(text) {
  const textarea = document.querySelector("[data-entry-content]");
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  renderMarkdownPreview();
}

async function uploadAsset() {
  const input = document.querySelector("[data-asset-file]");
  const file = input.files?.[0];
  if (!file) {
    showToast("先选择一个文件");
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  const asset = await cmsRequest("/admin/assets", {
    method: "POST",
    body: formData,
  });
  const url = cmsResourceUrl(asset.url);
  const markdown = file.type?.startsWith("image/")
    ? `\n![${asset.filename}](${url})\n`
    : `\n[${asset.filename}](${url})\n`;
  insertIntoContent(markdown);
  input.value = "";
  showToast("文件已上传并插入 Markdown");
}

function entryToPost(entry) {
  const metadata = parseMetadata(entry);
  return {
    ...metadata,
    title: entry.title,
    slug: entry.slug,
    status: entry.status,
    category: entry.category,
    summary: entry.summary,
    content: entry.content_md,
  };
}

function entryToProject(entry) {
  const metadata = parseMetadata(entry);
  return {
    ...metadata,
    name: entry.title,
    slug: entry.slug,
    status: metadata.status || entry.status,
    summary: entry.summary,
    content: entry.content_md,
  };
}

function entryToKnowledge(entry) {
  const metadata = parseMetadata(entry);
  return {
    ...metadata,
    topic: entry.title,
    slug: entry.slug,
    summary: entry.summary,
    content: entry.content_md,
  };
}

function entryToReading(entry) {
  const metadata = parseMetadata(entry);
  return {
    ...metadata,
    title: entry.title,
    slug: entry.slug,
    note: entry.summary || entry.content_md,
  };
}

async function writeCmsEntriesToLocalSite() {
  const [articles, entries] = await Promise.all([
    cmsRequest("/admin/articles"),
    cmsRequest("/admin/entries"),
  ]);
  const nextState = structuredClone(state);
  nextState.posts = articles.map(entryToPost);
  nextState.projects = entries.filter((entry) => entry.entity_type === "project").map(entryToProject);
  nextState.knowledgeBase = entries.filter((entry) => entry.entity_type === "knowledge").map(entryToKnowledge);
  nextState.reading = entries.filter((entry) => entry.entity_type === "reading").map(entryToReading);
  state = nextState;
  render();
  await save();
  showToast("CMS 内容已写入本地站点 JSON");
}

async function save() {
  const response = await fetch("/api/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state, null, 2),
  });

  showToast(response.ok ? "已保存到 data/site.json" : "保存失败");
}

function cmsApiBase() {
  return document.querySelector("[data-cms-api]")?.value.replace(/\/+$/, "") || cmsConfig.api;
}

function cmsResourceUrl(path) {
  const value = String(path || "");
  return /^https?:\/\//i.test(value) ? value : `${cmsApiBase()}${value}`;
}

function setCmsStatus(message) {
  document.querySelectorAll("[data-cms-status]").forEach((target) => {
    target.textContent = message;
  });
}

async function cmsRequest(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
    ...(cmsToken ? { authorization: `Bearer ${cmsToken}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${cmsApiBase()}${path}`, { ...options, headers });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const payload = JSON.parse(raw);
      message = typeof payload.detail === "string" ? payload.detail : payload.detail?.message || raw;
    } catch {
      // Keep the response text when the server does not return JSON.
    }
    const error = new Error(message || `CMS request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function documentStatusLabel(status) {
  return { ready: "可检索", disabled: "已停用", processing: "解析中", error: "解析失败" }[status] || status;
}

function renderDocumentUploadOptions() {
  const select = document.querySelector("[data-document-upload-column]");
  if (!select) return;
  select.innerHTML = `<option value="">未指定</option>${knowledgeColumns
    .map((column) => `<option value="${column.id}">${escapeHtml(column.name)}</option>`)
    .join("")}`;
}

function renderDocumentStats() {
  const target = document.querySelector("[data-document-stats]");
  if (!target) return;
  const chunkCount = documents.reduce((sum, item) => sum + Number(item.chunk_count || 0), 0);
  const readyCount = documents.filter((item) => item.status === "ready").length;
  const errorCount = documents.filter((item) => item.status === "error").length;
  target.innerHTML = [
    ["文档", documents.length, "已纳入管理"],
    ["可检索", readyCount, "当前启用"],
    ["切片", chunkCount, "可单独编辑"],
    ["异常", errorCount, errorCount ? "需要重新解析" : "解析状态正常"],
  ].map(([label, value, note]) => `<article><span>${label}</span><strong>${value}</strong><p>${note}</p></article>`).join("");
}

function renderDocumentList() {
  const target = document.querySelector("[data-document-list]");
  if (!target) return;
  target.innerHTML = documents.length ? documents.map((item) => `
    <button type="button" data-document-id="${item.id}" class="${activeDocument?.id === item.id ? "is-active" : ""}">
      <span class="document-list-heading"><strong>${escapeHtml(item.title)}</strong><em data-status="${escapeHtml(item.status)}">${escapeHtml(documentStatusLabel(item.status))}</em></span>
      <small>${escapeHtml(item.original_filename)} · ${item.chunk_count || 0} 个切片 · r${item.revision || 1}</small>
    </button>
  `).join("") : `<p class="empty">暂无文档，上传第一份资料开始构建文档知识库。</p>`;
}

function documentNodeOptions(item) {
  const selected = new Set((item.node_ids || []).map(Number));
  return knowledgeNodes.length ? knowledgeNodes.map((node) => `
    <label><input type="checkbox" value="${node.id}" ${selected.has(node.id) ? "checked" : ""} />${escapeHtml(node.title)}</label>
  `).join("") : `<span>暂无知识节点</span>`;
}

function documentColumnOptions(selectedId) {
  return `<option value="">未指定</option>${knowledgeColumns.map((column) => `
    <option value="${column.id}" ${Number(selectedId) === column.id ? "selected" : ""}>${escapeHtml(column.name)}</option>
  `).join("")}`;
}

function renderDocumentChunks(item) {
  return (item.chunks || []).length ? item.chunks.map((chunk) => `
    <details class="document-chunk" data-document-chunk="${chunk.id}" ${chunk.chunk_index === 0 ? "open" : ""}>
      <summary>
        <span><strong>#${chunk.chunk_index + 1} ${escapeHtml(chunk.heading || "未命名切片")}</strong><small>${chunk.token_count || 0} tokens · ${escapeHtml(chunk.embedding_provider || "local")}</small></span>
        <em>${chunk.is_enabled ? "启用" : "停用"}</em>
      </summary>
      <div class="document-chunk-form">
        <div class="grid three">
          <label>标题<input data-chunk-heading value="${escapeHtml(chunk.heading || "")}" /></label>
          <label>起始页<input data-chunk-page-start type="number" min="1" value="${chunk.page_start || ""}" /></label>
          <label>结束页<input data-chunk-page-end type="number" min="1" value="${chunk.page_end || ""}" /></label>
        </div>
        <label>切片正文<textarea data-chunk-content rows="8">${escapeHtml(chunk.content || "")}</textarea></label>
        <div class="grid two compact-grid">
          <label>元数据 JSON<textarea data-chunk-metadata rows="3">${escapeHtml(JSON.stringify(chunk.metadata || {}, null, 2))}</textarea></label>
          <label class="check-row"><input data-chunk-enabled type="checkbox" ${chunk.is_enabled ? "checked" : ""} />允许检索这个切片</label>
        </div>
        <div class="actions left"><button type="button" data-document-chunk-save="${chunk.id}">保存切片</button></div>
      </div>
    </details>
  `).join("") : `<p class="empty">没有可编辑切片。请检查解析错误或重新切片。</p>`;
}

function renderDocumentEditor() {
  const target = document.querySelector("[data-document-editor]");
  if (!target) return;
  if (!activeDocument) {
    target.innerHTML = `<p class="empty">选择一份文档查看解析结果。</p>`;
    return;
  }
  const item = activeDocument;
  target.innerHTML = `
    <div class="document-editor-header">
      <div>
        <span class="document-kicker">${escapeHtml(item.original_filename)} · ${(Number(item.size_bytes || 0) / 1024).toFixed(1)} KB</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.parser)} · ${escapeHtml(documentStatusLabel(item.status))} · revision ${item.revision || 1}</p>
      </div>
      <a href="${cmsResourceUrl(item.file_url)}" target="_blank" rel="noreferrer">查看原文件</a>
    </div>
    ${item.parse_error ? `<div class="document-error"><strong>解析失败</strong><p>${escapeHtml(item.parse_error)}</p></div>` : ""}
    <div class="grid two">
      <label>标题<input data-document-title value="${escapeHtml(item.title || "")}" /></label>
      <label>URL 标识<input data-document-slug value="${escapeHtml(item.slug || "")}" /></label>
      <label>可见性<select data-document-visibility>
        ${["private", "unlisted", "public"].map((value) => `<option value="${value}" ${item.visibility === value ? "selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label>所属专栏<select data-document-column>${documentColumnOptions(item.column_id)}</select></label>
    </div>
    <label>摘要<textarea data-document-summary rows="3">${escapeHtml(item.summary || "")}</textarea></label>
    <div class="document-node-links">
      <strong>关联知识节点</strong>
      <div data-document-nodes>${documentNodeOptions(item)}</div>
    </div>
    <div class="grid two compact-grid">
      <label>元数据 JSON<textarea data-document-metadata rows="4">${escapeHtml(JSON.stringify(item.metadata || {}, null, 2))}</textarea></label>
      <label class="check-row"><input data-document-ai-search type="checkbox" ${item.allow_ai_search ? "checked" : ""} />允许 AI 检索此文档</label>
    </div>
    <div class="actions left document-actions">
      <button type="button" data-document-save>保存文档</button>
      <button type="button" data-document-toggle ${!["ready", "disabled"].includes(item.status) ? "disabled" : ""}>${item.status === "ready" ? "停用检索" : "启用检索"}</button>
      <button type="button" class="danger" data-document-delete>删除文档</button>
    </div>
    <section class="document-rechunk">
      <div><strong>切片设置</strong><span>重新切片会先保存当前版本。</span></div>
      <label>长度<input data-document-chunk-size type="number" min="200" max="4000" value="${item.chunk_size || 900}" /></label>
      <label>重叠<input data-document-chunk-overlap type="number" min="0" max="1000" value="${item.chunk_overlap || 150}" /></label>
      <button type="button" data-document-rechunk>重新解析</button>
    </section>
    <section class="document-chunks-section">
      <div class="panel-title compact"><div><h3>切片编辑</h3><p>${item.enabled_chunk_count || 0}/${item.chunk_count || 0} 个切片已启用。</p></div></div>
      <div data-document-chunks>${renderDocumentChunks(item)}</div>
    </section>
    <section class="version-panel">
      <div class="panel-title compact"><h3>文档版本</h3><button type="button" data-document-versions>刷新版本</button></div>
      <div class="version-list" data-document-version-list><p class="empty">点击刷新查看版本。</p></div>
    </section>
  `;
}

async function selectDocument(documentId) {
  activeDocument = await cmsRequest(`/admin/documents/${documentId}`);
  renderDocumentList();
  renderDocumentEditor();
}

async function loadDocuments() {
  documents = await cmsRequest("/admin/documents");
  renderDocumentUploadOptions();
  renderDocumentStats();
  renderDocumentList();
  if (activeDocument?.id && documents.some((item) => item.id === activeDocument.id)) {
    await selectDocument(activeDocument.id);
  } else if (documents[0]) {
    await selectDocument(documents[0].id);
  } else {
    activeDocument = null;
    renderDocumentEditor();
  }
  renderAdminDashboard();
}

async function uploadDocument() {
  const fileInput = document.querySelector("[data-document-file]");
  if (!fileInput.files?.[0]) throw new Error("请先选择文档");
  const form = new FormData();
  form.append("file", fileInput.files[0]);
  form.append("title", document.querySelector("[data-document-upload-title]").value.trim());
  form.append("visibility", document.querySelector("[data-document-upload-visibility]").value);
  const columnId = document.querySelector("[data-document-upload-column]").value;
  if (columnId) form.append("column_id", columnId);
  activeDocument = await cmsRequest("/admin/documents", { method: "POST", body: form });
  fileInput.value = "";
  document.querySelector("[data-document-upload-title]").value = "";
  showToast(activeDocument.status === "ready" ? "文档已解析并生成切片" : "文档已上传，但解析失败");
  await loadDocuments();
}

function parseJsonField(selector, label) {
  try {
    return JSON.parse(document.querySelector(selector).value || "{}");
  } catch {
    throw new Error(`${label}必须是有效 JSON`);
  }
}

async function saveDocument() {
  if (!activeDocument?.id) return;
  const payload = {
    title: document.querySelector("[data-document-title]").value.trim(),
    slug: document.querySelector("[data-document-slug]").value.trim(),
    summary: document.querySelector("[data-document-summary]").value.trim(),
    visibility: document.querySelector("[data-document-visibility]").value,
    allow_ai_search: document.querySelector("[data-document-ai-search]").checked,
    column_id: Number(document.querySelector("[data-document-column]").value) || null,
    node_ids: [...document.querySelectorAll("[data-document-nodes] input:checked")].map((input) => Number(input.value)),
    metadata: parseJsonField("[data-document-metadata]", "文档元数据"),
    expected_revision: activeDocument.revision,
  };
  if (!payload.title || !payload.slug) throw new Error("标题和 URL 标识不能为空");
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}`, { method: "PATCH", body: JSON.stringify(payload) });
  showToast("文档已保存并记录版本");
  await loadDocuments();
}

async function toggleDocument() {
  if (!activeDocument?.id) return;
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}/toggle`, { method: "POST" });
  showToast(activeDocument.status === "ready" ? "文档检索已启用" : "文档检索已停用");
  await loadDocuments();
}

async function rechunkDocument() {
  if (!activeDocument?.id || !confirm("重新解析会替换当前切片，旧内容会保存在版本历史中。是否继续？")) return;
  const payload = {
    chunk_size: Number(document.querySelector("[data-document-chunk-size]").value),
    chunk_overlap: Number(document.querySelector("[data-document-chunk-overlap]").value),
  };
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}/rechunk`, { method: "POST", body: JSON.stringify(payload) });
  showToast("文档已重新解析并生成切片");
  await loadDocuments();
}

async function saveDocumentChunk(chunkId) {
  const block = document.querySelector(`[data-document-chunk="${chunkId}"]`);
  if (!block) return;
  const numberOrNull = (selector) => Number(block.querySelector(selector).value) || null;
  const metadataField = block.querySelector("[data-chunk-metadata]");
  let metadata;
  try { metadata = JSON.parse(metadataField.value || "{}"); } catch { throw new Error("切片元数据必须是有效 JSON"); }
  await cmsRequest(`/admin/document-chunks/${chunkId}`, {
    method: "PATCH",
    body: JSON.stringify({
      heading: block.querySelector("[data-chunk-heading]").value.trim(),
      content: block.querySelector("[data-chunk-content]").value.trim(),
      page_start: numberOrNull("[data-chunk-page-start]"),
      page_end: numberOrNull("[data-chunk-page-end]"),
      metadata,
      is_enabled: block.querySelector("[data-chunk-enabled]").checked,
    }),
  });
  showToast("切片已保存并重新生成向量");
  await selectDocument(activeDocument.id);
}

async function loadDocumentVersions() {
  if (!activeDocument?.id) return;
  const versions = await cmsRequest(`/admin/documents/${activeDocument.id}/versions`);
  const target = document.querySelector("[data-document-version-list]");
  target.innerHTML = versions.length ? versions.map((version) => `
    <div class="version-row"><div><strong>${escapeHtml(version.reason)}</strong><span>${escapeHtml(formatDateTime(version.created_at))} · ${escapeHtml(version.created_by_email || "system")}</span></div><button type="button" data-document-version-restore="${version.id}">恢复</button></div>
  `).join("") : `<p class="empty">暂无版本。</p>`;
}

async function restoreDocumentVersion(versionId) {
  if (!confirm("确定恢复该文档版本吗？当前状态会先保存为新版本。")) return;
  activeDocument = await cmsRequest(`/admin/documents/versions/${versionId}/restore`, { method: "POST" });
  showToast("文档版本已恢复");
  await loadDocuments();
  await loadDocumentVersions();
}

async function deleteDocument() {
  if (!activeDocument?.id || !confirm(`确定永久删除「${activeDocument.title}」及其切片吗？删除前会保留版本快照。`)) return;
  await cmsRequest(`/admin/documents/${activeDocument.id}`, { method: "DELETE" });
  activeDocument = null;
  showToast("文档及其切片已删除");
  await loadDocuments();
}

async function cmsLogin() {
  const email = document.querySelector("[data-cms-email]").value.trim();
  const password = document.querySelector("[data-cms-password]").value;
  cmsConfig.api = cmsApiBase();
  cmsConfig.email = email;
  localStorage.setItem("portfolio.cms.api", cmsConfig.api);
  localStorage.setItem("portfolio.cms.email", email);

  const token = await cmsRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  cmsToken = token.access_token;
  localStorage.setItem("portfolio.cms.token", cmsToken);
  setCmsStatus("已连接 CMS");
  showToast("CMS 登录成功");
  await loadKnowledgeColumns();
  await loadKnowledgeGraphData();
  await loadDocuments();
  await loadEntries();
  await loadAiRuns();
  await loadAgentRuns();
  await loadRagIndex();
  await loadAiFeedback();
  await loadContentOps();
  await loadSearchAnalytics();
  await loadContentGaps();
  await loadRelationHealth();
  await loadPublishWorkflow();
}

async function pushToCms() {
  await cmsRequest("/admin/site", {
    method: "POST",
    body: JSON.stringify({ data: state }),
  });
  setCmsStatus("已同步到 CMS");
  showToast("已同步到 FastAPI CMS");
  await loadRagIndex();
}

async function pullFromCms() {
  const nextState = await cmsRequest("/admin/site");
  state = nextState;
  render();
  setCmsStatus("已从 CMS 读取");
  showToast("已读取 CMS 内容");
}

async function guarded(action) {
  try {
    await action();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "操作失败");
  }
}

async function init() {
  const apiInput = document.querySelector("[data-cms-api]");
  if (apiInput) apiInput.value = cmsConfig.api;
  const apiDocs = document.querySelector("[data-api-docs]");
  if (apiDocs) apiDocs.href = `${cmsConfig.api.replace(/\/+$/, "")}/docs`;
  state = await fetch("/api/content").then((response) => response.json());
  document.querySelector("[data-cms-api]").value = cmsConfig.api;
  document.querySelector("[data-cms-email]").value = cmsConfig.email;
  setCmsStatus(cmsToken ? "已有登录令牌" : "未连接");
  configureAdminPages();
  render();

  document.querySelectorAll("[data-admin-route]").forEach((button) => {
    button.addEventListener("click", () => guarded(() => navigateAdminRoute(button.dataset.adminRoute)));
  });
  document.querySelectorAll("[data-dashboard-action]").forEach((button) => {
    button.addEventListener("click", () => guarded(async () => {
      const action = button.dataset.dashboardAction;
      if (action === "new-article") {
        await navigateAdminRoute("articles");
        document.querySelector("[data-entry-new]")?.click();
      }
      if (action === "new-node") {
        await navigateAdminRoute("knowledge-nodes");
        document.querySelector("[data-node-new]")?.click();
      }
      if (action === "new-relation") {
        await navigateAdminRoute("knowledge-relations");
        document.querySelector("[data-node-relation-new]")?.click();
      }
    }));
  });
  const adminSearch = document.querySelector("[data-admin-search]");
  adminSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !adminSearch.value.trim()) return;
    const query = adminSearch.value.trim().toLowerCase();
    const route = (state.posts || []).some((item) => [item.title, item.summary, ...(item.tags || [])].join(" ").toLowerCase().includes(query))
      ? "articles"
      : (state.knowledgeNodes || []).some((item) => [item.title, item.summary, ...(item.tag_names || [])].join(" ").toLowerCase().includes(query))
        ? "knowledge-nodes"
        : "site-settings";
    guarded(() => navigateAdminRoute(route));
  });
  window.addEventListener("hashchange", () => guarded(() => navigateAdminRoute(window.location.hash.slice(1) || "dashboard", { updateHash: false })));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      adminSearch.focus();
      adminSearch.select();
    }
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.add;
      ensureList(key).push(structuredClone(templates[key]));
      render();
    });
  });

  document.querySelector("[data-save]").addEventListener("click", save);
  document.querySelector("[data-cms-login]").addEventListener("click", () => guarded(cmsLogin));
  document.querySelector("[data-cms-push]").addEventListener("click", () => guarded(async () => {
    await pushToCms();
    await loadEntries();
  }));
  document.querySelector("[data-cms-pull]").addEventListener("click", () => guarded(pullFromCms));
  document.querySelector("[data-health-refresh]").addEventListener("click", () => {
    renderHealthDashboard();
    showToast("内容健康度已刷新");
  });
  document.querySelector("[data-ai-runs-refresh]").addEventListener("click", () => guarded(loadAiRuns));
  document.querySelector("[data-agent-runs-refresh]").addEventListener("click", () => guarded(loadAgentRuns));
  document.querySelector("[data-agent-evaluate]").addEventListener("click", () => guarded(evaluateAgentSuite));
  document.querySelector("[data-rag-index-refresh]").addEventListener("click", () => guarded(loadRagIndex));
  document.querySelector("[data-rag-index-rebuild]").addEventListener("click", () => guarded(rebuildRagIndex));
  document.querySelector("[data-rag-evaluate]").addEventListener("click", () => guarded(evaluateRagIndex));
  document.querySelector("[data-document-refresh]").addEventListener("click", () => guarded(loadDocuments));
  document.querySelector("[data-document-upload-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    guarded(uploadDocument);
  });
  document.querySelector("[data-document-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-document-id]");
    if (button) guarded(() => selectDocument(button.dataset.documentId));
  });
  document.querySelector("[data-document-editor]").addEventListener("click", (event) => {
    const chunkButton = event.target.closest("[data-document-chunk-save]");
    if (chunkButton) {
      guarded(() => saveDocumentChunk(chunkButton.dataset.documentChunkSave));
      return;
    }
    const restoreButton = event.target.closest("[data-document-version-restore]");
    if (restoreButton) {
      guarded(() => restoreDocumentVersion(restoreButton.dataset.documentVersionRestore));
      return;
    }
    if (event.target.closest("[data-document-save]")) guarded(saveDocument);
    else if (event.target.closest("[data-document-toggle]")) guarded(toggleDocument);
    else if (event.target.closest("[data-document-rechunk]")) guarded(rechunkDocument);
    else if (event.target.closest("[data-document-versions]")) guarded(loadDocumentVersions);
    else if (event.target.closest("[data-document-delete]")) guarded(deleteDocument);
  });
  document.querySelector("[data-ai-feedback-refresh]").addEventListener("click", () => guarded(loadAiFeedback));
  document.querySelector("[data-content-ops-refresh]").addEventListener("click", () => guarded(loadContentOps));
  document.querySelector("[data-search-analytics-refresh]").addEventListener("click", () => guarded(loadSearchAnalytics));
  document.querySelector("[data-content-gaps-refresh]").addEventListener("click", () => guarded(loadContentGaps));
  document.querySelector("[data-relation-health-refresh]").addEventListener("click", () => guarded(loadRelationHealth));
  document.querySelector("[data-publish-workflow-refresh]").addEventListener("click", () => guarded(loadPublishWorkflow));
  document.querySelector("[data-column-new]").addEventListener("click", () => {
    setColumnForm(emptyKnowledgeColumn());
    renderColumnList();
  });
  document.querySelector("[data-column-save]").addEventListener("click", () => guarded(saveKnowledgeColumn));
  document.querySelector("[data-column-delete]").addEventListener("click", () => guarded(deleteKnowledgeColumn));
  document.querySelector("[data-column-name]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-column-slug]");
    if (!activeKnowledgeColumn?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-column-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-column-id]");
    if (!button) return;
    activeKnowledgeColumn = knowledgeColumns.find((column) => String(column.id) === button.dataset.columnId);
    setColumnForm(activeKnowledgeColumn);
    renderColumnList();
  });
  document.querySelector("[data-node-new]").addEventListener("click", () => {
    setKnowledgeNodeForm(emptyKnowledgeNode());
    renderKnowledgeNodeList();
  });
  document.querySelector("[data-node-refresh]").addEventListener("click", () => guarded(loadKnowledgeGraphData));
  document.querySelector("[data-node-save]").addEventListener("click", () => guarded(saveKnowledgeNode));
  document.querySelector("[data-node-delete]").addEventListener("click", () => guarded(deleteKnowledgeNode));
  document.querySelector("[data-node-title]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-node-slug]");
    if (!activeKnowledgeNode?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-node-columns]").addEventListener("change", () => {
    const draft = { ...readKnowledgeNodeForm(), id: activeKnowledgeNode?.id, revision: activeKnowledgeNode?.revision };
    renderKnowledgeNodeLinks(draft);
  });
  document.querySelector("[data-node-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-id]");
    if (!button) return;
    setKnowledgeNodeForm(knowledgeNodes.find((node) => String(node.id) === button.dataset.nodeId));
    renderKnowledgeNodeList();
    guarded(loadKnowledgeNodeVersions);
  });
  document.querySelector("[data-node-version-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-version-restore]");
    if (button) guarded(() => restoreKnowledgeNodeVersion(button.dataset.nodeVersionRestore));
  });
  document.querySelector("[data-node-relation-new]").addEventListener("click", () => {
    setKnowledgeRelationForm(emptyKnowledgeRelation());
    renderKnowledgeRelationList();
  });
  document.querySelector("[data-node-relation-save]").addEventListener("click", () => guarded(saveKnowledgeRelation));
  document.querySelector("[data-node-relation-delete]").addEventListener("click", () => guarded(deleteKnowledgeRelation));
  document.querySelector("[data-node-relation-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-relation-id]");
    if (!button) return;
    setKnowledgeRelationForm(knowledgeRelations.find((relation) => String(relation.id) === button.dataset.nodeRelationId));
    renderKnowledgeRelationList();
  });

  document.querySelectorAll("[data-entity-tab]").forEach((button) => {
    button.addEventListener("click", () => guarded(async () => {
      await performAutosave();
      activeEntityType = button.dataset.entityTab;
      document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current === button));
      await loadEntries();
    }));
  });

  document.querySelector("[data-entry-new]").addEventListener("click", () => guarded(async () => {
    await performAutosave();
    setEntryForm(defaultEntry(activeEntityType));
    renderEntryList();
    setCmsWorkspaceMode("editor");
  }));
  document.querySelector("[data-entry-refresh]").addEventListener("click", () => guarded(loadEntries));
  document.querySelector("[data-entry-save]").addEventListener("click", () => guarded(() => saveEntry()));
  document.querySelector("[data-entry-publish]").addEventListener("click", () => guarded(publishEntry));
  document.querySelector("[data-entry-archive]").addEventListener("click", () => guarded(archiveEntry));
  document.querySelector("[data-entry-delete]").addEventListener("click", () => guarded(deleteEntry));
  document.querySelector("[data-entry-versions]").addEventListener("click", () => guarded(loadVersions));
  document.querySelector("[data-entry-sync-local]").addEventListener("click", () => guarded(writeCmsEntriesToLocalSite));
  document.querySelector("[data-asset-upload]").addEventListener("click", () => guarded(uploadAsset));
  document.querySelector("[data-relation-refresh]").addEventListener("click", () => guarded(loadRelationSuggestions));
  document.querySelector("[data-relation-apply-all]").addEventListener("click", applyAllRelationSuggestions);
  document.querySelector("[data-entry-content]").addEventListener("input", renderMarkdownPreview);
  [
    "[data-entry-keywords]",
    "[data-entry-related]",
    "[data-entry-seo-title]",
    "[data-entry-seo-description]",
    "[data-entry-canonical]",
    "[data-entry-cover]",
    "[data-entry-column-cover]",
    "[data-entry-column-description]",
    "[data-entry-body-font-size]",
    "[data-entry-related-knowledge]",
    "[data-entry-related-reading]",
    "[data-entry-related-posts]",
    "[data-entry-note-links]",
    "[data-entry-notes-json]",
  ].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", syncMetadataPreviewFromFields);
  });
  document.querySelector("[data-entry-title]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-entry-slug]");
    if (!activeEntry?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-entry-columns]").addEventListener("change", syncMetadataPreviewFromFields);
  document.querySelector("[data-entry-primary-column]").addEventListener("change", syncMetadataPreviewFromFields);

  const entryEditor = document.querySelector("[data-entry-editor]");
  entryEditor.addEventListener("input", scheduleEntryAutosave);
  entryEditor.addEventListener("change", scheduleEntryAutosave);

  document.querySelector("[data-entry-list]").addEventListener("click", (event) => guarded(async () => {
    const button = event.target.closest("[data-entry-id]");
    if (!button) return;
    await performAutosave();
    activeEntry = cmsEntries.find((entry) => String(entry.id) === button.dataset.entryId);
    setEntryForm(activeEntry);
    renderEntryList();
    await loadEntryDraft(activeEntry);
    await loadVersions();
    setCmsWorkspaceMode("editor");
  }));
  document.querySelector("[data-cms-editor-back]")?.addEventListener("click", () => guarded(async () => {
    await performAutosave();
    setCmsWorkspaceMode("list");
  }));

  document.querySelector("[data-ai-run-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-run-id]");
    if (!button) return;
    activeAiRun = aiRuns.find((run) => String(run.id) === button.dataset.aiRunId);
    renderAiRunList();
    renderAiRunDetail();
  });

  document.querySelector("[data-agent-run-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-agent-run-id]");
    if (!button) return;
    activeAgentRun = agentRuns.find((run) => String(run.id) === button.dataset.agentRunId);
    renderAgentRunList();
    renderAgentRunDetail();
  });

  document.querySelector("[data-content-gap-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-gap-draft]");
    if (!button) return;
    guarded(() => createGapDraft(button.dataset.gapDraft, button.dataset.gapType));
  });

  document.querySelector("[data-ai-feedback-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-feedback-draft]");
    if (!button) return;
    guarded(() => createAiFeedbackDraft(button.dataset.aiFeedbackDraft, button.dataset.aiFeedbackType));
  });

  document.querySelector("[data-content-ops-board]").addEventListener("click", (event) => {
    const stateButton = event.target.closest("[data-content-ops-state]");
    if (stateButton) {
      guarded(() => setContentOpsTaskState(stateButton.dataset.contentOpsState, stateButton.dataset.contentOpsStatus));
      return;
    }
    const button = event.target.closest("[data-content-ops-task]");
    if (!button) return;
    guarded(() => handleContentOpsTask(button.dataset.contentOpsTask));
  });

  document.querySelector("[data-relation-health-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-relation-fix]");
    if (!button) return;
    guarded(() => fixRelationIssue(button.dataset.relationFix));
  });

  document.querySelector("[data-publish-board]").addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-workflow-open]");
    if (openButton) {
      guarded(() => openWorkflowEntry(openButton.dataset.workflowOpen, openButton.dataset.workflowType));
      return;
    }
    const publishButton = event.target.closest("[data-workflow-publish]");
    if (publishButton) {
      guarded(() => publishWorkflowEntry(publishButton.dataset.workflowPublish, publishButton.dataset.workflowType));
    }
  });

  document.querySelector("[data-auto-relation-results]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-relation-item]");
    if (!button) return;
    const item = relationItemsByType(button.dataset.relationType).find((current) => String(current.id) === button.dataset.relationItem);
    if (!item) return;
    applyRelationItems(button.dataset.relationType, [item]);
    showToast(`已关联：${item.title}`);
  });

  document.querySelector("[data-version-list]").addEventListener("click", (event) => {
    const diffButton = event.target.closest("[data-version-diff]");
    if (diffButton) {
      guarded(() => loadVersionDiff(diffButton.dataset.versionDiff));
      return;
    }
    const button = event.target.closest("[data-version-restore]");
    if (!button) return;
    guarded(() => restoreVersion(button.dataset.versionRestore));
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      guarded(() => saveEntry());
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!autosaveDirty && !autosaveInFlight) return;
    event.preventDefault();
    event.returnValue = "";
  });

  setEntryForm(defaultEntry(activeEntityType));
  setColumnForm(emptyKnowledgeColumn());
  setKnowledgeNodeForm(emptyKnowledgeNode());
  setKnowledgeRelationForm(emptyKnowledgeRelation());
  if (cmsToken) {
    guarded(async () => {
      await loadKnowledgeColumns();
      await loadKnowledgeGraphData();
      await loadDocuments();
      await loadEntries();
    });
    guarded(loadAiRuns);
    guarded(loadAgentRuns);
    guarded(loadRagIndex);
    guarded(loadAiFeedback);
    guarded(loadContentOps);
    guarded(loadSearchAnalytics);
    guarded(loadContentGaps);
    guarded(loadRelationHealth);
    guarded(loadPublishWorkflow);
  }
  await navigateAdminRoute(window.location.hash.slice(1) || "dashboard", { updateHash: false });
}

init();
