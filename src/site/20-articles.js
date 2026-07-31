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
