/* GENERATED SITE SCRIPT. Edit files under src/ and run npm run build. */
const contentUrl = "data/site.json";
const isLocalPreview = ["127.0.0.1", "localhost", ""].includes(window.location.hostname);
const portfolioApiUrl = window.PORTFOLIO_API || (isLocalPreview ? "http://127.0.0.1:8000" : `${window.location.origin}/api`);
const aiApiUrl = window.PORTFOLIO_AI_API || `${portfolioApiUrl}/ai/ask`;
const agentApiUrl = window.PORTFOLIO_AGENT_API || `${portfolioApiUrl}/agent`;
const searchAnalyticsUrl = window.PORTFOLIO_SEARCH_ANALYTICS_API || `${portfolioApiUrl}/search/events`;
const aiSessionId = crypto.randomUUID();
let aiRenderedHistory = [];
let appContent = null;
let knowledgeGraphInstance = null;
let knowledgeGraphData = { nodes: [], edges: [], stats: {} };
let activeKnowledgeGraphColumn = "";
let activeKnowledgeGraphLayout = "clustered";
let activeKnowledgeGraphTags = new Set();
let lastGraphNodeTap = { id: "", at: 0 };
const searchAnalyticsTimers = new Map();
let activeAgentTaskId = null;
let agentPollTimer = null;
let aiScopeCatalog = { columns: [], nodes: [], articles: [], documents: [] };

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

function sendSearchAnalytics(payload) {
  const body = JSON.stringify({
    session_id: aiSessionId,
    source: "command",
    event_type: "search",
    query: "",
    result_count: 0,
    selected_type: "",
    selected_title: "",
    selected_href: "",
    ...payload,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(searchAnalyticsUrl, blob);
      return;
    }
    fetch(searchAnalyticsUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics should never break the public site.
  }
}

function scheduleSearchAnalytics(source, query, resultCount) {
  const normalized = String(query || "").trim();
  if (!normalized) return;
  window.clearTimeout(searchAnalyticsTimers.get(source));
  searchAnalyticsTimers.set(
    source,
    window.setTimeout(() => {
      sendSearchAnalytics({
        source,
        event_type: "search",
        query: normalized,
        result_count: resultCount,
      });
    }, 650),
  );
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

function safeContentUrl(value, kind = "link") {
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

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = safeContentUrl(url, "image");
      return safe ? `<img src="${escapeHtml(safe)}" alt="${alt}" loading="lazy" />` : alt;
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${escapeHtml(safeContentUrl(url))}" target="_blank" rel="noreferrer">${label}</a>`)
    .replace(/\[\^([^\]]+)\]/g, (_, id) => `<sup><a href="#footnote-${escapeHtml(slugify(id))}" class="footnote-ref">[${escapeHtml(id)}]</a></sup>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\$\$(.+?)\$\$/g, '<span class="math-block">$1</span>')
    .replace(/\$(.+?)\$/g, '<span class="math-inline">$1</span>');
}

function markdownToHtml(markdown, options = {}) {
  const footnotes = [];
  const lines = String(markdown || "")
    .split("\n")
    .filter((line) => {
      const footnote = line.match(/^\[\^([^\]]+)\]:\s+(.+)$/);
      if (footnote) {
        footnotes.push({ id: slugify(footnote[1]), label: footnote[1], text: footnote[2] });
        return false;
      }
      return true;
    });
  const blocks = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;
  let codeLang = "";
  let callout = null;

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
      const source = escapeHtml(code.join("\n"));
      if (codeLang === "mermaid") {
        blocks.push(`<figure class="mermaid-diagram"><figcaption>Mermaid</figcaption><pre>${source}</pre></figure>`);
      } else {
        blocks.push(`
          <div class="code-shell">
            <button type="button" data-copy-code>复制</button>
            <pre class="code-block" data-lang="${escapeHtml(codeLang || "text")}"><code>${source}</code></pre>
          </div>
        `);
      }
      code = [];
      codeLang = "";
    }
  }

  function flushCallout() {
    if (callout) {
      blocks.push(`
        <aside class="callout callout-${escapeHtml(callout.type)}">
          <strong>${escapeHtml(callout.title || callout.type.toUpperCase())}</strong>
          ${callout.lines.length ? `<p>${inlineMarkdown(callout.lines.join(" "))}</p>` : ""}
        </aside>
      `);
      callout = null;
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
        flushCallout();
        inCode = true;
        codeLang = line.trim().slice(3).trim().toLowerCase();
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
      flushCallout();
      continue;
    }

    const calloutHeader = line.match(/^>\s*\[!(note|tip|warning|important)\]\s*(.*)$/i);
    if (calloutHeader) {
      flushParagraph();
      flushList();
      flushCallout();
      callout = { type: calloutHeader[1].toLowerCase(), title: calloutHeader[2] || calloutHeader[1], lines: [] };
      continue;
    }

    const calloutLine = line.match(/^>\s+(.+)$/);
    if (callout && calloutLine) {
      callout.lines.push(calloutLine[1]);
      continue;
    }

    if (callout) flushCallout();

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length + 1, 5);
      const id = slugify(heading[2]);
      blocks.push(`<h${level} id="${escapeHtml(id)}">${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
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
  flushCallout();
  if (footnotes.length) {
    blocks.push(`
      <section class="footnotes">
        <h2>Footnotes</h2>
        <ol>
          ${footnotes
            .map((note) => `<li id="footnote-${escapeHtml(note.id)}"><span>${inlineMarkdown(note.text)}</span></li>`)
            .join("")}
        </ol>
      </section>
    `);
  }
  if (options.emptyMessage && !blocks.length) {
    return `<div class="empty-state"><strong>${escapeHtml(options.emptyMessage.title)}</strong><p>${escapeHtml(options.emptyMessage.body)}</p></div>`;
  }
  return blocks.join("");
}

function extractHeadings(markdown) {
  return [...String(markdown || "").matchAll(/^(#{2,4})\s+(.+)$/gm)].map((match) => ({
    title: match[2],
    id: slugify(match[2]),
    level: match[1].length,
  }));
}

function extractArticleToc(markdown) {
  const headings = extractHeadings(markdown);
  if (headings.length) return headings.map((item) => ({ ...item, paragraphIndex: null }));
  return String(markdown || "")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[#>*_`\[\]()~-]/g, " ").replace(/\s+/g, " ").trim())
    .filter((block) => block.length >= 8)
    .slice(0, 12)
    .map((block, index) => ({
      title: block.length > 24 ? `${block.slice(0, 24)}…` : block,
      id: `article-section-${index + 1}`,
      level: 2,
      paragraphIndex: index,
    }));
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
  if (contacts) {
    contacts.innerHTML = (profile.contacts || [])
      .map((item) => {
        const href = item.href || "#";
        const isLink = href && href !== "#";
        return `<a href="${escapeHtml(href)}" ${isLink ? 'target="_blank" rel="noreferrer"' : ""}>${escapeHtml(item.label)} · ${escapeHtml(item.value)}</a>`;
      })
      .join("");
  }

  const status = document.querySelector("[data-status]");
  if (status) {
    status.innerHTML = (profile.status || [])
      .map(
        (item) => `
          <div>
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `,
      )
      .join("");
  }

  const focus = document.querySelector("[data-focus]");
  if (focus) {
    focus.innerHTML = (profile.focus || [])
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
}

function renderSiteModules(content) {
  const target = document.querySelector("[data-site-modules]");
  if (!target) return;
  target.innerHTML = (content.siteModules || [])
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
      ${projectVisual(project)}
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.tagline || project.summary || "")}</p>
      <div class="pill-list compact">
        ${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <span class="project-detail-link">查看详情 →</span>
    </a>
  `;
}

function projectVisual(project, compact = true) {
  const visual = project.visual || {};
  const items = visual.items || project.modules || [];
  return `
    <div class="project-visual ${compact ? "" : "large"}">
      <div class="visual-top">
        <span>${escapeHtml(visual.label || project.name)}</span>
        <strong>${escapeHtml(visual.status || project.status || "In Progress")}</strong>
      </div>
      <div class="visual-main">
        <b>${escapeHtml(visual.metric || project.tagline || "Project Console")}</b>
        <em>${escapeHtml(project.summary || "")}</em>
      </div>
      <div class="visual-dashboard" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="visual-flow">
        ${items.slice(0, compact ? 3 : 6).map((item) => `<i>${escapeHtml(item)}</i>`).join("")}
      </div>
    </div>
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

function architectureFlow(items) {
  if (!items?.length) return "";
  return `
    <section class="wide-section">
      <h2>系统架构图</h2>
      <div class="architecture-flow">
        ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>
  `;
}

function codeList(title, items) {
  if (!items?.length) return "";
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <pre class="code-block">${escapeHtml(items.join("\n"))}</pre>
    </section>
  `;
}

function renderProjects(content) {
  const projects = content.projects || [];
  const html = projects.length
    ? projects.map(projectCard).join("")
    : `<div class="empty-state"><strong>项目作品整理中</strong><p>后续会补充 C# 工程项目、大模型 Demo、Agent 或 RAG 实践。</p></div>`;

  document.querySelector("[data-projects]").innerHTML = html;
  document.querySelector("[data-featured-projects]").innerHTML = projects.slice(0, 3).map(projectCard).join("");

  const current = projects[0];
  if (current) {
    const consoleTarget = document.querySelector("[data-hero-console]");
    if (consoleTarget) {
      consoleTarget.innerHTML = `
        ${projectVisual(current, false)}
        <div class="hero-project-links">
          <a href="#project-${escapeHtml(normalizeSlug(current, 0, "project"))}">查看工程细节</a>
          <span>${escapeHtml(current.github ? "GitHub available" : "GitHub 待补充")}</span>
        </div>
      `;
    }
  }
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
        <p>${escapeHtml(project.tagline || project.summary || "")}</p>
      </div>
      <div class="pill-list compact">${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <div class="detail-grid">
      <section class="wide-section">${projectVisual(project, false)}</section>
      ${architectureFlow(project.architectureDiagram)}
      ${detailList("核心模块", project.modules)}
      ${codeList("目录结构", project.directoryTree)}
      ${detailList("技术选型", project.techChoices)}
      ${detailList("数据库设计", project.databaseDesign)}
      ${detailList("API", project.apiExamples)}
      ${detailList("部署", project.deployment)}
      ${detailList("性能目标", project.performance)}
      <section>
        <h2>问题背景</h2>
        <p>${escapeHtml(project.problem || "待补充。")}</p>
      </section>
      <section>
        <h2>架构说明</h2>
        <p>${escapeHtml(project.architecture || "待补充。")}</p>
      </section>
      ${detailList("项目要点", project.details)}
      ${detailList("当前证据", project.evidence)}
      ${detailList("踩坑与风险", project.pitfalls || project.challenges)}
      ${detailList("下一步", project.nextSteps)}
    </div>
  `;
}

function publishedPosts(content) {
  return (content.posts || []).filter((post) => post.status !== "draft");
}

function postRouteSlug(posts, index) {
  const base = normalizeSlug(posts[index], index, "post");
  const duplicateIndex = posts.slice(0, index).filter((post, current) => normalizeSlug(post, current, "post") === base).length;
  return duplicateIndex ? `${base}-${duplicateIndex + 1}` : base;
}

function postExcerpt(post, limit = 118) {
  const summary = String(post.summary || "").trim();
  const content = String(post.content || post.content_md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\[\]()~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const source = summary.length >= 12 ? summary : content;
  return source.length > limit ? `${source.slice(0, limit).trim()}…` : source;
}

function postWordCount(post) {
  return String(post.content || post.content_md || "").replace(/\s+/g, "").length;
}

function formatCompactCount(value) {
  const count = Number(value) || 0;
  if (count >= 10000) return `${(count / 10000).toFixed(1)}w`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function buildPostColumns(posts) {
  const groups = new Map();
  posts.forEach((post, index) => {
    const name = String(post.category || "未分类").trim() || "未分类";
    if (!groups.has(name)) {
      groups.set(name, {
        name,
        slug: slugify(name) || `column-${groups.size + 1}`,
        posts: [],
        cover: post.columnCover || post.cover || "",
        description: post.columnDescription || `收录关于「${name}」的文章与思考。`,
      });
    }
    const group = groups.get(name);
    group.posts.push({ post, index });
    if (!group.cover && (post.columnCover || post.cover)) group.cover = post.columnCover || post.cover;
    if (post.columnDescription) group.description = post.columnDescription;
  });
  return [...groups.values()];
}

function postCard(post, index, posts) {
  const slug = postRouteSlug(posts, index);
  return `
    <a class="post-card" href="#post-${escapeHtml(slug)}" data-post-card data-title="${escapeHtml(post.title)}" data-category="${escapeHtml(post.category || "")}" data-tags="${escapeHtml((post.tags || []).join(","))}">
      <div class="post-cover">
        ${post.cover ? `<img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="lazy" />` : ""}
      </div>
      <div class="post-card-copy">
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(postExcerpt(post))}</p>
        <div class="card-meta">
          <time>${escapeHtml(post.date || "未设置日期")}</time>
          <span>${calculateReadTime(post.content || post.content_md)} min read</span>
          <span>${escapeHtml(post.category || "文章")}</span>
        </div>
      </div>
    </a>
  `;
}

function renderPosts(content) {
  const posts = publishedPosts(content);
  const list = document.querySelector("[data-posts]");
  const latest = document.querySelector("[data-latest-posts]");
  const search = document.querySelector("[data-post-search]");
  const columnsTarget = document.querySelector("[data-post-columns]");
  const columns = buildPostColumns(posts);

  if (columnsTarget) {
    columnsTarget.innerHTML = columns.length
      ? columns.map((column) => `
          <a class="post-column-card" href="#post-column-${escapeHtml(column.slug)}">
            <div class="post-column-cover">
              ${column.cover ? `<img src="${escapeHtml(column.cover)}" alt="${escapeHtml(column.name)}" loading="lazy" />` : `<span>${escapeHtml(column.name.slice(0, 1))}</span>`}
            </div>
            <div class="post-column-copy">
              <h2>${escapeHtml(column.name)}</h2>
              <p>${escapeHtml(column.description)}</p>
              <div><span>▤ 文章 ${column.posts.length}</span><span>✎ 字数 ${formatCompactCount(column.posts.reduce((sum, item) => sum + postWordCount(item.post), 0))}</span></div>
            </div>
          </a>
        `).join("")
      : `<div class="empty-state"><strong>还没有专栏</strong><p>发布文章并填写专栏名称后，会自动生成专栏。</p></div>`;
  }

  list.innerHTML = posts.length
    ? posts.map((post, index) => postCard(post, index, posts)).join("")
    : `<div class="empty-state"><strong>还没有文章</strong><p>之后写的新文章会显示在这里。</p></div>`;
  latest.innerHTML = posts.length
    ? posts.slice(0, 3).map((post) => postCard(post, posts.indexOf(post), posts)).join("")
    : `<div class="empty-state"><strong>还没有文章</strong><p>文章发布后会自动出现在这里。</p></div>`;

  if (search) {
    search.oninput = () => {
      const resultCount = applyPostFilters();
      scheduleSearchAnalytics("posts", search.value, resultCount);
    };
  }

  const recentPosts = document.querySelector("[data-recent-posts]");
  if (recentPosts) {
    recentPosts.innerHTML = posts.length
      ? posts.slice(0, 5).map((post, index) => `<a href="#post-${escapeHtml(postRouteSlug(posts, index))}"><strong>${escapeHtml(post.title)}</strong><time>${escapeHtml((post.date || "").slice(5) || "未发布")}</time></a>`).join("")
      : `<span>暂无更新</span>`;
  }

  const postCount = document.querySelector("[data-post-count]");
  if (postCount) {
    postCount.textContent = String(posts.length);
  }

  setText("[data-post-words]", formatCompactCount(posts.reduce((sum, post) => sum + postWordCount(post), 0)));

  setText("[data-post-reads]", "0");
  setText("[data-post-today]", "0");
}

function applyPostFilters() {
  const searchValue = document.querySelector("[data-post-search]")?.value.trim().toLowerCase() || "";
  let visibleCount = 0;

  document.querySelectorAll("[data-posts] [data-post-card]").forEach((card) => {
    const text = `${card.dataset.title} ${card.dataset.category} ${card.dataset.tags}`.toLowerCase();
    const matchesSearch = !searchValue || text.includes(searchValue);
    card.hidden = !matchesSearch;
    if (!card.hidden) visibleCount += 1;
  });
  return visibleCount;
}

function renderPostColumn(content, slug) {
  const posts = publishedPosts(content);
  const column = buildPostColumns(posts).find((item) => item.slug === slug);
  const overviewHead = document.querySelector("[data-post-overview-head]");
  const columnsTarget = document.querySelector("[data-post-columns]");
  const detail = document.querySelector("[data-post-column-detail]");
  const head = document.querySelector("[data-post-column-head]");
  const list = document.querySelector("[data-posts]");
  const article = document.querySelector("[data-post-article]");
  if (!column || !detail || !head || !list) return;

  if (overviewHead) overviewHead.hidden = true;
  if (columnsTarget) columnsTarget.hidden = true;
  if (article) article.hidden = true;
  detail.hidden = false;
  head.innerHTML = `
    <a class="back-link" href="#posts">‹ 返回专栏</a>
    <div>
      <h1>${escapeHtml(column.name)}</h1>
      <p>${escapeHtml(column.description)}</p>
    </div>
    <span>${column.posts.length} 篇文章</span>
  `;
  list.innerHTML = column.posts.map(({ post, index }) => postCard(post, index, posts)).join("");
  const search = document.querySelector("[data-post-search]");
  if (search) search.value = "";
}

function setMetaContent(selector, content) {
  const node = document.querySelector(selector);
  if (node) node.setAttribute("content", content || "");
}

function updateArticleSeo(post) {
  const title = post.seoTitle || post.title || "文章";
  const description = post.seoDescription || post.summary || "晏宏翔的技术文章。";
  document.title = `${title} | 晏宏翔`;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
}

function updateDefaultSeo(content) {
  const profile = content.profile || fallbackContent.profile;
  const title = `${profile.name || "晏宏翔"} | AI Agent / RAG 方向`;
  const description = profile.summary || "晏宏翔的个人品牌主页、技术博客、项目作品集、学习档案与 AI 能力展示平台。";
  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
}

function setupArticleInteractions(container) {
  container.querySelectorAll("[data-copy-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".code-shell")?.querySelector("code")?.textContent || "";
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败";
      }
      setTimeout(() => {
        button.textContent = "复制";
      }, 1200);
    });
  });
}

function renderArticle(content, slug) {
  const posts = publishedPosts(content);
  const index = posts.findIndex((post, current) => postRouteSlug(posts, current) === slug);
  const post = posts[index];
  const article = document.querySelector("[data-post-article]");
  const list = document.querySelector("[data-posts]");
  const overviewHead = document.querySelector("[data-post-overview-head]");
  const columnsTarget = document.querySelector("[data-post-columns]");
  const columnDetail = document.querySelector("[data-post-column-detail]");

  if (!post) {
    article.hidden = true;
    list.hidden = false;
    return;
  }

  article.closest('[data-view="posts"]')?.classList.add("is-article-detail");

  const headings = extractArticleToc(post.content);
  const columnPosts = posts.map((item, current) => ({ post: item, index: current })).filter((item) => item.post.category === post.category);
  const columnIndex = columnPosts.findIndex((item) => item.index === index);
  const previous = columnPosts[columnIndex - 1];
  const next = columnPosts[columnIndex + 1];
  const related = relatedEntries(content, [post.title, post.summary, ...(post.tags || [])].join(" "), {
    excludeHref: `#post-${slug}`,
    limit: 4,
  });
  updateArticleSeo(post);

  if (overviewHead) overviewHead.hidden = true;
  if (columnsTarget) columnsTarget.hidden = true;
  if (columnDetail) columnDetail.hidden = true;
  list.hidden = true;
  article.hidden = false;
  const bodyFontSize = Math.max(14, Math.min(24, Number(post.bodyFontSize) || 18));
  article.innerHTML = `
    <a class="back-link" href="#post-column-${escapeHtml(slugify(post.category || "未分类"))}">‹ 返回${escapeHtml(post.category || "专栏")}</a>
    <header class="article-intro-grid">
      <div class="article-photo">
        ${post.cover ? `<img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="eager" />` : ""}
      </div>
      <div class="article-intro-copy">
        <div class="article-heading">
          <h1>${escapeHtml(post.title)}</h1>
        <div class="card-meta">
          <span>${escapeHtml(post.category || "文章")}</span>
          <time>${escapeHtml(post.date || "未设置日期")}</time>
          <span>${calculateReadTime(post.content)} min read</span>
          <span>${formatCompactCount(postWordCount(post))} 字</span>
        </div>
          <p>${escapeHtml(postExcerpt(post, 92))}</p>
        </div>
        <nav class="article-inline-toc" aria-label="文章目录">
          <strong>目录</strong>
          <div>
            ${headings.length ? headings.map((heading) => `<a class="level-${heading.level}" href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>`).join("") : "<span>正文</span>"}
          </div>
        </nav>
      </div>
    </header>
    <div class="article-body" style="--article-font-size: ${bodyFontSize}px">${markdownToHtml(post.content)}</div>
    <nav class="article-nav">
      ${previous ? `<a href="#post-${escapeHtml(postRouteSlug(posts, previous.index))}">上一篇 · ${escapeHtml(previous.post.title)}</a>` : "<span></span>"}
      ${next ? `<a href="#post-${escapeHtml(postRouteSlug(posts, next.index))}">下一篇 · ${escapeHtml(next.post.title)}</a>` : "<span></span>"}
    </nav>
    ${
      related.length
        ? `<section class="related-panel"><h2>相关内容</h2>${related
            .map((entry) => `<a href="${escapeHtml(entry.href)}"><span>${escapeHtml(entry.type)}</span><strong>${escapeHtml(entry.title)}</strong></a>`)
            .join("")}</section>`
        : ""
    }
  `;
  if (!extractHeadings(post.content).length) {
    article.querySelectorAll(".article-body > p").forEach((paragraph, paragraphIndex) => {
      paragraph.id = `article-section-${paragraphIndex + 1}`;
    });
  }
  setupArticleInteractions(article);
}

function renderKnowledgeColumns(content) {
  const target = document.querySelector("[data-knowledge-columns]");
  if (!target) return;
  const columns = content.knowledgeColumns || [];
  target.innerHTML = columns.length
    ? columns.map((column) => `
        <a class="knowledge-folder-card" href="#column-${escapeHtml(column.slug)}" data-knowledge-column-card data-search="${escapeHtml([column.name, column.description].join(" "))}">
          <span class="knowledge-folder-icon" aria-hidden="true"></span>
          <div>
            <h3>${escapeHtml(column.name)}</h3>
            <small>${Number(column.node_count) || 0} 个节点</small>
          </div>
          <span class="knowledge-card-arrow" aria-hidden="true">›</span>
        </a>
      `).join("")
    : `<p class="empty-state">还没有公开知识专栏。</p>`;
}

function renderKnowledgeColumnDetail(content, slug) {
  const columns = content.knowledgeColumns || [];
  const column = columns.find((item) => item.slug === slug);
  const target = document.querySelector("[data-column-detail]");
  const overview = document.querySelector("[data-knowledge-overview]");
  if (!column || !target || !overview) {
    if (target) target.hidden = true;
    if (overview) overview.hidden = false;
    return;
  }
  const nodes = (content.knowledgeNodes || []).filter((node) => (node.columns || []).some((item) => item.slug === slug));
  overview.hidden = true;
  target.hidden = false;
  document.querySelectorAll("[data-knowledge-nav] a").forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#column-${slug}`));
  document.querySelector(".knowledge-nav-root")?.classList.remove("is-active");
  target.innerHTML = `
    <a class="knowledge-breadcrumb" href="#knowledge">专栏</a>
    <header class="knowledge-detail-head">
      <div>
        <h1>${escapeHtml(column.name)}</h1>
        ${column.description ? `<p>${escapeHtml(column.description)}</p>` : ""}
        <small>${nodes.length} 个节点</small>
      </div>
    </header>
    <section class="knowledge-contained-section">
      <div class="knowledge-contained-head"><h2>节点</h2><span>该专栏包含的知识模块</span></div>
      <div class="knowledge-node-folder-grid">
        ${nodes.length ? nodes.map((node) => `
          <a class="knowledge-folder-card knowledge-node-folder" href="#node-${escapeHtml(node.slug)}">
            <span class="knowledge-folder-icon" aria-hidden="true"></span>
            <div><h3>${escapeHtml(node.title)}</h3></div>
            <span class="knowledge-card-arrow" aria-hidden="true">›</span>
          </a>
        `).join("") : `<p class="empty-state">这个专栏暂时没有公开知识节点。</p>`}
      </div>
    </section>
  `;
}

function renderNormalizedKnowledgeNodes(content) {
  const target = document.querySelector("[data-normalized-knowledge-nodes]");
  if (!target) return;
  const nodes = content.knowledgeNodes || [];
  target.innerHTML = nodes.length ? nodes.map((node) => `
    <a class="normalized-node-card" href="#node-${escapeHtml(node.slug)}" data-normalized-node data-search="${escapeHtml([node.title, node.summary, node.node_type, ...(node.tag_names || [])].join(" "))}">
      <div><span>${escapeHtml(node.node_type || "concept")}</span><small>重要度 ${Number(node.importance) || 3}</small></div>
      <h3>${escapeHtml(node.title)}</h3>
      <p>${escapeHtml(node.summary || "")}</p>
      <div class="pill-list compact">${(node.tag_names || []).slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </a>
  `).join("") : `<p class="empty-state">还没有公开知识节点。</p>`;
}

function renderKnowledgeNodeDetail(content, slug) {
  const node = (content.knowledgeNodes || []).find((item) => item.slug === slug);
  const target = document.querySelector("[data-node-detail]");
  const overview = document.querySelector("[data-knowledge-overview]");
  const columnDetail = document.querySelector("[data-column-detail]");
  if (!node || !target || !overview) return;
  overview.hidden = true;
  if (columnDetail) columnDetail.hidden = true;
  target.hidden = false;
  const relations = (node.relations || []).filter((relation) => relation.other_node);
  const primaryColumn = (node.columns || [])[0];
  document.querySelectorAll("[data-knowledge-nav] a").forEach((link) => link.classList.toggle("is-active", primaryColumn && link.getAttribute("href") === `#column-${primaryColumn.slug}`));
  document.querySelector(".knowledge-nav-root")?.classList.remove("is-active");
  target.innerHTML = `
    <a class="knowledge-breadcrumb" href="${primaryColumn ? `#column-${escapeHtml(primaryColumn.slug)}` : "#knowledge"}">${primaryColumn ? escapeHtml(primaryColumn.name) : "专栏"}</a>
    <header class="node-detail-head">
      <div><span>${escapeHtml(node.node_type || "concept")}</span><span>重要度 ${Number(node.importance) || 3}</span></div>
      <h1>${escapeHtml(node.title)}</h1>
      <p>${escapeHtml(node.summary || "")}</p>
      <div class="pill-list compact">${(node.tag_names || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      ${(node.columns || []).length ? `<nav class="article-columns">${node.columns.map((column) => `<a href="#column-${escapeHtml(column.slug)}">${escapeHtml(column.name)}</a>`).join("")}</nav>` : ""}
    </header>
    <div class="article-body">${markdownToHtml(node.content_markdown || node.summary || "")}</div>
    <section class="node-relations"><h2>知识关系</h2>${relations.length ? relations.map((relation) => `<a href="#node-${escapeHtml(relation.other_node.slug)}"><span>${escapeHtml(relation.perspective === "incoming" ? "来源" : "去向")} · ${escapeHtml(relation.relation_label || relation.relation_type)}</span><strong>${escapeHtml(relation.other_node.title)}</strong><p>${escapeHtml(relation.description || relation.other_node.summary || "")}</p></a>`).join("") : `<p class="empty-state">这个节点还没有公开关系。</p>`}</section>
    <section class="node-relations"><h2>相关文章</h2>${(node.articles || []).length ? node.articles.map((article) => `<a href="#post-${escapeHtml(article.slug)}"><span>${escapeHtml(article.relation_type || "references")}</span><strong>${escapeHtml(article.title)}</strong><p>${escapeHtml(article.summary || "")}</p></a>`).join("") : `<p class="empty-state">暂时没有已发布的相关文章。</p>`}</section>
  `;
}

function relatedEntries(content, query, options = {}) {
  return flattenSearchContent(content)
    .map((entry) => ({ ...entry, score: scoreEntry(entry, query) }))
    .filter((entry) => entry.score > 0 && entry.href !== options.excludeHref)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit || 3);
}

function labelMatches(label, candidate) {
  const source = String(label || "").trim().toLowerCase();
  const target = String(candidate || "").trim().toLowerCase();
  if (!source || !target) return false;
  return source === target || source.includes(target) || target.includes(source);
}

function relationMatches(content, labels = []) {
  const values = [...new Set((labels || []).filter(Boolean))];
  const matches = [];

  values.forEach((label) => {
    const projectIndex = (content.projects || []).findIndex((project) => labelMatches(label, project.name) || labelMatches(label, project.slug));
    if (projectIndex >= 0) {
      const project = content.projects[projectIndex];
      matches.push({
        type: "项目",
        title: project.name,
        summary: project.tagline || project.summary || "",
        href: `#project-${normalizeSlug(project, projectIndex, "project")}`,
      });
      return;
    }

    const postIndex = (content.posts || []).findIndex((post) => labelMatches(label, post.title) || labelMatches(label, post.slug));
    if (postIndex >= 0) {
      const post = content.posts[postIndex];
      matches.push({
        type: "文章",
        title: post.title,
        summary: post.summary || "",
        href: `#post-${normalizeSlug(post, postIndex, "post")}`,
      });
      return;
    }

    const knowledgeIndex = (content.knowledgeBase || []).findIndex((group) => {
      const topicMatch = labelMatches(label, group.topic) || labelMatches(label, group.slug);
      const itemMatch = (group.items || []).some((item) => labelMatches(label, item));
      const noteMatch = (group.notes || []).some((note) => labelMatches(label, note.name));
      return topicMatch || itemMatch || noteMatch;
    });
    if (knowledgeIndex >= 0) {
      const group = content.knowledgeBase[knowledgeIndex];
      matches.push({
        type: "知识",
        title: label,
        summary: group.summary || group.topic,
        href: `#knowledge-${normalizeSlug(group, knowledgeIndex, "knowledge")}`,
      });
      return;
    }

    const readingIndex = (content.reading || []).findIndex((item) => labelMatches(label, item.title));
    if (readingIndex >= 0) {
      const item = content.reading[readingIndex];
      matches.push({
        type: "阅读",
        title: item.title,
        summary: [item.author, item.status, item.note].filter(Boolean).join(" · "),
        href: "#about",
      });
      return;
    }

    matches.push({ type: "未归档", title: label, summary: "等待补充为知识节点或内容条目", href: "#knowledge" });
  });

  return matches;
}

