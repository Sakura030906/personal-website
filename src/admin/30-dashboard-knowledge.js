function renderAdminDashboard() {
  const statsTarget = document.querySelector("[data-admin-dashboard-stats]");
  if (!statsTarget || !state) return;
  const postEntries = cmsEntries.length
    ? cmsEntries.filter((entry) => entry.entity_type === "post")
    : (state.posts || []).map((post, index) => ({ id: `local-${index}`, title: post.title, status: post.status, updated_at: post.date, entity_type: "post" }));
  const draftCount = postEntries.filter((entry) => entry.status === "draft").length;
  const publishedCount = postEntries.filter((entry) => entry.status === "published").length;
  const nodeCount = knowledgeNodes.length || (state.knowledgeNodes || []).length;
  const pendingDocuments = documents.filter((item) => !["ready", "indexed"].includes(item.status)).length;
  const dashboardStats = [
    ["□", "草稿文章", draftCount, "继续编辑与发布"],
    ["⌘", "知识节点", nodeCount, `${knowledgeRelations.length || state.knowledgeGraph?.edges?.length || 0} 条关系`],
    ["▣", "待处理文档", pendingDocuments, `${documents.length} 份文档记录`],
    ["◇", "最近 Agent 运行", agentRuns.length, "当前加载的审计任务"],
  ];
  statsTarget.innerHTML = dashboardStats.map(([icon, label, value, note], index) => `<article data-tone="${["green", "green", "amber", "blue"][index]}"><i>${icon}</i><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div></article>`).join("");

  const recentTarget = document.querySelector("[data-admin-recent-content]");
  if (recentTarget) {
    const recent = [
      ...postEntries.map((entry) => ({ title: entry.title, type: "文章", status: entry.status || "draft", date: entry.updated_at || entry.date || "" })),
      ...(knowledgeNodes.length ? knowledgeNodes : state.knowledgeNodes || []).slice(0, 6).map((node) => ({ title: node.title, type: "知识节点", status: node.visibility || "public", date: node.updated_at || "" })),
      ...(state.changelog || []).slice(0, 3).map((item) => ({ title: `${item.version} ${item.title}`, type: "系统", status: "updated", date: item.date || "" })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
    recentTarget.innerHTML = `
      <div class="dashboard-table-head"><span>标题</span><span>类型</span><span>状态</span><span>更新时间</span></div>
      ${recent.map((item) => `<article><strong>${escapeHtml(item.title || "未命名")}</strong><span>${escapeHtml(item.type)}</span><em>${escapeHtml(item.status)}</em><time>${escapeHtml(formatDateTime(item.date) || item.date || "最近")}</time></article>`).join("")}
    `;
  }

  const publishTarget = document.querySelector("[data-admin-publish-summary]");
  if (publishTarget) {
    const total = Math.max(1, draftCount + publishedCount);
    publishTarget.innerHTML = `
      <div class="dashboard-progress-row"><span>Draft</span><i><b style="width:${Math.round((draftCount / total) * 100)}%"></b></i><strong>${draftCount}</strong></div>
      <div class="dashboard-progress-row published"><span>Published</span><i><b style="width:${Math.round((publishedCount / total) * 100)}%"></b></i><strong>${publishedCount}</strong></div>
      <small>总计文章：${draftCount + publishedCount} 篇</small>
    `;
  }

  const ragTarget = document.querySelector("[data-admin-rag-summary]");
  if (ragTarget) {
    const vectorStore = ragIndex?.stats?.vector_store || {};
    ragTarget.innerHTML = `
      <div class="dashboard-status-row"><span>Local 索引</span><strong><i></i>${ragIndex ? "正常" : "等待连接"}</strong></div>
      <div class="dashboard-status-row"><span>Milvus 向量库</span><strong><i></i>${escapeHtml(vectorStore.status || vectorStore.active || "未读取")}</strong></div>
      <small>${ragIndex?.stats?.last_indexed ? `最后同步：${escapeHtml(formatDateTime(ragIndex.stats.last_indexed))}` : "登录 CMS 后读取实时索引状态"}</small>
    `;
  }

  const activityTarget = document.querySelector("[data-admin-activity-summary]");
  if (activityTarget) {
    activityTarget.innerHTML = (state.changelog || []).slice(0, 4).map((item) => `<article><i></i><time>${escapeHtml(item.date || "")}</time><span>发布 ${escapeHtml(item.version)} ${escapeHtml(item.title)}</span></article>`).join("");
  }
}

function countKnowledgeNodesForHealth() {
  return (state.knowledgeBase || []).reduce((total, group) => total + 1 + (group.items || []).length + (group.notes || []).length, 0);
}

function contentWordCount() {
  return (state.posts || []).reduce((total, post) => total + String(post.content || "").replace(/\s+/g, "").length, 0);
}

function healthIssue(severity, title, detail, action = "") {
  return { severity, title, detail, action };
}

function buildHealthReport() {
  const posts = state.posts || [];
  const publishedPosts = posts.filter((post) => post.status !== "draft");
  const draftPosts = posts.filter((post) => post.status === "draft");
  const projects = state.projects || [];
  const knowledge = state.knowledgeBase || [];
  const reading = state.reading || [];
  const cmsDrafts = cmsEntries.filter((entry) => entry.status === "draft").length;
  const cmsPublished = cmsEntries.filter((entry) => entry.status === "published").length;
  const issues = [];

  posts.forEach((post) => {
    if (post.status !== "draft" && !post.summary) {
      issues.push(healthIssue("warning", `文章缺少摘要：${post.title}`, "摘要会影响列表展示、SEO 描述和 AI Lab 检索质量。", "补充 summary"));
    }
    if (post.status !== "draft" && !post.seoDescription && !post.summary) {
      issues.push(healthIssue("warning", `文章缺少 SEO 描述：${post.title}`, "建议至少填写 summary 或 seoDescription。", "补充 SEO"));
    }
    if (post.status !== "draft" && !(post.tags || []).length) {
      issues.push(healthIssue("info", `文章缺少标签：${post.title}`, "标签会用于筛选、搜索和相关文章联动。", "添加 tags"));
    }
  });

  knowledge.forEach((group) => {
    const relationCount = [
      ...(group.relatedKnowledge || []),
      ...(group.relatedProjects || []),
      ...(group.relatedReading || []),
      ...(group.relatedPosts || []),
    ].length;
    if (!relationCount) {
      issues.push(healthIssue("warning", `知识主题没有关联：${group.topic}`, "没有关联的知识节点不会形成知识网络。", "补充 relatedKnowledge / relatedProjects"));
    }
    if (!(group.notes || []).length) {
      issues.push(healthIssue("info", `知识主题缺少笔记：${group.topic}`, "建议至少补 1 条可复用知识节点。", "添加 notes"));
    }
  });

  projects.forEach((project) => {
    if (!project.github && !project.demo && project.status !== "规划中") {
      issues.push(healthIssue("info", `项目缺少链接：${project.name}`, "真实 GitHub 或 Demo 会提升可信度。", "补充链接"));
    }
  });

  reading.forEach((book) => {
    if (![...(book.relatedKnowledge || []), ...(book.relatedProjects || [])].length) {
      issues.push(healthIssue("info", `阅读记录没有关联：${book.title}`, "关联知识或项目后，Reading 才能进入知识网络。", "补充关联"));
    }
  });

  return {
    stats: [
      ["文章", posts.length, `${publishedPosts.length} 已发布 / ${draftPosts.length} 草稿`],
      ["知识节点", countKnowledgeNodesForHealth(), `${knowledge.length} 个主题`],
      ["阅读", reading.length, `${reading.filter((item) => item.status === "在读").length} 在读`],
      ["项目", projects.length, "项目先保持真实进度"],
      ["写作字数", contentWordCount().toLocaleString("zh-CN"), "来自文章正文"],
      ["CMS", cmsEntries.length || "-", cmsEntries.length ? `${cmsPublished} 发布 / ${cmsDrafts} 草稿` : "未加载 CMS"],
    ],
    issues,
  };
}

function renderHealthDashboard() {
  const statTarget = document.querySelector("[data-health-stats]");
  const issueTarget = document.querySelector("[data-health-issues]");
  if (!statTarget || !issueTarget || !state) return;
  const report = buildHealthReport();

  statTarget.innerHTML = report.stats
    .map(
      ([label, value, note]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `,
    )
    .join("");

  issueTarget.innerHTML = report.issues.length
    ? `
      <h3>待处理事项</h3>
      ${report.issues
        .slice(0, 12)
        .map(
          (issue) => `
            <article class="health-issue ${escapeHtml(issue.severity)}">
              <span>${escapeHtml(issue.severity)}</span>
              <div>
                <strong>${escapeHtml(issue.title)}</strong>
                <p>${escapeHtml(issue.detail)}</p>
              </div>
              <em>${escapeHtml(issue.action)}</em>
            </article>
          `,
        )
        .join("")}
    `
    : `<div class="empty success">当前没有明显内容健康问题。</div>`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function emptyKnowledgeColumn() {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    cover_url: "",
    icon: "book-open",
    visibility: "public",
    allow_ai_search: true,
    sort_order: 0,
  };
}

function setColumnForm(column = emptyKnowledgeColumn()) {
  activeKnowledgeColumn = column;
  document.querySelector("[data-column-name]").value = column.name || "";
  document.querySelector("[data-column-slug]").value = column.slug || "";
  document.querySelector("[data-column-description]").value = column.description || "";
  document.querySelector("[data-column-cover]").value = column.cover_url || "";
  document.querySelector("[data-column-icon]").value = column.icon || "book-open";
  document.querySelector("[data-column-visibility]").value = column.visibility || "public";
  document.querySelector("[data-column-ai-search]").checked = column.allow_ai_search !== false;
  document.querySelector("[data-column-sort]").value = Number(column.sort_order) || 0;
}

function readColumnForm() {
  const name = document.querySelector("[data-column-name]").value.trim();
  return {
    name,
    slug: document.querySelector("[data-column-slug]").value.trim() || slugify(name),
    description: document.querySelector("[data-column-description]").value.trim(),
    cover_url: document.querySelector("[data-column-cover]").value.trim(),
    icon: document.querySelector("[data-column-icon]").value.trim() || "book-open",
    visibility: document.querySelector("[data-column-visibility]").value,
    allow_ai_search: document.querySelector("[data-column-ai-search]").checked,
    sort_order: Number(document.querySelector("[data-column-sort]").value) || 0,
  };
}

function renderColumnList() {
  const target = document.querySelector("[data-column-list]");
  if (!target) return;
  target.innerHTML = knowledgeColumns.length
    ? knowledgeColumns.map((column) => `
        <button type="button" data-column-id="${column.id}" class="${activeKnowledgeColumn?.id === column.id ? "is-active" : ""}">
          <strong>${escapeHtml(column.name)}</strong>
          <small>${escapeHtml(column.visibility)} · ${column.article_count || 0} 篇文章</small>
        </button>
      `).join("")
    : `<p class="empty">暂无专栏，可以新建第一个专栏。</p>`;
}

function renderArticleColumnEditor(metadata = {}) {
  const target = document.querySelector("[data-entry-columns]");
  const primary = document.querySelector("[data-entry-primary-column]");
  if (!target || !primary) return;
  const selected = new Set((metadata.columnIds || []).map(Number));
  target.innerHTML = knowledgeColumns.length
    ? knowledgeColumns.map((column) => `
        <label><input type="checkbox" value="${column.id}" ${selected.has(column.id) ? "checked" : ""} />${escapeHtml(column.name)}</label>
      `).join("")
    : `<span>暂无专栏，请先在上方创建。</span>`;
  primary.innerHTML = `<option value="">未指定</option>${knowledgeColumns
    .filter((column) => selected.has(column.id))
    .map((column) => `<option value="${column.id}" ${Number(metadata.primaryColumnId) === column.id ? "selected" : ""}>${escapeHtml(column.name)}</option>`)
    .join("")}`;
}

async function loadKnowledgeColumns() {
  knowledgeColumns = await cmsRequest("/admin/knowledge-columns");
  if (activeKnowledgeColumn?.id) {
    activeKnowledgeColumn = knowledgeColumns.find((column) => column.id === activeKnowledgeColumn.id) || knowledgeColumns[0] || emptyKnowledgeColumn();
  } else {
    activeKnowledgeColumn = knowledgeColumns[0] || emptyKnowledgeColumn();
  }
  setColumnForm(activeKnowledgeColumn);
  renderColumnList();
  renderArticleColumnEditor(parseMetadata(activeEntry));
}

async function saveKnowledgeColumn() {
  const payload = readColumnForm();
  if (!payload.name) throw new Error("请填写专栏名称");
  const path = activeKnowledgeColumn?.id ? `/admin/knowledge-columns/${activeKnowledgeColumn.id}` : "/admin/knowledge-columns";
  const method = activeKnowledgeColumn?.id ? "PATCH" : "POST";
  activeKnowledgeColumn = await cmsRequest(path, { method, body: JSON.stringify(payload) });
  showToast("专栏已保存");
  await loadKnowledgeColumns();
}

async function deleteKnowledgeColumn() {
  if (!activeKnowledgeColumn?.id) return;
  if (!confirm(`确定删除专栏「${activeKnowledgeColumn.name}」吗？文章本身不会被删除。`)) return;
  await cmsRequest(`/admin/knowledge-columns/${activeKnowledgeColumn.id}`, { method: "DELETE" });
  activeKnowledgeColumn = null;
  showToast("专栏已删除，文章仍然保留");
  await loadKnowledgeColumns();
}

function renderEditorReadiness(listSelector, summarySelector, checks) {
  const list = document.querySelector(listSelector);
  const summary = document.querySelector(summarySelector);
  if (!list || !summary) return;
  const ready = checks.filter((item) => item.ready).length;
  summary.textContent = `${ready} / ${checks.length}`;
  list.innerHTML = checks.map((item) => `<li class="${item.ready ? "is-ready" : ""}">${escapeHtml(item.label)}</li>`).join("");
}

function setEditorStatus(selector, message, state = "idle") {
  const target = document.querySelector(selector);
  if (!target) return;
  target.textContent = message;
  target.dataset.state = state;
}

function filterRelationChoices(selector, query) {
  const normalized = String(query || "").trim().toLowerCase();
  document.querySelectorAll(`${selector} label`).forEach((label) => {
    label.classList.toggle("is-filtered", Boolean(normalized) && !label.textContent.toLowerCase().includes(normalized));
  });
}

function emptyKnowledgeNode() {
  return { id: null, title: "", slug: "", summary: "", content_markdown: "", node_type: "concept", importance: 3, visibility: "public", allow_ai_search: true, revision: 1, tag_names: [], column_ids: [], primary_column_id: null, article_ids: [] };
}

function setKnowledgeNodeForm(node = emptyKnowledgeNode()) {
  nodeEditorHydrating = true;
  window.clearTimeout(nodeAutosaveTimer);
  nodeAutosaveDirty = false;
  activeKnowledgeNode = node;
  nodeEnhancement = null;
  document.querySelector("[data-node-title]").value = node.title || "";
  document.querySelector("[data-node-slug]").value = node.slug || "";
  document.querySelector("[data-node-summary]").value = node.summary || "";
  document.querySelector("[data-node-content]").value = node.content_markdown || "";
  document.querySelector("[data-node-type]").value = node.node_type || "concept";
  document.querySelector("[data-node-importance]").value = Number(node.importance) || 3;
  document.querySelector("[data-node-visibility]").value = node.visibility || "public";
  document.querySelector("[data-node-ai-search]").checked = node.allow_ai_search !== false;
  document.querySelector("[data-node-tags]").value = (node.tag_names || []).join(", ");
  renderKnowledgeNodeLinks(node);
  const note = document.querySelector("[data-node-version-note]");
  note.textContent = node.id ? `revision ${node.revision || 1}` : "新节点尚未保存";
  document.querySelector("[data-node-shell-title]").textContent = node.title || "新知识节点";
  document.querySelector("[data-node-shell-visibility]").textContent = (node.visibility || "public").toUpperCase();
  document.querySelector("[data-node-link-search]").value = "";
  document.querySelector("[data-node-version-diff]").hidden = true;
  setEditorStatus("[data-node-save-status]", node.id ? `已保存 · r${node.revision || 1}` : "尚未保存", node.id ? "saved" : "idle");
  renderKnowledgeNodeReadiness();
  renderContentEnhancement("node");
  nodeEditorHydrating = false;
}

function renderKnowledgeNodeReadiness() {
  let payload;
  try { payload = readKnowledgeNodeForm(); } catch { payload = emptyKnowledgeNode(); }
  renderEditorReadiness("[data-node-readiness]", "[data-node-readiness-summary]", [
    { label: "标题与 URL 标识", ready: Boolean(payload.title && payload.slug) },
    { label: "摘要不少于 20 字", ready: payload.summary.length >= 20 },
    { label: "正文不少于 80 字", ready: payload.content_markdown.trim().length >= 80 },
    { label: "至少属于一个专栏", ready: payload.column_ids.length > 0 },
    { label: "已有标签或关联文章", ready: payload.tag_names.length > 0 || payload.article_ids.length > 0 },
    { label: "公开节点允许 AI 检索", ready: payload.visibility !== "public" || payload.allow_ai_search },
  ]);
}

function renderKnowledgeNodeLinks(node = emptyKnowledgeNode()) {
  const selectedColumns = new Set((node.column_ids || []).map(Number));
  const columns = document.querySelector("[data-node-columns]");
  columns.innerHTML = knowledgeColumns.length ? knowledgeColumns.map((column) => `<label><input type="checkbox" value="${column.id}" ${selectedColumns.has(column.id) ? "checked" : ""} />${escapeHtml(column.name)}</label>`).join("") : "<span>暂无专栏</span>";
  const primary = document.querySelector("[data-node-primary-column]");
  primary.innerHTML = `<option value="">未指定</option>${knowledgeColumns.filter((column) => selectedColumns.has(column.id)).map((column) => `<option value="${column.id}" ${Number(node.primary_column_id) === column.id ? "selected" : ""}>${escapeHtml(column.name)}</option>`).join("")}`;
  const selectedArticles = new Set((node.article_ids || []).map(Number));
  document.querySelector("[data-node-articles]").innerHTML = knowledgeArticles.length ? knowledgeArticles.map((article) => `<label><input type="checkbox" value="${article.id}" ${selectedArticles.has(article.id) ? "checked" : ""} />${escapeHtml(article.title)}</label>`).join("") : "<span>暂无文章</span>";
}

function readKnowledgeNodeForm() {
  const title = document.querySelector("[data-node-title]").value.trim();
  const columnIds = [...document.querySelectorAll("[data-node-columns] input:checked")].map((input) => Number(input.value));
  return {
    title,
    slug: document.querySelector("[data-node-slug]").value.trim() || slugify(title),
    summary: document.querySelector("[data-node-summary]").value.trim(),
    content_markdown: document.querySelector("[data-node-content]").value,
    node_type: document.querySelector("[data-node-type]").value,
    importance: Number(document.querySelector("[data-node-importance]").value) || 3,
    visibility: document.querySelector("[data-node-visibility]").value,
    allow_ai_search: document.querySelector("[data-node-ai-search]").checked,
    tag_names: splitValues(document.querySelector("[data-node-tags]").value),
    column_ids: columnIds,
    primary_column_id: Number(document.querySelector("[data-node-primary-column]").value) || null,
    article_ids: [...document.querySelectorAll("[data-node-articles] input:checked")].map((input) => Number(input.value)),
    article_relation_type: "references",
    expected_revision: activeKnowledgeNode?.id ? activeKnowledgeNode.revision : null,
  };
}

function renderKnowledgeNodeList() {
  const target = document.querySelector("[data-node-list]");
  target.innerHTML = knowledgeNodes.length ? knowledgeNodes.map((node) => `<button type="button" data-node-id="${node.id}" class="${activeKnowledgeNode?.id === node.id ? "is-active" : ""}"><strong>${escapeHtml(node.title)}</strong><small>${escapeHtml(node.node_type)} · ${escapeHtml(node.visibility)} · ${node.relations?.length || 0} 条关系</small></button>`).join("") : `<p class="empty">暂无知识节点。</p>`;
}

function emptyKnowledgeRelation() {
  return { id: null, source_node_id: knowledgeNodes[0]?.id || null, target_node_id: knowledgeNodes[1]?.id || null, relation_type: "related_to", relation_label: "", description: "", weight: 1, direction: "directed", is_active: true, is_public: true };
}

function renderRelationSelects(relation = emptyKnowledgeRelation()) {
  const options = knowledgeNodes.map((node) => `<option value="${node.id}">${escapeHtml(node.title)}</option>`).join("");
  document.querySelector("[data-node-relation-source]").innerHTML = options;
  document.querySelector("[data-node-relation-target]").innerHTML = options;
  if (relation.source_node_id) document.querySelector("[data-node-relation-source]").value = relation.source_node_id;
  if (relation.target_node_id) document.querySelector("[data-node-relation-target]").value = relation.target_node_id;
}

function setKnowledgeRelationForm(relation = emptyKnowledgeRelation()) {
  activeKnowledgeRelation = relation;
  renderRelationSelects(relation);
  document.querySelector("[data-node-relation-type]").value = relation.relation_type || "related_to";
  document.querySelector("[data-node-relation-direction]").value = relation.direction || "directed";
  document.querySelector("[data-node-relation-label]").value = relation.relation_label || "";
  document.querySelector("[data-node-relation-description]").value = relation.description || "";
  document.querySelector("[data-node-relation-weight]").value = Number(relation.weight) || 1;
  document.querySelector("[data-node-relation-active]").checked = relation.is_active !== false;
  document.querySelector("[data-node-relation-public]").checked = relation.is_public !== false;
}

function renderKnowledgeRelationList() {
  const target = document.querySelector("[data-node-relation-list]");
  target.innerHTML = knowledgeRelations.length ? knowledgeRelations.map((relation) => `<button type="button" data-node-relation-id="${relation.id}" class="${activeKnowledgeRelation?.id === relation.id ? "is-active" : ""}"><strong>${escapeHtml(relation.source?.title || "?")} → ${escapeHtml(relation.target?.title || "?")}</strong><small>${escapeHtml(relation.relation_type)} · ${relation.is_public ? "公开" : "私有"}</small></button>`).join("") : `<p class="empty">暂无节点关系。</p>`;
}

async function loadKnowledgeGraphData() {
  [knowledgeNodes, knowledgeRelations, knowledgeArticles] = await Promise.all([
    cmsRequest("/admin/knowledge-nodes"), cmsRequest("/admin/knowledge-relations"), cmsRequest("/admin/articles"),
  ]);
  activeKnowledgeNode = activeKnowledgeNode?.id ? knowledgeNodes.find((node) => node.id === activeKnowledgeNode.id) : knowledgeNodes[0];
  activeKnowledgeRelation = activeKnowledgeRelation?.id ? knowledgeRelations.find((relation) => relation.id === activeKnowledgeRelation.id) : knowledgeRelations[0];
  setKnowledgeNodeForm(activeKnowledgeNode || emptyKnowledgeNode());
  setKnowledgeRelationForm(activeKnowledgeRelation || emptyKnowledgeRelation());
  renderKnowledgeNodeList();
  renderKnowledgeRelationList();
  await loadKnowledgeNodeVersions();
  renderAdminDashboard();
}

async function loadKnowledgeNodeVersions() {
  const target = document.querySelector("[data-node-version-list]");
  if (!activeKnowledgeNode?.id) {
    target.innerHTML = `<p class="empty">保存后会记录节点版本。</p>`;
    return;
  }
  const versions = await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}/versions`);
  target.innerHTML = versions.length ? versions.map((version) => `<article><div><strong>${escapeHtml(version.reason)}</strong><span>${escapeHtml(formatDateTime(version.created_at))} · ${escapeHtml(version.created_by_email || "system")}</span></div><div class="version-actions"><button type="button" data-node-version-diff="${version.id}">查看差异</button><button type="button" data-node-version-restore="${version.id}">恢复</button></div></article>`).join("") : `<p class="empty">暂无版本。</p>`;
}

async function loadKnowledgeNodeVersionDiff(versionId) {
  const diff = await cmsRequest(`/admin/knowledge-nodes/versions/${versionId}/diff`);
  const target = document.querySelector("[data-node-version-diff]");
  target.textContent = `变更字段：${(diff.changed_fields || []).join("、") || "无字段变化"}\n\n${diff.content_diff || "正文没有变化。"}`;
  target.hidden = false;
}

async function restoreKnowledgeNodeVersion(versionId) {
  if (!confirm("确定恢复这个知识节点版本吗？当前内容会先自动保存为一个版本。")) return;
  activeKnowledgeNode = await cmsRequest(`/admin/knowledge-nodes/versions/${versionId}/restore`, { method: "POST" });
  showToast("知识节点版本已恢复");
  await loadKnowledgeGraphData();
}

async function saveKnowledgeNode() {
  const payload = readKnowledgeNodeForm();
  if (!payload.title) throw new Error("请填写节点标题");
  const path = activeKnowledgeNode?.id ? `/admin/knowledge-nodes/${activeKnowledgeNode.id}` : "/admin/knowledge-nodes";
  activeKnowledgeNode = await cmsRequest(path, { method: activeKnowledgeNode?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  nodeAutosaveDirty = false;
  setEditorStatus("[data-node-save-status]", `已保存 · r${activeKnowledgeNode.revision || 1}`, "saved");
  showToast("知识节点已保存并记录版本");
  await loadKnowledgeGraphData();
}

function scheduleKnowledgeNodeAutosave() {
  if (nodeEditorHydrating || !cmsToken) return;
  renderKnowledgeNodeReadiness();
  document.querySelector("[data-node-shell-title]").textContent = document.querySelector("[data-node-title]").value.trim() || "新知识节点";
  document.querySelector("[data-node-shell-visibility]").textContent = document.querySelector("[data-node-visibility]").value.toUpperCase();
  if (!activeKnowledgeNode?.id) {
    setEditorStatus("[data-node-save-status]", "先保存以创建节点", "dirty");
    return;
  }
  setEditorStatus("[data-node-save-status]", "有未保存修改", "dirty");
  nodeAutosaveDirty = true;
  window.clearTimeout(nodeAutosaveTimer);
  nodeAutosaveTimer = window.setTimeout(() => guarded(performKnowledgeNodeAutosave), 2400);
}

async function performKnowledgeNodeAutosave() {
  if (!activeKnowledgeNode?.id || nodeAutosaveInFlight || !nodeAutosaveDirty) return;
  const payload = readKnowledgeNodeForm();
  if (!payload.title) return;
  nodeAutosaveInFlight = true;
  setEditorStatus("[data-node-save-status]", "正在自动保存…", "saving");
  try {
    activeKnowledgeNode = await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}`, {
      method: "PATCH", body: JSON.stringify(payload),
    });
    nodeAutosaveDirty = false;
    setEditorStatus("[data-node-save-status]", `已自动保存 · r${activeKnowledgeNode.revision || 1}`, "saved");
    const note = document.querySelector("[data-node-version-note]");
    if (note) note.textContent = `revision ${activeKnowledgeNode.revision || 1}`;
  } finally {
    nodeAutosaveInFlight = false;
  }
}

async function deleteKnowledgeNode() {
  if (!activeKnowledgeNode?.id || !confirm(`将「${activeKnowledgeNode.title}」移至回收站？节点内容、关系和版本都会保留。`)) return;
  await cmsRequest(`/admin/knowledge-nodes/${activeKnowledgeNode.id}`, { method: "DELETE" });
  activeKnowledgeNode = null;
  showToast("知识节点已移至回收站");
  await loadKnowledgeGraphData();
}

function readKnowledgeRelationForm() {
  return { source_node_id: Number(document.querySelector("[data-node-relation-source]").value), target_node_id: Number(document.querySelector("[data-node-relation-target]").value), relation_type: document.querySelector("[data-node-relation-type]").value, direction: document.querySelector("[data-node-relation-direction]").value, relation_label: document.querySelector("[data-node-relation-label]").value.trim(), description: document.querySelector("[data-node-relation-description]").value.trim(), weight: Number(document.querySelector("[data-node-relation-weight]").value) || 1, is_active: document.querySelector("[data-node-relation-active]").checked, is_public: document.querySelector("[data-node-relation-public]").checked };
}

async function saveKnowledgeRelation() {
  const payload = readKnowledgeRelationForm();
  if (!payload.source_node_id || !payload.target_node_id) throw new Error("请先创建至少两个节点");
  const path = activeKnowledgeRelation?.id ? `/admin/knowledge-relations/${activeKnowledgeRelation.id}` : "/admin/knowledge-relations";
  activeKnowledgeRelation = await cmsRequest(path, { method: activeKnowledgeRelation?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  showToast("节点关系已保存");
  await loadKnowledgeGraphData();
}

async function deleteKnowledgeRelation() {
  if (!activeKnowledgeRelation?.id) return;
  await cmsRequest(`/admin/knowledge-relations/${activeKnowledgeRelation.id}`, { method: "DELETE" });
  activeKnowledgeRelation = null;
  showToast("节点关系已删除");
  await loadKnowledgeGraphData();
}
