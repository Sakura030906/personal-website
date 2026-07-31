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
