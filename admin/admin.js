let state;

const templates = {
  "profile.status": { label: "当前状态", value: "内容" },
  "profile.contacts": { label: "Email", value: "name@example.com", href: "mailto:name@example.com" },
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
    details: ["项目要点"],
    github: "",
    demo: "",
  },
  posts: {
    title: "新文章标题",
    slug: "new-post",
    category: "技术学习",
    date: new Date().toISOString().slice(0, 10),
    summary: "文章摘要。",
    tags: ["学习"],
    content: "在这里写正文。\n\n支持简单 Markdown：## 小标题、- 列表、```代码块```。",
  },
  knowledgeBase: { topic: "新主题", items: ["知识点"] },
  learningMap: {
    layer: "新层级",
    items: [{ name: "学习项", status: "未开始" }],
  },
  reading: { title: "书名", author: "作者", status: "想读", note: "阅读备注。" },
  timeline: { time: "2026", event: "新的阶段记录。" },
  "aiShowcase.pipeline": "新节点",
};

const listNames = [
  "profile.status",
  "profile.contacts",
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
    .split(",")
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

    if (["about.values", "techStack", "aiShowcase.pipeline"].includes(path)) {
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

    if (path === "about.education" || path === "about.experience") {
      renderTitleMetaDescription(item, entry);
    }

    if (path === "projects") {
      item.append(
        field("项目名", entry.name, (value) => (entry.name = value)),
        field("URL 标识", entry.slug, (value) => (entry.slug = value)),
        field("状态", entry.status, (value) => (entry.status = value)),
        field("简介", entry.summary, (value) => (entry.summary = value), 3),
        field("技术栈，逗号分隔", entry.stack || [], (value) => {
          entry.stack = splitValues(value);
        }),
        field("项目要点，逗号分隔", entry.details || [], (value) => {
          entry.details = splitValues(value);
        }),
        field("GitHub 链接", entry.github, (value) => (entry.github = value)),
        field("Demo 链接", entry.demo, (value) => (entry.demo = value)),
      );
    }

    if (path === "posts") {
      item.append(
        field("标题", entry.title, (value) => (entry.title = value)),
        field("URL 标识", entry.slug, (value) => (entry.slug = value)),
        field("分类", entry.category, (value) => (entry.category = value)),
        field("日期", entry.date, (value) => (entry.date = value)),
        field("摘要", entry.summary, (value) => (entry.summary = value), 3),
        field("标签，逗号分隔", entry.tags || [], (value) => {
          entry.tags = splitValues(value);
        }),
        field("正文", entry.content, (value) => (entry.content = value), 12),
      );
    }

    if (path === "knowledgeBase") {
      item.append(
        field("主题", entry.topic, (value) => (entry.topic = value)),
        field("知识点，逗号分隔", entry.items || [], (value) => {
          entry.items = splitValues(value);
        }),
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
        field("备注", entry.note, (value) => (entry.note = value), 3),
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

  listNames.forEach(renderList);
}

function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

async function save() {
  const response = await fetch("/api/content", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state, null, 2),
  });

  showToast(response.ok ? "已保存到 data/site.json" : "保存失败");
}

async function init() {
  state = await fetch("/api/content").then((response) => response.json());
  render();

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.add;
      ensureList(key).push(structuredClone(templates[key]));
      render();
    });
  });

  document.querySelector("[data-save]").addEventListener("click", save);
}

init();
