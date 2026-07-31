/* GENERATED ADMIN SCRIPT. Edit files under src/ and run npm run build. */
let state;
let cmsToken = "";
localStorage.removeItem("portfolio.cms.token");

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
let proactiveDashboard = null;
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
let nodeAutosaveTimer = null;
let nodeAutosaveInFlight = false;
let nodeAutosaveDirty = false;
let nodeEditorHydrating = false;
let documentAutosaveTimer = null;
let documentAutosaveInFlight = false;
let documentAutosaveDirty = false;
let documentEditorHydrating = false;
let activeAdminRoute = "dashboard";
let cmsWorkspaceMode = "list";
let inboxItems = [];
let activeInboxItem = null;
let activityEvents = [];
let trashItems = [];
let workspaceOverview = null;
let organizationData = null;
let activeOrganizationEntity = null;
let activeOrganizationBacklinks = null;
let reviewDashboard = null;
let reviewSearchResults = [];
let maintenanceDashboard = null;
let activeInboxSuggestion = null;
let aiWorkflowDashboard = null;
let articleEnhancement = null;
let nodeEnhancement = null;
let evaluationDashboard = null;
let activeEvalSuite = null;
let currentCmsUser = null;
let accountUsers = [];

const adminRouteTitles = {
  dashboard: "控制台",
  inbox: "收件箱",
  review: "检索与回顾",
  maintenance: "主动维护",
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
  activity: "最近活动",
  trash: "回收站",
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
    "account-panel": "security",
    "health-panel": "runtime",
    "content-ops-panel": "runtime",
    "ai-runs-panel": "rag ai-feedback",
    "agent-runs-panel": "agent experiments",
    "evaluation-workbench-panel": "experiments",
    "ai-feedback-panel": "ai-feedback",
    "rag-index-panel": "rag experiments",
    "document-library-panel": "documents files",
    "search-analytics-panel": "runtime",
    "content-gaps-panel": "runtime",
    "relation-health-panel": "runtime",
    "publish-workflow-panel": "versions publishing",
    "knowledge-column-panel": "knowledge-columns article-columns",
    "knowledge-node-panel": "knowledge-nodes knowledge-relations",
    "organization-panel": "knowledge-relations",
    "content-cms-panel": "articles projects versions",
    "workspace-inbox-panel": "inbox",
    "review-workspace-panel": "review",
    "maintenance-workspace-panel": "maintenance",
    "workspace-activity-panel": "activity",
    "workspace-trash-panel": "trash",
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
  const previousRoute = activeAdminRoute;
  if (previousRoute === "knowledge-nodes") await performKnowledgeNodeAutosave();
  if (previousRoute === "documents") await performDocumentAutosave();
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
  if (cmsToken && nextRoute === "inbox") await loadInbox();
  if (cmsToken && nextRoute === "review") await loadReviewDashboard();
  if (cmsToken && nextRoute === "maintenance") await loadMaintenanceDashboard();
  if (cmsToken && nextRoute === "ai-feedback") await Promise.all([loadProactiveDashboard(false), loadAiFeedback()]);
  if (cmsToken && nextRoute === "knowledge-relations") await loadOrganization();
  if (cmsToken && nextRoute === "security") await loadCurrentAccount();
  if (cmsToken && nextRoute === "activity") await loadActivity();
  if (cmsToken && nextRoute === "trash") await loadTrash();
  document.querySelector(".admin-workspace")?.scrollTo?.({ top: 0, behavior: "instant" });
  renderAdminDashboard();
}

function formatWorkspaceTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function resetInboxForm() {
  activeInboxItem = null;
  document.querySelector("[data-inbox-form-title]").textContent = "快速记录";
  document.querySelector("[data-inbox-title]").value = "";
  document.querySelector("[data-inbox-body]").value = "";
  document.querySelector("[data-inbox-type]").value = "note";
  document.querySelector("[data-inbox-url]").value = "";
  const organizer = document.querySelector("[data-inbox-organizer]");
  if (organizer) organizer.hidden = true;
  renderInbox();
}

