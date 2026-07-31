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