function relationList(title, items, emptyText) {
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${
        items.length
          ? items
              .map(
                (item) => `
                  <a href="${escapeHtml(item.href)}">
                    <small>${escapeHtml(item.type)}</small>
                    <strong>${escapeHtml(item.title)}</strong>
                    <span>${escapeHtml(item.summary || "")}</span>
                  </a>
                `,
              )
              .join("")
          : `<p>${escapeHtml(emptyText)}</p>`
      }
    </section>
  `;
}

function relationTypePriority(type) {
  return {
    主题: 7,
    项目: 6,
    文章: 5,
    知识: 4,
    阅读: 3,
    概念: 2,
    未归档: 1,
  }[type] || 0;
}

function knowledgeRelationSummary(content, group) {
  const labels = [
    ...(group.relatedKnowledge || []),
    ...(group.relatedProjects || []),
    ...(group.relatedReading || []),
    ...(group.relatedPosts || []),
  ];
  return relationMatches(content, labels);
}

function buildKnowledgeNetwork(content) {
  const groups = content.knowledgeBase || [];
  const nodes = new Map();
  const edges = new Map();
  const topicIds = [];
  const childrenByTopic = new Map();

  function normalizeNodeId(label) {
    return slugify(label || "node");
  }

  function upsertNode(label, type, href, sourceTopic = "") {
    const id = normalizeNodeId(label);
    const existing = nodes.get(id);
    const next = {
      id,
      label,
      type,
      href: href || "#knowledge",
      sourceTopic,
      weight: 1,
    };

    if (!existing) {
      nodes.set(id, next);
      return next;
    }

    existing.weight += 1;
    if (relationTypePriority(type) > relationTypePriority(existing.type)) {
      existing.type = type;
      existing.href = href || existing.href;
      existing.label = label || existing.label;
    }
    return existing;
  }

  function addEdge(from, to, type = "关联") {
    if (!from || !to || from.id === to.id) return;
    const key = `${from.id}->${to.id}`;
    if (!edges.has(key)) {
      edges.set(key, { from: from.id, to: to.id, type });
    }
  }

  groups.forEach((group, groupIndex) => {
    const slug = normalizeSlug(group, groupIndex, "knowledge");
    const topicNode = upsertNode(group.topic, "主题", `#knowledge-${slug}`, group.topic);
    topicIds.push(topicNode.id);
    childrenByTopic.set(topicNode.id, []);

    const conceptLabels = [...new Set([...(group.items || []), ...(group.notes || []).map((note) => note.name)].filter(Boolean))].slice(0, 5);
    conceptLabels.forEach((label) => {
      const matched = relationMatches(content, [label])[0];
      const node = upsertNode(label, matched?.type === "知识" ? "知识" : "概念", matched?.href || `#knowledge-${slug}`, group.topic);
      childrenByTopic.get(topicNode.id).push(node.id);
      addEdge(topicNode, node, "包含");
    });

    const relationLabels = [
      ...(group.relatedKnowledge || []),
      ...(group.relatedProjects || []),
      ...(group.relatedReading || []),
      ...(group.relatedPosts || []),
    ].filter(Boolean);

    relationMatches(content, [...new Set(relationLabels)].slice(0, 7)).forEach((match) => {
      const node = upsertNode(match.title, match.type, match.href, group.topic);
      childrenByTopic.get(topicNode.id).push(node.id);
      addEdge(topicNode, node, match.type);
    });
  });

  const positionedNodes = [...nodes.values()];
  const topicNodes = topicIds.map((id) => nodes.get(id)).filter(Boolean);
  const radiusX = topicNodes.length > 2 ? 270 : 180;
  const radiusY = topicNodes.length > 2 ? 88 : 62;
  topicNodes.forEach((node, index) => {
    const angle = topicNodes.length === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index / topicNodes.length) * Math.PI * 2;
    node.x = Math.round(450 + Math.cos(angle) * radiusX);
    node.y = Math.round(190 + Math.sin(angle) * radiusY);
  });

  const childCounters = new Map();
  positionedNodes.forEach((node) => {
    if (typeof node.x === "number") return;
    const sourceTopic = topicNodes.find((topic) => (childrenByTopic.get(topic.id) || []).includes(node.id)) || topicNodes[0];
    const count = childCounters.get(sourceTopic.id) || 0;
    childCounters.set(sourceTopic.id, count + 1);
    const angle = -Math.PI / 2 + count * 0.72;
    const spread = 78 + Math.min(count, 4) * 12;
    node.x = Math.max(72, Math.min(828, Math.round(sourceTopic.x + Math.cos(angle) * spread)));
    node.y = Math.max(46, Math.min(334, Math.round(sourceTopic.y + Math.sin(angle) * spread)));
  });

  return {
    nodes: positionedNodes,
    edges: [...edges.values()].filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
  };
}