function renderInbox() {
  const target = document.querySelector("[data-inbox-list]");
  if (!target) return;
  const pending = inboxItems.filter((item) => item.status !== "processed" && item.status !== "archived");
  target.innerHTML = pending.length ? pending.map((item) => `
    <article class="workspace-list-item ${activeInboxItem?.id === item.id ? "is-active" : ""}" data-inbox-id="${item.id}">
      <button type="button" class="workspace-item-main" data-inbox-open="${item.id}">
        <i>${escapeHtml({ note: "N", idea: "I", link: "L", document: "D" }[item.item_type] || "N")}</i>
        <span><strong>${escapeHtml(item.title || item.body.slice(0, 48) || item.source_url || "未命名记录")}</strong><small>${escapeHtml(item.body.slice(0, 90) || item.source_url || "暂无内容")}</small></span>
        <time>${escapeHtml(formatWorkspaceTime(item.updated_at))}</time>
      </button>
      <div class="workspace-item-actions">
        <button type="button" data-inbox-organize="${item.id}">整理内容</button>
        <button type="button" class="danger-text" data-inbox-trash="${item.id}">移至回收站</button>
      </div>
    </article>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>收件箱已整理完</strong><span>新的想法可以随时先记录在这里。</span></div>`;
  const badge = document.querySelector("[data-inbox-badge]");
  if (badge) {
    badge.textContent = pending.length;
    badge.hidden = pending.length === 0;
  }
}

async function loadWorkspaceOverview() {
  workspaceOverview = await cmsRequest("/admin/workspace/overview");
  const badge = document.querySelector("[data-inbox-badge]");
  if (badge) {
    badge.textContent = workspaceOverview.inbox || 0;
    badge.hidden = !workspaceOverview.inbox;
  }
}

async function loadInbox() {
  inboxItems = await cmsRequest("/admin/inbox");
  renderInbox();
  await loadWorkspaceOverview();
}

function renderInboxOrganizerLinks() {
  const selectedColumns = new Set([...document.querySelectorAll("[data-inbox-target-columns] input:checked")].map((input) => Number(input.value)));
  const selectedNodes = new Set([...document.querySelectorAll("[data-inbox-target-nodes] input:checked")].map((input) => Number(input.value)));
  document.querySelector("[data-inbox-target-columns]").innerHTML = knowledgeColumns.length
    ? knowledgeColumns.map((column) => `<label><input type="checkbox" value="${column.id}" ${selectedColumns.has(column.id) ? "checked" : ""} /><span>${escapeHtml(column.name)}</span></label>`).join("")
    : `<p class="empty">暂无知识专栏。</p>`;
  document.querySelector("[data-inbox-target-nodes]").innerHTML = knowledgeNodes.length
    ? knowledgeNodes.map((node) => `<label><input type="checkbox" value="${node.id}" ${selectedNodes.has(node.id) ? "checked" : ""} /><span>${escapeHtml(node.title)}</span></label>`).join("")
    : `<p class="empty">暂无知识节点。</p>`;
  const primary = document.querySelector("[data-inbox-target-primary-column]");
  const current = primary.value;
  primary.innerHTML = `<option value="">未指定</option>${knowledgeColumns.map((column) => `<option value="${column.id}">${escapeHtml(column.name)}</option>`).join("")}`;
  if ([...primary.options].some((option) => option.value === current)) primary.value = current;
}

function updateInboxOrganizerMode() {
  const type = document.querySelector("[data-inbox-target-type]").value;
  document.querySelector("[data-inbox-node-type-wrap]").hidden = type !== "knowledge";
}

function openInboxOrganizer(itemId) {
  activeInboxItem = inboxItems.find((item) => String(item.id) === String(itemId)) || null;
  if (!activeInboxItem) return;
  renderInbox();
  const organizer = document.querySelector("[data-inbox-organizer]");
  organizer.hidden = false;
  document.querySelector("[data-inbox-target-type]").value = activeInboxItem.item_type === "document" ? "knowledge" : "knowledge";
  document.querySelector("[data-inbox-target-title]").value = activeInboxItem.title || activeInboxItem.body.split("\n")[0].slice(0, 120) || "未命名内容";
  document.querySelector("[data-inbox-target-slug]").value = slugify(document.querySelector("[data-inbox-target-title]").value);
  document.querySelector("[data-inbox-target-summary]").value = activeInboxItem.body.slice(0, 240);
  document.querySelector("[data-inbox-target-tags]").value = "";
  document.querySelector("[data-inbox-target-visibility]").value = "private";
  document.querySelector("[data-inbox-target-node-type]").value = "concept";
  renderInboxOrganizerLinks();
  updateInboxOrganizerMode();
  document.querySelector("[data-inbox-organize-status]").textContent = "";
  organizer.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveInboxItem() {
  const payload = {
    title: document.querySelector("[data-inbox-title]").value.trim(),
    body: document.querySelector("[data-inbox-body]").value.trim(),
    source_url: document.querySelector("[data-inbox-url]").value.trim(),
    item_type: document.querySelector("[data-inbox-type]").value,
    visibility: "private",
  };
  if (activeInboxItem?.id) {
    await cmsRequest(`/admin/inbox/${activeInboxItem.id}`, { method: "PATCH", body: JSON.stringify({ ...payload, status: activeInboxItem.status || "inbox" }) });
    showToast("收件内容已更新");
  } else {
    await cmsRequest("/admin/inbox", { method: "POST", body: JSON.stringify(payload) });
    showToast("已保存到收件箱");
  }
  resetInboxForm();
  await loadInbox();
  await loadActivity();
}

async function promoteInboxItem() {
  if (!activeInboxItem?.id) throw new Error("请先选择一条收件内容");
  const entityType = document.querySelector("[data-inbox-target-type]").value;
  const payload = {
    entity_type: entityType,
    title: document.querySelector("[data-inbox-target-title]").value.trim(),
    slug: document.querySelector("[data-inbox-target-slug]").value.trim(),
    summary: document.querySelector("[data-inbox-target-summary]").value.trim(),
    visibility: document.querySelector("[data-inbox-target-visibility]").value,
    tag_names: splitValues(document.querySelector("[data-inbox-target-tags]").value),
    column_ids: [...document.querySelectorAll("[data-inbox-target-columns] input:checked")].map((input) => Number(input.value)),
    primary_column_id: Number(document.querySelector("[data-inbox-target-primary-column]").value) || null,
    node_ids: [...document.querySelectorAll("[data-inbox-target-nodes] input:checked")].map((input) => Number(input.value)),
    node_type: document.querySelector("[data-inbox-target-node-type]").value,
  };
  if (!payload.title) throw new Error("请填写整理后的标题");
  document.querySelector("[data-inbox-organize-status]").textContent = "正在创建草稿…";
  const result = await cmsRequest(`/admin/inbox/${activeInboxItem.id}/promote`, {
    method: "POST", body: JSON.stringify(payload),
  });
  showToast(`已整理为${entityType === "post" ? "文章" : entityType === "knowledge" ? "知识节点" : entityLabels[entityType]}：${result.title}`);
  activeInboxItem = null;
  await loadInbox();
  if (entityType === "knowledge") {
    await loadKnowledgeGraphData();
    activeKnowledgeNode = knowledgeNodes.find((node) => node.id === result.id) || activeKnowledgeNode;
    await navigateAdminRoute("knowledge-nodes");
    setKnowledgeNodeForm(activeKnowledgeNode);
    renderKnowledgeNodeList();
  } else if (entityType === "post" || entityType === "project") {
    activeEntityType = entityType;
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === result.id) || activeEntry;
    await navigateAdminRoute(entityType === "post" ? "articles" : "projects");
    setEntryForm(activeEntry);
    setCmsWorkspaceMode("editor");
  }
}

async function trashInboxItem(itemId) {
  if (!confirm("将这条记录移至回收站？之后仍可恢复。")) return;
  await cmsRequest(`/admin/inbox/${itemId}`, { method: "DELETE" });
  showToast("已移至回收站");
  await loadInbox();
}

function organizationTypeLabel(type) {
  return { knowledge_column: "知识专栏", knowledge_node: "知识节点", article: "文章", document: "文档", project: "项目" }[type] || type;
}

function renderOrganization() {
  const statsTarget = document.querySelector("[data-organization-stats]");
  const listTarget = document.querySelector("[data-organization-list]");
  if (!statsTarget || !listTarget) return;
  const stats = organizationData?.stats || {};
  statsTarget.innerHTML = [
    ["内容实体", stats.entities || 0, `${stats.columns || 0} 个专栏`],
    ["有效关系", stats.relations || 0, "包含、引用与节点关系"],
    ["知识节点", stats.nodes || 0, `${stats.documents || 0} 份文档`],
    ["孤立内容", stats.orphans || 0, "建议补充专栏或关联"],
  ].map(([label, value, note]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");

  const query = document.querySelector("[data-organization-search]")?.value.trim().toLowerCase() || "";
  const type = document.querySelector("[data-organization-type]")?.value || "";
  const onlyOrphans = document.querySelector("[data-organization-orphans]")?.checked;
  const rows = (organizationData?.entities || []).filter((item) => {
    if (type && item.entity_type !== type) return false;
    if (onlyOrphans && item.connections !== 0) return false;
    return !query || `${item.title} ${item.slug}`.toLowerCase().includes(query);
  });
  listTarget.innerHTML = rows.length ? rows.map((item) => `
    <button type="button" class="${item.connections === 0 ? "is-orphan" : ""} ${activeOrganizationEntity?.entity_type === item.entity_type && activeOrganizationEntity?.id === item.id ? "is-active" : ""}" data-organization-entity="${item.entity_type}:${item.id}">
      <i>${escapeHtml({ knowledge_column: "COL", knowledge_node: "NODE", article: "POST", document: "DOC", project: "PROJ" }[item.entity_type] || "ITEM")}</i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(item.slug)}</small></span>
      <b>${item.connections === 0 ? "未关联" : `${item.connections} 条`}</b>
    </button>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>没有匹配内容</strong><span>调整筛选条件后重试。</span></div>`;
}

function relationOtherTitle(link, entity) {
  return link.source_type === entity.entity_type && link.source_id === entity.id ? link.target_title : link.source_title;
}

function renderOrganizationDetail() {
  const target = document.querySelector("[data-organization-detail]");
  if (!target) return;
  if (!activeOrganizationEntity || !activeOrganizationBacklinks) {
    target.innerHTML = `<div class="workspace-empty-state"><i>⌁</i><strong>选择一个内容</strong><span>这里会显示它的正向关系与反向链接。</span></div>`;
    return;
  }
  const renderLinks = (title, rows) => `<section class="backlink-group"><h3>${title}（${rows.length}）</h3>${rows.length ? rows.map((link) => `<article><strong>${escapeHtml(relationOtherTitle(link, activeOrganizationEntity))}</strong><span>${escapeHtml(organizationTypeLabel(link.source_type))} → ${escapeHtml(link.relation_type)} → ${escapeHtml(organizationTypeLabel(link.target_type))}</span></article>`).join("") : `<p class="empty">暂无记录。</p>`}</section>`;
  target.innerHTML = `
    <header class="organization-detail-head"><span>${escapeHtml(organizationTypeLabel(activeOrganizationEntity.entity_type)).toUpperCase()}</span><h2>${escapeHtml(activeOrganizationEntity.title)}</h2><p>${escapeHtml(activeOrganizationEntity.slug)} · 共 ${activeOrganizationBacklinks.total} 条连接</p></header>
    <button type="button" data-organization-open-editor>打开对应编辑器</button>
    ${renderLinks("反向链接", activeOrganizationBacklinks.inbound || [])}
    ${renderLinks("正向关系", activeOrganizationBacklinks.outbound || [])}
  `;
}

async function loadOrganization() {
  organizationData = await cmsRequest("/admin/workspace/organization");
  if (activeOrganizationEntity) {
    activeOrganizationEntity = organizationData.entities.find((item) => item.entity_type === activeOrganizationEntity.entity_type && item.id === activeOrganizationEntity.id) || null;
  }
  renderOrganization();
  if (!activeOrganizationEntity) renderOrganizationDetail();
}

async function selectOrganizationEntity(value) {
  const [entityType, rawId] = String(value).split(":");
  activeOrganizationEntity = organizationData?.entities?.find((item) => item.entity_type === entityType && item.id === Number(rawId)) || null;
  if (!activeOrganizationEntity) return;
  activeOrganizationBacklinks = await cmsRequest(`/admin/workspace/backlinks/${entityType}/${rawId}`);
  renderOrganization();
  renderOrganizationDetail();
}

async function openOrganizationEditor() {
  if (!activeOrganizationEntity) return;
  const { entity_type: type, id } = activeOrganizationEntity;
  if (type === "knowledge_node") {
    activeKnowledgeNode = knowledgeNodes.find((node) => node.id === id) || activeKnowledgeNode;
    await navigateAdminRoute("knowledge-nodes");
    if (activeKnowledgeNode) setKnowledgeNodeForm(activeKnowledgeNode);
  } else if (type === "document") {
    await navigateAdminRoute("documents");
    await selectDocument(id);
  } else if (type === "article") {
    activeEntityType = "post";
    await navigateAdminRoute("articles");
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === id) || activeEntry;
    if (activeEntry) setEntryForm(activeEntry);
    setCmsWorkspaceMode("editor");
  } else if (type === "knowledge_column") {
    activeKnowledgeColumn = knowledgeColumns.find((column) => column.id === id) || activeKnowledgeColumn;
    await navigateAdminRoute("knowledge-columns");
    if (activeKnowledgeColumn) setColumnForm(activeKnowledgeColumn);
  }
}

async function openWorkspaceEntity(entityType, entityId) {
  const id = Number(entityId);
  if (entityType === "project") {
    activeEntityType = "project";
    await navigateAdminRoute("projects");
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === id) || null;
    if (activeEntry) {
      setEntryForm(activeEntry);
      setCmsWorkspaceMode("editor");
    }
    return;
  }
  if (!organizationData) await loadOrganization();
  activeOrganizationEntity = organizationData?.entities?.find((item) => item.entity_type === entityType && item.id === id) || {
    id, entity_type: entityType, title: "", slug: "",
  };
  await openOrganizationEditor();
}
function reviewStatusLabel(item) {
  if (item.status === "suggested") return "建议回顾";
  if (item.status === "pending") return "今日到期";
  return item.next_review_at ? `下次 ${formatWorkspaceTime(item.next_review_at)}` : "已安排";
}

function renderReviewSearchResults() {
  const target = document.querySelector("[data-review-search-results]");
  if (!target) return;
  if (!reviewSearchResults.length) {
    target.innerHTML = `<div class="workspace-empty-state"><i>⌕</i><strong>没有匹配内容</strong><span>尝试更短的关键词或切换内容类型。</span></div>`;
    return;
  }
  target.innerHTML = reviewSearchResults.map((item) => `<article>
    <button type="button" class="review-search-main" data-review-open="${escapeHtml(item.entity_type)}:${item.id}">
      <i>${escapeHtml({ article: "POST", knowledge_node: "NODE", knowledge_column: "COL", document: "DOC", project: "PROJ" }[item.entity_type] || "ITEM")}</i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(item.visibility || "private")} ${item.status ? `· ${escapeHtml(item.status)}` : ""}</small><em>${escapeHtml(item.summary || item.slug || "暂无摘要")}</em></span>
      <b>打开 ›</b>
    </button>
    <button type="button" class="review-search-queue" data-review-quick-queue="${escapeHtml(item.entity_type)}:${item.id}">＋ 加入今日</button>
  </article>
  `).join("");
}

async function searchReviewWorkspace() {
  const query = document.querySelector("[data-review-search]")?.value.trim() || "";
  const type = document.querySelector("[data-review-search-type]")?.value || "";
  if (!query) {
    reviewSearchResults = [];
    const target = document.querySelector("[data-review-search-results]");
    if (target) target.innerHTML = `<div class="workspace-empty-state"><i>⌕</i><strong>搜索整个第二大脑</strong><span>后台检索包含私有内容、草稿和未发布知识。</span></div>`;
    return;
  }
  const response = await cmsRequest(`/admin/workspace/search?q=${encodeURIComponent(query)}&entity_type=${encodeURIComponent(type)}&limit=30`);
  reviewSearchResults = response.items || [];
  renderReviewSearchResults();
}

function renderReviewDashboard() {
  const statsTarget = document.querySelector("[data-review-stats]");
  const queueTarget = document.querySelector("[data-review-queue]");
  const recentTarget = document.querySelector("[data-review-recent]");
  const recommendationsTarget = document.querySelector("[data-review-recommendations]");
  const upcomingTarget = document.querySelector("[data-review-upcoming]");
  const summaryTarget = document.querySelector("[data-review-daily-summary]");
  if (!statsTarget || !queueTarget || !recentTarget || !recommendationsTarget || !upcomingTarget || !summaryTarget) return;
  const stats = reviewDashboard?.stats || {};
  const summary = reviewDashboard?.daily_summary || {};
  summaryTarget.innerHTML = `
    <div><span>TODAY · ${escapeHtml(summary.date || "")}</span><strong>今天，让知识重新进入工作。</strong><small>记录 ${summary.captured_today || 0} 条 · 修改 ${summary.changed_today || 0} 项 · 回顾 ${summary.reviewed_today || 0} 项</small></div>
    <div class="review-streak"><strong>${summary.review_streak || 0}</strong><span>连续回顾天数</span></div>
  `;
  statsTarget.innerHTML = [
    ["今日到期", stats.due || 0, "需要重新阅读"],
    ["已安排", stats.scheduled || 0, "进入回顾周期"],
    ["累计回顾", stats.reviewed || 0, "主动复习次数"],
    ["尚未回顾", stats.unreviewed || 0, "待建立记忆"],
  ].map(([label, value, note]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");

  const queue = reviewDashboard?.queue || [];
  document.querySelector("[data-review-queue-count]").textContent = `${queue.length} 项`;
  queueTarget.innerHTML = queue.length ? queue.map((item) => {
    const entity = item.entity || {};
    return `<article>
      <label class="review-row-select"><input type="checkbox" data-review-select="${item.entity_type}:${item.entity_id}" aria-label="选择 ${escapeHtml(entity.title || "未命名")}" /></label>
      <button type="button" class="review-item-main" data-review-open="${escapeHtml(item.entity_type)}:${item.entity_id}">
        <i>${escapeHtml(organizationTypeLabel(item.entity_type).slice(0, 1))}</i>
        <span><strong>${escapeHtml(entity.title || "未命名")}</strong><small>${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(reviewStatusLabel(item))}</small><em>${escapeHtml(entity.summary || entity.slug || "暂无摘要")}</em></span>
      </button>
      <div class="review-item-actions">
        <button type="button" data-review-action="reviewed:${item.entity_type}:${item.entity_id}:7">完成 · 7 天</button>
        <button type="button" class="secondary" data-review-action="snooze:${item.entity_type}:${item.entity_id}:1">明天再看</button>
        <button type="button" class="secondary" data-review-edit="${item.entity_type}:${item.entity_id}">设置</button>
      </div>
      <section class="review-item-editor" data-review-editor="${item.entity_type}:${item.entity_id}" hidden>
        <label>下次间隔<input type="number" min="1" max="365" value="${Number(item.interval_days) || 7}" data-review-editor-days />天</label>
        <label>回顾备注<input value="${escapeHtml(item.note || "")}" data-review-editor-note placeholder="记录理解、疑问或下次关注点" /></label>
        <button type="button" data-review-custom-action="reviewed:${item.entity_type}:${item.entity_id}">保存并完成</button>
        <button type="button" class="secondary" data-review-custom-action="snooze:${item.entity_type}:${item.entity_id}">仅安排时间</button>
      </section>
    </article>`;
  }).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>今日回顾已完成</strong><span>新的到期内容会自动出现在这里。</span></div>`;

  const reasonLabels = { contains: "同一专栏", references: "引用关系", related_to: "相关知识", content_similarity: "内容相似", highly_connected: "知识枢纽", uses: "使用关系", depends_on: "依赖关系" };
  const compactRows = (rows, mode = "recent") => rows.length ? rows.map((item) => `
    <button type="button" data-review-open="${escapeHtml(item.entity_type)}:${item.id}">
      <i>${escapeHtml(organizationTypeLabel(item.entity_type).slice(0, 1))}</i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${mode === "recommendation" ? `${escapeHtml(item.source_title || "知识网络")} · ${escapeHtml(reasonLabels[item.reason] || item.reason || "关联")}` : mode === "upcoming" ? `${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(reviewStatusLabel(item))}` : `${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(formatWorkspaceTime(item.updated_at))}`}</small></span>
      <b>›</b>
    </button>
  `).join("") : `<p class="empty">暂无内容。</p>`;
  recentTarget.innerHTML = compactRows(reviewDashboard?.recent || []);
  recommendationsTarget.innerHTML = compactRows(reviewDashboard?.recommendations || [], "recommendation");
  upcomingTarget.innerHTML = compactRows((reviewDashboard?.upcoming || []).map((item) => ({
    ...(item.entity || {}), entity_type: item.entity_type, id: item.entity_id,
    status: item.status, next_review_at: item.next_review_at,
  })), "upcoming");
  updateReviewSelectedCount();

  const badge = document.querySelector("[data-review-badge]");
  if (badge) {
    badge.textContent = stats.due || 0;
    badge.hidden = !stats.due;
  }
}

async function loadReviewDashboard() {
  reviewDashboard = await cmsRequest("/admin/workspace/review");
  renderReviewDashboard();
}

async function updateReviewEntity(action, entityType, entityId, intervalDays, note = "") {
  await cmsRequest(`/admin/workspace/review/${entityType}/${entityId}`, {
    method: "POST",
    body: JSON.stringify({ action, interval_days: Number(intervalDays) || 7, note }),
  });
  showToast(action === "reviewed" ? "已完成回顾并安排下次复习" : "已调整回顾时间");
  await loadReviewDashboard();
}

function selectedReviewTargets() {
  return [...document.querySelectorAll("[data-review-select]:checked")].map((input) => {
    const [entity_type, entity_id] = input.dataset.reviewSelect.split(":");
    return { entity_type, entity_id: Number(entity_id) };
  });
}

function updateReviewSelectedCount() {
  const selected = selectedReviewTargets();
  const target = document.querySelector("[data-review-selected-count]");
  if (target) target.textContent = `已选 ${selected.length} 项`;
  const selectAll = document.querySelector("[data-review-select-all]");
  const total = document.querySelectorAll("[data-review-select]").length;
  if (selectAll) {
    selectAll.checked = total > 0 && selected.length === total;
    selectAll.indeterminate = selected.length > 0 && selected.length < total;
  }
}

async function batchReviewEntities(action) {
  const targets = selectedReviewTargets();
  if (!targets.length) throw new Error("请先选择需要处理的内容");
  const intervalDays = Number(document.querySelector("[data-review-batch-days]")?.value) || 7;
  const response = await cmsRequest("/admin/workspace/review/batch", {
    method: "POST",
    body: JSON.stringify({ action, interval_days: intervalDays, note: "", targets }),
  });
  showToast(`已处理 ${response.updated || targets.length} 项内容`);
  await loadReviewDashboard();
}

function maintenancePriorityLabel(priority) {
  return { high: "高", medium: "中", low: "低" }[priority] || priority;
}

function maintenanceCategoryLabel(category) {
  return {
    organize: "待整理", content: "内容质量", relationship: "知识关系",
    review: "回顾", system: "系统",
  }[category] || category;
}

function maintenanceActionLabel(task) {
  return {
    organize: "开始整理", review: "立即回顾", relate: "建立关系",
    edit: "完善内容", repair: "检查文档", open: "打开",
  }[task.action] || "处理";
}

function renderMaintenanceTrend(report) {
  const target = document.querySelector("[data-maintenance-trend]");
  if (!target) return;
  const rows = report?.trend || [];
  const maximum = Math.max(1, ...rows.map((item) => item.total || 0));
  target.innerHTML = rows.map((item) => {
    const captured = Math.max(0, Number(item.captured) || 0);
    const reviewed = Math.max(0, Number(item.reviewed) || 0);
    const changed = Math.max(0, (Number(item.total) || 0) - captured - reviewed);
    const scale = 100 / maximum;
    return `<article title="${escapeHtml(item.date)} · 共 ${item.total || 0} 次活动">
      <div class="maintenance-bar">
        <i data-kind="changed" style="height:${Math.max(changed * scale, changed ? 4 : 0)}%"></i>
        <i data-kind="captured" style="height:${Math.max(captured * scale, captured ? 4 : 0)}%"></i>
        <i data-kind="reviewed" style="height:${Math.max(reviewed * scale, reviewed ? 4 : 0)}%"></i>
      </div>
      <span>${escapeHtml(item.date.slice(5))}</span>
    </article>`;
  }).join("");
}

function renderMaintenanceTasks() {
  const target = document.querySelector("[data-maintenance-tasks]");
  if (!target) return;
  const priority = document.querySelector("[data-maintenance-priority]")?.value || "";
  const category = document.querySelector("[data-maintenance-category]")?.value || "";
  const allTasks = maintenanceDashboard?.maintenance?.tasks || [];
  const tasks = allTasks.filter((task) => (!priority || task.priority === priority) && (!category || task.category === category));
  document.querySelector("[data-maintenance-task-count]").textContent = `${tasks.length} 项`;
  target.innerHTML = tasks.length ? tasks.map((task) => `
    <article>
      <i data-priority="${escapeHtml(task.priority)}">${escapeHtml(maintenancePriorityLabel(task.priority))}</i>
      <div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(maintenanceCategoryLabel(task.category))} · ${escapeHtml(task.reason)}</span></div>
      <button type="button" data-maintenance-task="${escapeHtml(task.id)}">${escapeHtml(maintenanceActionLabel(task))}</button>
    </article>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>当前筛选下没有维护任务</strong><span>知识系统处于清洁状态。</span></div>`;
}

function renderMaintenanceAiInbox() {
  const select = document.querySelector("[data-maintenance-ai-inbox]");
  if (!select) return;
  const pending = inboxItems.filter((item) => item.status !== "processed" && item.status !== "archived");
  const selected = select.value;
  select.innerHTML = pending.length
    ? `<option value="">选择一条记录</option>${pending.map((item) => `<option value="${item.id}">${escapeHtml(item.title || item.body.slice(0, 40) || "未命名记录")}</option>`).join("")}`
    : `<option value="">收件箱已整理完</option>`;
  if (pending.some((item) => String(item.id) === selected)) select.value = selected;
}

function renderMaintenanceAiSuggestion(payload) {
  const target = document.querySelector("[data-maintenance-ai-result]");
  if (!target) return;
  if (!payload?.suggestion) {
    target.innerHTML = `<div class="workspace-empty-state"><i>AI</i><strong>先选择一条记录</strong><span>建议不会自动写入或发布。</span></div>`;
    return;
  }
  const suggestion = payload.suggestion;
  const typeLabel = { knowledge: "知识节点", post: "文章", project: "项目", reading: "阅读记录" }[suggestion.entity_type] || suggestion.entity_type;
  target.innerHTML = `
    <div class="maintenance-ai-meta"><span>${escapeHtml(payload.model_applied ? "MODEL" : "LOCAL")}</span><em>${Math.round((suggestion.confidence || 0) * 100)}% 置信度</em></div>
    <h3>${escapeHtml(suggestion.title)}</h3>
    <p>${escapeHtml(suggestion.summary || "暂无摘要")}</p>
    <dl><div><dt>建议类型</dt><dd>${escapeHtml(typeLabel)}</dd></div><div><dt>标签</dt><dd>${escapeHtml((suggestion.tag_names || []).join(" · ") || "未识别")}</dd></div><div><dt>知识连接</dt><dd>${(suggestion.column_ids || []).length} 个专栏 · ${(suggestion.node_ids || []).length} 个节点</dd></div></dl>
    <ul>${(suggestion.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
    <small>${escapeHtml(payload.safety || "")}</small>
    <button type="button" data-maintenance-ai-apply>带入整理表单</button>
  `;
}

function renderKnowledgeOpportunities() {
  const target = document.querySelector("[data-maintenance-opportunities]");
  if (!target) return;
  const opportunities = maintenanceDashboard?.opportunities || {};
  const duplicates = opportunities.duplicates || [];
  const relations = opportunities.relations || [];
  const group = (title, rows, kind) => rows.length ? `
    <section>
      <h3>${escapeHtml(title)} <span>${rows.length}</span></h3>
      ${rows.slice(0, 6).map((item) => `
        <article>
          <div><strong>${escapeHtml(item.source_title)} <i>↔</i> ${escapeHtml(item.target_title)}</strong><span>${escapeHtml(item.reason)} · ${Math.round((item.score || 0) * 100)}%</span></div>
          <button type="button" data-maintenance-opportunity="${kind}:${item.source_id}:${item.target_id}">${kind === "relation" ? "确认关联" : "检查重复"}</button>
        </article>
      `).join("")}
    </section>
  ` : "";
  target.innerHTML = duplicates.length || relations.length
    ? `${group("疑似重复", duplicates, "duplicate")}${group("推荐关系", relations, "relation")}<small>已扫描 ${opportunities.scanned_nodes || 0} 个知识节点${opportunities.truncated ? "，仅分析最近更新的 250 个" : ""}</small>`
    : `<div class="workspace-empty-state"><i>✓</i><strong>没有发现明显问题</strong><span>当前节点之间没有高置信度的重复或缺失关系。</span></div>`;
}

function renderAiWorkflowDashboard() {
  const statsTarget = document.querySelector("[data-ai-workflow-stats]");
  const queueTarget = document.querySelector("[data-ai-workflow-queue]");
  if (!statsTarget || !queueTarget) return;
  const stats = aiWorkflowDashboard?.stats || {};
  const rows = [
    [stats.pending || 0, "待确认"],
    [`${Math.round((stats.adoption_rate || 0) * 100)}%`, "历史采用率"],
    [`${Math.round((stats.avg_confidence || 0) * 100)}%`, "平均置信度"],
    [`${Math.round((stats.tag_coverage || 0) * 100)}%`, "标签覆盖"],
    [`${Math.round((stats.relation_coverage || 0) * 100)}%`, "关系覆盖"],
    [`${Math.round((stats.avg_readiness || 0) * 100)}%`, "整理就绪度"],
  ];
  statsTarget.innerHTML = rows.map(([value, label]) => `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join("");
  const queue = aiWorkflowDashboard?.queue || [];
  queueTarget.innerHTML = queue.length ? queue.map((row) => {
    const item = row.item || {};
    const suggestion = row.suggestion || {};
    const typeLabel = { knowledge: "知识节点", post: "文章", project: "项目", reading: "阅读记录" }[suggestion.entity_type] || suggestion.entity_type;
    const connectionCount = (suggestion.column_ids || []).length + (suggestion.node_ids || []).length;
    return `<article>
      <div class="maintenance-workflow-source"><span>INBOX</span><strong>${escapeHtml(item.title || item.body?.slice(0, 50) || "未命名记录")}</strong><small>${escapeHtml(item.body?.slice(0, 90) || item.source_url || "暂无内容")}</small></div>
      <div class="maintenance-workflow-suggestion"><span>${escapeHtml(row.model_applied ? "MODEL" : "LOCAL")} · ${escapeHtml(typeLabel)} · ${Math.round((suggestion.confidence || 0) * 100)}%</span><strong>${escapeHtml(suggestion.title || "未命名建议")}</strong><small>${escapeHtml((suggestion.tag_names || []).join(" · ") || "暂无标签")} · ${connectionCount} 个知识连接</small></div>
      <div class="maintenance-workflow-row-actions"><button type="button" data-ai-workflow-adopt="${item.id}">采用</button><button type="button" class="secondary" data-ai-workflow-reject="${item.id}">忽略</button></div>
    </article>`;
  }).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>AI 整理队列已清空</strong><span>新的收件箱记录会自动进入下一轮分析。</span></div>`;
}

function renderMaintenanceDashboard() {
  if (!maintenanceDashboard) return;
  const report = maintenanceDashboard.report || {};
  const summary = report.summary || {};
  const maintenance = maintenanceDashboard.maintenance || {};
  const period = report.period || {};
  document.querySelector("[data-maintenance-period]").textContent = `${period.start || ""} 至 ${period.end || ""} · ${summary.active_days || 0} 个活跃日`;
  const stats = [
    [summary.captured || 0, "新记录", "进入收件箱"],
    [summary.created || 0, "新建内容", `${summary.touched_entities || 0} 项被触达`],
    [summary.reviewed || 0, "完成回顾", "重新进入工作记忆"],
    [maintenance.stats?.total || 0, "待维护", `${maintenance.stats?.high || 0} 项高优先级`],
  ];
  document.querySelector("[data-maintenance-stats]").innerHTML = stats.map(([value, label, note]) => `<article><strong>${value}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></article>`).join("");
  renderMaintenanceTrend(report);
  renderMaintenanceTasks();
  const focus = document.querySelector("[data-maintenance-focus]");
  const top = report.top_entities || [];
  focus.innerHTML = top.length ? top.map((item, index) => `<article><i>${index + 1}</i><span><strong>${escapeHtml(item.title)}</strong><small>${item.events} 次操作</small></span></article>`).join("") : `<div class="workspace-empty-state"><i>·</i><strong>本期暂无活动</strong><span>开始记录后会生成关注重点。</span></div>`;
  const badge = document.querySelector("[data-maintenance-badge]");
  if (badge) {
    badge.textContent = maintenance.stats?.high || 0;
    badge.hidden = !(maintenance.stats?.high || 0);
  }
  renderMaintenanceAiInbox();
  renderKnowledgeOpportunities();
  renderAiWorkflowDashboard();
}

async function loadMaintenanceDashboard() {
  const days = Number(document.querySelector("[data-maintenance-days]")?.value) || 7;
  if (!inboxItems.length) await loadInbox();
  maintenanceDashboard = await cmsRequest(`/admin/workspace/maintenance?days=${days}`);
  aiWorkflowDashboard = await cmsRequest("/admin/workspace/ai-workflow?limit=20");
  renderMaintenanceDashboard();
}

async function loadAiWorkflowDashboard() {
  aiWorkflowDashboard = await cmsRequest("/admin/workspace/ai-workflow?limit=20");
  renderAiWorkflowDashboard();
}

async function runBatchInboxSuggestions(mode = "local") {
  const current = aiWorkflowDashboard?.queue || [];
  const itemIds = current.slice(0, mode === "auto" ? 5 : 25).map((row) => row.item.id);
  if (!itemIds.length) throw new Error("当前没有待分析的收件箱记录");
  const target = document.querySelector("[data-ai-workflow-queue]");
  target.innerHTML = `<div class="workspace-empty-state"><i>AI</i><strong>正在批量分析 ${itemIds.length} 条记录</strong><span>${mode === "auto" ? "调用已配置模型并保留本地降级能力。" : "使用本地规则匹配类型、标签与知识连接。"}</span></div>`;
  const response = await cmsRequest("/admin/inbox/suggestions/batch", {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds, limit: itemIds.length, mode }),
  });
  aiWorkflowDashboard.queue = response.items || [];
  renderAiWorkflowDashboard();
  showToast(`已完成 ${response.processed || 0} 条整理建议`);
}

async function recordAiWorkflowDecision(payload, decision, note = "") {
  if (!payload?.item?.id || !payload?.suggestion) return;
  const suggestion = payload.suggestion;
  await cmsRequest("/admin/workspace/ai-workflow/decision", {
    method: "POST",
    body: JSON.stringify({
      item_id: payload.item.id,
      suggestion_id: `inbox:${payload.item.id}:${suggestion.slug || "suggestion"}`,
      decision,
      confidence: Number(suggestion.confidence) || 0,
      suggested_type: suggestion.entity_type || "knowledge",
      note,
    }),
  });
}

async function adoptAiWorkflowSuggestion(itemId) {
  const payload = (aiWorkflowDashboard?.queue || []).find((row) => row.item?.id === Number(itemId));
  if (!payload) return;
  activeInboxSuggestion = { ...payload, generator: "workflow", model_applied: false, safety: "建议仅用于预填充，必须由管理员确认后才能创建草稿。" };
  await applyInboxOrganizationSuggestion();
}

async function rejectAiWorkflowSuggestion(itemId) {
  const payload = (aiWorkflowDashboard?.queue || []).find((row) => row.item?.id === Number(itemId));
  if (!payload) return;
  await recordAiWorkflowDecision(payload, "rejected", "管理员在整理队列中忽略该建议");
  showToast("已记录忽略决定，后续质量统计会纳入本次反馈");
  await loadAiWorkflowDashboard();
}

async function runInboxOrganizationSuggestion() {
  const itemId = Number(document.querySelector("[data-maintenance-ai-inbox]")?.value);
  if (!itemId) throw new Error("请先选择一条待整理记录");
  const target = document.querySelector("[data-maintenance-ai-result]");
  target.innerHTML = `<div class="workspace-empty-state"><i>AI</i><strong>正在分析内容</strong><span>匹配类型、标签、专栏与知识节点。</span></div>`;
  activeInboxSuggestion = await cmsRequest(`/admin/inbox/${itemId}/suggest`, { method: "POST" });
  renderMaintenanceAiSuggestion(activeInboxSuggestion);
}

async function applyInboxOrganizationSuggestion() {
  const payload = activeInboxSuggestion;
  if (!payload?.suggestion) return;
  const suggestion = payload.suggestion;
  await recordAiWorkflowDecision(payload, "adopted", "管理员采用建议并带入整理表单");
  await navigateAdminRoute("inbox");
  openInboxOrganizer(payload.item.id);
  document.querySelector("[data-inbox-target-type]").value = suggestion.entity_type || "knowledge";
  document.querySelector("[data-inbox-target-title]").value = suggestion.title || "";
  document.querySelector("[data-inbox-target-slug]").value = suggestion.slug || slugify(suggestion.title || "");
  document.querySelector("[data-inbox-target-summary]").value = suggestion.summary || "";
  document.querySelector("[data-inbox-target-tags]").value = (suggestion.tag_names || []).join(", ");
  document.querySelector("[data-inbox-target-visibility]").value = "private";
  document.querySelector("[data-inbox-target-node-type]").value = suggestion.node_type || "concept";
  document.querySelectorAll("[data-inbox-target-columns] input").forEach((input) => {
    input.checked = (suggestion.column_ids || []).includes(Number(input.value));
  });
  document.querySelectorAll("[data-inbox-target-nodes] input").forEach((input) => {
    input.checked = (suggestion.node_ids || []).includes(Number(input.value));
  });
  const primary = document.querySelector("[data-inbox-target-primary-column]");
  primary.value = suggestion.primary_column_id || "";
  updateInboxOrganizerMode();
  document.querySelector("[data-inbox-organize-status]").textContent = "AI 建议已带入，请确认后再创建草稿。";
  document.querySelector("[data-inbox-organizer]").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleMaintenanceTask(taskId) {
  const task = maintenanceDashboard?.maintenance?.tasks?.find((item) => item.id === taskId);
  if (!task) return;
  if (task.action === "organize") {
    await navigateAdminRoute("inbox");
    openInboxOrganizer(task.entity_id);
    return;
  }
  if (task.action === "review") {
    if (task.entity_type && task.entity_id) {
      await updateReviewEntity("queue", task.entity_type, task.entity_id, 1, "由维护清单加入今日回顾");
    }
    await navigateAdminRoute("review");
    return;
  }
  if (task.entity_type && task.entity_id) await openWorkspaceEntity(task.entity_type, task.entity_id);
  else if (task.route) await navigateAdminRoute(task.route);
}

async function handleKnowledgeOpportunity(value) {
  const [kind, sourceIdValue, targetIdValue] = value.split(":");
  const sourceId = Number(sourceIdValue);
  const targetId = Number(targetIdValue);
  const opportunities = maintenanceDashboard?.opportunities || {};
  const rows = kind === "relation" ? opportunities.relations || [] : opportunities.duplicates || [];
  const item = rows.find((candidate) => candidate.source_id === sourceId && candidate.target_id === targetId);
  if (!item) return;
  if (kind === "duplicate") {
    showToast(`请对比“${item.source_title}”与“${item.target_title}”后决定是否合并`);
    await openWorkspaceEntity("knowledge_node", sourceId);
    return;
  }
  await cmsRequest("/admin/knowledge-relations", {
    method: "POST",
    body: JSON.stringify({
      source_node_id: sourceId,
      target_node_id: targetId,
      relation_type: item.relation_type || "related_to",
      relation_label: "AI 辅助发现",
      description: item.reason || "由知识维护工作流推荐",
      weight: Math.max(0.1, Math.min(10, Number(item.score) || 1)),
      direction: "bidirectional",
      is_active: true,
      is_public: item.is_public === true,
    }),
  });
  showToast(`已建立“${item.source_title}”与“${item.target_title}”的关系`);
  await loadMaintenanceDashboard();
  await loadKnowledgeGraphData();
}

function maintenanceReportText() {
  const report = maintenanceDashboard?.report;
  const maintenance = maintenanceDashboard?.maintenance;
  if (!report || !maintenance) return "";
  return [
    `第二大脑周报（${report.period.start} 至 ${report.period.end}）`,
    `活跃 ${report.summary.active_days} 天，记录 ${report.summary.captured} 条，新建 ${report.summary.created} 项，修改 ${report.summary.changed} 项，回顾 ${report.summary.reviewed} 项。`,
    `当前维护任务 ${maintenance.stats.total} 项，其中高优先级 ${maintenance.stats.high} 项、孤立内容 ${maintenance.stats.orphans} 项、待整理收件 ${maintenance.stats.inbox} 项。`,
    `本期重点：${(report.top_entities || []).map((item) => `${item.title}（${item.events}）`).join("、") || "暂无"}`,
  ].join("\n");
}

function renderActivity() {
  const target = document.querySelector("[data-activity-list]");
  if (!target) return;
  const labels = { captured: "记录", created: "创建", updated: "更新", published: "发布", archived: "归档", trashed: "移至回收站", restored: "恢复", promoted: "整理" };
  target.innerHTML = activityEvents.length ? activityEvents.map((event) => `
    <article><i></i><time>${escapeHtml(formatWorkspaceTime(event.created_at))}</time><div><strong>${escapeHtml(labels[event.action] || event.action)} · ${escapeHtml(event.entity_title || "未命名")}</strong><span>${escapeHtml(entityLabels[event.entity_type] || event.entity_type)} · ${escapeHtml(event.actor_email || "system")}</span></div></article>
  `).join("") : `<div class="workspace-empty-state"><i>◷</i><strong>暂无活动记录</strong><span>新建、修改、发布和恢复操作会记录在这里。</span></div>`;
}

async function loadActivity() {
  activityEvents = await cmsRequest("/admin/activity?limit=100");
  renderActivity();
}

function renderTrash() {
  const target = document.querySelector("[data-trash-list]");
  if (!target) return;
  target.innerHTML = trashItems.length ? trashItems.map((item) => `
    <article class="trash-row"><i>⌫</i><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(entityLabels[item.entity_type] || item.entity_type)} · 删除于 ${escapeHtml(formatWorkspaceTime(item.deleted_at))}</span></div><button type="button" data-trash-restore="${item.entity_type}:${item.id}">恢复</button></article>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>回收站为空</strong><span>删除的内容会安全保留在这里。</span></div>`;
}

async function loadTrash() {
  trashItems = await cmsRequest("/admin/trash");
  renderTrash();
  await loadWorkspaceOverview();
}

async function restoreTrashItem(value) {
  const [entityType, entityId] = value.split(":");
  await cmsRequest(`/admin/trash/${entityType}/${entityId}/restore`, { method: "POST" });
  showToast("内容已恢复");
  await loadTrash();
  await loadEntries();
  await loadKnowledgeGraphData();
  await loadDocuments();
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

function renderEditorReadiness(listSelector, summarySelector, checks) {
  const list = document.querySelector(listSelector);
  const summary = document.querySelector(summarySelector);
  if (!list || !summary) return;
  const ready = checks.filter((item) => item.ready).length;
  summary.textContent = `${ready} / ${checks.length}`;
  list.innerHTML = checks.map((item) => `<li class="${item.ready ? "is-ready" : ""}">${escapeHtml(item.label)}</li>`).join("");
}

function setEditorStatus(selector, message, state = "idle") {
  const target = document.querySelector(selector);
  if (!target) return;
  target.textContent = message;
  target.dataset.state = state;
}

function filterRelationChoices(selector, query) {
  const normalized = String(query || "").trim().toLowerCase();
  document.querySelectorAll(`${selector} label`).forEach((label) => {
    label.classList.toggle("is-filtered", Boolean(normalized) && !label.textContent.toLowerCase().includes(normalized));
  });
}

function emptyKnowledgeNode() {
  return { id: null, title: "", slug: "", summary: "", content_markdown: "", node_type: "concept", importance: 3, visibility: "public", allow_ai_search: true, revision: 1, tag_names: [], column_ids: [], primary_column_id: null, article_ids: [] };
}

function setKnowledgeNodeForm(node = emptyKnowledgeNode()) {
  nodeEditorHydrating = true;
  window.clearTimeout(nodeAutosaveTimer);
  nodeAutosaveDirty = false;
  activeKnowledgeNode = node;
  nodeEnhancement = null;
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
  document.querySelector("[data-node-shell-title]").textContent = node.title || "新知识节点";
  document.querySelector("[data-node-shell-visibility]").textContent = (node.visibility || "public").toUpperCase();
  document.querySelector("[data-node-link-search]").value = "";
  document.querySelector("[data-node-version-diff]").hidden = true;
  setEditorStatus("[data-node-save-status]", node.id ? `已保存 · r${node.revision || 1}` : "尚未保存", node.id ? "saved" : "idle");
  renderKnowledgeNodeReadiness();
  renderContentEnhancement("node");
  nodeEditorHydrating = false;
}

function renderKnowledgeNodeReadiness() {
  let payload;
  try { payload = readKnowledgeNodeForm(); } catch { payload = emptyKnowledgeNode(); }
  renderEditorReadiness("[data-node-readiness]", "[data-node-readiness-summary]", [
    { label: "标题与 URL 标识", ready: Boolean(payload.title && payload.slug) },
    { label: "摘要不少于 20 字", ready: payload.summary.length >= 20 },
    { label: "正文不少于 80 字", ready: payload.content_markdown.trim().length >= 80 },
    { label: "至少属于一个专栏", ready: payload.column_ids.length > 0 },
    { label: "已有标签或关联文章", ready: payload.tag_names.length > 0 || payload.article_ids.length > 0 },
    { label: "公开节点允许 AI 检索", ready: payload.visibility !== "public" || payload.allow_ai_search },
  ]);
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
  target.innerHTML = versions.length ? versions.map((version) => `<article><div><strong>${escapeHtml(version.reason)}</strong><span>${escapeHtml(formatDateTime(version.created_at))} · ${escapeHtml(version.created_by_email || "system")}</span></div><div class="version-actions"><button type="button" data-node-version-diff="${version.id}">查看差异</button><button type="button" data-node-version-restore="${version.id}">恢复</button></div></article>`).join("") : `<p class="empty">暂无版本。</p>`;
}

async function loadKnowledgeNodeVersionDiff(versionId) {
  const diff = await cmsRequest(`/admin/knowledge-nodes/versions/${versionId}/diff`);
  const target = document.querySelector("[data-node-version-diff]");
  target.textContent = `变更字段：${(diff.changed_fields || []).join("、") || "无字段变化"}\n\n${diff.content_diff || "正文没有变化。"}`;
  target.hidden = false;
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
  nodeAutosaveDirty = false;
  setEditorStatus("[data-node-save-status]", `已保存 · r${activeKnowledgeNode.revision || 1}`, "saved");
  showToast("知识节点已保存并记录版本");
  await loadKnowledgeGraphData();
}

function scheduleKnowledgeNodeAutosave() {
  if (nodeEditorHydrating || !cmsToken) return;
  renderKnowledgeNodeReadiness();
  document.querySelector("[data-node-shell-title]").textContent = document.querySelector("[data-node-title]").value.trim() || "新知识节点";
  document.querySelector("[data-node-shell-visibility]").textContent = document.querySelector("[data-node-visibility]").value.toUpperCase();
  if (!activeKnowledgeNode?.id) {
    setEditorStatus("[data-node-save-status]", "先保存以创建节点", "dirty");
    return;
  }
  setEditorStatus("[data-node-save-status]", "有未保存修改", "dirty");
  nodeAutosaveDirty = true;
  window.clearTimeout(nodeAutosaveTimer);
  nodeAutosaveTimer = window.setTimeout(() => guarded(performKnowledgeNodeAutosave), 2400);
}

async function performKnowledgeNodeAutosave() {
  if (!activeKnowledgeNode?.id || nodeAutosaveInFlight || !nodeAutosaveDirty) return;
  const payload = readKnowledgeNodeForm();
  if (!payload.title) return;
  nodeAutosaveInFlight = true;
  setEditorStatus("[data-node-save-status]", "正在自动保存…", "saving");
  try {
    activeKnowledgeNode = await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}`, {
      method: "PATCH", body: JSON.stringify(payload),
    });
    nodeAutosaveDirty = false;
    setEditorStatus("[data-node-save-status]", `已自动保存 · r${activeKnowledgeNode.revision || 1}`, "saved");
    const note = document.querySelector("[data-node-version-note]");
    if (note) note.textContent = `revision ${activeKnowledgeNode.revision || 1}`;
  } finally {
    nodeAutosaveInFlight = false;
  }
}

async function deleteKnowledgeNode() {
  if (!activeKnowledgeNode?.id || !confirm(`将「${activeKnowledgeNode.title}」移至回收站？节点内容、关系和版本都会保留。`)) return;
  await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}`, { method: "DELETE" });
  activeKnowledgeNode = null;
  showToast("知识节点已移至回收站");
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

function emptyEvalSuite() {
  return {
    id: null, name: "", slug: "", eval_type: "rag", description: "", is_active: true, version: 1,
    cases: [{ id: "case-1", question: "", expected_terms: [], expected_slugs: [] }],
  };
}

function setEvalSuiteForm(suite = emptyEvalSuite()) {
  activeEvalSuite = suite;
  document.querySelector("[data-eval-name]").value = suite.name || "";
  document.querySelector("[data-eval-slug]").value = suite.slug || "";
  document.querySelector("[data-eval-type]").value = suite.eval_type || "rag";
  document.querySelector("[data-eval-description]").value = suite.description || "";
  document.querySelector("[data-eval-active]").checked = suite.is_active !== false;
  document.querySelector("[data-eval-cases]").value = JSON.stringify(suite.cases || [], null, 2);
  document.querySelector("[data-eval-version]").textContent = suite.id ? `固定样本 v${suite.version} · ${suite.case_count || suite.cases?.length || 0} 条` : "新评测集";
  document.querySelector("[data-eval-run-local]").disabled = !suite.id;
  document.querySelector("[data-eval-run-auto]").disabled = !suite.id || suite.eval_type !== "agent";
  renderEvaluationDashboard();
}

function readEvalSuiteForm() {
  const casesInput = document.querySelector("[data-eval-cases]");
  const cases = parseArrayJson(casesInput.value, null);
  if (!cases?.length) {
    casesInput.classList.add("is-invalid");
    throw new Error("固定样本必须是至少包含一条记录的 JSON 数组");
  }
  casesInput.classList.remove("is-invalid");
  const name = document.querySelector("[data-eval-name]").value.trim();
  return {
    name,
    slug: document.querySelector("[data-eval-slug]").value.trim() || slugify(name),
    eval_type: document.querySelector("[data-eval-type]").value,
    description: document.querySelector("[data-eval-description]").value.trim(),
    cases,
    is_active: document.querySelector("[data-eval-active]").checked,
  };
}

function evalPrimaryMetric(run) {
  const metrics = run.metrics || {};
  return run.eval_type === "rag" ? `MRR ${metrics.mrr ?? 0}` : `成功率 ${Math.round((Number(metrics.success_rate) || 0) * 100)}%`;
}

function renderEvaluationDashboard(payload = evaluationDashboard) {
  const statsTarget = document.querySelector("[data-eval-stats]");
  const suitesTarget = document.querySelector("[data-eval-suite-list]");
  const historyTarget = document.querySelector("[data-eval-history]");
  if (!statsTarget || !suitesTarget || !historyTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    suitesTarget.innerHTML = `<p class="empty">登录后加载固定评测集。</p>`;
    historyTarget.innerHTML = `<p class="empty">运行评测后显示历史与回归结论。</p>`;
    return;
  }
  const stats = payload.stats || {};
  statsTarget.innerHTML = [
    ["评测集", stats.suites || 0, `${stats.active_suites || 0} 个启用`],
    ["固定样本", stats.cases || 0, "版本化保存"],
    ["历史运行", stats.runs || 0, "可重复对比"],
    ["当前回退", stats.regressions || 0, stats.regressions ? "需要检查" : "未发现回退"],
  ].map(([label, value, note]) => `<article><span>${label}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  suitesTarget.innerHTML = (payload.suites || []).map((suite) => `
    <button type="button" data-eval-suite-id="${suite.id}" class="${activeEvalSuite?.id === suite.id ? "is-active" : ""}">
      <i>${suite.eval_type === "rag" ? "R" : "A"}</i>
      <span><strong>${escapeHtml(suite.name)}</strong><small>${escapeHtml(suite.eval_type.toUpperCase())} · v${suite.version} · ${suite.case_count} 条</small></span>
      <em>${suite.is_active ? "启用" : "停用"}</em>
    </button>
  `).join("") || `<p class="empty">暂无评测集。</p>`;
  historyTarget.innerHTML = (payload.runs || []).length ? `
    <header><strong>运行历史</strong><span>同一评测集、同一模式自动与上一次比较</span></header>
    ${(payload.runs || []).map((run) => {
      const regression = run.regression || {};
      const statusLabel = { baseline: "基线", stable: "稳定", improved: "提升", regressed: "回退" }[regression.status] || regression.status;
      return `<button type="button" data-eval-run-id="${run.id}" class="is-${escapeHtml(regression.status || "baseline")}">
        <span>${escapeHtml(run.eval_type.toUpperCase())} · ${escapeHtml(run.mode)} · suite v${run.suite_version}</span>
        <strong>${escapeHtml(evalPrimaryMetric(run))}</strong>
        <em>${escapeHtml(statusLabel || "基线")} ${regression.delta ? `${regression.delta > 0 ? "+" : ""}${regression.delta}` : ""}</em>
        <time>${escapeHtml(formatDateTime(run.created_at))} · ${escapeHtml(run.duration_ms)}ms</time>
      </button>`;
    }).join("")}
  ` : `<p class="empty">运行评测后显示历史与回归结论。</p>`;
}

async function loadEvaluationDashboard() {
  evaluationDashboard = await cmsRequest("/admin/evaluation/dashboard");
  if (!activeEvalSuite?.id) activeEvalSuite = evaluationDashboard.suites?.[0] || emptyEvalSuite();
  else activeEvalSuite = evaluationDashboard.suites.find((suite) => suite.id === activeEvalSuite.id) || evaluationDashboard.suites?.[0] || emptyEvalSuite();
  setEvalSuiteForm(activeEvalSuite);
}

async function saveEvalSuite() {
  const payload = readEvalSuiteForm();
  const path = activeEvalSuite?.id ? `/admin/evaluation/suites/${activeEvalSuite.id}` : "/admin/evaluation/suites";
  const saved = await cmsRequest(path, { method: activeEvalSuite?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  activeEvalSuite = saved;
  await loadEvaluationDashboard();
  showToast(`评测集已保存为 v${saved.version}`);
}

async function runEvaluationSuite(mode = "local") {
  if (!activeEvalSuite?.id) throw new Error("请先保存评测集");
  const button = document.querySelector(mode === "auto" ? "[data-eval-run-auto]" : "[data-eval-run-local]");
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "评测运行中…";
  try {
    const result = await cmsRequest(`/admin/evaluation/suites/${activeEvalSuite.id}/run`, {
      method: "POST", body: JSON.stringify({ mode, limit: 5, published_only: true }),
    });
    await loadEvaluationDashboard();
    renderEvaluationRunDetail(result);
    showToast(`评测完成：${evalPrimaryMetric(result)}`);
  } finally {
    button.textContent = original;
    button.disabled = mode === "auto" && activeEvalSuite?.eval_type !== "agent";
  }
}

function renderEvaluationRunDetail(run) {
  const target = document.querySelector("[data-eval-run-detail]");
  if (!target) return;
  const cases = run.result?.cases || [];
  const comparisons = run.result?.comparisons || [];
  target.hidden = false;
  target.innerHTML = `
    <header><div><span>RUN #${escapeHtml(run.id)} · ${escapeHtml(run.suite?.name || "")}</span><h3>${escapeHtml(evalPrimaryMetric(run))}</h3></div><button type="button" data-eval-detail-close>关闭</button></header>
    ${comparisons.length ? `<div class="evaluation-comparisons">${comparisons.map((item, index) => `<article class="${index === 0 ? "is-best" : ""}"><span>${index === 0 ? "BEST" : "CONFIG"}</span><strong>${escapeHtml(item.name)}</strong><small>MRR ${escapeHtml(item.stats?.mrr ?? 0)} · Top1 ${Math.round((Number(item.stats?.top1_hit_rate) || 0) * 100)}%</small></article>`).join("")}</div>` : ""}
    <div class="evaluation-case-results">${cases.map((item) => `<article class="${item.success === false || item.expected_hit === false ? "is-failed" : ""}"><span>${escapeHtml(item.id || "case")}</span><strong>${escapeHtml(item.question || item.goal)}</strong><small>${item.expected_hit === false ? "未命中期望来源" : item.success === false ? `失败：${escapeHtml((item.missing_tools || []).join("、") || "质量门槛")}` : "通过"}</small></article>`).join("")}</div>
  `;
}

async function loadEvaluationRun(runId) {
  renderEvaluationRunDetail(await cmsRequest(`/admin/evaluation/runs/${runId}`));
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

function renderProactiveDashboard(payload = proactiveDashboard) {
  const statsTarget = document.querySelector("[data-proactive-stats]");
  const taskTarget = document.querySelector("[data-proactive-tasks]");
  const memoryTarget = document.querySelector("[data-memory-list]");
  if (!statsTarget || !taskTarget || !memoryTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    taskTarget.innerHTML = `<p class="empty">登录 CMS 后生成今日任务。</p>`;
    memoryTarget.innerHTML = `<p class="empty">暂无长期记忆。</p>`;
    return;
  }
  const stats = payload.stats || {};
  statsTarget.innerHTML = [
    ["待处理", stats.open_tasks || 0], ["高优先级", stats.high_priority || 0],
    ["记忆候选", stats.memory_candidates || 0], ["已确认", stats.active_memories || 0],
    ["公开上下文", stats.public_memories || 0],
  ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
  taskTarget.innerHTML = (payload.tasks || []).length ? payload.tasks.map((task) => `
    <article class="proactive-task is-${escapeHtml(task.priority)}">
      <div><span>${escapeHtml(task.priority)} · ${escapeHtml(task.task_type)}</span><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.description || "")}</p></div>
      <div class="actions left"><button type="button" data-proactive-task="${task.id}:completed">完成</button><button type="button" class="secondary" data-proactive-task="${task.id}:dismissed">忽略</button></div>
    </article>`).join("") : `<p class="empty success">今天没有待处理任务。</p>`;
  memoryTarget.innerHTML = (payload.memories || []).length ? payload.memories.map((memory) => `
    <article class="memory-item is-${escapeHtml(memory.status)}">
      <div><span>${escapeHtml(memory.memory_type)} · ${escapeHtml(memory.visibility)} · ${escapeHtml(memory.status)}</span><strong>${escapeHtml(memory.title)}</strong><p>${escapeHtml(memory.content)}</p></div>
      <div class="actions left">
        ${memory.status === "candidate" ? `<button type="button" data-memory-action="${memory.id}:active:${memory.visibility}">确认</button>` : ""}
        ${memory.status === "active" ? `<button type="button" class="secondary" data-memory-action="${memory.id}:archived:${memory.visibility}">归档</button>` : ""}
        ${memory.status !== "archived" ? `<button type="button" class="secondary" data-memory-action="${memory.id}:${memory.status}:${memory.visibility === "public" ? "private" : "public"}">${memory.visibility === "public" ? "设为私有" : "允许公开"}</button>` : ""}
      </div>
    </article>`).join("") : `<p class="empty">暂无长期记忆。</p>`;
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

function safePreviewUrl(value, kind = "link") {
  const raw = String(value || "").trim();
  if (!raw) return kind === "image" ? "" : "#";
  if (/^(#|\/|\.\/|\.\.\/)/.test(raw)) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    const allowed = kind === "image" ? ["http:", "https:"] : ["http:", "https:", "mailto:"];
    return allowed.includes(parsed.protocol) ? raw : (kind === "image" ? "" : "#");
  } catch {
    return kind === "image" ? "" : "#";
  }
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
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        const safe = safePreviewUrl(url, "image");
        return safe ? `<img alt="${alt}" src="${escapeHtml(safe)}" />` : alt;
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${escapeHtml(safePreviewUrl(url))}" target="_blank" rel="noreferrer">${label}</a>`)
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
  const enhancement = document.querySelector("[data-entry-enhancement-panel]");
  if (enhancement) enhancement.hidden = activeEntityType !== "post";
}

const enhancementFieldLabels = {
  summary: "摘要",
  tags: "标签",
  seo_title: "SEO 标题",
  seo_description: "SEO 描述",
  related_articles: "关联文章",
  related_nodes: "关联知识节点",
};

function enhancementValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" ? item.title || item.id : item)).filter(Boolean).join(" · ") || "无";
  }
  return String(value || "无");
}

function renderContentEnhancement(kind) {
  const payload = kind === "node" ? nodeEnhancement : articleEnhancement;
  const target = document.querySelector(`[data-${kind}-enhancement-result]`);
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">${kind === "node" ? "先保存节点，再生成增强建议。" : "保存文章后，可以生成字段级建议。"}</p>`;
    return;
  }
  const changed = (payload.fields || []).filter((field) => field.changed);
  target.innerHTML = `
    <div class="ai-enhancement-meta"><span>${escapeHtml(payload.model_applied ? "MODEL" : "LOCAL")}</span><span>基于 revision ${escapeHtml(payload.revision)}</span><span>${changed.length} 个字段可优化</span></div>
    <div class="ai-enhancement-fields">
      ${(payload.fields || []).map((field) => `
        <label class="ai-enhancement-field ${field.changed ? "is-changed" : ""}">
          <input type="checkbox" data-enhancement-field="${escapeHtml(field.field)}" ${field.changed ? "checked" : ""} ${field.changed ? "" : "disabled"} />
          <span class="ai-enhancement-field-name">${escapeHtml(enhancementFieldLabels[field.field] || field.field)}</span>
          <div><small>当前</small><p>${escapeHtml(enhancementValue(field.current))}</p></div>
          <i>→</i>
          <div><small>建议</small><p>${escapeHtml(enhancementValue(field.proposed))}</p></div>
        </label>
      `).join("")}
    </div>
    <div class="ai-enhancement-footer"><small>${escapeHtml(payload.safety || "必须确认后才会写入。")}</small><button type="button" data-${kind}-enhancement-apply ${changed.length ? "" : "disabled"}>应用已选字段</button></div>
  `;
}

async function suggestContentEnhancement(kind, mode = "local") {
  const entity = kind === "node" ? activeKnowledgeNode : activeEntry;
  if (!entity?.id || (kind === "entry" && activeEntityType !== "post")) {
    throw new Error(kind === "node" ? "请先保存知识节点" : "请先保存文章");
  }
  const target = document.querySelector(`[data-${kind}-enhancement-result]`);
  target.innerHTML = `<p class="empty">正在${mode === "auto" ? "调用模型" : "分析内容"}…</p>`;
  const path = kind === "node"
    ? `/admin/knowledge-nodes/${entity.id}/enhancement/suggest`
    : `/admin/articles/${entity.id}/enhancement/suggest`;
  const payload = await cmsRequest(path, { method: "POST", body: JSON.stringify({ mode }) });
  if (kind === "node") nodeEnhancement = payload;
  else articleEnhancement = payload;
  renderContentEnhancement(kind);
}

async function applyContentEnhancement(kind) {
  const payload = kind === "node" ? nodeEnhancement : articleEnhancement;
  const entity = kind === "node" ? activeKnowledgeNode : activeEntry;
  if (!payload || !entity?.id) return;
  const panel = document.querySelector(`[data-${kind}-enhancement-panel]`);
  const selectedFields = [...panel.querySelectorAll("[data-enhancement-field]:checked")].map((input) => input.dataset.enhancementField);
  if (!selectedFields.length) throw new Error("请至少选择一个需要应用的字段");
  const path = kind === "node"
    ? `/admin/knowledge-nodes/${entity.id}/enhancement/apply`
    : `/admin/articles/${entity.id}/enhancement/apply`;
  const result = await cmsRequest(path, {
    method: "POST",
    body: JSON.stringify({ expected_revision: payload.revision, selected_fields: selectedFields, proposal: payload.proposal }),
  });
  if (kind === "node") {
    activeKnowledgeNode = result.node;
    const index = knowledgeNodes.findIndex((item) => item.id === result.node.id);
    if (index >= 0) knowledgeNodes[index] = result.node;
    setKnowledgeNodeForm(result.node);
    renderKnowledgeNodeList();
    await loadKnowledgeNodeVersions();
  } else {
    activeEntry = result.article;
    const index = cmsEntries.findIndex((item) => item.id === result.article.id);
    if (index >= 0) cmsEntries[index] = result.article;
    setEntryForm(result.article);
    renderEntryList();
    await loadVersions();
  }
  showToast(`已应用 ${selectedFields.length} 个增强字段`);
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
  articleEnhancement = null;
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
  renderContentEnhancement("entry");
  renderMarkdownPreview();
  document.querySelector("[data-entry-shell-kind]").textContent = (entityLabels[displayedEntry.entity_type] || "CONTENT").toUpperCase();
  document.querySelector("[data-entry-shell-title]").textContent = displayedEntry.title || `新${entityLabels[displayedEntry.entity_type] || "内容"}`;
  document.querySelector("[data-entry-shell-visibility]").textContent = (displayedEntry.visibility || "public").toUpperCase();
  renderEntryReadiness();
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

function entryReadinessChecks(payload = readEntryForm()) {
  const metadata = parseJson(payload.metadata_json, {});
  const keywords = metadata[keywordKeys[activeEntityType] || "tags"] || [];
  const checks = [
    { label: "标题与 URL 标识", ready: Boolean(payload.title && payload.slug) },
    { label: "摘要不少于 30 字", ready: payload.summary.length >= 30 },
    { label: "正文不少于 120 字", ready: payload.content_md.trim().length >= 120 },
    { label: "至少设置一个标签", ready: keywords.length > 0 },
    { label: "可见性已确认", ready: ["public", "unlisted", "private"].includes(payload.visibility) },
  ];
  if (activeEntityType === "post") {
    checks.push(
      { label: "已设置文章封面", ready: Boolean(metadata.cover) },
      { label: "已设置 SEO 描述", ready: Boolean(metadata.seoDescription || payload.summary.length >= 50) },
      { label: "至少属于一个专栏", ready: (metadata.columnIds || []).length > 0 },
    );
  } else {
    checks.push({ label: "已有内容关联", ready: (metadata.relatedProjects || []).length > 0 || keywords.length > 1 });
  }
  return checks;
}
function renderEntryReadiness() {
  try {
    renderEditorReadiness("[data-entry-readiness]", "[data-entry-readiness-summary]", entryReadinessChecks());
  } catch {
    renderEditorReadiness("[data-entry-readiness]", "[data-entry-readiness-summary]", [
      { label: "修正编辑器中的格式错误", ready: false },
    ]);
  }
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

async function loadProactiveDashboard(refresh = false) {
  proactiveDashboard = await cmsRequest(`/admin/proactive/dashboard?refresh=${refresh ? "true" : "false"}`);
  renderProactiveDashboard();
}

async function updateProactiveTask(value) {
  const [id, status] = String(value || "").split(":");
  await cmsRequest(`/admin/proactive/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  showToast(status === "completed" ? "任务已完成" : "任务已忽略");
  await loadProactiveDashboard(false);
}

async function createLongTermMemory(event) {
  event.preventDefault();
  await cmsRequest("/admin/long-term-memories", {
    method: "POST",
    body: JSON.stringify({
      title: document.querySelector("[data-memory-title]").value.trim(),
      content: document.querySelector("[data-memory-content]").value.trim(),
      memory_type: document.querySelector("[data-memory-type]").value,
      visibility: document.querySelector("[data-memory-visibility]").value,
      status: "candidate",
    }),
  });
  event.currentTarget.reset();
  showToast("已加入记忆候选，确认后才会生效");
  await loadProactiveDashboard(false);
}

async function updateLongTermMemory(value) {
  const [id, status, visibility] = String(value || "").split(":");
  await cmsRequest(`/admin/long-term-memories/${id}`, { method: "PATCH", body: JSON.stringify({ status, visibility }) });
  showToast(status === "active" ? "长期记忆已确认" : "长期记忆已更新");
  await loadProactiveDashboard(false);
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
  await loadWorkspaceOverview();
  await loadInbox();
  await loadActivity();
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
  const missing = entryReadinessChecks().filter((item) => !item.ready);
  if (missing.length && !confirm(`还有 ${missing.length} 项发布准备未完成：\n\n${missing.map((item) => `· ${item.label}`).join("\n")}\n\n仍然继续发布吗？`)) return;
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
  if (!confirm(`确定将「${activeEntry.title}」移至回收站吗？之后可以恢复。`)) return;
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}` : `/admin/entries/${activeEntry.id}`;
  await cmsRequest(path, { method: "DELETE" });
  activeEntry = null;
  showToast("已移至回收站");
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
  document.querySelector("[data-entry-shell-title]").textContent = document.querySelector("[data-entry-title]").value.trim() || `新${entityLabels[activeEntityType] || "内容"}`;
  document.querySelector("[data-entry-shell-visibility]").textContent = document.querySelector("[data-entry-visibility]").value.toUpperCase();
  renderEntryReadiness();
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

async function save() {
  if (!cmsToken) throw new Error("请先登录服务器后台");
  await cmsRequest("/admin/site", {
    method: "POST",
    body: JSON.stringify({ data: state }),
  });
  showToast("站点设置已保存到服务器");
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
    ...(options.headers || {}),
  };
  const response = await fetch(`${cmsApiBase()}${path}`, { ...options, headers, credentials: "include" });
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
    if (response.status === 401) {
      cmsToken = "";
      currentCmsUser = null;
      setCmsStatus("登录已失效");
    }
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
  documentEditorHydrating = true;
  window.clearTimeout(documentAutosaveTimer);
  documentAutosaveDirty = false;
  const item = activeDocument;
  target.innerHTML = `
    <div class="editor-command-bar">
      <div><span>DOCUMENT</span><strong data-document-shell-title>${escapeHtml(item.title)}</strong></div>
      <div class="editor-command-state"><i data-document-shell-visibility>${escapeHtml((item.visibility || "private").toUpperCase())}</i><b data-document-save-status data-state="saved">已保存 · r${item.revision || 1}</b></div>
    </div>
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
      <label class="relation-search">搜索节点<input data-document-link-search placeholder="输入节点名称筛选" /></label>
      <div data-document-nodes>${documentNodeOptions(item)}</div>
    </div>
    <div class="grid two compact-grid">
      <label>元数据 JSON<textarea data-document-metadata rows="4">${escapeHtml(JSON.stringify(item.metadata || {}, null, 2))}</textarea></label>
      <label class="check-row"><input data-document-ai-search type="checkbox" ${item.allow_ai_search ? "checked" : ""} />允许 AI 检索此文档</label>
    </div>
    <section class="editor-readiness">
      <div><span>检索准备</span><strong data-document-readiness-summary>0 / 0</strong></div>
      <ul data-document-readiness></ul>
    </section>
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
      <pre class="version-diff" data-document-version-diff hidden></pre>
    </section>
  `;
  renderDocumentReadiness();
  documentEditorHydrating = false;
}

function readDocumentPayload() {
  return {
    title: document.querySelector("[data-document-title]").value.trim(),
    slug: document.querySelector("[data-document-slug]").value.trim(),
    summary: document.querySelector("[data-document-summary]").value.trim(),
    visibility: document.querySelector("[data-document-visibility]").value,
    allow_ai_search: document.querySelector("[data-document-ai-search]").checked,
    column_id: Number(document.querySelector("[data-document-column]").value) || null,
    node_ids: [...document.querySelectorAll("[data-document-nodes] input:checked")].map((input) => Number(input.value)),
    metadata: parseJsonField("[data-document-metadata]", "文档元数据"),
    expected_revision: activeDocument?.revision,
  };
}

function renderDocumentReadiness() {
  if (!activeDocument || !document.querySelector("[data-document-readiness]")) return;
  let payload;
  try { payload = readDocumentPayload(); } catch { payload = { title: "", slug: "", summary: "", node_ids: [], column_id: null, allow_ai_search: false }; }
  renderEditorReadiness("[data-document-readiness]", "[data-document-readiness-summary]", [
    { label: "标题与 URL 标识", ready: Boolean(payload.title && payload.slug) },
    { label: "摘要不少于 20 字", ready: payload.summary.length >= 20 },
    { label: "文档解析成功", ready: ["ready", "disabled"].includes(activeDocument.status) },
    { label: "至少一个切片已启用", ready: Number(activeDocument.enabled_chunk_count || 0) > 0 },
    { label: "已指定所属专栏", ready: Boolean(payload.column_id) },
    { label: "已关联知识节点", ready: payload.node_ids.length > 0 },
  ]);
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
  window.clearTimeout(documentAutosaveTimer);
  const payload = readDocumentPayload();
  if (!payload.title || !payload.slug) throw new Error("标题和 URL 标识不能为空");
  setEditorStatus("[data-document-save-status]", "正在保存…", "saving");
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}`, { method: "PATCH", body: JSON.stringify(payload) });
  documentAutosaveDirty = false;
  setEditorStatus("[data-document-save-status]", `已保存 · r${activeDocument.revision || 1}`, "saved");
  showToast("文档已保存并记录版本");
  await loadDocuments();
}

function scheduleDocumentAutosave() {
  if (documentEditorHydrating || !cmsToken || !activeDocument?.id) return;
  renderDocumentReadiness();
  document.querySelector("[data-document-shell-title]").textContent = document.querySelector("[data-document-title]").value.trim() || "未命名文档";
  document.querySelector("[data-document-shell-visibility]").textContent = document.querySelector("[data-document-visibility]").value.toUpperCase();
  setEditorStatus("[data-document-save-status]", "有未保存修改", "dirty");
  documentAutosaveDirty = true;
  window.clearTimeout(documentAutosaveTimer);
  documentAutosaveTimer = window.setTimeout(() => guarded(performDocumentAutosave), 2800);
}

async function performDocumentAutosave() {
  if (!activeDocument?.id || documentAutosaveInFlight || !documentAutosaveDirty) return;
  const payload = readDocumentPayload();
  if (!payload.title || !payload.slug) return;
  documentAutosaveInFlight = true;
  setEditorStatus("[data-document-save-status]", "正在自动保存…", "saving");
  try {
    activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}`, {
      method: "PATCH", body: JSON.stringify(payload),
    });
    documentAutosaveDirty = false;
    setEditorStatus("[data-document-save-status]", `已自动保存 · r${activeDocument.revision || 1}`, "saved");
  } finally {
    documentAutosaveInFlight = false;
  }
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
    <div class="version-row"><div><strong>${escapeHtml(version.reason)}</strong><span>${escapeHtml(formatDateTime(version.created_at))} · ${escapeHtml(version.created_by_email || "system")}</span></div><div class="version-actions"><button type="button" data-document-version-diff="${version.id}">查看差异</button><button type="button" data-document-version-restore="${version.id}">恢复</button></div></div>
  `).join("") : `<p class="empty">暂无版本。</p>`;
}

async function loadDocumentVersionDiff(versionId) {
  const diff = await cmsRequest(`/admin/documents/versions/${versionId}/diff`);
  const target = document.querySelector("[data-document-version-diff]");
  target.textContent = `变更字段：${(diff.changed_fields || []).join("、") || "无字段变化"}\n\n${diff.content_diff || "切片正文没有变化。"}`;
  target.hidden = false;
}

async function restoreDocumentVersion(versionId) {
  if (!confirm("确定恢复该文档版本吗？当前状态会先保存为新版本。")) return;
  activeDocument = await cmsRequest(`/admin/documents/versions/${versionId}/restore`, { method: "POST" });
  showToast("文档版本已恢复");
  await loadDocuments();
  await loadDocumentVersions();
}

async function deleteDocument() {
  if (!activeDocument?.id || !confirm(`将「${activeDocument.title}」移至回收站？文档、切片和版本都会保留。`)) return;
  await cmsRequest(`/admin/documents/${activeDocument.id}`, { method: "DELETE" });
  activeDocument = null;
  showToast("文档已移至回收站");
  await loadDocuments();
}

function formatAccountRole(role) {
  return { admin: "管理员", editor: "编辑者", viewer: "只读用户" }[role] || role;
}

function renderCurrentAccount() {
  const target = document.querySelector("[data-current-account]");
  if (!target) return;
  if (!currentCmsUser) {
    target.innerHTML = `<p class="empty">请先在下方登录服务器后台。</p>`;
    return;
  }
  target.innerHTML = `
    <div><span>当前账号</span><strong>${escapeHtml(currentCmsUser.email)}</strong></div>
    <div><span>权限</span><strong>${formatAccountRole(currentCmsUser.role)}</strong></div>
    <div><span>状态</span><strong>${currentCmsUser.is_active ? "正常" : "已停用"}</strong></div>
    <div><span>最近登录</span><strong>${formatDateTime(currentCmsUser.last_login_at) || "首次登录"}</strong></div>
  `;
  document.querySelectorAll(".admin-sidebar-user strong").forEach((node) => { node.textContent = currentCmsUser.email; });
  document.querySelectorAll(".admin-sidebar-user span").forEach((node) => { node.textContent = formatAccountRole(currentCmsUser.role); });
}

function renderAccountUsers() {
  const target = document.querySelector("[data-account-users]");
  const manager = document.querySelector("[data-account-manager]");
  if (!target || !manager) return;
  const canManage = currentCmsUser?.role === "admin";
  manager.hidden = !canManage;
  if (!canManage) {
    target.innerHTML = `<p class="empty">只有管理员可以查看和管理其他账号。</p>`;
    return;
  }
  target.innerHTML = accountUsers.length ? accountUsers.map((user) => `
    <article class="account-row" data-account-id="${user.id}">
      <div><strong>${escapeHtml(user.email)}</strong><span>${formatDateTime(user.last_login_at) || "尚未登录"}</span></div>
      <select data-account-role ${user.id === currentCmsUser?.id ? "disabled" : ""}>
        ${["admin", "editor", "viewer"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${formatAccountRole(role)}</option>`).join("")}
      </select>
      <button type="button" data-account-toggle ${user.id === currentCmsUser?.id ? "disabled" : ""}>${user.is_active ? "停用" : "启用"}</button>
      <button type="button" data-account-reset>重置密码</button>
    </article>
  `).join("") : `<p class="empty">还没有其他账号。</p>`;
}

async function loadCurrentAccount() {
  currentCmsUser = await cmsRequest("/auth/me");
  renderCurrentAccount();
  if (currentCmsUser.role === "admin") await loadAccountUsers();
  else renderAccountUsers();
}

async function loadAccountUsers() {
  accountUsers = await cmsRequest("/admin/users");
  renderAccountUsers();
}

async function createAccount() {
  const email = document.querySelector("[data-account-email]").value.trim();
  const password = document.querySelector("[data-account-password]").value;
  const role = document.querySelector("[data-account-role-new]").value;
  await cmsRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  document.querySelector("[data-account-email]").value = "";
  document.querySelector("[data-account-password]").value = "";
  showToast("账号已创建并保存到服务器");
  await loadAccountUsers();
}

async function updateAccount(button, action) {
  const row = button.closest("[data-account-id]");
  const user = accountUsers.find((item) => String(item.id) === row?.dataset.accountId);
  if (!user) return;
  if (action === "role") {
    await cmsRequest(`/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: row.querySelector("[data-account-role]").value }),
    });
  }
  if (action === "toggle") {
    await cmsRequest(`/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !user.is_active }),
    });
  }
  if (action === "reset") {
    const password = window.prompt(`为 ${user.email} 设置新密码（至少 10 位）`);
    if (!password) return;
    await cmsRequest(`/admin/users/${user.id}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }
  showToast("账号设置已更新");
  await loadAccountUsers();
}

async function changeOwnPassword() {
  const currentPassword = document.querySelector("[data-current-password]").value;
  const newPassword = document.querySelector("[data-new-password]").value;
  await cmsRequest("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  await cmsRequest("/auth/logout", { method: "POST" }).catch(() => null);
  cmsToken = "";
  currentCmsUser = null;
  accountUsers = [];
  renderCurrentAccount();
  renderAccountUsers();
  setCmsStatus("密码已修改，请重新登录");
  showToast("密码已修改，旧登录令牌已经失效");
}
async function cmsLogin() {
  const email = document.querySelector("[data-cms-email]").value.trim();
  const password = document.querySelector("[data-cms-password]").value;
  cmsConfig.api = cmsApiBase();
  cmsConfig.email = email;
  localStorage.setItem("portfolio.cms.api", cmsConfig.api);
  localStorage.setItem("portfolio.cms.email", email);

  await cmsRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  cmsToken = "cookie";
  setCmsStatus("已连接 CMS");
  showToast("CMS 登录成功");
  await loadCurrentAccount();
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
  await loadWorkspaceOverview();
  await loadInbox();
  await loadActivity();
}

async function pushToCms() {
  await cmsRequest("/admin/site", {
    method: "POST",
    body: JSON.stringify({ data: state }),
  });
  setCmsStatus("服务器数据已保存");
  showToast("站点设置已保存到服务器数据库");
  await loadRagIndex();
}

async function pullFromCms() {
  const nextState = await cmsRequest("/admin/site");
  state = nextState;
  render();
  setCmsStatus("已读取服务器数据");
  showToast("已刷新服务器站点设置");
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
  state = await fetch("/data/site.json").then((response) => {
    if (!response.ok) throw new Error("无法读取站点初始配置。");
    return response.json();
  });
  if (cmsToken) {
    try {
      currentCmsUser = await cmsRequest("/auth/me");
      state = await cmsRequest("/admin/site");
    } catch (error) {
      if (error.status !== 404) console.warn(error);
    }
  }
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
      if (action === "quick-capture") {
        await navigateAdminRoute("inbox");
        resetInboxForm();
        document.querySelector("[data-inbox-title]")?.focus();
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
    guarded(async () => {
      await navigateAdminRoute("review");
      document.querySelector("[data-review-search]").value = adminSearch.value.trim();
      await searchReviewWorkspace();
    });
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
  document.querySelector("[data-account-refresh]").addEventListener("click", () => guarded(loadCurrentAccount));
  document.querySelector("[data-account-create]").addEventListener("click", () => guarded(createAccount));
  document.querySelector("[data-own-password-change]").addEventListener("click", () => guarded(changeOwnPassword));
  document.querySelector("[data-account-users]").addEventListener("change", (event) => {
    if (event.target.matches("[data-account-role]")) guarded(() => updateAccount(event.target, "role"));
  });
  document.querySelector("[data-account-users]").addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-account-toggle]");
    if (toggle) guarded(() => updateAccount(toggle, "toggle"));
    const reset = event.target.closest("[data-account-reset]");
    if (reset) guarded(() => updateAccount(reset, "reset"));
  });
  document.querySelector("[data-inbox-compose]").addEventListener("click", () => {
    resetInboxForm();
    document.querySelector("[data-inbox-title]")?.focus();
  });
  document.querySelector("[data-inbox-reset]").addEventListener("click", resetInboxForm);
  document.querySelector("[data-inbox-save]").addEventListener("click", () => guarded(saveInboxItem));
  document.querySelector("[data-inbox-refresh]").addEventListener("click", () => guarded(loadInbox));
  document.querySelector("[data-inbox-organizer-close]").addEventListener("click", () => {
    document.querySelector("[data-inbox-organizer]").hidden = true;
  });
  document.querySelector("[data-inbox-target-type]").addEventListener("change", updateInboxOrganizerMode);
  document.querySelector("[data-inbox-target-title]").addEventListener("input", (event) => {
    const slug = document.querySelector("[data-inbox-target-slug]");
    if (!slug.dataset.touched) slug.value = slugify(event.target.value);
  });
  document.querySelector("[data-inbox-target-slug]").addEventListener("input", (event) => {
    event.target.dataset.touched = event.target.value ? "true" : "";
  });
  document.querySelector("[data-inbox-target-search]").addEventListener("input", (event) => {
    filterRelationChoices("[data-inbox-target-columns]", event.target.value);
    filterRelationChoices("[data-inbox-target-nodes]", event.target.value);
  });
  document.querySelector("[data-inbox-target-columns]").addEventListener("change", () => {
    const selected = new Set([...document.querySelectorAll("[data-inbox-target-columns] input:checked")].map((input) => input.value));
    const primary = document.querySelector("[data-inbox-target-primary-column]");
    [...primary.options].forEach((option) => { option.hidden = option.value && !selected.has(option.value); });
    if (primary.value && !selected.has(primary.value)) primary.value = "";
  });
  document.querySelector("[data-inbox-organize-submit]").addEventListener("click", () => guarded(promoteInboxItem));
  document.querySelector("[data-inbox-list]").addEventListener("click", (event) => {
    const open = event.target.closest("[data-inbox-open]");
    if (open) {
      activeInboxItem = inboxItems.find((item) => String(item.id) === open.dataset.inboxOpen) || null;
      if (!activeInboxItem) return;
      document.querySelector("[data-inbox-form-title]").textContent = "编辑记录";
      document.querySelector("[data-inbox-title]").value = activeInboxItem.title || "";
      document.querySelector("[data-inbox-body]").value = activeInboxItem.body || "";
      document.querySelector("[data-inbox-type]").value = activeInboxItem.item_type || "note";
      document.querySelector("[data-inbox-url]").value = activeInboxItem.source_url || "";
      renderInbox();
      return;
    }
    const organize = event.target.closest("[data-inbox-organize]");
    if (organize) openInboxOrganizer(organize.dataset.inboxOrganize);
    const trash = event.target.closest("[data-inbox-trash]");
    if (trash) guarded(() => trashInboxItem(trash.dataset.inboxTrash));
  });
  document.querySelector("[data-review-refresh]").addEventListener("click", () => guarded(loadReviewDashboard));
  document.querySelector("[data-review-search-submit]").addEventListener("click", () => guarded(searchReviewWorkspace));
  document.querySelector("[data-review-search]").addEventListener("keydown", (event) => {
    if (event.key === "Enter") guarded(searchReviewWorkspace);
  });
  document.querySelector("[data-review-search-type]").addEventListener("change", () => {
    if (document.querySelector("[data-review-search]").value.trim()) guarded(searchReviewWorkspace);
  });
  document.querySelector("[data-review-select-all]").addEventListener("change", (event) => {
    document.querySelectorAll("[data-review-select]").forEach((input) => { input.checked = event.target.checked; });
    updateReviewSelectedCount();
  });
  document.querySelector(".review-workspace-panel").addEventListener("change", (event) => {
    if (event.target.matches("[data-review-select]")) updateReviewSelectedCount();
  });
  document.querySelector(".review-workspace-panel").addEventListener("click", (event) => {
    const batchAction = event.target.closest("[data-review-batch-action]");
    if (batchAction) {
      guarded(() => batchReviewEntities(batchAction.dataset.reviewBatchAction));
      return;
    }
    const quickQueue = event.target.closest("[data-review-quick-queue]");
    if (quickQueue) {
      const [entityType, entityId] = quickQueue.dataset.reviewQuickQueue.split(":");
      guarded(() => updateReviewEntity("queue", entityType, entityId, 7));
      return;
    }
    const edit = event.target.closest("[data-review-edit]");
    if (edit) {
      const editor = document.querySelector(`[data-review-editor="${edit.dataset.reviewEdit}"]`);
      if (editor) editor.hidden = !editor.hidden;
      return;
    }
    const customAction = event.target.closest("[data-review-custom-action]");
    if (customAction) {
      const [action, entityType, entityId] = customAction.dataset.reviewCustomAction.split(":");
      const editor = customAction.closest("[data-review-editor]");
      const days = editor?.querySelector("[data-review-editor-days]")?.value || 7;
      const note = editor?.querySelector("[data-review-editor-note]")?.value.trim() || "";
      guarded(() => updateReviewEntity(action, entityType, entityId, days, note));
      return;
    }
    const open = event.target.closest("[data-review-open]");
    if (open) {
      const [entityType, entityId] = open.dataset.reviewOpen.split(":");
      guarded(() => openWorkspaceEntity(entityType, entityId));
      return;
    }
    const actionButton = event.target.closest("[data-review-action]");
    if (actionButton) {
      const [action, entityType, entityId, intervalDays] = actionButton.dataset.reviewAction.split(":");
      guarded(() => updateReviewEntity(action, entityType, entityId, intervalDays));
    }
  });
  document.querySelector("[data-maintenance-refresh]").addEventListener("click", () => guarded(loadMaintenanceDashboard));
  document.querySelector("[data-maintenance-days]").addEventListener("change", () => guarded(loadMaintenanceDashboard));
  document.querySelector("[data-maintenance-priority]").addEventListener("change", renderMaintenanceTasks);
  document.querySelector("[data-maintenance-category]").addEventListener("change", renderMaintenanceTasks);
  document.querySelector("[data-maintenance-ai-run]").addEventListener("click", () => guarded(runInboxOrganizationSuggestion));
  document.querySelector("[data-ai-workflow-refresh]").addEventListener("click", () => guarded(loadAiWorkflowDashboard));
  document.querySelector("[data-ai-workflow-local]").addEventListener("click", () => guarded(() => runBatchInboxSuggestions("local")));
  document.querySelector("[data-ai-workflow-auto]").addEventListener("click", () => guarded(() => runBatchInboxSuggestions("auto")));
  document.querySelector("[data-maintenance-copy]").addEventListener("click", () => guarded(async () => {
    const text = maintenanceReportText();
    if (!text) throw new Error("周报尚未加载");
    await navigator.clipboard.writeText(text);
    showToast("周报已复制");
  }));
  document.querySelector(".maintenance-workspace-panel").addEventListener("click", (event) => {
    const task = event.target.closest("[data-maintenance-task]");
    if (task) {
      guarded(() => handleMaintenanceTask(task.dataset.maintenanceTask));
      return;
    }
    const opportunity = event.target.closest("[data-maintenance-opportunity]");
    if (opportunity) {
      guarded(() => handleKnowledgeOpportunity(opportunity.dataset.maintenanceOpportunity));
      return;
    }
    const adopt = event.target.closest("[data-ai-workflow-adopt]");
    if (adopt) {
      guarded(() => adoptAiWorkflowSuggestion(adopt.dataset.aiWorkflowAdopt));
      return;
    }
    const reject = event.target.closest("[data-ai-workflow-reject]");
    if (reject) {
      guarded(() => rejectAiWorkflowSuggestion(reject.dataset.aiWorkflowReject));
      return;
    }
    if (event.target.closest("[data-maintenance-ai-apply]")) guarded(applyInboxOrganizationSuggestion);
  });
  document.querySelector("[data-organization-refresh]").addEventListener("click", () => guarded(loadOrganization));
  document.querySelector("[data-organization-search]").addEventListener("input", renderOrganization);
  document.querySelector("[data-organization-type]").addEventListener("change", renderOrganization);
  document.querySelector("[data-organization-orphans]").addEventListener("change", renderOrganization);
  document.querySelector("[data-organization-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-organization-entity]");
    if (button) guarded(() => selectOrganizationEntity(button.dataset.organizationEntity));
  });
  document.querySelector("[data-organization-detail]").addEventListener("click", (event) => {
    if (event.target.closest("[data-organization-open-editor]")) guarded(openOrganizationEditor);
  });
  document.querySelector("[data-activity-refresh]").addEventListener("click", () => guarded(loadActivity));
  document.querySelector("[data-trash-refresh]").addEventListener("click", () => guarded(loadTrash));
  document.querySelector("[data-trash-list]").addEventListener("click", (event) => {
    const restore = event.target.closest("[data-trash-restore]");
    if (restore) guarded(() => restoreTrashItem(restore.dataset.trashRestore));
  });
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
  document.querySelector("[data-eval-refresh]").addEventListener("click", () => guarded(loadEvaluationDashboard));
  document.querySelector("[data-eval-new]").addEventListener("click", () => setEvalSuiteForm(emptyEvalSuite()));
  document.querySelector("[data-eval-save]").addEventListener("click", () => guarded(saveEvalSuite));
  document.querySelector("[data-eval-run-local]").addEventListener("click", () => guarded(() => runEvaluationSuite("local")));
  document.querySelector("[data-eval-run-auto]").addEventListener("click", () => guarded(() => runEvaluationSuite("auto")));
  document.querySelector("[data-eval-name]").addEventListener("input", (event) => {
    if (!activeEvalSuite?.id && !document.querySelector("[data-eval-slug]").value.trim()) document.querySelector("[data-eval-slug]").value = slugify(event.target.value);
  });
  document.querySelector("[data-eval-suite-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-eval-suite-id]");
    if (!button) return;
    setEvalSuiteForm(evaluationDashboard?.suites?.find((suite) => String(suite.id) === button.dataset.evalSuiteId) || emptyEvalSuite());
  });
  document.querySelector("[data-eval-history]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-eval-run-id]");
    if (button) guarded(() => loadEvaluationRun(button.dataset.evalRunId));
  });
  document.querySelector("[data-eval-run-detail]").addEventListener("click", (event) => {
    if (event.target.closest("[data-eval-detail-close]")) event.currentTarget.hidden = true;
  });
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
    const diffButton = event.target.closest("[data-document-version-diff]");
    if (diffButton) {
      guarded(() => loadDocumentVersionDiff(diffButton.dataset.documentVersionDiff));
      return;
    }
    if (event.target.closest("[data-document-save]")) guarded(saveDocument);
    else if (event.target.closest("[data-document-toggle]")) guarded(toggleDocument);
    else if (event.target.closest("[data-document-rechunk]")) guarded(rechunkDocument);
    else if (event.target.closest("[data-document-versions]")) guarded(loadDocumentVersions);
    else if (event.target.closest("[data-document-delete]")) guarded(deleteDocument);
  });
  document.querySelector("[data-document-editor]").addEventListener("input", (event) => {
    if (event.target.matches("[data-document-link-search]")) {
      filterRelationChoices("[data-document-nodes]", event.target.value);
      return;
    }
    if (!event.target.closest("[data-document-chunk]")) scheduleDocumentAutosave();
  });
  document.querySelector("[data-document-editor]").addEventListener("change", (event) => {
    if (!event.target.closest("[data-document-chunk]") && !event.target.matches("[data-document-link-search]")) scheduleDocumentAutosave();
  });
  document.querySelector("[data-ai-feedback-refresh]").addEventListener("click", () => guarded(loadAiFeedback));
  document.querySelector("[data-proactive-refresh]").addEventListener("click", () => guarded(() => loadProactiveDashboard(true)));
  document.querySelector("[data-memory-form]").addEventListener("submit", (event) => guarded(() => createLongTermMemory(event)));
  document.querySelector("[data-proactive-tasks]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-proactive-task]");
    if (button) guarded(() => updateProactiveTask(button.dataset.proactiveTask));
  });
  document.querySelector("[data-memory-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-memory-action]");
    if (button) guarded(() => updateLongTermMemory(button.dataset.memoryAction));
  });
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
  document.querySelector("[data-node-enhancement-local]").addEventListener("click", () => guarded(() => suggestContentEnhancement("node", "local")));
  document.querySelector("[data-node-enhancement-auto]").addEventListener("click", () => guarded(() => suggestContentEnhancement("node", "auto")));
  document.querySelector("[data-node-enhancement-result]").addEventListener("click", (event) => {
    if (event.target.closest("[data-node-enhancement-apply]")) guarded(() => applyContentEnhancement("node"));
  });
  document.querySelector("[data-node-delete]").addEventListener("click", () => guarded(deleteKnowledgeNode));
  document.querySelector("[data-node-title]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-node-slug]");
    if (!activeKnowledgeNode?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-node-link-search]").addEventListener("input", (event) => {
    filterRelationChoices("[data-node-columns]", event.target.value);
    filterRelationChoices("[data-node-articles]", event.target.value);
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
    const diffButton = event.target.closest("[data-node-version-diff]");
    if (diffButton) {
      guarded(() => loadKnowledgeNodeVersionDiff(diffButton.dataset.nodeVersionDiff));
      return;
    }
    const button = event.target.closest("[data-node-version-restore]");
    if (button) guarded(() => restoreKnowledgeNodeVersion(button.dataset.nodeVersionRestore));
  });
  const nodeForm = document.querySelector(".node-form");
  nodeForm.addEventListener("input", (event) => {
    if (!event.target.matches("[data-node-link-search]")) scheduleKnowledgeNodeAutosave();
  });
  nodeForm.addEventListener("change", scheduleKnowledgeNodeAutosave);
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
  document.querySelector("[data-entry-enhancement-local]").addEventListener("click", () => guarded(() => suggestContentEnhancement("entry", "local")));
  document.querySelector("[data-entry-enhancement-auto]").addEventListener("click", () => guarded(() => suggestContentEnhancement("entry", "auto")));
  document.querySelector("[data-entry-enhancement-result]").addEventListener("click", (event) => {
    if (event.target.closest("[data-entry-enhancement-apply]")) guarded(() => applyContentEnhancement("entry"));
  });
  document.querySelector("[data-entry-publish]").addEventListener("click", () => guarded(publishEntry));
  document.querySelector("[data-entry-archive]").addEventListener("click", () => guarded(archiveEntry));
  document.querySelector("[data-entry-delete]").addEventListener("click", () => guarded(deleteEntry));
  document.querySelector("[data-entry-versions]").addEventListener("click", () => guarded(loadVersions));
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
      if (activeAdminRoute === "knowledge-nodes") guarded(saveKnowledgeNode);
      else if (activeAdminRoute === "documents") guarded(saveDocument);
      else guarded(() => saveEntry());
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!autosaveDirty && !autosaveInFlight && !nodeAutosaveDirty && !nodeAutosaveInFlight && !documentAutosaveDirty && !documentAutosaveInFlight) return;
    event.preventDefault();
    event.returnValue = "";
  });

  setEntryForm(defaultEntry(activeEntityType));
  setColumnForm(emptyKnowledgeColumn());
  setKnowledgeNodeForm(emptyKnowledgeNode());
  setKnowledgeRelationForm(emptyKnowledgeRelation());
  try {
    await loadCurrentAccount();
    cmsToken = "cookie";
  } catch (error) {
    if (error?.status !== 401) console.warn("Unable to restore CMS session", error);
  }
  if (cmsToken) {
    guarded(async () => {
      await loadKnowledgeColumns();
      await loadKnowledgeGraphData();
      await loadDocuments();
      await loadEntries();
      await loadWorkspaceOverview();
      await loadInbox();
      await loadActivity();
      await loadMaintenanceDashboard();
    });
    guarded(loadAiRuns);
    guarded(loadAgentRuns);
    guarded(loadEvaluationDashboard);
    guarded(loadRagIndex);
    guarded(loadAiFeedback);
    guarded(() => loadProactiveDashboard(false));
    guarded(loadContentOps);
    guarded(loadSearchAnalytics);
    guarded(loadContentGaps);
    guarded(loadRelationHealth);
    guarded(loadPublishWorkflow);
  }
  await navigateAdminRoute(window.location.hash.slice(1) || "dashboard", { updateHash: false });
}

init();
