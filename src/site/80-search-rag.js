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