function renderKnowledgeNetwork(content) {
  const target = document.querySelector("[data-knowledge-map]");
  if (!target) return;
  const graph = buildKnowledgeNetwork(content);
  if (!graph.nodes.length) {
    target.innerHTML = `<div class="empty-state"><strong>还没有可视化节点</strong><p>添加知识主题后会自动生成图谱。</p></div>`;
    return;
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  target.innerHTML = `
    <div class="knowledge-map-canvas">
      <svg class="knowledge-map-svg" viewBox="0 0 900 380" role="img" aria-label="知识网络关系图">
        ${graph.edges
          .map((edge) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" data-edge-type="${escapeHtml(edge.type)}"></line>`;
          })
          .join("")}
      </svg>
      ${graph.nodes
        .map(
          (node) => `
            <a class="knowledge-node" data-node-type="${escapeHtml(node.type)}" href="${escapeHtml(node.href)}" style="--x:${node.x}px; --y:${node.y}px;">
              <span>${escapeHtml(node.type)}</span>
              <strong>${escapeHtml(node.label)}</strong>
            </a>
          `,
        )
        .join("")}
    </div>
    <div class="knowledge-map-legend">
      <span><i></i>主题</span>
      <span><i></i>知识/概念</span>
      <span><i></i>项目/阅读</span>
    </div>
  `;
}

function graphNodeColor(type) {
  return {
    column: "#2f6fec",
    concept: "#167c55",
    article: "#2764a5",
    question: "#b06b16",
    tool: "#7b4bb7",
    project: "#b34747",
    reference: "#4d6674",
  }[type] || "#167c55";
}

const graphClusterPalette = ["#16a77b", "#397ee8", "#8d62d9", "#f39a45", "#de6572", "#39a8a1", "#6e8ed6"];

function graphColumnColor(slug = "") {
  const value = [...String(slug)].reduce((total, char) => total + char.charCodeAt(0), 0);
  return graphClusterPalette[value % graphClusterPalette.length];
}

function graphSemanticGroup(node) {
  const text = [node.title, node.summary, ...(node.tags || [])].join(" ").toLowerCase();
  const groups = [
    { key: "index", title: "索引机制", words: ["index", "hnsw", "ivf", "索引"] },
    { key: "retrieval", title: "检索与召回", words: ["search", "retrieval", "召回", "检索", "rerank", "topk"] },
    { key: "model", title: "数据模型", words: ["collection", "schema", "partition", "chunk", "document", "数据", "切分"] },
    { key: "memory", title: "状态与记忆", words: ["redis", "cache", "memory", "缓存", "状态", "锁"] },
    { key: "runtime", title: "运行与编排", words: ["agent", "tool", "workflow", "langgraph", "fastapi", "任务", "工具"] },
    { key: "foundation", title: "核心基础", words: ["embedding", "vector", "向量", "prompt", "llm", "模型"] },
  ];
  return groups.find((group) => group.words.some((word) => text.includes(word))) || { key: "concept", title: "核心概念" };
}

function renderGraphDetail(nodeData = null) {
  const target = document.querySelector("[data-graph-detail]");
  if (!target) return;
  if (!nodeData) {
    const stats = knowledgeGraphData.stats || {};
    target.innerHTML = `<span>图谱概览</span><strong>${Number(stats.node_count) || 0} 个公开节点</strong><p>单击节点查看摘要与真实关联，双击可进入知识库阅读全文。</p>`;
    return;
  }
  const relatedEdges = (knowledgeGraphData.edges || []).filter((edge) => edge.source === nodeData.id || edge.target === nodeData.id);
  const neighbors = relatedEdges.map((edge) => {
    const otherId = edge.source === nodeData.id ? edge.target : edge.source;
    const other = (knowledgeGraphData.nodes || []).find((node) => node.id === otherId);
    return other ? { ...other, relation: edge.label || edge.relation_type } : null;
  }).filter(Boolean);
  const completeNode = (appContent?.knowledgeNodes || []).find((node) => String(node.id) === String(nodeData.id));
  const articles = completeNode?.articles || [];
  const isColumn = nodeData.node_type === "column";
  const isGroup = nodeData.node_type === "group";
  target.innerHTML = `
    <div class="graph-detail-head"><span>${isColumn ? "知识专栏" : isGroup ? "主题分组" : "知识点"}</span><button type="button" data-graph-detail-close aria-label="关闭详情">×</button></div>
    <strong>${escapeHtml(nodeData.title)}</strong>
    <p>${escapeHtml(nodeData.summary || "暂无摘要")}</p>
    <dl>
      ${isColumn ? "" : `<div><dt>节点类型</dt><dd>${escapeHtml(nodeData.node_type || "concept")}</dd></div>`}
      <div><dt>直接关系</dt><dd>${relatedEdges.length}</dd></div>
      <div><dt>所属专栏</dt><dd>${escapeHtml(isColumn ? nodeData.title : (nodeData.columns || []).map((column) => column.name).join(" / ") || "未分类")}</dd></div>
    </dl>
    ${(nodeData.tags || []).length ? `<div class="graph-detail-tags">${nodeData.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
    ${isGroup ? "" : `<a class="graph-detail-primary" href="${escapeHtml(nodeData.href)}">${isColumn ? "查看专栏" : "查看知识详情"}</a>`}
    <a class="graph-detail-secondary" href="admin/" target="_blank" rel="noreferrer">在后台建立跨专栏关联</a>
    ${neighbors.length ? `<div class="graph-neighbors"><span>直接关联</span>${neighbors.slice(0, 8).map((node) => `<a href="${escapeHtml(node.href)}"><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.relation)}</small></a>`).join("")}</div>` : ""}
    ${articles.length ? `<div class="graph-neighbors"><span>相关文章</span>${articles.slice(0, 5).map((article) => `<a href="#post-${escapeHtml(article.slug)}"><strong>${escapeHtml(article.title)}</strong><small>文章</small></a>`).join("")}</div>` : ""}
  `;
  target.querySelector("[data-graph-detail-close]")?.addEventListener("click", () => {
    knowledgeGraphInstance?.elements().removeClass("faded focused");
    knowledgeGraphInstance?.nodes().unselect();
    renderGraphDetail();
  });
}

function nodesForGraphColumn(content, columnSlug) {
  return (content.knowledgeGraph?.nodes || []).filter((node) =>
    (node.columns || []).some((column) => column.slug === columnSlug),
  );
}

function buildColumnKnowledgeGraph(content, columnSlug) {
  const column = (content.knowledgeColumns || []).find((item) => item.slug === columnSlug);
  const allNodes = content.knowledgeGraph?.nodes || [];
  const selectedNodes = nodesForGraphColumn(content, columnSlug);
  const selectedIds = new Set(selectedNodes.map((node) => String(node.id)));
  const touchingEdges = (content.knowledgeGraph?.edges || []).filter((edge) => selectedIds.has(String(edge.source)) || selectedIds.has(String(edge.target)));
  const externalIds = new Set(touchingEdges.flatMap((edge) => [String(edge.source), String(edge.target)]).filter((id) => !selectedIds.has(id)));
  const externalNodes = allNodes.filter((node) => externalIds.has(String(node.id)));
  const rootId = `column-${columnSlug}`;
  const rootColor = "#16a77b";
  const root = {
    id: rootId,
    title: column?.name || "知识专栏",
    summary: column?.description || "当前知识专栏的主题节点。",
    node_type: "column",
    importance: 6,
    tags: [],
    columns: column ? [{ name: column.name, slug: column.slug }] : [],
    href: `#column-${columnSlug}`,
    cluster_color: rootColor,
    is_root: true,
  };
  const groupsByKey = new Map();
  selectedNodes.forEach((node) => {
    const group = graphSemanticGroup(node);
    if (!groupsByKey.has(group.key)) groupsByKey.set(group.key, { ...group, nodes: [] });
    groupsByKey.get(group.key).nodes.push(node);
  });
  const groupNodes = [...groupsByKey.values()].map((group, index) => ({
    id: `group-${columnSlug}-${group.key}`,
    title: group.title,
    summary: `${column?.name || "当前专栏"}中的${group.title}知识簇。`,
    node_type: "group",
    importance: 4,
    tags: [],
    columns: column ? [{ name: column.name, slug: column.slug }] : [],
    href: `#column-${columnSlug}`,
    cluster_color: graphClusterPalette[index % graphClusterPalette.length],
    is_group: true,
    group_key: group.key,
  }));
  const groupEdges = groupNodes.map((group, index) => ({
    id: `group-link-${columnSlug}-${group.group_key}`,
    source: rootId,
    target: group.id,
    relation_type: "contains",
    label: "包含",
    description: "专栏包含该主题知识簇。",
    weight: 1,
    direction: "directed",
    is_membership: true,
    order: index,
  }));
  const selectedDecorated = selectedNodes.map((node) => {
    const group = graphSemanticGroup(node);
    const groupNode = groupNodes.find((item) => item.group_key === group.key);
    return { ...node, cluster_color: groupNode?.cluster_color || rootColor, group_id: groupNode?.id, is_external: false };
  });
  const membershipEdges = selectedDecorated.map((node, index) => ({
    id: `membership-${columnSlug}-${node.id}`,
    source: node.group_id,
    target: String(node.id),
    relation_type: "contains",
    label: "",
    description: "知识节点属于当前主题知识簇。",
    weight: 1,
    direction: "directed",
    is_membership: true,
    order: index,
  }));
  const externalColumns = [...new Map(externalNodes.flatMap((node) => node.columns || []).filter((item) => item.slug !== columnSlug).map((item) => [item.slug, item])).values()];
  const externalRoots = externalColumns.map((item) => ({
    id: `column-${item.slug}`,
    title: item.name,
    summary: `通过真实知识关系与 ${column?.name || "当前专栏"} 相连。`,
    node_type: "column",
    importance: 4,
    tags: [],
    columns: [item],
    href: `#column-${item.slug}`,
    cluster_color: graphColumnColor(item.slug),
    is_external: true,
    is_root: true,
  }));
  const externalDecorated = externalNodes.map((node) => {
    const externalColumn = (node.columns || []).find((item) => item.slug !== columnSlug) || node.columns?.[0];
    return { ...node, cluster_color: graphColumnColor(externalColumn?.slug), external_root_id: `column-${externalColumn?.slug}`, is_external: true };
  });
  const externalMembershipEdges = externalDecorated.map((node, index) => ({
    id: `external-membership-${columnSlug}-${node.id}`,
    source: node.external_root_id,
    target: String(node.id),
    relation_type: "contains",
    label: "",
    description: "跨专栏关联节点。",
    weight: 1,
    direction: "directed",
    is_membership: true,
    is_external: true,
    order: index,
  }));
  const explicitEdges = touchingEdges.map((edge) => ({ ...edge, is_cross_column: !selectedIds.has(String(edge.source)) || !selectedIds.has(String(edge.target)) }));
  const edges = [...groupEdges, ...membershipEdges, ...externalMembershipEdges, ...explicitEdges];
  return {
    column,
    nodes: [root, ...groupNodes, ...selectedDecorated, ...externalRoots, ...externalDecorated],
    edges,
    stats: { node_count: selectedNodes.length + externalNodes.length, edge_count: edges.length, explicit_edge_count: explicitEdges.length, cross_column_count: explicitEdges.filter((edge) => edge.is_cross_column).length },
  };
}

function clusteredGraphPositions(graph, width = 760, height = 620) {
  const positions = new Map();
  const center = { x: width / 2, y: height / 2 };
  const root = graph.nodes.find((node) => node.is_root && !node.is_external);
  if (root) positions.set(String(root.id), center);
  const groups = graph.nodes.filter((node) => node.is_group);
  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(groups.length, 1);
    const groupPosition = { x: center.x + Math.cos(angle) * 190, y: center.y + Math.sin(angle) * 170 };
    positions.set(String(group.id), groupPosition);
    const children = graph.nodes.filter((node) => node.group_id === group.id);
    children.forEach((node, childIndex) => {
      const childAngle = angle - 0.9 + (1.8 * childIndex) / Math.max(children.length - 1, 1);
      positions.set(String(node.id), { x: groupPosition.x + Math.cos(childAngle) * 90, y: groupPosition.y + Math.sin(childAngle) * 82 });
    });
  });
  const externalRoots = graph.nodes.filter((node) => node.is_root && node.is_external);
  externalRoots.forEach((externalRoot, index) => {
    const angle = Math.PI / 5 + (Math.PI * 1.6 * index) / Math.max(externalRoots.length, 1);
    const rootPosition = { x: center.x + Math.cos(angle) * 330, y: center.y + Math.sin(angle) * 265 };
    positions.set(String(externalRoot.id), rootPosition);
    const children = graph.nodes.filter((node) => node.external_root_id === externalRoot.id);
    children.forEach((node, childIndex) => {
      const childAngle = angle - 0.55 + (1.1 * childIndex) / Math.max(children.length - 1, 1);
      positions.set(String(node.id), { x: rootPosition.x + Math.cos(childAngle) * 76, y: rootPosition.y + Math.sin(childAngle) * 70 });
    });
  });
  return positions;
}

function renderGraphRecommendations(graph) {
  const target = document.querySelector("[data-graph-recommendations]");
  if (!target) return;
  const crossEdges = (graph.edges || []).filter((edge) => edge.is_cross_column);
  target.innerHTML = crossEdges.length ? crossEdges.slice(0, 4).map((edge) => {
    const source = graph.nodes.find((node) => String(node.id) === String(edge.source));
    const destination = graph.nodes.find((node) => String(node.id) === String(edge.target));
    if (!source || !destination) return "";
    return `<article><span>${escapeHtml(edge.label || "知识关联")}</span><strong>${escapeHtml(source.title)} ↔ ${escapeHtml(destination.title)}</strong><p>${escapeHtml(source.columns?.[0]?.name || "知识")} 与 ${escapeHtml(destination.columns?.[0]?.name || "知识")} 已建立真实连接</p><a href="admin/" target="_blank" rel="noreferrer">编辑关联</a></article>`;
  }).join("") : `<div class="graph-recommendation-empty"><strong>当前还没有跨专栏关系</strong><p>在后台为任意两个知识节点建立关系后，会自动在这里和图谱中出现。</p><a href="admin/" target="_blank" rel="noreferrer">建立第一条关联</a></div>`;
}

