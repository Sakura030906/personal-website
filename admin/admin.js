let state;

const templates = {
  links: { label: "New", value: "example.com", href: "https://example.com" },
  highlights: { label: "Label", value: "Value" },
  about: "新的介绍段落。",
  projects: {
    name: "项目名称",
    description: "项目说明。",
    impact: "项目结果。",
    stack: ["Tech"],
  },
  skills: { title: "技能组", items: ["能力"] },
  experience: {
    period: "2024 - Now",
    title: "职位 / 角色",
    description: "经历说明。",
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

function renderList(name) {
  const target = document.querySelector(`[data-list="${name}"]`);
  target.innerHTML = "";

  state[name].forEach((entry, index) => {
    const item = itemShell(`${name} #${index + 1}`, () => {
      state[name].splice(index, 1);
      render();
    });

    if (name === "links") {
      item.append(
        field("标签", entry.label, (value) => (entry.label = value)),
        field("显示值", entry.value, (value) => (entry.value = value)),
        field("链接地址", entry.href, (value) => (entry.href = value)),
      );
    }

    if (name === "highlights") {
      item.append(
        field("名称", entry.label, (value) => (entry.label = value)),
        field("值", entry.value, (value) => (entry.value = value)),
      );
    }

    if (name === "about") {
      item.append(field("段落", entry, (value) => (state[name][index] = value), 4));
    }

    if (name === "projects") {
      item.append(
        field("项目名", entry.name, (value) => (entry.name = value)),
        field("说明", entry.description, (value) => (entry.description = value), 3),
        field("结果", entry.impact, (value) => (entry.impact = value), 2),
        field("技术栈，逗号分隔", entry.stack, (value) => {
          entry.stack = value.split(",").map((item) => item.trim()).filter(Boolean);
        }),
      );
    }

    if (name === "skills") {
      item.append(
        field("标题", entry.title, (value) => (entry.title = value)),
        field("技能，逗号分隔", entry.items, (value) => {
          entry.items = value.split(",").map((item) => item.trim()).filter(Boolean);
        }),
      );
    }

    if (name === "experience") {
      item.append(
        field("时间", entry.period, (value) => (entry.period = value)),
        field("标题", entry.title, (value) => (entry.title = value)),
        field("说明", entry.description, (value) => (entry.description = value), 3),
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

  ["links", "highlights", "about", "projects", "skills", "experience"].forEach(renderList);
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

  if (!response.ok) {
    showToast("保存失败");
    return;
  }

  showToast("已保存到 data/site.json");
}

async function init() {
  state = await fetch("/api/content").then((response) => response.json());
  render();

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.add;
      state[key].push(structuredClone(templates[key]));
      render();
    });
  });

  document.querySelector("[data-save]").addEventListener("click", save);
}

init();
