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