function populateGraphWorkspace(content, graph) {
  const nodeTypeSelect = document.querySelector("[data-graph-node-type]");
  const relationSelect = document.querySelector("[data-graph-relation-type]");
  const columnList = document.querySelector("[data-graph-column-list]");
  if (columnList) {
    columnList.innerHTML = (content.knowledgeColumns || []).map((column) => {
      const count = nodesForGraphColumn(content, column.slug).length;
      return `<button class="${column.slug === activeKnowledgeGraphColumn ? "is-active" : ""}" type="button" data-graph-column="${escapeHtml(column.slug)}"><span>${escapeHtml(column.name)}</span><strong>${count}</strong></button>`;
    }).join("");
    columnList.querySelectorAll("[data-graph-column]").forEach((button) => {
      button.addEventListener("click", () => {
        activeKnowledgeGraphColumn = button.dataset.graphColumn;
        activeKnowledgeGraphTags.clear();
        renderDatabaseKnowledgeGraph(content);
      });
    });
  }
  if (!nodeTypeSelect || !relationSelect) return;
  const nodeTypes = [...new Set((graph.nodes || []).map((node) => node.node_type).filter((type) => type && type !== "column"))].sort();
  nodeTypeSelect.innerHTML = `<option value="">全部类型</option>${nodeTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  const relationTypes = [...new Set((graph.edges || []).map((edge) => edge.relation_type).filter(Boolean))].sort();
  relationSelect.innerHTML = `<option value="">全部关系</option>${relationTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;
  const tags = [...new Set((graph.nodes || []).flatMap((node) => node.tags || []))].sort();
  const tagTarget = document.querySelector("[data-graph-tag-filter]");
  if (tagTarget) {
    tagTarget.innerHTML = tags.length ? tags.map((tag) => `<button class="${activeKnowledgeGraphTags.has(tag) ? "is-active" : ""}" type="button" data-graph-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("") : `<small>当前专栏暂无标签</small>`;
    tagTarget.querySelectorAll("[data-graph-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        const tag = button.dataset.graphTag;
        if (activeKnowledgeGraphTags.has(tag)) activeKnowledgeGraphTags.delete(tag);
        else activeKnowledgeGraphTags.add(tag);
        button.classList.toggle("is-active", activeKnowledgeGraphTags.has(tag));
        applyKnowledgeGraphFilters();
      });
    });
  }
}

function applyKnowledgeGraphFilters() {
  if (!knowledgeGraphInstance) return;
  const query = [document.querySelector("[data-graph-search]")?.value, document.querySelector("[data-graph-filter-search]")?.value].find((value) => value?.trim())?.trim().toLowerCase() || "";
  const nodeType = document.querySelector("[data-graph-node-type]")?.value || "";
  const relationType = document.querySelector("[data-graph-relation-type]")?.value || "";
  const connectedOnly = document.querySelector("[data-graph-connected-only]")?.checked || false;
  const visibleIds = new Set();
  let firstVisibleNode = null;
  knowledgeGraphInstance.nodes().forEach((element) => {
    const data = element.data();
    const text = [data.title, data.summary, ...(data.tags || [])].join(" ").toLowerCase();
    const isRoot = data.node_type === "column" || data.node_type === "group";
    const matches = isRoot || ((!query || text.includes(query))
      && (!nodeType || data.node_type === nodeType)
      && (!activeKnowledgeGraphTags.size || [...activeKnowledgeGraphTags].every((tag) => (data.tags || []).includes(tag)))
      && (!connectedOnly || element.connectedEdges().filter((edge) => !edge.data("is_membership")).length > 0));
    element.style("display", matches ? "element" : "none");
    if (matches) {
      visibleIds.add(String(data.id));
      firstVisibleNode ||= element;
    }
  });
  let visibleEdges = 0;
  knowledgeGraphInstance.edges().forEach((element) => {
    const data = element.data();
    const matches = visibleIds.has(String(element.source().id()))
      && visibleIds.has(String(element.target().id()))
      && (!relationType || data.relation_type === relationType);
    element.style("display", matches ? "element" : "none");
    if (matches) visibleEdges += 1;
  });
  const stats = document.querySelector("[data-graph-stats]");
  const visibleKnowledgeCount = knowledgeGraphInstance.nodes(":visible").filter((node) => !["column", "group"].includes(node.data("node_type"))).length;
  if (stats) stats.innerHTML = `<span>知识节点 <strong>${visibleKnowledgeCount}</strong></span><span>真实关系 <strong>${visibleEdges}</strong></span>`;
  const summary = document.querySelector("[data-graph-summary]");
  if (summary) summary.textContent = `共 ${visibleKnowledgeCount} 个节点，${visibleEdges} 条关系，支持跨专栏连接`;
  knowledgeGraphInstance.elements().removeClass("faded focused");
  knowledgeGraphInstance.nodes().unselect();
  if (query && firstVisibleNode) {
    firstVisibleNode.select();
    firstVisibleNode.closedNeighborhood().addClass("focused");
    renderGraphDetail(firstVisibleNode.data());
  } else if (!query) {
    renderGraphDetail();
  }
  if (visibleIds.size) knowledgeGraphInstance.fit(knowledgeGraphInstance.elements(":visible"), 52);
}

function bindKnowledgeGraphControls() {
  const search = document.querySelector("[data-graph-search]");
  const filterSearch = document.querySelector("[data-graph-filter-search]");
  const nodeType = document.querySelector("[data-graph-node-type]");
  const relationType = document.querySelector("[data-graph-relation-type]");
  const connectedOnly = document.querySelector("[data-graph-connected-only]");
  [search, filterSearch, nodeType, relationType, connectedOnly].forEach((control) => {
    if (control) control.oninput = applyKnowledgeGraphFilters;
  });
  document.querySelectorAll("[data-graph-fit]").forEach((button) => { button.onclick = () => knowledgeGraphInstance?.fit(knowledgeGraphInstance.elements(":visible"), 60); });
  document.querySelectorAll("[data-graph-zoom-in]").forEach((button) => { button.onclick = () => {
    if (knowledgeGraphInstance) knowledgeGraphInstance.zoom({ level: Math.min(knowledgeGraphInstance.maxZoom(), knowledgeGraphInstance.zoom() * 1.25), renderedPosition: { x: knowledgeGraphInstance.width() / 2, y: knowledgeGraphInstance.height() / 2 } });
  }; });
  document.querySelectorAll("[data-graph-zoom-out]").forEach((button) => { button.onclick = () => {
    if (knowledgeGraphInstance) knowledgeGraphInstance.zoom({ level: Math.max(knowledgeGraphInstance.minZoom(), knowledgeGraphInstance.zoom() / 1.25), renderedPosition: { x: knowledgeGraphInstance.width() / 2, y: knowledgeGraphInstance.height() / 2 } });
  }; });
  document.querySelector("[data-graph-reset]").onclick = () => {
    [search, filterSearch].forEach((input) => { if (input) input.value = ""; });
    [nodeType, relationType].forEach((select) => { if (select) select.value = ""; });
    if (connectedOnly) connectedOnly.checked = false;
    activeKnowledgeGraphTags.clear();
    document.querySelectorAll("[data-graph-tag]").forEach((button) => button.classList.remove("is-active"));
    applyKnowledgeGraphFilters();
  };
  document.querySelectorAll("[data-graph-layout]").forEach((button) => {
    button.onclick = () => {
      activeKnowledgeGraphLayout = button.dataset.graphLayout;
      document.querySelectorAll("[data-graph-layout]").forEach((item) => item.classList.toggle("is-active", item === button));
      runKnowledgeGraphLayout();
    };
  });
  document.querySelector("[data-graph-fullscreen]").onclick = async () => {
    const studio = document.querySelector("[data-graph-studio]");
    if (!document.fullscreenElement) await studio?.requestFullscreen?.();
    else await document.exitFullscreen?.();
    window.setTimeout(() => { knowledgeGraphInstance?.resize(); knowledgeGraphInstance?.fit(undefined, 60); }, 120);
  };
  document.querySelector("[data-graph-export]").onclick = () => {
    const blob = new Blob([JSON.stringify(knowledgeGraphData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeKnowledgeGraphColumn || "knowledge"}-graph.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
}

function runKnowledgeGraphLayout() {
  if (!knowledgeGraphInstance) return;
  if (activeKnowledgeGraphLayout === "clustered") {
    const positions = clusteredGraphPositions(knowledgeGraphData, knowledgeGraphInstance.width(), knowledgeGraphInstance.height());
    knowledgeGraphInstance.layout({
      name: "preset",
      positions: (node) => positions.get(String(node.id())) || { x: knowledgeGraphInstance.width() / 2, y: knowledgeGraphInstance.height() / 2 },
      animate: true,
      animationDuration: 520,
      fit: true,
      padding: 64,
    }).run();
    return;
  }
  const options = activeKnowledgeGraphLayout === "cose"
    ? { name: "cose", animate: true, animationDuration: 520, fit: true, padding: 72, nodeRepulsion: 13000, idealEdgeLength: 125, gravity: 0.16, numIter: 1400, randomize: true }
    : { name: activeKnowledgeGraphLayout, animate: false, fit: true, padding: 72, startAngle: -Math.PI / 2, minNodeSpacing: 55 };
  knowledgeGraphInstance.layout(options).run();
}

let cytoscapeModulePromise = null;

async function ensureCytoscape() {
  if (typeof window.cytoscape === "function") return window.cytoscape;
  cytoscapeModulePromise ||= import("./vendor/cytoscape.esm.min.mjs").then((module) => {
    window.cytoscape = module.default;
    return module.default;
  });
  return cytoscapeModulePromise;
}

async function renderDatabaseKnowledgeGraph(content) {
  const target = document.querySelector("[data-knowledge-map]");
  const columns = content.knowledgeColumns || [];
  if (!activeKnowledgeGraphColumn || !columns.some((column) => column.slug === activeKnowledgeGraphColumn)) activeKnowledgeGraphColumn = columns[0]?.slug || "";
  const graph = buildColumnKnowledgeGraph(content, activeKnowledgeGraphColumn);
  knowledgeGraphData = graph;
  if (!target) return;
  populateGraphWorkspace(content, graph);
  renderGraphRecommendations(graph);
  const title = document.querySelector("[data-graph-title]");
  if (title) title.textContent = graph.column?.name || "知识网络";
  if (!graph.nodes?.length) {
    target.innerHTML = `<div class="empty-state"><strong>还没有公开图谱节点</strong><p>在后台创建节点和关系后会显示在这里。</p></div>`;
    renderGraphDetail();
    return;
  }
  try {
    await ensureCytoscape();
  } catch (error) {
    console.error("Unable to load knowledge graph engine", error);
    target.innerHTML = `<div class="graph-fallback">${graph.nodes.map((node) => `<a href="${escapeHtml(node.href)}">${escapeHtml(node.title)}</a>`).join("")}</div>`;
    renderGraphDetail();
    return;
  }
  if (knowledgeGraphInstance) knowledgeGraphInstance.destroy();
  target.innerHTML = "";
  knowledgeGraphInstance = window.cytoscape({
    container: target,
    elements: [
      ...graph.nodes.map((node) => ({ group: "nodes", data: { ...node, id: String(node.id) } })),
      ...graph.edges.map((edge) => ({ group: "edges", data: edge })),
    ],
    minZoom: 0.35,
    maxZoom: 2.5,
    wheelSensitivity: 0.22,
    style: [
      { selector: "node", style: { "background-color": "data(cluster_color)", "background-opacity": 0.12, "label": "data(title)", "color": "#17221d", "font-size": 10, "font-weight": 700, "text-wrap": "wrap", "text-max-width": 82, "text-valign": "center", "width": 46, "height": 46, "border-width": 1.5, "border-color": "data(cluster_color)", "shadow-blur": 18, "shadow-opacity": 0.18, "shadow-color": "data(cluster_color)", "transition-property": "width height border-width opacity", "transition-duration": "180ms" } },
      { selector: "node[node_type = 'column']", style: { "width": (element) => element.data("is_external") ? 62 : 88, "height": (element) => element.data("is_external") ? 62 : 88, "background-opacity": 0.9, "color": "#ffffff", "font-size": (element) => element.data("is_external") ? 11 : 14, "border-width": 5, "border-opacity": 0.18, "shadow-blur": 28, "shadow-opacity": 0.28 } },
      { selector: "node[node_type = 'group']", style: { "width": 64, "height": 64, "background-opacity": 0.78, "color": "#ffffff", "font-size": 11, "border-width": 8, "border-opacity": 0.12, "shadow-blur": 22, "shadow-opacity": 0.22 } },
      { selector: "node[is_external]", style: { "background-opacity": 0.18, "border-style": "dashed" } },
      { selector: "edge", style: { "width": (element) => element.data("is_cross_column") ? 2.8 : element.data("is_membership") ? 1.2 : Math.max(1.8, Math.min(4, Number(element.data("weight")) || 1)), "line-color": (element) => element.data("is_cross_column") ? "#e69542" : element.data("is_membership") ? "#b5c2bb" : "#55a887", "line-opacity": (element) => element.data("is_membership") ? 0.58 : 0.92, "line-style": (element) => element.data("is_membership") ? "dashed" : "solid", "target-arrow-color": (element) => element.data("is_cross_column") ? "#e69542" : element.data("is_membership") ? "#b5c2bb" : "#55a887", "target-arrow-shape": (element) => element.data("is_membership") ? "none" : "triangle", "arrow-scale": 0.65, "curve-style": "bezier", "label": (element) => element.data("is_cross_column") ? element.data("label") : "", "font-size": 8, "color": "#7c684d", "text-background-color": "#ffffff", "text-background-opacity": 0.94, "text-background-padding": 3 } },
      { selector: "node:selected", style: { "border-color": "#245fcc", "border-width": 4, "overlay-opacity": 0.05, "overlay-color": "#2f6fec" } },
      { selector: ".faded", style: { "opacity": 0.16, "text-opacity": 0.1 } },
      { selector: ".focused", style: { "opacity": 1, "z-index": 10 } },
    ],
    layout: { name: "preset" },
  });
  knowledgeGraphInstance.on("tap", "node", (event) => {
    const node = event.target;
    const now = Date.now();
    const isDoubleTap = lastGraphNodeTap.id === node.id() && now - lastGraphNodeTap.at < 360;
    lastGraphNodeTap = { id: node.id(), at: now };
    if (isDoubleTap && node.data("href")) {
      window.location.hash = node.data("href").replace(/^#/, "");
      return;
    }
    knowledgeGraphInstance.elements().addClass("faded");
    node.closedNeighborhood().removeClass("faded").addClass("focused");
    renderGraphDetail(node.data());
  });
  knowledgeGraphInstance.on("tap", (event) => {
    if (event.target !== knowledgeGraphInstance) return;
    knowledgeGraphInstance.elements().removeClass("faded focused");
    renderGraphDetail();
  });
  bindKnowledgeGraphControls();
  runKnowledgeGraphLayout();
  applyKnowledgeGraphFilters();
  renderGraphDetail();
}
function renderKnowledge(content) {
  const groups = content.knowledgeBase || [];
  const normalizedNodes = content.knowledgeNodes || [];
  const target = document.querySelector("[data-knowledge]");
  if (!target) return;
  target.hidden = normalizedNodes.length > 0;
  target.innerHTML = groups
    .map((group, index) => {
      const slug = normalizeSlug(group, index, "knowledge");
      const searchable = [
        group.topic,
        group.summary,
        ...(group.items || []),
        ...(group.relatedProjects || []),
        ...(group.relatedKnowledge || []),
        ...(group.relatedReading || []),
        ...(group.relatedPosts || []),
        ...(group.notes || []).flatMap((note) => [note.name, note.description, note.example, ...(note.links || [])]),
      ].join(" ");
      return `
        <a class="knowledge-card" href="#knowledge-${escapeHtml(slug)}" data-knowledge-card data-search="${escapeHtml(searchable)}">
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

  const search = document.querySelector("[data-knowledge-search]");
  if (search) {
    search.oninput = () => {
      const resultCount = applyKnowledgeSearch();
      scheduleSearchAnalytics("knowledge", search.value, resultCount);
    };
  }

  const nav = document.querySelector("[data-knowledge-nav]");
  if (nav) {
    nav.innerHTML = (content.knowledgeColumns || []).length
      ? (content.knowledgeColumns || []).map((column) => `<a href="#column-${escapeHtml(column.slug)}"><span class="knowledge-nav-folder" aria-hidden="true"></span>${escapeHtml(column.name)}</a>`).join("")
      : `<span class="empty">暂无专栏</span>`;
  }

  const relations = document.querySelector("[data-knowledge-relations]");
  if (relations) {
    relations.innerHTML = groups.length
      ? groups
          .map(
            (group) => {
              const matches = knowledgeRelationSummary(content, group).slice(0, 5);
              return `
              <article>
                <strong>${escapeHtml(group.topic)}</strong>
                <span>${escapeHtml((group.items || []).join(" / "))}</span>
                <div class="relation-chips">
                  ${
                    matches.length
                      ? matches.map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.type)} · ${escapeHtml(item.title)}</a>`).join("")
                      : "<small>等待关联内容</small>"
                  }
                </div>
              </article>
            `;
            },
          )
          .join("")
      : `<div class="empty-state"><strong>还没有知识节点</strong><p>添加知识库内容后会自动生成节点关系。</p></div>`;
  }

  const graphSection = document.querySelector(".knowledge-graph");
  if (graphSection) graphSection.hidden = false;
}

function applyKnowledgeSearch() {
  const query = document.querySelector("[data-knowledge-search]")?.value.trim().toLowerCase() || "";
  let visibleCount = 0;
  document.querySelectorAll("[data-knowledge-column-card]").forEach((card) => {
    const text = card.dataset.search.toLowerCase();
    card.hidden = Boolean(query) && !text.includes(query);
    if (!card.hidden) visibleCount += 1;
  });
  return visibleCount;
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
  const query = [group.topic, group.summary, ...(group.items || []), ...(group.notes || []).map((note) => note.name)].join(" ");
  const related = relatedEntries(content, query, { excludeHref: `#knowledge-${slug}`, limit: 6 });
  const explicitRelations = knowledgeRelationSummary(content, group);
  const noteRelations = relationMatches(content, (group.notes || []).flatMap((note) => note.links || []));
  const allRelations = [...explicitRelations, ...noteRelations];
  const uniqueRelations = allRelations.filter(
    (item, currentIndex) => allRelations.findIndex((candidate) => candidate.type === item.type && candidate.title === item.title) === currentIndex,
  );
  const knowledgeLinks = uniqueRelations.filter((item) => item.type === "知识");
  const projectLinks = uniqueRelations.filter((item) => item.type === "项目");
  const readingLinks = uniqueRelations.filter((item) => item.type === "阅读");
  const articleLinks = [
    ...uniqueRelations.filter((item) => item.type === "文章"),
    ...related.filter((entry) => entry.type === "文章").map((entry) => ({ type: "文章", title: entry.title, summary: entry.subtitle || "", href: entry.href })),
  ].filter((item, currentIndex, items) => items.findIndex((candidate) => candidate.title === item.title) === currentIndex);
  const backlinkLabels = new Set([group.topic, ...(group.items || []), ...(group.notes || []).map((note) => note.name)].map((item) => String(item).toLowerCase()));
  const backlinks = groups
    .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
    .filter(({ candidate }) => candidate !== group)
    .filter(({ candidate }) => {
      const labels = [
        ...(candidate.relatedKnowledge || []),
        ...(candidate.relatedProjects || []),
        ...(candidate.relatedReading || []),
        ...(candidate.relatedPosts || []),
        ...(candidate.notes || []).flatMap((note) => note.links || []),
      ];
      return labels.some((label) => backlinkLabels.has(String(label).toLowerCase()));
    })
    .map(({ candidate, candidateIndex }) => ({
      type: "知识",
      title: candidate.topic,
      summary: candidate.summary || "",
      href: `#knowledge-${normalizeSlug(candidate, candidateIndex, "knowledge")}`,
    }));

  function noteLinkPills(note) {
    const matches = relationMatches(content, note.links || []);
    return matches.length
      ? `<div class="pill-list compact relation-pill-list">${matches
          .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.type)} · ${escapeHtml(item.title)}</a>`)
          .join("")}</div>`
      : "";
  }

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
    <div class="knowledge-detail-layout">
      <aside class="node-index">
        <strong>节点</strong>
        ${(group.notes || []).map((note) => `<a href="#node-${escapeHtml(slugify(note.name))}">${escapeHtml(note.name)}</a>`).join("")}
      </aside>
      <div class="note-grid knowledge-notes">
      ${(group.notes || [])
        .map(
          (note) => `
            <article class="note-card" id="node-${escapeHtml(slugify(note.name))}">
              <h2>${escapeHtml(note.name)}</h2>
              <p>${escapeHtml(note.description)}</p>
              ${note.example ? `<pre class="code-block">${escapeHtml(note.example)}</pre>` : ""}
              ${noteLinkPills(note)}
            </article>
          `,
        )
        .join("")}
      </div>
      <aside class="relation-panel">
        ${relationList("反向链接", backlinks, "暂时没有其它知识节点指向这里。")}
        ${relationList("相关知识", knowledgeLinks, "等待补充更多知识节点。")}
        ${relationList("关联项目", projectLinks, "目前还没有真实项目关联。")}
        ${relationList("相关文章", articleLinks, "文章发布后会自动关联到这里。")}
        ${relationList("阅读材料", readingLinks, "阅读记录补充后会显示在这里。")}
      </aside>
    </div>
  `;
}

function renderRoadmap(content) {
  const mapTarget = document.querySelector("[data-learning-map]");
  const readingTarget = document.querySelector("[data-reading]");
  const timelineTarget = document.querySelector("[data-timeline]");
  if (!mapTarget || !readingTarget || !timelineTarget) return;

  mapTarget.innerHTML = (content.learningMap || [])
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

  readingTarget.innerHTML = (content.reading || [])
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

  timelineTarget.innerHTML = (content.timeline || [])
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
  const profile = content.profile || fallbackContent.profile;
  renderTimeline("[data-education]", about.education);
  renderTimeline("[data-experience]", about.experience);
  renderReadingDashboard(content);
  const valuesTarget = document.querySelector("[data-values]");
  if (valuesTarget) {
    valuesTarget.innerHTML = (about.values || [])
      .map((item) => `<p>${escapeHtml(item)}</p>`)
      .join("");
  }

  const homeAbout = document.querySelector("[data-home-about]");
  if (homeAbout) {
    homeAbout.textContent =
      "2025 年毕业于江西师范大学计算机专业，目前在上海做 C# 工程开发。正在把工程经验迁移到大模型应用方向，重点关注 RAG、Agent、知识库系统和可落地的业务场景。";
  }

  const education = about.education?.[0] || {};
  const experience = about.experience?.[0] || {};
  const emailContact = (profile.contacts || []).find((item) => String(item.href || "").startsWith("mailto:"));
  const githubContact = (profile.contacts || []).find((item) => item.label === "GitHub");
  const profileTarget = document.querySelector("[data-about-profile]");
  if (profileTarget) {
    const avatar = profile.avatar_url
      ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.name)}" />`
      : `<span>${escapeHtml(profile.initials || profile.name?.slice(0, 1) || "晏")}</span>`;
    profileTarget.innerHTML = `
      <div class="about-profile-visual">
        <figure>${avatar}<i aria-label="当前在线"></i></figure>
      </div>
      <div class="about-profile-copy">
        <h1>${escapeHtml(profile.name)}</h1>
        <strong>${escapeHtml(profile.role || "AI Agent / RAG 工程师方向")}</strong>
        <p>${escapeHtml(profile.summary || "")}</p>
      </div>
      <div class="about-profile-facts">
        <div><i>◇</i><span>教育背景<strong>${escapeHtml(education.title || "江西师范大学")} · 计算机专业</strong></span></div>
        <div><i>▣</i><span>工作经历<strong>${escapeHtml(experience.meta || "C# 工程师 · 2025 - 至今")}</strong></span></div>
        <div><i>⌘</i><span>技术专长<strong>AI Agent · RAG · 系统设计 · Python · 数据库</strong></span></div>
        <div><i>♥</i><span>兴趣爱好<strong>阅读 · 写作 · 思考 · 健身</strong></span></div>
        <div><i>✉</i><span>邮箱<strong>${escapeHtml(emailContact?.value || "Cecilia030906@proton.me")}</strong></span></div>
        <div><i>⌖</i><span>所在地<strong>中国 · 上海</strong></span></div>
      </div>
      <div class="about-profile-actions">
        <a href="${escapeHtml(emailContact?.href || "mailto:Cecilia030906@proton.me")}">联系我 <span>→</span></a>
        <button type="button" data-about-print>导出简历 <span>⇩</span></button>
      </div>
    `;
    profileTarget.querySelector("[data-about-print]")?.addEventListener("click", () => window.print());
  }

  const posts = (content.posts || []).filter((post) => post.status !== "draft");
  const writingWords = posts.reduce((total, post) => total + String(post.content || post.content_markdown || "").replace(/\s+/g, "").length, 0);
  const nodes = content.knowledgeNodes || [];
  const notes = countKnowledgeNotes(content);
  const statTarget = document.querySelector("[data-about-stats]");
  if (statTarget) {
    const stats = [
      ["▧", inclusiveDaysSince("2026-07-01"), "连续学习天数", "从 2026-07-01 开始"],
      ["□", posts.length, "文章发布数", `${writingWords.toLocaleString("zh-CN")} 字沉淀`],
      ["⌘", nodes.length, "知识节点", `${(content.knowledgeColumns || []).length} 个专栏 · ${(content.knowledgeGraph?.edges || []).length} 条关系`],
      ["◇", notes, "知识笔记", "持续积累中"],
    ];
    statTarget.innerHTML = stats.map(([icon, value, label, note]) => `<article><i>${icon}</i><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></article>`).join("");
  }

  const buildingTarget = document.querySelector("[data-about-building]");
  if (buildingTarget) {
    const building = content.building?.items || [];
    buildingTarget.innerHTML = building.slice(0, 3).map((item, index) => {
      const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
      const tone = ["green", "amber", "blue"][index] || "green";
      return `
        <article data-tone="${tone}">
          <header><i>${["◒", "▤", "▦"][index] || "◇"}</i><strong>${escapeHtml(item.title)}</strong></header>
          <p>${escapeHtml(item.description || "")}</p>
          <div class="about-progress"><span><b style="width:${progress}%"></b></span><small>进度 ${progress}%</small></div>
          <em>${escapeHtml(item.status || "进行中")}</em>
        </article>
      `;
    }).join("");
  }

  const techTarget = document.querySelector("[data-about-tech]");
  if (techTarget) {
    techTarget.innerHTML = (content.techStack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  const linkTarget = document.querySelector("[data-about-links]");
  if (linkTarget) {
    const githubReady = githubContact && githubContact.value && githubContact.value !== "待补充";
    linkTarget.innerHTML = `
      ${githubReady ? `<a href="${escapeHtml(githubContact.href)}" target="_blank" rel="noreferrer"><i>GH</i><span>GitHub</span></a>` : `<div><i>GH</i><span>GitHub · 待补充</span></div>`}
      <a href="#posts"><i>文</i><span>技术文章</span></a>
      <a href="#graph"><i>图</i><span>知识图谱</span></a>
      <a href="${escapeHtml(emailContact?.href || "mailto:Cecilia030906@proton.me")}"><i>✉</i><span>邮箱</span></a>
    `;
  }

  const readingTarget = document.querySelector("[data-about-reading]");
  if (readingTarget) {
    const reading = content.reading || [];
    const readingCount = reading.filter((item) => item.status === "在读").length;
    const plannedCount = reading.filter((item) => item.status === "想读").length;
    const relatedCount = new Set(reading.flatMap((item) => item.relatedKnowledge || [])).size;
    const total = Math.max(1, reading.length);
    const readDegrees = Math.round((readingCount / total) * 360);
    const plannedDegrees = Math.round((plannedCount / total) * 360);
    readingTarget.innerHTML = `
      <div class="about-reading-chart" style="--reading-deg:${readDegrees}deg;--planned-deg:${plannedDegrees}deg"><strong>${reading.length}</strong><span>阅读记录</span></div>
      <dl>
        <div><dt><i data-tone="green"></i>总阅读</dt><dd>${reading.length}</dd></div>
        <div><dt><i data-tone="light"></i>在读</dt><dd>${readingCount}</dd></div>
        <div><dt><i data-tone="amber"></i>想读</dt><dd>${plannedCount}</dd></div>
        <div><dt><i data-tone="gray"></i>关联知识</dt><dd>${relatedCount}</dd></div>
      </dl>
    `;
  }

  const growthTarget = document.querySelector("[data-about-growth]");
  if (growthTarget) {
    const timeline = content.timeline || [];
    growthTarget.innerHTML = timeline.map((item, index) => `
      <article>
        <i>${["◇", "▣", "⌘", "◎"][index] || "○"}</i>
        <span>${escapeHtml(item.time)}</span>
        <p>${escapeHtml(item.event)}</p>
      </article>
    `).join("");
  }
}

function renderReadingDashboard(content) {
  const target = document.querySelector("[data-reading-dashboard]");
  if (!target) return;
  const reading = content.reading || [];
  const stats = [
    ["总阅读", reading.length],
    ["在读", reading.filter((item) => item.status === "在读").length],
    ["想读", reading.filter((item) => item.status === "想读").length],
    ["关联知识", new Set(reading.flatMap((item) => item.relatedKnowledge || [])).size],
  ];

  target.innerHTML = `
    <div class="section-title">
      <div>
        <p>Reading Dashboard</p>
        <h2>阅读记录</h2>
      </div>
      <a href="#knowledge">关联知识库 →</a>
    </div>
    <div class="reading-stats">
      ${stats.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
    </div>
    <div class="reading-grid">
      ${
        reading.length
          ? reading
              .map((book) => {
                const relations = relationMatches(content, [
                  ...(book.relatedKnowledge || []),
                  ...(book.relatedProjects || []),
                  ...(book.relatedPosts || []),
                ]).slice(0, 6);
                const progress = Math.max(0, Math.min(100, Number(book.progress || 0)));
                return `
                  <article class="reading-card">
                    <div class="card-meta">
                      <span>${escapeHtml(book.status || "记录中")}</span>
                      <span>${progress}%</span>
                    </div>
                    <h3>${escapeHtml(book.title)}</h3>
                    <p>${escapeHtml(book.author || "")}</p>
                    <p>${escapeHtml(book.note || "")}</p>
                    <div class="reading-progress" aria-label="阅读进度 ${progress}%"><span style="width:${progress}%"></span></div>
                    ${
                      (book.highlights || []).length
                        ? `<ul>${book.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
                        : ""
                    }
                    ${
                      relations.length
                        ? `<div class="relation-pill-list">${relations
                            .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.type)} · ${escapeHtml(item.title)}</a>`)
                            .join("")}</div>`
                        : ""
                    }
                  </article>
                `;
              })
              .join("")
          : `<div class="empty-state"><strong>还没有阅读记录</strong><p>添加书籍后会自动生成阅读仪表盘。</p></div>`
      }
    </div>
  `;
}

function renderTimeline(selector, items) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = (items || [])
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

function aiScopeCatalogKey(type) {
  return { column: "columns", node: "nodes", article: "articles", document: "documents" }[type] || "";
}

function renderAiScopeValues() {
  const typeSelect = document.querySelector("[data-ai-scope-type]");
  const valueSelect = document.querySelector("[data-ai-scope-value]");
  const valueWrap = document.querySelector("[data-ai-scope-value-wrap]");
  const note = document.querySelector("[data-ai-scope-note]");
  if (!typeSelect || !valueSelect || !valueWrap || !note) return;
  const type = typeSelect.value;
  const key = aiScopeCatalogKey(type);
  const items = key ? aiScopeCatalog[key] || [] : [];
  valueWrap.hidden = type === "all";
  valueSelect.innerHTML = items.length
    ? items.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("")
    : `<option value="">暂无可用内容</option>`;
  const savedValue = localStorage.getItem(`portfolio.ai.scope.${type}`) || "";
  if (savedValue && items.some((item) => String(item.id) === savedValue)) valueSelect.value = savedValue;
  const labels = { column: "专栏", node: "知识节点", article: "文章", document: "文档" };
  note.textContent = type === "all"
    ? "检索全部已公开且允许 AI 使用的内容。"
    : items.length
      ? `只检索与所选${labels[type]}直接关联的公开内容。`
      : `当前没有可用于 AI 检索的公开${labels[type]}。`;
}

async function loadAiScopeCatalog() {
  try {
    const response = await fetch(`${aiApiUrl.replace(/\/ask$/, "")}/scopes`, { cache: "no-store", credentials: "include" });
    if (!response.ok) throw new Error(`Scope request failed: ${response.status}`);
    aiScopeCatalog = await response.json();
  } catch {
    aiScopeCatalog = { columns: [], nodes: [], articles: [], documents: [] };
  }
  renderAiScopeValues();
}

function setupAiScopeSelector() {
  const typeSelect = document.querySelector("[data-ai-scope-type]");
  const valueSelect = document.querySelector("[data-ai-scope-value]");
  if (!typeSelect || !valueSelect) return;
  const savedType = localStorage.getItem("portfolio.ai.scope.type") || "all";
  if ([...typeSelect.options].some((option) => option.value === savedType)) typeSelect.value = savedType;
  typeSelect.onchange = () => {
    localStorage.setItem("portfolio.ai.scope.type", typeSelect.value);
    renderAiScopeValues();
  };
  valueSelect.onchange = () => {
    localStorage.setItem(`portfolio.ai.scope.${typeSelect.value}`, valueSelect.value);
  };
  renderAiScopeValues();
  loadAiScopeCatalog();
}

function readAiRetrievalScope() {
  const type = document.querySelector("[data-ai-scope-type]")?.value || "all";
  const id = Number(document.querySelector("[data-ai-scope-value]")?.value || 0);
  if (type === "all") return {};
  const selectedId = id || -1;
  if (type === "column") return { column_ids: [selectedId] };
  if (type === "node") return { node_ids: [selectedId] };
  if (type === "article") return { article_ids: [selectedId] };
  if (type === "document") return { entity_types: ["document"], document_ids: [selectedId] };
  return {};
}

function activeAiScopeLabel() {
  const type = document.querySelector("[data-ai-scope-type]")?.value || "all";
  if (type === "all") return "全部公开内容";
  const select = document.querySelector("[data-ai-scope-value]");
  return select?.selectedOptions?.[0]?.textContent || "未选择";
}

function activateAiLabPanel(panelName = "overview") {
  const validPanel = document.querySelector(`[data-lab-panel="${panelName}"]`) ? panelName : "overview";
  document.querySelectorAll("[data-lab-panel]").forEach((panel) => {
    const active = panel.dataset.labPanel === validPanel;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".ai-lab-navigation [data-lab-open]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.labOpen === validPanel);
  });
  document.querySelector(".ai-lab-workspace")?.scrollTo?.({ top: 0, behavior: "smooth" });
}

function bindAiLabNavigation() {
  const labView = document.querySelector(".ai-lab-view");
  if (!labView) return;
  labView.onclick = (event) => {
    const opener = event.target.closest("[data-lab-open]");
    if (!opener) return;
    event.preventDefault();
    activateAiLabPanel(opener.dataset.labOpen);
  };
  const search = labView.querySelector("[data-lab-search]");
  if (search) {
    search.onkeydown = (event) => {
      if (event.key !== "Enter" || !search.value.trim()) return;
      activateAiLabPanel("rag");
      const question = document.querySelector("[data-ai-question]");
      if (question) {
        question.value = search.value.trim();
        question.focus();
      }
    };
  }
  activateAiLabPanel("overview");
}

function renderAiLabOverview(content, ai) {
  const searchableCount = flattenSearchContent(content).length;
  const nodes = content.knowledgeNodes || [];
  const graphEdges = content.knowledgeGraph?.edges || [];
  const columns = content.knowledgeColumns || [];
  const posts = (content.posts || []).filter((post) => post.status !== "draft");
  const history = aiRenderedHistory;
  const capabilities = document.querySelector("[data-lab-capabilities]");
  if (capabilities) {
    capabilities.innerHTML = `
      <article class="ai-capability-card rag">
        <header><i>R</i><div><h3>RAG Studio</h3><p>构建知识检索与问答系统</p></div><span>${escapeHtml(ai.status || "运行中")}</span></header>
        <div class="ai-flow-row"><span>文档</span><b>→</b><span>切块</span><b>→</b><span>检索</span><b>→</b><span>重排</span><b>→</b><span>生成</span></div>
        <button type="button" data-lab-open="rag">进入 RAG Studio <span>→</span></button>
      </article>
      <article class="ai-capability-card agent">
        <header><i>A</i><div><h3>Agent Studio</h3><p>开发和调试智能任务流程</p></div><span>只读 Beta</span></header>
        <div class="ai-flow-row"><span>规划</span><b>→</b><span>工具</span><b>→</b><span>记忆</span><b>→</b><span>执行</span><b>→</b><span>评估</span></div>
        <button type="button" data-lab-open="agent">进入 Agent Studio <span>→</span></button>
      </article>
      <article class="ai-capability-card experiment">
        <header><i>E</i><div><h3>Experiment</h3><p>实验记录、评估与对比</p></div><span>已接入评测</span></header>
        <div class="ai-mini-chart" aria-label="实验迭代趋势示意"><i style="height:28%"></i><i style="height:38%"></i><i style="height:34%"></i><i style="height:52%"></i><i style="height:45%"></i><i style="height:68%"></i><i style="height:82%"></i></div>
        <button type="button" data-lab-open="experiment">查看实验 <span>→</span></button>
      </article>
    `;
  }

  const status = document.querySelector("[data-lab-system-status]");
  if (status) {
    const statusItems = [
      ["▣", "可检索内容", searchableCount.toLocaleString("zh-CN"), `${posts.length} 篇文章 · ${columns.length} 个专栏`],
      ["◎", "知识节点", nodes.length.toLocaleString("zh-CN"), `${graphEdges.length} 条显式关系`],
      ["⌁", "检索模式", "Hybrid", "向量 + 关键词 + 图谱"],
      ["◇", "Agent Runtime", "Ready", "只读白名单工具"],
      ["○", "问答记录", history.length.toLocaleString("zh-CN"), "服务器 Memory"],
      ["✓", "引用能力", "Enabled", "回答可跳转来源"],
    ];
    status.innerHTML = statusItems.map(([icon, label, value, note]) => `<article><i>${icon}</i><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  }

  const activity = document.querySelector("[data-lab-activity]");
  if (activity) {
    const historyActivity = history.slice(0, 3).map((item) => ({
      icon: "Q",
      title: `查询：“${item.question}”`,
      type: "RAG",
      status: "已完成",
      time: item.createdAt || "最近",
    }));
    const contentActivity = [
      ...(content.changelog || []).slice(0, 2).map((item) => ({ icon: "U", title: `发布 ${item.version} ${item.title}`, type: "系统", status: "已更新", time: item.date })),
      ...posts.slice(0, 2).map((item) => ({ icon: "D", title: `发布文章：${item.title}`, type: "内容", status: "已发布", time: item.date || item.published_at })),
    ];
    activity.innerHTML = [...historyActivity, ...contentActivity].slice(0, 5).map((item) => `
      <article><i>${escapeHtml(item.icon)}</i><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.type)}</span><em>${escapeHtml(item.status)}</em><time>${escapeHtml(item.time || "最近")}</time></article>
    `).join("");
  }

  const quick = document.querySelector("[data-lab-quick-actions]");
  if (quick) {
    quick.innerHTML = `
      <button type="button" data-lab-open="rag"><i>▣</i><div><strong>新建 RAG 会话</strong><span>指定范围，检索知识并生成回答</span></div><b>＋</b></button>
      <button type="button" data-lab-open="agent"><i>◇</i><div><strong>运行 Agent</strong><span>输入目标，查看规划和工具步骤</span></div><b>＋</b></button>
      <a href="admin/" target="_blank" rel="noreferrer"><i>⇧</i><div><strong>上传数据</strong><span>导入文档并管理知识内容</span></div><b>＋</b></a>
      <button type="button" data-lab-open="experiment"><i>△</i><div><strong>查看实验</strong><span>检查评测能力与演进计划</span></div><b>＋</b></button>
    `;
  }

  const architecture = document.querySelector("[data-lab-architecture]");
  if (architecture) {
    const layers = [
      ["数据层", "文章 · 文档 · 知识节点"],
      ["知识层", "Chunk · Embedding"],
      ["检索层", "Milvus · Multi-Query · RRF"],
      ["生成层", "Reranker · Grounding · LLM"],
      ["Agent 层", "Planner · Tools · Memory"],
    ];
    architecture.innerHTML = layers.map(([title, description], index) => `<article><i>${index + 1}</i><strong>${title}</strong><span>${description}</span></article>${index < layers.length - 1 ? "<b>→</b>" : ""}`).join("");
  }

  const experiments = document.querySelector("[data-lab-experiments]");
  if (experiments) {
    const experimentItems = [
      ["RAG 检索评测", "Multi-Query、RRF、Reranker 与 Grounding 已进入评测链路。", "已接入"],
      ["Agent Runtime 评测", "记录任务规划、工具路径、最终状态和执行审计。", "已接入"],
      ["下一步实验", "继续补充真实测试集、延迟基线和检索质量对比。", "进行中"],
    ];
    experiments.innerHTML = experimentItems.map(([title, description, state], index) => `<article><span>Experiment 0${index + 1}</span><h2>${title}</h2><p>${description}</p><strong>${state}</strong></article>`).join("");
  }

  const knowledge = document.querySelector("[data-lab-knowledge]");
  if (knowledge) {
    knowledge.innerHTML = `
      <a href="#knowledge"><i>▧</i><div><strong>知识专栏</strong><span>${columns.length} 个专栏，按主题管理知识节点</span></div><b>→</b></a>
      <a href="#graph"><i>⌘</i><div><strong>知识图谱</strong><span>${nodes.length} 个节点，${graphEdges.length} 条显式关系</span></div><b>→</b></a>
      <a href="admin/" target="_blank" rel="noreferrer"><i>＋</i><div><strong>内容管理</strong><span>创建节点、上传文档并建立跨专栏关系</span></div><b>→</b></a>
    `;
  }
}

function renderAi(content) {
  const ai = content.aiShowcase || fallbackContent.aiShowcase;
  const homeTarget = document.querySelector("[data-ai-showcase]");
  if (homeTarget) {
    homeTarget.innerHTML = `
      <div>
        <div class="card-meta"><span>${escapeHtml(ai.status || "规划中")}</span></div>
        <h3>${escapeHtml(ai.title)}</h3>
        <p>${escapeHtml(ai.summary)}</p>
      </div>
      <div class="pipeline">${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    `;
  }

  const aiFull = document.querySelector("[data-ai-full]");
  if (aiFull) {
    const graph = buildKnowledgeNetwork(content);
    aiFull.innerHTML = `
    <div class="section-title">
      <p>Architecture</p>
      <h2>${escapeHtml(ai.title)}</h2>
    </div>
    <p>${escapeHtml(ai.summary)}</p>
    <div class="pipeline lab-pipeline">${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <div class="agent-metrics">
      <div><span>Knowledge Chunks</span><strong>${flattenSearchContent(content).length}</strong></div>
      <div><span>Graph Nodes</span><strong>${graph.nodes.length}</strong></div>
      <div><span>Graph Edges</span><strong>${graph.edges.length}</strong></div>
      <div><span>Retrieval</span><strong>Keyword + Graph</strong></div>
    </div>
    ${detailList("演进规划", ai.roadmap)}
  `;
  }

  renderAiLabOverview(content, ai);
  bindAiLabNavigation();

  const capabilitiesTarget = document.querySelector("[data-ai-capabilities]");
  if (capabilitiesTarget) {
    capabilitiesTarget.innerHTML = (ai.capabilities || [])
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

  const askButton = document.querySelector("[data-ai-ask]");
  const answerTarget = document.querySelector("[data-ai-answer]");
  const traceTarget = document.querySelector("[data-ai-trace]");
  if (askButton && answerTarget) {
    setupAiScopeSelector();
    askButton.onclick = () => answerStaticQuestion(content);
    renderAiHistory();
    answerTarget.innerHTML = `
      <strong>可以先试试：</strong>
      <div class="suggestion-row">
        ${(ai.examples || []).map((item) => `<button type="button" data-question="${escapeHtml(item.question)}">${escapeHtml(item.question)}</button>`).join("")}
      </div>
    `;
    if (traceTarget) {
      traceTarget.innerHTML = renderTrace(["等待问题", "准备检索站内内容", "返回引用来源"], "idle");
    }
    answerTarget.onclick = (event) => {
      const feedbackButton = event.target.closest("[data-ai-feedback]");
      if (feedbackButton) {
        sendAiFeedback(feedbackButton).catch(() => {
          const row = feedbackButton.closest("[data-ai-feedback-memory]");
          if (row) row.querySelector("span").textContent = "反馈提交失败";
        });
        return;
      }
      const button = event.target.closest("[data-question]");
      if (!button) return;
      document.querySelector("[data-ai-question]").value = button.dataset.question;
      answerStaticQuestion(content);
    };
  }

  const agentButton = document.querySelector("[data-agent-run]");
  if (agentButton) agentButton.onclick = runAgentTask;
  const cancelButton = document.querySelector("[data-agent-cancel]");
  const retryButton = document.querySelector("[data-agent-retry]");
  const approveButton = document.querySelector("[data-agent-approve]");
  const denyButton = document.querySelector("[data-agent-deny]");
  if (cancelButton) cancelButton.onclick = cancelAgentTask;
  if (retryButton) retryButton.onclick = retryAgentTask;
  if (approveButton) approveButton.onclick = () => confirmAgentTask(true);
  if (denyButton) denyButton.onclick = () => confirmAgentTask(false);

  document.querySelector("[data-ai-clear-history]")?.addEventListener("click", async () => {
    try {
      await fetch(`${aiApiUrl.replace(/\/ask$/, "")}/memories`, { method: "DELETE", credentials: "include" });
    } catch {
      // The server remains the source of truth; do not create a browser copy.
    }
    aiRenderedHistory = [];
    renderAiHistory();
  });

  document.querySelector("[data-ai-history]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-history-id]");
    if (!button) return;
    const item = aiRenderedHistory.find((record) => String(record.id) === button.dataset.aiHistoryId);
    if (!item) return;
    document.querySelector("[data-ai-question]").value = item.question;
    answerTarget.innerHTML = `
      <strong>History</strong>
      <p>${escapeHtml(item.answer || "")}</p>
      ${renderCitationQuality(item.sources || [])}
      ${renderSourceList(item.sources || [])}
      ${
        item.promptContext
          ? `<details class="prompt-box">
              <summary>Prompt Context</summary>
              <pre>${escapeHtml(item.promptContext)}</pre>
            </details>`
          : ""
      }
      <div class="run-metrics">
        <span>Quality <strong>${escapeHtml(item.qualityScore)}</strong></span>
        <span>Sources <strong>${escapeHtml(item.sourceCount)}</strong></span>
        <span>Generator <strong>${escapeHtml(item.generator || "local")}</strong></span>
        <span>Latency <strong>${escapeHtml(item.latencyMs || "-")}ms</strong></span>
        <span>Time <strong>${escapeHtml(item.createdAt)}</strong></span>
      </div>
    `;
  });
}

function renderTrace(steps, state = "done") {
  return steps
    .map(
      (step, index) => `
        <div class="${state === "idle" && index > 0 ? "" : "is-done"}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(step)}</strong>
        </div>
      `,
    )
    .join("");
}

function normalizeBackendMemory(memory) {
  const sources = Array.isArray(memory.sources) ? memory.sources : [];
  return {
    id: String(memory.id),
    createdAt: memory.created_at ? new Date(memory.created_at).toLocaleString("zh-CN", { hour12: false }) : "",
    question: memory.question,
    answer: memory.answer,
    sources,
    sourceCount: sources.length || (memory.source_slugs || []).length,
    qualityScore: typeof memory.quality_score === "number" ? memory.quality_score : "-",
    generator: memory.generator || "server",
    latencyMs: memory.latency_ms || 0,
    trace: memory.trace || [],
    promptContext: memory.prompt_context || "",
    grounding: memory.grounding || {},
  };
}

async function fetchBackendHistory() {
  const url = `${aiApiUrl.replace(/\/ask$/, "")}/memories?session_id=${encodeURIComponent(aiSessionId)}&limit=12`;
  const response = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error(`Memory request failed: ${response.status}`);
  const memories = await response.json();
  return Array.isArray(memories) ? memories.map(normalizeBackendMemory) : [];
}

function renderAiHistoryList(history, mode = "local") {
  const target = document.querySelector("[data-ai-history]");
  if (!target) return;
  aiRenderedHistory = history;
  target.innerHTML = history.length
    ? history
        .map(
          (item) => `
            <button type="button" data-ai-history-id="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.createdAt)}</span>
              <strong>${escapeHtml(item.question)}</strong>
              <small>${escapeHtml(mode)} · Quality ${escapeHtml(item.qualityScore)} · ${escapeHtml(item.sourceCount)} sources · ${escapeHtml(item.generator || "local")} · ${escapeHtml(item.grounding?.status || "legacy")} · ${escapeHtml(item.latencyMs || "-")}ms</small>
            </button>
          `,
        )
        .join("")
    : `<p>还没有问答记录。</p>`;
}

async function renderAiHistory() {
  try {
    const backendHistory = await fetchBackendHistory();
    if (backendHistory.length) {
      renderAiHistoryList(backendHistory, "server");
      return;
    }
  } catch {
    aiRenderedHistory = [];
    renderAiHistoryList([], "server offline");
  }
}
function inclusiveDaysSince(dateString) {
  const start = new Date(`${dateString}T00:00:00+08:00`);
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diff = Math.floor((current - startLocal) / 86400000) + 1;
  return Math.max(1, diff);
}

function countKnowledgeNotes(content) {
  return (content.knowledgeBase || []).reduce((total, group) => total + (group.notes || []).length, 0);
}

function countKnowledgeNodes(content) {
  return (content.knowledgeBase || []).reduce((total, group) => total + 1 + (group.items || []).length + (group.notes || []).length, 0);
}

function dashboardStats(content) {
  const posts = (content.posts || []).filter((post) => post.status !== "draft");
  const projects = content.projects || [];
  const reading = content.reading || [];
  const building = content.building?.items || [];
  const changelog = content.changelog || [];
  const knowledgeTopics = content.knowledgeBase || [];
  const noteCount = countKnowledgeNotes(content);
  const nodeCount = (content.knowledgeNodes || []).length || countKnowledgeNodes(content);
  const learningDays = inclusiveDaysSince("2026-07-01");
  const writingWords = posts.reduce((total, post) => total + String(post.content || "").replace(/\s+/g, "").length, 0);

  return [
    { label: "Learning", value: learningDays, unit: "days", note: "从 2026-07-01 开始" },
    { label: "Articles", value: posts.length, unit: "published", note: `${writingWords.toLocaleString("zh-CN")} 字沉淀` },
    { label: "Projects", value: projects.length, unit: "tracked", note: "持续补充工程证据" },
    { label: "Knowledge", value: nodeCount, unit: "nodes", note: `${knowledgeTopics.length} 个主题 · ${noteCount} 条笔记` },
    { label: "Reading", value: reading.length, unit: "items", note: "书籍与学习材料" },
    { label: "Building", value: building.length, unit: "active", note: "当前构建项" },
    { label: "Releases", value: changelog.length, unit: "logs", note: "网站迭代记录" },
    { label: "Stack", value: (content.techStack || []).length, unit: "skills", note: "技术栈标签" },
  ];
}

function dashboardCards(stats, compact = false) {
  return stats
    .map(
      (item) => `
        <article class="dashboard-card ${compact ? "compact" : ""}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <em>${escapeHtml(item.unit)}</em>
          <p>${escapeHtml(item.note)}</p>
        </article>
      `,
    )
    .join("");
}

function renderStats(content) {
  const stats = dashboardStats(content);
  const statMap = Object.fromEntries(stats.map((item) => [item.label, item.value]));
  const posts = (content.posts || []).filter((post) => post.status !== "draft");
  const projects = content.projects || [];
  const knowledge = content.knowledgeBase || [];
  const noteCount = countKnowledgeNotes(content);
  const nodeCount = (content.knowledgeNodes || []).length || countKnowledgeNodes(content);

  setText("[data-learning-days]", statMap.Learning);
  setText("[data-footer-post-count]", posts.length);
  setText("[data-footer-project-count]", projects.length);
  setText("[data-footer-note-count]", noteCount);

  setText("[data-knowledge-count]", knowledge.length);
  setText("[data-knowledge-node-count]", nodeCount);
  setText("[data-note-count]", noteCount);
  setText("[data-project-count]", projects.length);

  const dashboard = document.querySelector("[data-growth-dashboard]");
  if (dashboard) {
    dashboard.innerHTML = dashboardCards(stats);
  }
}

function renderNow(content) {
  const now = content.now || {};
  const main = document.querySelector("[data-now-main]");
  const side = document.querySelector("[data-now-side]");
  if (!main || !side) return;

  const building = content.building?.items || now.currentlyBuilding || [];
  const learning = now.currentlyLearning || (content.learningMap || []).flatMap((group) => group.items || []).map((item) => item.name).slice(0, 8);
  const reading = content.reading || [];
  const posts = (content.posts || []).filter((post) => post.status !== "draft");
  const wordCount = posts.reduce((total, post) => total + String(post.content || post.content_markdown || "").replace(/\s+/g, "").length, 0);
  const learningDays = inclusiveDaysSince("2026-07-01");
  const nodeCount = (content.knowledgeNodes || []).length || countKnowledgeNodes(content);
  const columnCount = (content.knowledgeColumns || []).length;
  const noteCount = countKnowledgeNotes(content);
  const recentActivity = [
    ...posts.slice(0, 2).map((post) => ({ label: `发布文章 ${post.title}`, time: post.date || post.published_at || "最近" })),
    ...(content.knowledgeColumns || []).slice(0, 2).map((column) => ({ label: `更新专栏 ${column.name}`, time: String(column.updated_at || "").slice(0, 10) || "最近" })),
    ...(content.changelog || []).slice(0, 2).map((item) => ({ label: `发布 ${item.version} ${item.title}`, time: item.date || "最近" })),
  ].slice(0, 5);

  main.innerHTML = `
    <section class="now-hero">
      <img src="assets/hero-workspace.png" alt="正在构建个人知识系统的工作台" />
      <div><p>“持续学习，保持好奇，<br />让知识成为穿越不确定性的力量。”</p><span>更新于 ${escapeHtml(now.updatedAt || "未设置")}</span></div>
    </section>
    <section class="now-section now-building-section">
      <div class="now-section-heading"><h2>正在进行</h2><a href="#building">查看全部 →</a></div>
      <div class="now-progress-list">
        ${building.slice(0, 3).map((item, index) => {
          const progress = Math.max(0, Math.min(100, Number(item.progress ?? [66, 42, 25][index] ?? 0)));
          return `<article class="now-progress-item"><i>${["◒", "▤", "▦"][index] || "◇"}</i><div><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status || "进行中")}</span></div><p>${escapeHtml(item.description || "")}</p><footer><span><b style="width:${progress}%"></b></span><em>进度 ${progress}%</em><small>更新于 ${escapeHtml(content.building?.updatedAt || now.updatedAt || "最近")}</small></footer></div></article>`;
        }).join("")}
      </div>
    </section>
    <section class="now-focus-card">
      <img src="assets/blog-lifelong-learning.png" alt="阅读与记录工作台" />
      <div><h2>当前专注</h2><p>${escapeHtml(now.currentFocus || "持续构建个人 AI 平台。")}</p><p>${escapeHtml(now.nextGoal || "继续完善知识网络和 AI Lab。")}</p></div>
    </section>
    <section class="now-section now-activity-section">
      <div class="now-section-heading"><h2>近期动态</h2></div>
      <div class="now-activity-list">${recentActivity.map((item) => `<div><span>□</span><strong>${escapeHtml(item.label)}</strong><time>${escapeHtml(item.time)}</time></div>`).join("")}</div>
    </section>
  `;

  side.innerHTML = `
    <section class="now-overview-card">
      <h2>成长概览</h2>
      <div class="now-overview-grid">
        <article><span>▣</span><strong>${learningDays}</strong><p>连续学习天数</p><small>从 2026-07-01 开始</small></article>
        <article><span>⌑</span><strong>${posts.length}</strong><p>文章发布数</p><small>${wordCount.toLocaleString("zh-CN")} 字</small></article>
        <article><span>⌘</span><strong>${nodeCount}</strong><p>知识节点</p><small>${columnCount} 个专栏</small></article>
        <article><span>◇</span><strong>${noteCount}</strong><p>知识笔记</p><small>持续积累中</small></article>
      </div>
    </section>
    <section class="now-side-card">
      <h2>正在学习</h2>
      <div class="pill-list">${learning.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </section>
    <section class="now-side-card">
      <h2>阅读列表</h2>
      <div class="now-reading-list">${reading.slice(0, 3).map((item, index) => `<article><img src="${index === 0 ? "assets/blog-lifelong-learning.png" : "assets/hero-workspace.png"}" alt="" /><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status || "待读")} · ${Number(item.progress || 0)}%</span><i><b style="width:${Number(item.progress || 0)}%"></b></i></div></article>`).join("")}</div>
      <a class="now-more-link" href="#about">查看全部书籍 →</a>
    </section>
    <section class="now-side-card">
      <h2>快速入口</h2>
      <div class="now-quick-grid">
        <a href="admin/" target="_blank" rel="noreferrer"><span>□</span>新建文章</a>
        <a href="admin/" target="_blank" rel="noreferrer"><span>◇</span>新建节点</a>
        <a href="#knowledge"><span>⇧</span>导入内容</a>
        <a href="#graph"><span>⌘</span>知识图谱</a>
      </div>
    </section>
  `;
}

function renderBuilding(content) {
  const target = document.querySelector("[data-building]");
  if (!target) return;
  const building = content.building || {};
  const items = building.items || [];
  target.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="building-card">
              <div class="building-head">
                <span>${escapeHtml(item.status || "Building")}</span>
                <strong>${Number(item.progress || 0)}%</strong>
              </div>
              <h2>${escapeHtml(item.title)}</h2>
              <p>${escapeHtml(item.description || "")}</p>
              <div class="progress-track" aria-label="${escapeHtml(item.title)} 进度">
                <i style="width: ${Math.min(100, Math.max(0, Number(item.progress || 0)))}%"></i>
              </div>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state"><strong>还没有 Building 记录</strong><p>后续会记录正在构建的项目和能力。</p></div>`;
}

function renderChangelog(content) {
  const target = document.querySelector("[data-changelog]");
  if (!target) return;
  const entries = content.changelog || [];
  target.innerHTML = entries.length
    ? entries
        .map(
          (entry) => `
            <article class="changelog-item">
              <div>
                <span>${escapeHtml(entry.version)}</span>
                <time>${escapeHtml(entry.date)}</time>
              </div>
              <section>
                <h2>${escapeHtml(entry.title)}</h2>
                <ul>${(entry.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </section>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state"><strong>还没有更新日志</strong><p>后续每次重要迭代会记录在这里。</p></div>`;
}

function flattenSearchContent(content) {
  const entries = [];

  [
    ["页面", "首页", "个人主页、精选项目、最近文章和当前重点", "#home", "home hero profile"],
    ["页面", "文章", "技术博客、学习记录和写作系统", "#posts", "blog articles writing markdown rss"],
    ["页面", "项目", "项目作品、工程案例和系统设计", "#projects", "project portfolio case study"],
    ["页面", "知识库", "知识节点、关联内容和第二大脑", "#knowledge", "knowledge second brain graph"],
    ["页面", "Now", "当前正在构建、学习和阅读的内容", "#now", "now current focus currently learning reading"],
    ["页面", "Building", "持续构建中的系统、能力和阶段进度", "#building", "building build log progress changelog"],
    ["页面", "Changelog", "网站作为产品的版本迭代记录", "#changelog", "release notes update log version"],
    ["页面", "Growth Dashboard", "学习天数、文章、项目、知识节点、阅读和版本统计", "#home", "dashboard statistics stats growth"],
    ["页面", "AI Lab", "站内 RAG 问答和 AI 实验入口", "#lab", "ai rag agent ask me"],
    ["页面", "关于", "教育经历、工作经历、技术栈和联系方式", "#about", "about resume contact"],
  ].forEach(([type, title, subtitle, href, keywords]) => {
    entries.push({ type, title, subtitle, href, text: [title, subtitle, keywords].join(" ") });
  });

  (content.posts || [])
    .filter((post) => post.status !== "draft")
    .forEach((post, index) => {
    entries.push({
      type: "文章",
      title: post.title,
      subtitle: post.summary || post.category || "技术文章",
      href: `#post-${normalizeSlug(post, index, "post")}`,
      text: [post.title, post.category, post.summary, ...(post.tags || []), post.content].join(" "),
    });
  });

  (content.projects || []).forEach((project, index) => {
    entries.push({
      type: "项目",
      title: project.name,
      subtitle: project.summary || project.tagline || "项目作品",
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
    const relationSummary = knowledgeRelationSummary(content, group);
    const graphContext = [
      ...(group.relatedKnowledge || []).map((item) => `相关知识：${item}`),
      ...(group.relatedProjects || []).map((item) => `关联项目：${item}`),
      ...(group.relatedReading || []).map((item) => `阅读材料：${item}`),
      ...(group.relatedPosts || []).map((item) => `相关文章：${item}`),
    ];
    entries.push({
      type: "知识库",
      title: group.topic,
      subtitle: group.summary || "知识主题",
      href: `#knowledge-${normalizeSlug(group, index, "knowledge")}`,
      text: [
        group.topic,
        group.summary,
        ...(group.items || []),
        ...graphContext,
        ...(group.notes || []).flatMap((note) => [note.name, note.description]),
      ].join(" "),
      context: [group.summary, ...graphContext, ...(relationSummary || []).map((item) => `${item.type}：${item.title} ${item.summary}`)]
        .filter(Boolean)
        .join("\n"),
    });

    (group.notes || []).forEach((note) => {
      entries.push({
        type: "知识节点",
        title: `${group.topic} / ${note.name}`,
        subtitle: note.description || group.summary || "知识节点",
        href: `#knowledge-${normalizeSlug(group, index, "knowledge")}`,
        text: [group.topic, note.name, note.description, note.example, ...(note.links || []), ...(group.relatedProjects || [])].join(" "),
        context: [note.description, note.example, ...(note.links || []).map((item) => `链接：${item}`), ...graphContext].filter(Boolean).join("\n"),
      });
    });

    relationSummary.forEach((item) => {
      entries.push({
        type: "关系",
        title: `${group.topic} → ${item.title}`,
        subtitle: `${item.type} · ${item.summary || "知识网络关系"}`,
        href: item.href,
        text: [group.topic, item.title, item.type, item.summary, group.summary, ...graphContext].join(" "),
        context: [`${group.topic} 和 ${item.title} 存在 ${item.type} 关联。`, group.summary, item.summary].filter(Boolean).join("\n"),
      });
    });
  });

  (content.reading || []).forEach((item) => {
    const relationLabels = [...(item.relatedKnowledge || []), ...(item.relatedProjects || []), ...(item.relatedPosts || [])];
    entries.push({
      type: "阅读",
      title: item.title,
      subtitle: [item.author, item.status, item.note].filter(Boolean).join(" · "),
      href: "#about",
      text: [item.title, item.author, item.status, item.note, ...(item.highlights || []), ...relationLabels].join(" "),
      context: [
        item.note,
        ...(item.highlights || []).map((highlight) => `摘录：${highlight}`),
        ...(item.relatedKnowledge || []).map((value) => `相关知识：${value}`),
        ...(item.relatedProjects || []).map((value) => `关联项目：${value}`),
        ...(item.relatedPosts || []).map((value) => `相关文章：${value}`),
      ]
        .filter(Boolean)
        .join("\n"),
    });
  });

  (content.timeline || []).forEach((item) => {
    entries.push({
      type: "时间线",
      title: item.time,
      subtitle: item.event,
      href: "#about",
      text: [item.time, item.event].join(" "),
    });
  });

  return entries;
}

function sourceHref(source) {
  if (source.url) return source.url;
  if (source.href) return source.href;
  const type = source.entity_type || source.type || "";
  const slug = slugify(source.slug || source.title || "");
  if (type === "knowledge_node") return `#node-${slug}`;
  if (type === "knowledge") return `#knowledge-${slug}`;
  if (type === "project") return `#project-${slug}`;
  if (type === "post") return `#post-${slug}`;
  if (type === "reading") return "#reading";
  if (type === "document") return source.url || "#lab";
  return "#knowledge";
}

function sourceLabel(source) {
  const type = source.entity_type || source.type || "来源";
  return {
    post: "文章",
    project: "项目",
    knowledge: "知识",
    knowledge_node: "知识节点",
    document: "文档",
    "知识库": "知识",
    "知识节点": "知识节点",
    关系: "关系",
    阅读: "阅读",
    页面: "页面",
  }[type] || type;
}

function sourceKind(source) {
  const type = source.entity_type || source.type || "";
  const label = sourceLabel(source);
  if (["knowledge", "knowledge_node", "知识库", "知识节点", "关系", "知识"].includes(type) || ["知识", "知识节点", "关系"].includes(label)) return "knowledge";
  if (["project", "项目"].includes(type) || label === "项目") return "project";
  if (["post", "文章"].includes(type) || label === "文章") return "post";
  if (["reading", "阅读"].includes(type) || label === "阅读") return "reading";
  if (["document", "文档"].includes(type) || label === "文档") return "document";
  return "other";
}

function sourceHasGraphContext(source) {
  const context = [source.context, source.summary, source.subtitle, source.title].join(" ");
  return sourceKind(source) === "knowledge" || /相关知识|关联项目|阅读材料|相关文章|知识网络|→/.test(context);
}

function sourceScoreValue(source) {
  const value = Number(source.score || 0);
  return Number.isFinite(value) ? value : 0;
}

function sourceEvidenceText(source) {
  return source.matched_chunk || source.context || source.summary || source.subtitle || "";
}

function renderSourceScoreMeta(source) {
  const parts = [];
  if (source.score !== undefined && source.score !== null) parts.push(`score ${Math.round(Number(source.score) * 100) / 100}`);
  if (source.chunk_index !== undefined && source.chunk_index !== null) parts.push(`chunk #${source.chunk_index}`);
  if (source.lexical_score !== undefined && source.lexical_score !== null) parts.push(`lex ${source.lexical_score}`);
  if (source.vector_score !== undefined && source.vector_score !== null) parts.push(`vec ${Math.round(Number(source.vector_score) * 1000) / 1000}`);
  return parts.join(" · ");
}

function citationQuality(sources) {
  const total = sources.length;
  const scoreValues = sources.map(sourceScoreValue);
  const bestScore = Math.max(...scoreValues, 1);
  const averageRelevance = total ? Math.round((scoreValues.reduce((sum, value) => sum + value / bestScore, 0) / total) * 100) : 0;
  const kinds = sources.reduce((map, source) => {
    const kind = sourceKind(source);
    map[kind] = (map[kind] || 0) + 1;
    return map;
  }, {});
  const graphCount = sources.filter(sourceHasGraphContext).length;
  const diversity = Object.values(kinds).filter(Boolean).length;
  const supportCount = (kinds.project || 0) + (kinds.reading || 0) + (kinds.post || 0);
  const score = Math.min(
    100,
    Math.round(
      Math.min(40, averageRelevance * 0.4) +
        Math.min(20, diversity * 6) +
        Math.min(20, graphCount * 6) +
        Math.min(20, supportCount * 5),
    ),
  );
  const grade = score >= 80 ? "strong" : score >= 55 ? "medium" : "weak";

  return {
    total,
    score,
    grade,
    averageRelevance,
    graphCount,
    diversity,
    projectCount: kinds.project || 0,
    readingCount: kinds.reading || 0,
    articleCount: kinds.post || 0,
    knowledgeCount: kinds.knowledge || 0,
    documentCount: kinds.document || 0,
  };
}

function renderCitationQuality(sources) {
  const quality = citationQuality(sources);
  if (!quality.total) {
    return `
      <section class="citation-quality weak">
        <div>
          <span>Citation Quality</span>
          <strong>0</strong>
          <p>没有命中站内来源，当前回答证据不足。</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="citation-quality ${escapeHtml(quality.grade)}">
      <div>
        <span>Citation Quality</span>
        <strong>${quality.score}</strong>
        <p>${quality.grade === "strong" ? "引用覆盖较完整" : quality.grade === "medium" ? "引用可用，但还可以补充关联内容" : "引用较弱，需要补充内容"}</p>
      </div>
      <dl>
        <div><dt>Sources</dt><dd>${quality.total}</dd></div>
        <div><dt>Relevance</dt><dd>${quality.averageRelevance}%</dd></div>
        <div><dt>Graph</dt><dd>${quality.graphCount}</dd></div>
        <div><dt>Types</dt><dd>${quality.diversity}</dd></div>
        <div><dt>Projects</dt><dd>${quality.projectCount}</dd></div>
        <div><dt>Reading</dt><dd>${quality.readingCount}</dd></div>
        <div><dt>Documents</dt><dd>${quality.documentCount}</dd></div>
      </dl>
    </section>
  `;
}

function renderSourceList(sources) {
  if (!sources.length) return "";
  return `
    <div class="source-list">
      <span>Sources</span>
      ${sources
        .map(
          (entry) => `
            <a class="source-card" href="${escapeHtml(sourceHref(entry))}" ${sourceKind(entry) === "document" ? 'target="_blank" rel="noreferrer"' : ""}>
              <small>${escapeHtml(sourceLabel(entry))}${renderSourceScoreMeta(entry) ? ` · ${escapeHtml(renderSourceScoreMeta(entry))}` : ""}</small>
              <strong>${escapeHtml(entry.title)}</strong>
              <em>${escapeHtml(entry.summary || entry.subtitle || "")}</em>
              ${sourceEvidenceText(entry) ? `<blockquote>${escapeHtml(sourceEvidenceText(entry))}</blockquote>` : ""}
              ${(entry.graph_relations || []).length ? `<div class="source-graph-relations">${entry.graph_relations.slice(0, 3).map((relation) => `<span>↳ ${escapeHtml(relation)}</span>`).join("")}</div>` : ""}
              <b>${sourceHasGraphContext(entry) ? "Knowledge Graph" : "Content Source"}</b>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderAiFeedbackControls(memoryId) {
  if (!memoryId) return "";
  return `
    <div class="ai-feedback-row" data-ai-feedback-memory="${escapeHtml(memoryId)}">
      <span>这次回答有帮助吗？</span>
      <button type="button" data-ai-feedback="useful" data-ai-feedback-reason="helpful">有用</button>
      <button type="button" data-ai-feedback="not_useful" data-ai-feedback-reason="incorrect">不准确</button>
      <button type="button" data-ai-feedback="not_useful" data-ai-feedback-reason="missing_context">资料不足</button>
    </div>
  `;
}

async function sendAiFeedback(button) {
  const row = button.closest("[data-ai-feedback-memory]");
  const memoryId = Number(row?.dataset.aiFeedbackMemory || 0);
  if (!memoryId) return;
  row.querySelectorAll("button").forEach((current) => {
    current.disabled = true;
    current.classList.toggle("is-selected", current === button);
  });
  const response = await fetch(`${aiApiUrl.replace(/\/ask$/, "")}/feedback`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      memory_id: memoryId,
      session_id: aiSessionId,
      rating: button.dataset.aiFeedback,
      reason: button.dataset.aiFeedbackReason || "",
    }),
  });
  if (!response.ok) {
    row.querySelectorAll("button").forEach((current) => {
      current.disabled = false;
      current.classList.remove("is-selected");
    });
    throw new Error(`Feedback request failed: ${response.status}`);
  }
  row.querySelector("span").textContent = "反馈已记录";
}

function buildRagSources(content, query, limit = 6) {
  const entries = flattenSearchContent(content)
    .map((entry) => ({ ...entry, score: scoreEntry(entry, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const unique = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = `${entry.type}:${entry.title}:${entry.href}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(entry);
  });
  return unique.slice(0, limit);
}

function buildLocalGroundedAnswer(query, sources) {
  if (!sources.length) {
    return "当前站内内容里没有找到足够相关的资料。可以先在知识库、文章或项目里补充内容，AI Lab 才能基于真实资料回答。";
  }

  const sourceSummary = sources
    .slice(0, 3)
    .map((source) => `${sourceLabel(source)}「${source.title}」`)
    .join("、");
  const knowledgeSources = sources.filter((source) => ["知识库", "知识节点", "关系", "knowledge"].includes(source.type || source.entity_type));
  const relationHint = knowledgeSources.length
    ? `其中 ${knowledgeSources.length} 条来自知识网络，包含节点说明、关联项目、阅读材料或反向关系。`
    : "这次主要命中页面、项目或文章内容。";

  return `基于站内检索，问题“${query}”目前可以参考 ${sourceSummary}。${relationHint} 下面的 Sources 是这次回答的依据；后续接入 Embedding、向量库和 LLM 后，会用同一批上下文生成更完整的答案。`;
}

function searchPaletteItems(content, query = "") {
  const entries = flattenSearchContent(content);
  const normalized = query.trim();
  if (!normalized) {
    return entries
      .filter((entry) => ["页面", "知识库", "项目"].includes(entry.type))
      .slice(0, 9)
      .map((entry, index) => ({ ...entry, score: 100 - index }));
  }

  return entries
    .map((entry) => ({ ...entry, score: scoreEntry(entry, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

let commandResults = [];
let commandSelectedIndex = 0;

function renderSearchResults(content, query = "", selectedIndex = 0) {
  const target = document.querySelector("[data-search-results]");
  if (!target) return;

  commandResults = searchPaletteItems(content, query);
  commandSelectedIndex = Math.min(Math.max(selectedIndex, 0), Math.max(commandResults.length - 1, 0));

  target.innerHTML = commandResults.length
    ? `
        <div class="command-group-label">${query.trim() ? "Results" : "Quick Open"}</div>
        ${commandResults
        .map(
          (entry, index) => `
            <a href="${escapeHtml(entry.href)}" data-search-hit data-command-index="${index}" class="${index === commandSelectedIndex ? "is-selected" : ""}" aria-selected="${index === commandSelectedIndex}">
              <span>${escapeHtml(entry.type)}</span>
              <strong>${escapeHtml(entry.title)}</strong>
              <small>${escapeHtml(entry.subtitle || entry.href)}</small>
            </a>
          `,
        )
        .join("")}
      `
    : `
      <div class="search-empty">
        <strong>没有找到匹配内容</strong>
        <p>可以换一个关键词，或者先把相关内容写进文章、知识库、阅读记录或项目文档。</p>
      </div>
    `;
}

function setupGlobalSearch(content) {
  const overlay = document.querySelector("[data-search-overlay]");
  const input = document.querySelector("[data-global-search]");
  const openButton = document.querySelector("[data-open-search]");
  const closeButton = document.querySelector("[data-close-search]");
  if (!overlay || !input || !openButton || !closeButton) return;

  function openSearch() {
    overlay.hidden = false;
    input.value = "";
    renderSearchResults(content, "", 0);
    input.focus();
  }

  function closeSearch() {
    overlay.hidden = true;
  }

  openButton.onclick = openSearch;
  closeButton.onclick = closeSearch;
  input.oninput = () => {
    renderSearchResults(content, input.value, 0);
    scheduleSearchAnalytics("command", input.value, commandResults.length);
  };
  overlay.onclick = (event) => {
    const hit = event.target.closest("[data-search-hit]");
    if (hit) {
      const selected = commandResults[Number(hit.dataset.commandIndex)];
      if (selected) {
        sendSearchAnalytics({
          source: "command",
          event_type: "click",
          query: input.value.trim(),
          result_count: commandResults.length,
          selected_type: selected.type,
          selected_title: selected.title,
          selected_href: selected.href,
        });
      }
    }
    if (event.target === overlay || hit) {
      closeSearch();
    }
  };

  function openSelectedResult() {
    const selected = commandResults[commandSelectedIndex];
    if (!selected) return;
    sendSearchAnalytics({
      source: "command",
      event_type: "click",
      query: input.value.trim(),
      result_count: commandResults.length,
      selected_type: selected.type,
      selected_title: selected.title,
      selected_href: selected.href,
    });
    window.location.hash = selected.href.replace(/^#/, "");
    closeSearch();
  }

  document.addEventListener("keydown", (event) => {
    const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (isSearchShortcut) {
      event.preventDefault();
      openSearch();
    }
    if (overlay.hidden) return;
    if (event.key === "Escape") {
      closeSearch();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      renderSearchResults(content, input.value, commandSelectedIndex + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      renderSearchResults(content, input.value, commandSelectedIndex - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openSelectedResult();
    }
  });
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

function renderAgentTask(task) {
  const statusTarget = document.querySelector("[data-agent-status]");
  const planTarget = document.querySelector("[data-agent-plan]");
  const resultTarget = document.querySelector("[data-agent-result]");
  if (!statusTarget || !planTarget || !resultTarget) return;

  statusTarget.textContent = `Task #${task.id} · ${task.status} · ${task.planner || "local"} planner · ${task.tool_calls || 0} tool calls`;
  const running = ["pending", "queued", "running", "cancel_requested"].includes(task.status);
  const awaitingConfirmation = task.status === "awaiting_confirmation";
  const runButton = document.querySelector("[data-agent-run]");
  const cancelButton = document.querySelector("[data-agent-cancel]");
  const retryButton = document.querySelector("[data-agent-retry]");
  const approveButton = document.querySelector("[data-agent-approve]");
  const denyButton = document.querySelector("[data-agent-deny]");
  if (runButton) {
    runButton.disabled = running || awaitingConfirmation;
    runButton.hidden = running || awaitingConfirmation;
  }
  if (cancelButton) cancelButton.hidden = !(running || awaitingConfirmation);
  if (retryButton) retryButton.hidden = !["failed", "cancelled"].includes(task.status);
  if (approveButton) approveButton.hidden = !awaitingConfirmation;
  if (denyButton) denyButton.hidden = !awaitingConfirmation;
  const steps = (task.steps || []).length
    ? task.steps
    : (task.plan || []).map((step, index) => ({
        step_index: index,
        tool_name: step.tool,
        status: "planned",
        input: step.input || {},
        duration_ms: 0,
        reason: step.reason,
      }));
  planTarget.innerHTML = steps
    .map(
      (step) => `
        <article class="agent-runtime-step ${step.status === "failed" ? "is-failed" : ""}">
          <span>Step ${escapeHtml(Number(step.step_index) + 1)} · ${escapeHtml(step.status)} · ${escapeHtml(step.planner || "preview")}</span>
          <strong>${escapeHtml(step.tool_name)}</strong>
          <small>${escapeHtml(step.reason || JSON.stringify(step.input || {}))}</small>
          ${step.duration_ms ? `<small>${escapeHtml(step.duration_ms)}ms</small>` : ""}
          ${step.error ? `<p>${escapeHtml(step.error)}</p>` : ""}
        </article>
      `,
    )
    .join("");

  const result = task.result || {};
  const sources = result.sources || [];
  const grounding = result.grounding || {};
  resultTarget.innerHTML = ["completed", "cancelled"].includes(task.status)
    ? `
        <strong>Result</strong>
        <div class="agent-result-metrics">
          <span>${escapeHtml(result.generator || "local-agent")}</span>
          <span>Quality ${escapeHtml(result.quality_score ?? 0)}</span>
          <span>${escapeHtml(grounding.status || "unknown")}</span>
          <span>Support ${escapeHtml(Math.round((Number(grounding.support_score) || 0) * 100))}%</span>
          <span>${escapeHtml(result.latency_ms || 0)}ms</span>
        </div>
        <p class="agent-result-answer">${escapeHtml(result.answer || "任务已完成。").replace(/\n/g, "<br>")}</p>
        ${sources.length
          ? `<div class="source-list">${sources.map((source, index) => `<div><span>[${index + 1}] ${escapeHtml(source.entity_type || "content")}</span><strong><a href="${escapeHtml(source.url || "#")}">${escapeHtml(source.title || source.slug)}</a></strong><p>${escapeHtml(source.summary || source.context || "")}</p></div>`).join("")}</div>`
          : ""}
      `
    : task.status === "failed"
      ? `<strong>执行失败</strong><p>${escapeHtml(task.error || "未知错误")}</p>`
      : task.status === "awaiting_confirmation"
        ? `<strong>等待人工确认</strong><p>${escapeHtml(task.pending_confirmation?.reason || "下一步工具调用需要确认。")}</p><small>${escapeHtml(task.pending_confirmation?.tool || "")}</small>`
      : `<p>计划已创建，准备执行。</p>`;
}

function agentTaskUrl(taskId, action = "") {
  const suffix = action ? `/${action}` : "";
  return `${agentApiUrl}/tasks/${taskId}${suffix}?session_id=${encodeURIComponent(aiSessionId)}`;
}

function stopAgentPolling() {
  if (agentPollTimer) window.clearTimeout(agentPollTimer);
  agentPollTimer = null;
}

async function pollAgentTask(taskId) {
  stopAgentPolling();
  try {
    const response = await fetch(agentTaskUrl(taskId), { credentials: "include" });
    if (!response.ok) throw new Error(`Agent status failed: ${response.status}`);
    const task = await response.json();
    renderAgentTask(task);
    if (["pending", "queued", "running", "cancel_requested"].includes(task.status)) {
      agentPollTimer = window.setTimeout(() => pollAgentTask(taskId), 400);
    }
  } catch (error) {
    const statusTarget = document.querySelector("[data-agent-status]");
    if (statusTarget) statusTarget.textContent = error instanceof Error ? error.message : "任务状态读取失败";
  }
}

async function invokeAgentAction(action, body) {
  if (!activeAgentTaskId) return null;
  const response = await fetch(agentTaskUrl(activeAgentTaskId, action), {
    method: "POST",
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Agent ${action} failed: ${response.status}`);
  const task = await response.json();
  renderAgentTask(task);
  return task;
}

async function runAgentTask() {
  const goalInput = document.querySelector("[data-agent-goal]");
  const button = document.querySelector("[data-agent-run]");
  const statusTarget = document.querySelector("[data-agent-status]");
  const goal = goalInput?.value.trim() || "";
  if (!goal) {
    if (statusTarget) statusTarget.textContent = "请先输入任务目标";
    return;
  }

  stopAgentPolling();
  activeAgentTaskId = null;
  button.disabled = true;
  if (statusTarget) statusTarget.textContent = "正在创建只读执行计划...";
  try {
    const createResponse = await fetch(`${agentApiUrl}/tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, session_id: aiSessionId, max_steps: 6 }),
    });
    if (!createResponse.ok) throw new Error(`Agent create failed: ${createResponse.status}`);
    const created = await createResponse.json();
    renderAgentTask(created);
    activeAgentTaskId = created.id;
    if (statusTarget) statusTarget.textContent = `Task #${created.id} · 正在进入执行队列...`;
    await invokeAgentAction("start");
    await pollAgentTask(created.id);
  } catch (error) {
    if (statusTarget) statusTarget.textContent = "FastAPI Agent Runtime 未连接";
    document.querySelector("[data-agent-result]").innerHTML = `<p>${escapeHtml(error instanceof Error ? error.message : "Agent 执行失败")}</p>`;
  } finally {
    if (!activeAgentTaskId) button.disabled = false;
  }
}

async function cancelAgentTask() {
  try {
    await invokeAgentAction("cancel");
    await pollAgentTask(activeAgentTaskId);
  } catch (error) {
    document.querySelector("[data-agent-status]").textContent = error instanceof Error ? error.message : "取消失败";
  }
}

async function retryAgentTask() {
  try {
    await invokeAgentAction("retry");
    await pollAgentTask(activeAgentTaskId);
  } catch (error) {
    document.querySelector("[data-agent-status]").textContent = error instanceof Error ? error.message : "重试失败";
  }
}

async function confirmAgentTask(approved) {
  try {
    const task = await invokeAgentAction("confirm", { approved });
    if (task && approved) await pollAgentTask(activeAgentTaskId);
  } catch (error) {
    document.querySelector("[data-agent-status]").textContent = error instanceof Error ? error.message : "确认失败";
  }
}

async function answerStaticQuestion(content) {
  const query = document.querySelector("[data-ai-question]").value.trim();
  const target = document.querySelector("[data-ai-answer]");
  const traceTarget = document.querySelector("[data-ai-trace]");
  const examples = content.aiShowcase?.examples || [];

  if (!query) {
    target.innerHTML = "<p>先输入一个问题，例如：EduRAG 准备用哪些技术？</p>";
    if (traceTarget) traceTarget.innerHTML = renderTrace(["等待问题", "准备检索站内内容", "返回引用来源"], "idle");
    return;
  }

  const startedAt = performance.now();
  if (traceTarget) {
    traceTarget.innerHTML = renderTrace(["发送问题到 FastAPI", "等待 RAG 检索", "生成回答"], "idle");
  }
  target.innerHTML = "<p>正在检索站内内容...</p>";
  const scope = readAiRetrievalScope();

  try {
    const response = await fetch(aiApiUrl, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: query, limit: 5, session_id: aiSessionId, scope }),
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const result = await response.json();
    const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
    const sources = result.sources || [];
    const grounding = result.grounding || {};

    if (traceTarget) {
      traceTarget.innerHTML = renderTrace(result.trace || ["FastAPI RAG", "Vector Search", "Answer"]);
    }

    target.innerHTML = `
      <strong>Answer</strong>
      <p>${escapeHtml(result.answer || "")}</p>
      ${renderCitationQuality(sources)}
      <div class="run-metrics">
        <span>Grounding <strong>${escapeHtml(grounding.status || "-")}</strong></span>
        <span>Evidence <strong>${Math.round((Number(grounding.confidence) || 0) * 100)}%</strong></span>
        <span>Claim Support <strong>${Math.round((Number(grounding.support_score) || 0) * 100)}%</strong></span>
        <span>Citations <strong>${Math.round((Number(grounding.citation_coverage) || 0) * 100)}%</strong></span>
      </div>
      ${renderSourceList(sources)}
      ${renderAiFeedbackControls(result.memory_id)}
      <details class="prompt-box">
        <summary>Prompt Context</summary>
        <pre>${escapeHtml(result.prompt_context || "")}</pre>
      </details>
      <div class="run-metrics">
        <span>Latency <strong>${escapeHtml(result.latency_ms || elapsed)}ms</strong></span>
        <span>Sources <strong>${sources.length}</strong></span>
        <span>Memory <strong>${result.memory_id || "-"}</strong></span>
        <span>Generator <strong>${escapeHtml(result.generator || "local")}</strong></span>
        <span>Scope <strong>${escapeHtml(activeAiScopeLabel())}</strong></span>
        <span>Quality <strong>${escapeHtml(result.quality_score ?? citationQuality(sources).score)}</strong></span>
      </div>
    `;
    await renderAiHistory();
    return;
  } catch {
    if (traceTarget) {
      traceTarget.innerHTML = renderTrace(["FastAPI 未连接", "退回静态检索", "返回本地结果"]);
    }
    if (Object.keys(scope).length) {
      target.innerHTML = `<p>“${escapeHtml(activeAiScopeLabel())}”范围检索需要连接 FastAPI。当前没有退回全站搜索，以免返回范围外内容。</p>`;
      return;
    }
  }

  const example = examples.find((item) => query.includes(item.question) || item.question.includes(query));
  const ranked = buildRagSources(content, query, 6);

  const answer = example
    ? example.answer
    : ranked.length
      ? buildLocalGroundedAnswer(query, ranked)
      : "当前静态内容里没有找到明显匹配项，并且 FastAPI 后端没有连接。";
  const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
  const promptPreview = buildPromptPreview(query, ranked);

  if (traceTarget) {
    traceTarget.innerHTML = renderTrace([
      "解析问题与关键词",
      "检索文章 / 项目 / 知识网络",
      `命中 ${ranked.length} 个站内上下文`,
      "生成带引用的静态回答",
    ]);
  }

  target.innerHTML = `
    <strong>Answer</strong>
    <p>${escapeHtml(answer)}</p>
    ${renderCitationQuality(ranked)}
    ${renderSourceList(ranked)}
    <details class="prompt-box">
      <summary>Prompt Context</summary>
      <pre>${escapeHtml(promptPreview)}</pre>
    </details>
    <div class="run-metrics">
      <span>Latency <strong>${elapsed}ms</strong></span>
      <span>Sources <strong>${ranked.length}</strong></span>
      <span>Token <strong>0</strong></span>
      <span>Cost <strong>¥0</strong></span>
    </div>
  `;
}

function buildPromptPreview(query, sources) {
  return [
    `Question: ${query}`,
    "",
    "Context:",
    ...sources.map((source, index) =>
      [
        `${index + 1}. [${sourceLabel(source)}] ${source.title}`,
        `Summary: ${source.summary || source.subtitle || ""}`,
        source.context ? `Graph Context: ${source.context}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
    "Instruction: 基于站内内容回答；如果证据不足，明确说明当前内容不足。",
  ].join("\n");
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

  const postOverviewHead = document.querySelector("[data-post-overview-head]");
  const postColumns = document.querySelector("[data-post-columns]");
  const postColumnDetail = document.querySelector("[data-post-column-detail]");
  if (postOverviewHead) postOverviewHead.hidden = false;
  if (postColumns) postColumns.hidden = false;
  if (postColumnDetail) postColumnDetail.hidden = true;
  document.querySelector('[data-view="posts"]')?.classList.remove("is-article-detail");

  const knowledgeOverview = document.querySelector("[data-knowledge-overview]");
  const knowledgeColumnDetail = document.querySelector("[data-column-detail]");
  const knowledgeNodeDetail = document.querySelector("[data-node-detail]");
  const hiddenNormalizedNodes = document.querySelector("[data-normalized-knowledge-nodes]");
  if (knowledgeOverview) knowledgeOverview.hidden = false;
  if (knowledgeColumnDetail) knowledgeColumnDetail.hidden = true;
  if (knowledgeNodeDetail) knowledgeNodeDetail.hidden = true;
  if (hiddenNormalizedNodes) hiddenNormalizedNodes.hidden = true;
  document.querySelector(".knowledge-nav-root")?.classList.add("is-active");
  document.querySelectorAll("[data-knowledge-nav] a").forEach((link) => link.classList.remove("is-active"));
}

function setRoute(content) {
  const rawHash = window.location.hash.replace("#", "") || "home";
  let hash = rawHash;
  try {
    hash = decodeURIComponent(rawHash);
  } catch {
    hash = rawHash;
  }
  const isPostColumn = hash.startsWith("post-column-");
  const isPost = hash.startsWith("post-");
  const isProject = hash.startsWith("project-");
  const isKnowledge = hash.startsWith("knowledge-");
  const isColumn = hash.startsWith("column-");
  const isNode = hash.startsWith("node-");
  const requestedRoute = isPostColumn || isPost ? "posts" : isProject ? "projects" : isKnowledge || isColumn || isNode ? "knowledge" : hash;
  const route = document.querySelector(`[data-view="${requestedRoute}"]`) ? requestedRoute : "home";
  const activeRoute = ["building", "changelog"].includes(route) ? "now" : route;

  document.querySelectorAll("[data-route]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === activeRoute);
  });

  document.querySelectorAll("[data-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === route);
  });

  resetDetailViews();
  if ((content.knowledgeNodes || []).length) {
    const legacyKnowledge = document.querySelector("[data-knowledge]");
    if (legacyKnowledge) legacyKnowledge.hidden = true;
  }

  if (!isPost || isPostColumn) updateDefaultSeo(content);
  if (isPostColumn) renderPostColumn(content, hash.replace("post-column-", ""));
  else if (isPost) renderArticle(content, hash.replace("post-", ""));
  if (isProject) renderProjectDetail(content, hash.replace("project-", ""));
  if (isKnowledge) renderKnowledgeDetail(content, hash.replace("knowledge-", ""));
  if (isColumn) renderKnowledgeColumnDetail(content, hash.replace("column-", ""));
  if (isNode) renderKnowledgeNodeDetail(content, hash.replace("node-", ""));

  if (route === "graph") {
    window.requestAnimationFrame(() => {
      if ((content.knowledgeNodes || []).length) renderDatabaseKnowledgeGraph(content);
      else {
        const map = document.querySelector("[data-knowledge-map]");
        if (map) map.innerHTML = `<div class="empty-state"><strong>还没有公开图谱数据</strong><p>先在后台创建知识节点和显式关系。</p></div>`;
      }
    });
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function render(content) {
  appContent = content;
  renderProfile(content);
  renderSiteModules(content);
  renderProjects(content);
  renderPosts(content);
  renderKnowledge(content);
  renderKnowledgeColumns(content);
  renderNormalizedKnowledgeNodes(content);
  renderRoadmap(content);
  renderAbout(content);
  renderAi(content);
  renderStats(content);
  renderNow(content);
  renderBuilding(content);
  renderChangelog(content);
  renderPills("[data-tech-stack]", content.techStack || []);
  setupGlobalSearch(content);
  const yearTarget = document.querySelector("[data-year]");
  if (yearTarget) yearTarget.textContent = new Date().getFullYear();
  setRoute(content);
  window.addEventListener("hashchange", () => setRoute(content));
}

async function loadContent() {
  let localContent = fallbackContent;
  try {
    const response = await fetch(contentUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
    localContent = await response.json();
  } catch (error) {
    console.warn(error);
  }

  try {
    const response = await fetch(`${portfolioApiUrl}/content/site`, { cache: "no-store", signal: AbortSignal.timeout(1800) });
    if (!response.ok) throw new Error(`Site settings request failed: ${response.status}`);
    const serverContent = await response.json();
    if (serverContent && typeof serverContent === "object" && Object.keys(serverContent).length) {
      localContent = { ...localContent, ...serverContent };
    }
  } catch (error) {
    console.warn(error);
  }

  try {
    const response = await fetch(`${portfolioApiUrl}/content/public`, { cache: "no-store", signal: AbortSignal.timeout(1800) });
    if (!response.ok) throw new Error(`Public CMS request failed: ${response.status}`);
    const published = await response.json();
    return {
      ...localContent,
      posts: Array.isArray(published.posts) && published.posts.length ? published.posts : localContent.posts,
      projects: Array.isArray(published.projects) ? published.projects : localContent.projects,
      knowledgeBase: Array.isArray(published.knowledgeBase) && published.knowledgeBase.length ? published.knowledgeBase : localContent.knowledgeBase,
      knowledgeColumns: Array.isArray(published.knowledgeColumns) && published.knowledgeColumns.length ? published.knowledgeColumns : (localContent.knowledgeColumns || []),
      knowledgeNodes: Array.isArray(published.knowledgeNodes) && published.knowledgeNodes.length ? published.knowledgeNodes : (localContent.knowledgeNodes || []),
      knowledgeGraph: published.knowledgeGraph && typeof published.knowledgeGraph === "object" && Array.isArray(published.knowledgeGraph.nodes) && published.knowledgeGraph.nodes.length ? published.knowledgeGraph : (localContent.knowledgeGraph || { nodes: [], edges: [], stats: {} }),
    };
  } catch (error) {
    console.warn(error);
    return localContent;
  }
}

loadContent().then(render);
