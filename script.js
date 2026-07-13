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
    focus: [],
    contacts: [],
  },
  about: { education: [], experience: [], values: [] },
  siteModules: [],
  techStack: [],
  projects: [],
  posts: [],
  knowledgeBase: [],
  learningMap: [],
  reading: [],
  timeline: [],
  aiShowcase: { title: "", summary: "", pipeline: [], status: "", capabilities: [], examples: [], roadmap: [] },
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
  return item.slug || slugify(item.title || item.name || item.topic) || `${prefix}-${index + 1}`;
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

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
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

  document.querySelector("[data-contacts]").innerHTML = (profile.contacts || [])
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

  document.querySelector("[data-focus]").innerHTML = (profile.focus || [])
    .map(
      (item) => `
        <article class="focus-card">
          <span>${escapeHtml(item.label)}</span>
          <h3>${escapeHtml(item.value)}</h3>
          <p>${escapeHtml(item.note)}</p>
        </article>
      `,
    )
    .join("");
}

function renderSiteModules(content) {
  document.querySelector("[data-site-modules]").innerHTML = (content.siteModules || [])
    .map(
      (item) => `
        <article class="module-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </article>
      `,
    )
    .join("");
}

function projectCard(project, index) {
  const slug = normalizeSlug(project, index, "project");
  return `
    <a class="project-card" href="#project-${escapeHtml(slug)}">
      <div class="card-meta"><span>${escapeHtml(project.status || "记录中")}</span></div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.summary || "")}</p>
      <div class="pill-list compact">
        ${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <ul>
        ${(project.details || []).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <span class="read-more">查看项目详情</span>
    </a>
  `;
}

function detailList(title, items) {
  if (!items?.length) return "";
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
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

function renderProjectDetail(content, slug) {
  const projects = content.projects || [];
  const index = projects.findIndex((project, current) => normalizeSlug(project, current, "project") === slug);
  const project = projects[index];
  const list = document.querySelector("[data-projects]");
  const detail = document.querySelector("[data-project-detail]");

  if (!project) {
    list.hidden = false;
    detail.hidden = true;
    return;
  }

  list.hidden = true;
  detail.hidden = false;
  detail.innerHTML = `
    <a class="back-link" href="#projects">返回项目列表</a>
    <div class="detail-head">
      <div>
        <div class="card-meta"><span>${escapeHtml(project.status || "记录中")}</span></div>
        <h1>${escapeHtml(project.name)}</h1>
        <p>${escapeHtml(project.summary || "")}</p>
      </div>
      <div class="pill-list compact">${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <div class="detail-grid">
      <section>
        <h2>问题背景</h2>
        <p>${escapeHtml(project.problem || "待补充。")}</p>
      </section>
      <section>
        <h2>架构设想</h2>
        <p>${escapeHtml(project.architecture || "待补充。")}</p>
      </section>
      ${detailList("核心模块", project.modules)}
      ${detailList("项目要点", project.details)}
      ${detailList("主要难点", project.challenges)}
      ${detailList("下一步", project.nextSteps)}
    </div>
  `;
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
    filters.innerHTML = ["全部", ...categories]
      .map((item) => `<button type="button" data-category-filter="${escapeHtml(item)}">${escapeHtml(item)}</button>`)
      .join("");
    filters.querySelector("[data-category-filter]")?.classList.add("is-active");
    filters.onclick = (event) => {
      const button = event.target.closest("[data-category-filter]");
      if (!button) return;
      filters.querySelectorAll("button").forEach((node) => node.classList.remove("is-active"));
      button.classList.add("is-active");
      applyPostFilters();
    };
  }

  if (search) {
    search.oninput = applyPostFilters;
  }
}

