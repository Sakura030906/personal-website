let state;

const templates = {
  basicInfo: { label: "名称", value: "内容" },
  education: {
    title: "学校名称",
    meta: "专业 · 学历 · 时间",
    description: "教育经历说明。",
  },
  experience: {
    title: "公司名称",
    meta: "职位 · 时间",
    description: "工作经历说明。",
  },
  skills: "新技能",
  interests: "新兴趣",
  projects: {
    name: "项目名称",
    description: "项目说明。",
    stack: ["Tech"],
  },
  blogPosts: {
    title: "新文章标题",
    slug: "new-post",
    date: new Date().toISOString().slice(0, 10),
    summary: "文章摘要。",
    tags: ["学习"],
    content: "在这里写正文。\n\n可以用空行分段。",
  },
};

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

function renderList(name) {
  const target = document.querySelector(`[data-list="${name}"]`);
  target.innerHTML = "";
  state[name] ||= [];

  state[name].forEach((entry, index) => {
    const item = itemShell(`${name} #${index + 1}`, () => {
      state[name].splice(index, 1);
      render();
    });

    if (name === "basicInfo") {
      item.append(
        field("名称", entry.label, (value) => (entry.label = value)),
        field("内容", entry.value, (value) => (entry.value = value)),
      );
    }

    if (name === "education" || name === "experience") {
      item.append(
        field("标题", entry.title, (value) => (entry.title = value)),
        field("副标题/时间", entry.meta, (value) => (entry.meta = value)),
        field("说明", entry.description, (value) => (entry.description = value), 4),
      );
    }

    if (name === "skills" || name === "interests") {
      item.append(field("内容", entry, (value) => (state[name][index] = value)));
    }

    if (name === "projects") {
      item.append(
        field("项目名", entry.name, (value) => (entry.name = value)),
        field("说明", entry.description, (value) => (entry.description = value), 3),
        field("技术栈，逗号分隔", entry.stack || [], (value) => {
          entry.stack = splitValues(value);
        }),
      );
    }

    if (name === "blogPosts") {
      item.append(
        field("标题", entry.title, (value) => (entry.title = value)),
        field("URL 标识", entry.slug, (value) => (entry.slug = value)),
        field("日期", entry.date, (value) => (entry.date = value)),
        field("摘要", entry.summary, (value) => (entry.summary = value), 3),
        field("标签，逗号分隔", entry.tags || [], (value) => {
          entry.tags = splitValues(value);
        }),
        field("正文", entry.content, (value) => (entry.content = value), 10),
      );
    }

    target.append(item);
  });
}

function render() {
  document.querySelectorAll("[data-path]").forEach((input) => {
    input.value = state[input.dataset.path] || "";
    input.oninput = () => {
      state[input.dataset.path] = input.value;
    };
  });

  ["basicInfo", "education", "experience", "skills", "projects", "interests", "blogPosts"].forEach(renderList);
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
    body: JSON.stringify(state),
  });

  showToast(response.ok ? "已保存到 data/site.json" : "保存失败");
}

async function init() {
  state = await fetch("/api/content").then((response) => response.json());
  render();

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.add;
      state[key] ||= [];
      state[key].push(structuredClone(templates[key]));
      render();
    });
  });

  document.querySelector("[data-save]").addEventListener("click", save);
}

init();
