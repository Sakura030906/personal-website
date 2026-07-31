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