function applyPostFilters() {
  const searchValue = document.querySelector("[data-post-search]")?.value.trim().toLowerCase() || "";
  const category = document.querySelector("[data-category-filter].is-active")?.dataset.categoryFilter || "全部";

  document.querySelectorAll("[data-posts] [data-post-card]").forEach((card) => {
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
        ${headings.length ? headings.map((heading) => `<span>${escapeHtml(heading)}</span>`).join("") : "<span>正文</span>"}
      </aside>
    </div>
  `;
}

function renderKnowledge(content) {
  document.querySelector("[data-knowledge]").innerHTML = (content.knowledgeBase || [])
    .map((group, index) => {
      const slug = normalizeSlug(group, index, "knowledge");
      return `
        <a class="knowledge-card" href="#knowledge-${escapeHtml(slug)}">
          <h2>${escapeHtml(group.topic)}</h2>
          <p>${escapeHtml(group.summary || "")}</p>
          <div class="pill-list soft">
            ${(group.items || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
          <span class="read-more">查看知识节点</span>
        </a>
      `;
    })
    .join("");
}

function renderKnowledgeDetail(content, slug) {
  const groups = content.knowledgeBase || [];
  const index = groups.findIndex((group, current) => normalizeSlug(group, current, "knowledge") === slug);
  const group = groups[index];
  const list = document.querySelector("[data-knowledge]");
  const detail = document.querySelector("[data-knowledge-detail]");

  if (!group) {
    list.hidden = false;
    detail.hidden = true;
    return;
  }

  list.hidden = true;
  detail.hidden = false;
  detail.innerHTML = `
    <a class="back-link" href="#knowledge">返回知识库</a>
    <div class="detail-head">
      <div>
        <p class="kicker">Knowledge Node</p>
        <h1>${escapeHtml(group.topic)}</h1>
        <p>${escapeHtml(group.summary || "")}</p>
      </div>
      <div class="pill-list compact">${(group.items || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <div class="note-grid">
      ${(group.notes || [])
        .map(
          (note) => `
            <article class="note-card">
              <h2>${escapeHtml(note.name)}</h2>
              <p>${escapeHtml(note.description)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
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
  const homeTarget = document.querySelector("[data-ai-showcase]");
  homeTarget.innerHTML = `
    <div>
      <div class="card-meta"><span>${escapeHtml(ai.status || "规划中")}</span></div>
      <h3>${escapeHtml(ai.title)}</h3>
      <p>${escapeHtml(ai.summary)}</p>
    </div>
    <div class="pipeline">${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
  `;

  document.querySelector("[data-ai-full]").innerHTML = `
    <div class="section-title">
      <p>Architecture</p>
      <h2>${escapeHtml(ai.title)}</h2>
    </div>
    <p>${escapeHtml(ai.summary)}</p>
    <div class="pipeline lab-pipeline">${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    ${detailList("演进路线", ai.roadmap)}
  `;

  document.querySelector("[data-ai-capabilities]").innerHTML = (ai.capabilities || [])
    .map(
      (item) => `
        <article class="module-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
        </article>
      `,
    )
    .join("");

  const askButton = document.querySelector("[data-ai-ask]");
  askButton.onclick = () => answerStaticQuestion(content);
  document.querySelector("[data-ai-answer]").innerHTML = `
    <strong>可以先试试：</strong>
    <div class="suggestion-row">
      ${(ai.examples || []).map((item) => `<button type="button" data-question="${escapeHtml(item.question)}">${escapeHtml(item.question)}</button>`).join("")}
    </div>
  `;
  document.querySelector("[data-ai-answer]").onclick = (event) => {
    const button = event.target.closest("[data-question]");
    if (!button) return;
    document.querySelector("[data-ai-question]").value = button.dataset.question;
    answerStaticQuestion(content);
  };
}

function flattenSearchContent(content) {
  const entries = [];

  (content.posts || []).forEach((post, index) => {
    entries.push({
      type: "文章",
      title: post.title,
      href: `#post-${normalizeSlug(post, index, "post")}`,
      text: [post.title, post.category, post.summary, ...(post.tags || []), post.content].join(" "),
    });
  });

  (content.projects || []).forEach((project, index) => {
    entries.push({
      type: "项目",
      title: project.name,
      href: `#project-${normalizeSlug(project, index, "project")}`,
      text: [
        project.name,
        project.summary,
        project.problem,
        project.architecture,
        ...(project.stack || []),
        ...(project.details || []),
        ...(project.challenges || []),
        ...(project.nextSteps || []),
      ].join(" "),
    });
  });

  (content.knowledgeBase || []).forEach((group, index) => {
    entries.push({
      type: "知识库",
      title: group.topic,
      href: `#knowledge-${normalizeSlug(group, index, "knowledge")}`,
      text: [
        group.topic,
        group.summary,
        ...(group.items || []),
        ...(group.notes || []).flatMap((note) => [note.name, note.description]),
      ].join(" "),
    });
  });

  (content.learningMap || []).forEach((layer) => {
    entries.push({
      type: "学习路线",
      title: layer.layer,
      href: "#roadmap",
      text: [layer.layer, ...(layer.items || []).flatMap((item) => [item.name, item.status])].join(" "),
    });
  });

  return entries;
}

function scoreEntry(entry, query) {
  const text = entry.text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery
    .split(/[\s,，。?？/、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  let score = text.includes(normalizedQuery) ? 8 : 0;
  tokens.forEach((token) => {
    if (text.includes(token)) score += 2;
  });
  return score;
}

function answerStaticQuestion(content) {
  const query = document.querySelector("[data-ai-question]").value.trim();
  const target = document.querySelector("[data-ai-answer]");
  const examples = content.aiShowcase?.examples || [];

  if (!query) {
    target.innerHTML = "<p>先输入一个问题，例如：EduRAG 准备用哪些技术？</p>";
    return;
  }

  const example = examples.find((item) => query.includes(item.question) || item.question.includes(query));
  const ranked = flattenSearchContent(content)
    .map((entry) => ({ ...entry, score: scoreEntry(entry, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const answer = example
    ? example.answer
    : ranked.length
      ? `我在站内内容里找到了 ${ranked.length} 条相关记录。当前版本是静态检索 Demo，不调用真实大模型；后续会把这些内容切块、向量化，并接入 RAG 问答。`
      : "当前静态内容里没有找到明显匹配项。后续接入真实 RAG 后，可以通过语义检索覆盖更多表达方式。";

  target.innerHTML = `
    <strong>静态回答</strong>
    <p>${escapeHtml(answer)}</p>
    ${
      ranked.length
        ? `<div class="source-list">
            <span>相关来源</span>
            ${ranked.map((entry) => `<a href="${escapeHtml(entry.href)}">${escapeHtml(entry.type)} · ${escapeHtml(entry.title)}</a>`).join("")}
          </div>`
        : ""
    }
  `;
}

function resetDetailViews() {
  const pairs = [
    ["[data-posts]", "[data-post-article]"],
    ["[data-projects]", "[data-project-detail]"],
    ["[data-knowledge]", "[data-knowledge-detail]"],
  ];

  pairs.forEach(([listSelector, detailSelector]) => {
    const list = document.querySelector(listSelector);
    const detail = document.querySelector(detailSelector);
    if (list) list.hidden = false;
    if (detail) detail.hidden = true;
  });
}

function setRoute(content) {
  const hash = window.location.hash.replace("#", "") || "home";
  const isPost = hash.startsWith("post-");
  const isProject = hash.startsWith("project-");
  const isKnowledge = hash.startsWith("knowledge-");
  const route = isPost ? "posts" : isProject ? "projects" : isKnowledge ? "knowledge" : hash;

  document.querySelectorAll("[data-route]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === route);
  });

  document.querySelectorAll("[data-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === route);
  });

  resetDetailViews();

  if (isPost) renderArticle(content, hash.replace("post-", ""));
  if (isProject) renderProjectDetail(content, hash.replace("project-", ""));
  if (isKnowledge) renderKnowledgeDetail(content, hash.replace("knowledge-", ""));

  window.scrollTo({ top: 0, behavior: "auto" });
}

function render(content) {
  renderProfile(content);
  renderSiteModules(content);
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
