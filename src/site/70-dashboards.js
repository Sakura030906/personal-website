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
