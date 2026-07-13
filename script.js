const contentUrl = "data/site.json";

const fallbackContent = {
  profile: {
    name: "晏宏翔",
    initials: "晏",
    role: "AI Agent / RAG 工程师方向",
    headline: "把工业软件经验，迁移到大模型应用与知识库系统。",
    summary:
      "2025 年毕业于江西师范大学计算机专业，目前在上海阅凡自动化科技有限公司担任 C# 工程师。正在系统学习并实践大模型应用开发，重点关注企业知识库、向量检索、Agent 工作流与 RAG 系统。",
    status: [],
    contacts: [],
  },
  about: { education: [], experience: [], values: [] },
  techStack: [],
  projects: [],
  posts: [],
  knowledgeBase: [],
  learningMap: [],
  reading: [],
  timeline: [],
  aiShowcase: { title: "", summary: "", pipeline: [], status: "" },
};

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
    .replace(/^-|-$/g, "");
}

function normalizeSlug(item, index, prefix = "item") {
  return item.slug || slugify(item.title || item.name) || `${prefix}-${index + 1}`;
}

function calculateReadTime(content) {
  const text = String(content || "").replace(/\s+/g, "");
  return Math.max(1, Math.ceil(text.length / 500));
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value ?? "";
  });
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;

  function flushParagraph() {
    if (paragraph.length) {
      blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length) {
      blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  }

  function flushCode() {
    if (code.length) {
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      code = [];
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 1;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCode();
  return blocks.join("");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function renderPills(selector, items, className = "") {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = (items || [])
    .map((item) => `<span class="${className}">${escapeHtml(item)}</span>`)
    .join("");
}

function renderProfile(content) {
  const profile = content.profile || fallbackContent.profile;
  document.title = `${profile.name} | ${profile.role}`;
  setText('[data-profile="name"]', profile.name);
  setText('[data-profile="initials"]', profile.initials);
  setText('[data-profile="role"]', profile.role);
  setText('[data-profile="headline"]', profile.headline);
  setText('[data-profile="summary"]', profile.summary);

  const contacts = document.querySelector("[data-contacts]");
  contacts.innerHTML = (profile.contacts || [])
    .map((item) => {
      const href = item.href || "#";
      const isLink = href && href !== "#";
      return `<a class="button-link" href="${escapeHtml(href)}" ${isLink ? 'target="_blank" rel="noreferrer"' : ""}>${escapeHtml(item.label)} · ${escapeHtml(item.value)}</a>`;
    })
    .join("");

  document.querySelector("[data-status]").innerHTML = (profile.status || [])
    .map(
      (item) => `
        <article class="metric-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </article>
      `,
    )
    .join("");
}

function projectCard(project, index) {
  const slug = normalizeSlug(project, index, "project");
  const links = [
    project.github ? `<a href="${escapeHtml(project.github)}" target="_blank" rel="noreferrer">GitHub</a>` : "",
    project.demo ? `<a href="${escapeHtml(project.demo)}" target="_blank" rel="noreferrer">Demo</a>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="project-card" id="${escapeHtml(slug)}">
      <div class="card-meta">
        <span>${escapeHtml(project.status || "记录中")}</span>
      </div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.summary || "")}</p>
      <div class="pill-list compact">
        ${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <ul>
        ${(project.details || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      ${links ? `<div class="card-links">${links}</div>` : ""}
    </article>
  `;
}

function renderProjects(content) {
  const projects = content.projects || [];
  const html = projects.length
    ? projects.map(projectCard).join("")
    : `<div class="empty-state"><strong>项目作品整理中</strong><p>后续会补充 C# 工程项目、大模型 Demo、Agent 或 RAG 实践。</p></div>`;

  document.querySelector("[data-projects]").innerHTML = html;
  document.querySelector("[data-featured-projects]").innerHTML = projects.slice(0, 2).map(projectCard).join("");
}

function postCard(post, index) {
  const slug = normalizeSlug(post, index, "post");
  return `
    <a class="post-card" href="#post-${escapeHtml(slug)}" data-post-card data-title="${escapeHtml(post.title)}" data-category="${escapeHtml(post.category || "")}" data-tags="${escapeHtml((post.tags || []).join(","))}">
      <div class="card-meta">
        <span>${escapeHtml(post.category || "文章")}</span>
        <time>${escapeHtml(post.date || "未设置日期")}</time>
        <span>${calculateReadTime(post.content)} min read</span>
      </div>
      <h2>${escapeHtml(post.title)}</h2>
      <p>${escapeHtml(post.summary || "")}</p>
      <div class="pill-list compact">
        ${(post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    </a>
  `;
}

function renderPosts(content) {
  const posts = content.posts || [];
  const list = document.querySelector("[data-posts]");
  const latest = document.querySelector("[data-latest-posts]");
  const filters = document.querySelector("[data-post-filters]");
  const search = document.querySelector("[data-post-search]");

  list.innerHTML = posts.length
    ? posts.map(postCard).join("")
    : `<div class="empty-state"><strong>还没有文章</strong><p>打开本地编辑器，写下第一篇技术记录。</p></div>`;
  latest.innerHTML = posts.slice(0, 3).map(postCard).join("");

  const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))];
  if (filters) {
    filters.innerHTML = ["全部", ...categories].map((item) => `<button type="button" data-category-filter="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("");
    filters.querySelector("[data-category-filter]")?.classList.add("is-active");
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category-filter]");
      if (!button) return;
      filters.querySelectorAll("button").forEach((node) => node.classList.remove("is-active"));
      button.classList.add("is-active");
      applyPostFilters();
    });
  }

  if (search) {
    search.addEventListener("input", applyPostFilters);
  }
}

function applyPostFilters() {
  const searchValue = document.querySelector("[data-post-search]")?.value.trim().toLowerCase() || "";
  const category = document.querySelector("[data-category-filter].is-active")?.dataset.categoryFilter || "全部";

  document.querySelectorAll("[data-post-card]").forEach((card) => {
    const text = `${card.dataset.title} ${card.dataset.category} ${card.dataset.tags}`.toLowerCase();
    const matchesSearch = !searchValue || text.includes(searchValue);
    const matchesCategory = category === "全部" || card.dataset.category === category;
    card.hidden = !(matchesSearch && matchesCategory);
  });
}

function renderArticle(content, slug) {
  const posts = content.posts || [];
  const index = posts.findIndex((post, current) => normalizeSlug(post, current, "post") === slug);
  const post = posts[index];
  const article = document.querySelector("[data-post-article]");
  const list = document.querySelector("[data-posts]");

  if (!post) {
    article.hidden = true;
    list.hidden = false;
    return;
  }

  const headings = [...String(post.content || "").matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1]);
  const previous = posts[index - 1];
  const next = posts[index + 1];

  list.hidden = true;
  article.hidden = false;
  article.innerHTML = `
    <a class="back-link" href="#posts">返回文章列表</a>
    <div class="article-layout">
      <div class="article-main">
        <div class="card-meta">
          <span>${escapeHtml(post.category || "文章")}</span>
          <time>${escapeHtml(post.date || "未设置日期")}</time>
          <span>${calculateReadTime(post.content)} min read</span>
        </div>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="pill-list compact">${(post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="article-body">${markdownToHtml(post.content)}</div>
        <nav class="article-nav">
          ${previous ? `<a href="#post-${escapeHtml(normalizeSlug(previous, index - 1, "post"))}">上一篇 · ${escapeHtml(previous.title)}</a>` : "<span></span>"}
          ${next ? `<a href="#post-${escapeHtml(normalizeSlug(next, index + 1, "post"))}">下一篇 · ${escapeHtml(next.title)}</a>` : "<span></span>"}
        </nav>
      </div>
      <aside class="toc">
        <strong>目录</strong>
        ${
          headings.length
            ? headings.map((heading) => `<span>${escapeHtml(heading)}</span>`).join("")
            : "<span>正文</span>"
        }
      </aside>
    </div>
  `;
}

function renderKnowledge(content) {
  document.querySelector("[data-knowledge]").innerHTML = (content.knowledgeBase || [])
    .map(
      (group) => `
        <article class="knowledge-card">
          <h2>${escapeHtml(group.topic)}</h2>
          <div class="pill-list soft">
            ${(group.items || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderRoadmap(content) {
  document.querySelector("[data-learning-map]").innerHTML = (content.learningMap || [])
    .map(
      (layer) => `
        <article class="roadmap-card">
          <h2>${escapeHtml(layer.layer)}</h2>
          <div class="roadmap-items">
            ${(layer.items || [])
              .map(
                (item) => `
                  <div>
                    <span>${escapeHtml(item.name)}</span>
                    <strong>${escapeHtml(item.status)}</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");

  document.querySelector("[data-reading]").innerHTML = (content.reading || [])
    .map(
      (book) => `
        <article class="list-card">
          <strong>${escapeHtml(book.title)}</strong>
          <span>${escapeHtml(book.author || "")} · ${escapeHtml(book.status || "")}</span>
          <p>${escapeHtml(book.note || "")}</p>
        </article>
      `,
    )
    .join("");

  document.querySelector("[data-timeline]").innerHTML = (content.timeline || [])
    .map(
      (item) => `
        <article class="list-card">
          <strong>${escapeHtml(item.time)}</strong>
          <p>${escapeHtml(item.event)}</p>
        </article>
      `,
    )
    .join("");
}

function renderAbout(content) {
  const about = content.about || fallbackContent.about;
  renderTimeline("[data-education]", about.education);
  renderTimeline("[data-experience]", about.experience);
  document.querySelector("[data-values]").innerHTML = (about.values || [])
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join("");
}

function renderTimeline(selector, items) {
  document.querySelector(selector).innerHTML = (items || [])
    .map(
      (item) => `
        <section class="timeline-item">
          <span class="dot"></span>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="meta">${escapeHtml(item.meta)}</p>
            <p>${escapeHtml(item.description)}</p>
          </div>
        </section>
      `,
    )
    .join("");
}

function renderAi(content) {
  const ai = content.aiShowcase || fallbackContent.aiShowcase;
  document.querySelector("[data-ai-showcase]").innerHTML = `
    <div>
      <div class="card-meta"><span>${escapeHtml(ai.status || "规划中")}</span></div>
      <h3>${escapeHtml(ai.title)}</h3>
      <p>${escapeHtml(ai.summary)}</p>
    </div>
    <div class="pipeline">
      ${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function setRoute(content) {
  const hash = window.location.hash.replace("#", "") || "home";
  const isPost = hash.startsWith("post-");
  const route = isPost ? "posts" : hash;

  document.querySelectorAll("[data-route]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === route);
  });

  document.querySelectorAll("[data-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === route);
  });

  const postList = document.querySelector("[data-posts]");
  const postArticle = document.querySelector("[data-post-article]");
  if (postList && postArticle) {
    postList.hidden = false;
    postArticle.hidden = true;
  }

  if (isPost) {
    renderArticle(content, hash.replace("post-", ""));
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function render(content) {
  renderProfile(content);
  renderProjects(content);
  renderPosts(content);
  renderKnowledge(content);
  renderRoadmap(content);
  renderAbout(content);
  renderAi(content);
  renderPills("[data-tech-stack]", content.techStack || []);
  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  setRoute(content);
  window.addEventListener("hashchange", () => setRoute(content));
}

async function loadContent() {
  try {
    const response = await fetch(contentUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallbackContent;
  }
}

loadContent().then(render);
