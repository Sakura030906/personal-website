function configureAdminPages() {
  const pageMap = {
    "cms-panel": "security publishing",
    "account-panel": "security",
    "health-panel": "runtime",
    "content-ops-panel": "runtime",
    "ai-runs-panel": "rag ai-feedback",
    "agent-runs-panel": "agent experiments",
    "evaluation-workbench-panel": "experiments",
    "ai-feedback-panel": "ai-feedback",
    "rag-index-panel": "rag experiments",
    "document-library-panel": "documents files",
    "search-analytics-panel": "runtime",
    "content-gaps-panel": "runtime",
    "relation-health-panel": "runtime",
    "publish-workflow-panel": "versions publishing",
    "knowledge-column-panel": "knowledge-columns article-columns",
    "knowledge-node-panel": "knowledge-nodes knowledge-relations",
    "organization-panel": "knowledge-relations",
    "content-cms-panel": "articles projects versions",
    "workspace-inbox-panel": "inbox",
    "review-workspace-panel": "review",
    "maintenance-workspace-panel": "maintenance",
    "workspace-activity-panel": "activity",
    "workspace-trash-panel": "trash",
  };
  document.querySelectorAll(".admin-workspace > .panel").forEach((panel) => {
    const matchedClass = Object.keys(pageMap).find((className) => panel.classList.contains(className));
    panel.dataset.adminPages = matchedClass ? pageMap[matchedClass] : "site-settings";
  });
  const editor = document.querySelector(".cms-editor");
  if (editor && !editor.querySelector(".cms-editor-page-head")) {
    editor.insertAdjacentHTML("afterbegin", `
      <header class="cms-editor-page-head">
        <button type="button" data-cms-editor-back>‹ 返回列表</button>
        <div><span data-cms-editor-breadcrumb>内容管理</span><h2 data-cms-editor-title>内容编辑</h2></div>
      </header>
    `);
  }
}

function setCmsWorkspaceMode(mode = "list") {
  cmsWorkspaceMode = mode === "editor" ? "editor" : "list";
  const panel = document.querySelector(".content-cms-panel");
  if (!panel) return;
  panel.classList.toggle("is-list-mode", cmsWorkspaceMode === "list");
  panel.classList.toggle("is-editor-mode", cmsWorkspaceMode === "editor");
  const editorTitle = document.querySelector("[data-cms-editor-title]");
  const breadcrumb = document.querySelector("[data-cms-editor-breadcrumb]");
  if (editorTitle) editorTitle.textContent = activeEntry?.title || `新建${entityLabels[activeEntityType] || "内容"}`;
  if (breadcrumb) breadcrumb.textContent = `${adminRouteTitles[activeAdminRoute] || "内容管理"} / ${activeEntry?.id ? "编辑" : "新建"}`;
}

function adminRouteEntity(route) {
  return { articles: "post", projects: "project", versions: "post" }[route] || "";
}

function updateKnowledgeRouteLayout(route) {
  const panel = document.querySelector(".knowledge-node-panel");
  if (panel) {
    panel.querySelector(".node-manager").hidden = route === "knowledge-relations";
    panel.querySelector(".relation-manager").hidden = route === "knowledge-nodes";
    const title = panel.querySelector(".panel-title h2");
    const description = panel.querySelector(".panel-title p");
    if (route === "knowledge-relations") {
      title.textContent = "知识关系";
      description.textContent = "建立专栏内部与跨专栏节点关系，控制方向、公开状态和权重。";
    } else {
      title.textContent = "知识节点";
      description.textContent = "创建可独立阅读的知识单元，并管理正文、标签、所属专栏和版本。";
    }
  }

  const columnPanel = document.querySelector(".knowledge-column-panel");
  if (columnPanel) {
    const title = columnPanel.querySelector(".panel-title h2");
    const description = columnPanel.querySelector(".panel-title p");
    const articleMode = route === "article-columns";
    title.textContent = articleMode ? "文章专栏" : "知识专栏";
    description.textContent = articleMode
      ? "管理文章长期主题空间；文章可以加入多个专栏并指定主专栏。"
      : "管理独立知识空间、可见性、排序和 AI 检索权限。";
  }
}

async function navigateAdminRoute(route, { updateHash = true } = {}) {
  const nextRoute = adminRouteTitles[route] ? route : "dashboard";
  const previousRoute = activeAdminRoute;
  if (previousRoute === "knowledge-nodes") await performKnowledgeNodeAutosave();
  if (previousRoute === "documents") await performDocumentAutosave();
  activeAdminRoute = nextRoute;
  document.body.dataset.adminRoute = nextRoute;
  document.querySelector("[data-admin-page-title]").textContent = adminRouteTitles[nextRoute];
  document.querySelectorAll("[data-admin-route]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.adminRoute === nextRoute);
  });
  document.querySelector("[data-admin-page='dashboard']").hidden = nextRoute !== "dashboard";
  document.querySelectorAll(".admin-workspace > .panel").forEach((panel) => {
    panel.hidden = !(panel.dataset.adminPages || "").split(" ").includes(nextRoute);
  });
  updateKnowledgeRouteLayout(nextRoute);
  if (["articles", "projects", "versions"].includes(nextRoute)) {
    const contentPanel = document.querySelector(".content-cms-panel");
    const title = contentPanel?.querySelector(":scope > .panel-title h2");
    const description = contentPanel?.querySelector(":scope > .panel-title p");
    if (title) title.textContent = nextRoute === "projects" ? "项目管理" : nextRoute === "versions" ? "内容版本" : "文章管理";
    if (description) description.textContent = nextRoute === "projects"
      ? "管理项目状态、技术栈、工程证据和公开展示内容。"
      : nextRoute === "versions"
        ? "查看内容编辑器中的自动保存、发布版本和恢复记录。"
        : "管理文章、草稿、Markdown 正文、封面、SEO 和发布状态。";
    setCmsWorkspaceMode(nextRoute === "versions" ? "editor" : "list");
  }

  const entityType = adminRouteEntity(nextRoute);
  if (entityType && entityType !== activeEntityType) {
    await performAutosave();
    activeEntityType = entityType;
    document.querySelectorAll("[data-entity-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.entityTab === activeEntityType);
    });
    if (cmsToken) await loadEntries();
    else {
      setEntryForm(defaultEntry(activeEntityType));
      renderEntryList();
    }
  }

  if (updateHash && window.location.hash.slice(1) !== nextRoute) {
    history.pushState(null, "", `#${nextRoute}`);
  }
  if (cmsToken && nextRoute === "inbox") await loadInbox();
  if (cmsToken && nextRoute === "review") await loadReviewDashboard();
  if (cmsToken && nextRoute === "maintenance") await loadMaintenanceDashboard();
  if (cmsToken && nextRoute === "ai-feedback") await Promise.all([loadProactiveDashboard(false), loadAiFeedback()]);
  if (cmsToken && nextRoute === "knowledge-relations") await loadOrganization();
  if (cmsToken && nextRoute === "security") await loadCurrentAccount();
  if (cmsToken && nextRoute === "activity") await loadActivity();
  if (cmsToken && nextRoute === "trash") await loadTrash();
  document.querySelector(".admin-workspace")?.scrollTo?.({ top: 0, behavior: "instant" });
  renderAdminDashboard();
}

function formatWorkspaceTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function resetInboxForm() {
  activeInboxItem = null;
  document.querySelector("[data-inbox-form-title]").textContent = "快速记录";
  document.querySelector("[data-inbox-title]").value = "";
  document.querySelector("[data-inbox-body]").value = "";
  document.querySelector("[data-inbox-type]").value = "note";
  document.querySelector("[data-inbox-url]").value = "";
  const organizer = document.querySelector("[data-inbox-organizer]");
  if (organizer) organizer.hidden = true;
  renderInbox();
}

function renderInbox() {
  const target = document.querySelector("[data-inbox-list]");
  if (!target) return;
  const pending = inboxItems.filter((item) => item.status !== "processed" && item.status !== "archived");
  target.innerHTML = pending.length ? pending.map((item) => `
    <article class="workspace-list-item ${activeInboxItem?.id === item.id ? "is-active" : ""}" data-inbox-id="${item.id}">
      <button type="button" class="workspace-item-main" data-inbox-open="${item.id}">
        <i>${escapeHtml({ note: "N", idea: "I", link: "L", document: "D" }[item.item_type] || "N")}</i>
        <span><strong>${escapeHtml(item.title || item.body.slice(0, 48) || item.source_url || "未命名记录")}</strong><small>${escapeHtml(item.body.slice(0, 90) || item.source_url || "暂无内容")}</small></span>
        <time>${escapeHtml(formatWorkspaceTime(item.updated_at))}</time>
      </button>
      <div class="workspace-item-actions">
        <button type="button" data-inbox-organize="${item.id}">整理内容</button>
        <button type="button" class="danger-text" data-inbox-trash="${item.id}">移至回收站</button>
      </div>
    </article>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>收件箱已整理完</strong><span>新的想法可以随时先记录在这里。</span></div>`;
  const badge = document.querySelector("[data-inbox-badge]");
  if (badge) {
    badge.textContent = pending.length;
    badge.hidden = pending.length === 0;
  }
}

async function loadWorkspaceOverview() {
  workspaceOverview = await cmsRequest("/admin/workspace/overview");
  const badge = document.querySelector("[data-inbox-badge]");
  if (badge) {
    badge.textContent = workspaceOverview.inbox || 0;
    badge.hidden = !workspaceOverview.inbox;
  }
}

async function loadInbox() {
  inboxItems = await cmsRequest("/admin/inbox");
  renderInbox();
  await loadWorkspaceOverview();
}

function renderInboxOrganizerLinks() {
  const selectedColumns = new Set([...document.querySelectorAll("[data-inbox-target-columns] input:checked")].map((input) => Number(input.value)));
  const selectedNodes = new Set([...document.querySelectorAll("[data-inbox-target-nodes] input:checked")].map((input) => Number(input.value)));
  document.querySelector("[data-inbox-target-columns]").innerHTML = knowledgeColumns.length
    ? knowledgeColumns.map((column) => `<label><input type="checkbox" value="${column.id}" ${selectedColumns.has(column.id) ? "checked" : ""} /><span>${escapeHtml(column.name)}</span></label>`).join("")
    : `<p class="empty">暂无知识专栏。</p>`;
  document.querySelector("[data-inbox-target-nodes]").innerHTML = knowledgeNodes.length
    ? knowledgeNodes.map((node) => `<label><input type="checkbox" value="${node.id}" ${selectedNodes.has(node.id) ? "checked" : ""} /><span>${escapeHtml(node.title)}</span></label>`).join("")
    : `<p class="empty">暂无知识节点。</p>`;
  const primary = document.querySelector("[data-inbox-target-primary-column]");
  const current = primary.value;
  primary.innerHTML = `<option value="">未指定</option>${knowledgeColumns.map((column) => `<option value="${column.id}">${escapeHtml(column.name)}</option>`).join("")}`;
  if ([...primary.options].some((option) => option.value === current)) primary.value = current;
}

function updateInboxOrganizerMode() {
  const type = document.querySelector("[data-inbox-target-type]").value;
  document.querySelector("[data-inbox-node-type-wrap]").hidden = type !== "knowledge";
}

function openInboxOrganizer(itemId) {
  activeInboxItem = inboxItems.find((item) => String(item.id) === String(itemId)) || null;
  if (!activeInboxItem) return;
  renderInbox();
  const organizer = document.querySelector("[data-inbox-organizer]");
  organizer.hidden = false;
  document.querySelector("[data-inbox-target-type]").value = activeInboxItem.item_type === "document" ? "knowledge" : "knowledge";
  document.querySelector("[data-inbox-target-title]").value = activeInboxItem.title || activeInboxItem.body.split("\n")[0].slice(0, 120) || "未命名内容";
  document.querySelector("[data-inbox-target-slug]").value = slugify(document.querySelector("[data-inbox-target-title]").value);
  document.querySelector("[data-inbox-target-summary]").value = activeInboxItem.body.slice(0, 240);
  document.querySelector("[data-inbox-target-tags]").value = "";
  document.querySelector("[data-inbox-target-visibility]").value = "private";
  document.querySelector("[data-inbox-target-node-type]").value = "concept";
  renderInboxOrganizerLinks();
  updateInboxOrganizerMode();
  document.querySelector("[data-inbox-organize-status]").textContent = "";
  organizer.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveInboxItem() {
  const payload = {
    title: document.querySelector("[data-inbox-title]").value.trim(),
    body: document.querySelector("[data-inbox-body]").value.trim(),
    source_url: document.querySelector("[data-inbox-url]").value.trim(),
    item_type: document.querySelector("[data-inbox-type]").value,
    visibility: "private",
  };
  if (activeInboxItem?.id) {
    await cmsRequest(`/admin/inbox/${activeInboxItem.id}`, { method: "PATCH", body: JSON.stringify({ ...payload, status: activeInboxItem.status || "inbox" }) });
    showToast("收件内容已更新");
  } else {
    await cmsRequest("/admin/inbox", { method: "POST", body: JSON.stringify(payload) });
    showToast("已保存到收件箱");
  }
  resetInboxForm();
  await loadInbox();
  await loadActivity();
}

async function promoteInboxItem() {
  if (!activeInboxItem?.id) throw new Error("请先选择一条收件内容");
  const entityType = document.querySelector("[data-inbox-target-type]").value;
  const payload = {
    entity_type: entityType,
    title: document.querySelector("[data-inbox-target-title]").value.trim(),
    slug: document.querySelector("[data-inbox-target-slug]").value.trim(),
    summary: document.querySelector("[data-inbox-target-summary]").value.trim(),
    visibility: document.querySelector("[data-inbox-target-visibility]").value,
    tag_names: splitValues(document.querySelector("[data-inbox-target-tags]").value),
    column_ids: [...document.querySelectorAll("[data-inbox-target-columns] input:checked")].map((input) => Number(input.value)),
    primary_column_id: Number(document.querySelector("[data-inbox-target-primary-column]").value) || null,
    node_ids: [...document.querySelectorAll("[data-inbox-target-nodes] input:checked")].map((input) => Number(input.value)),
    node_type: document.querySelector("[data-inbox-target-node-type]").value,
  };
  if (!payload.title) throw new Error("请填写整理后的标题");
  document.querySelector("[data-inbox-organize-status]").textContent = "正在创建草稿…";
  const result = await cmsRequest(`/admin/inbox/${activeInboxItem.id}/promote`, {
    method: "POST", body: JSON.stringify(payload),
  });
  showToast(`已整理为${entityType === "post" ? "文章" : entityType === "knowledge" ? "知识节点" : entityLabels[entityType]}：${result.title}`);
  activeInboxItem = null;
  await loadInbox();
  if (entityType === "knowledge") {
    await loadKnowledgeGraphData();
    activeKnowledgeNode = knowledgeNodes.find((node) => node.id === result.id) || activeKnowledgeNode;
    await navigateAdminRoute("knowledge-nodes");
    setKnowledgeNodeForm(activeKnowledgeNode);
    renderKnowledgeNodeList();
  } else if (entityType === "post" || entityType === "project") {
    activeEntityType = entityType;
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === result.id) || activeEntry;
    await navigateAdminRoute(entityType === "post" ? "articles" : "projects");
    setEntryForm(activeEntry);
    setCmsWorkspaceMode("editor");
  }
}

async function trashInboxItem(itemId) {
  if (!confirm("将这条记录移至回收站？之后仍可恢复。")) return;
  await cmsRequest(`/admin/inbox/${itemId}`, { method: "DELETE" });
  showToast("已移至回收站");
  await loadInbox();
}

function organizationTypeLabel(type) {
  return { knowledge_column: "知识专栏", knowledge_node: "知识节点", article: "文章", document: "文档", project: "项目" }[type] || type;
}

function renderOrganization() {
  const statsTarget = document.querySelector("[data-organization-stats]");
  const listTarget = document.querySelector("[data-organization-list]");
  if (!statsTarget || !listTarget) return;
  const stats = organizationData?.stats || {};
  statsTarget.innerHTML = [
    ["内容实体", stats.entities || 0, `${stats.columns || 0} 个专栏`],
    ["有效关系", stats.relations || 0, "包含、引用与节点关系"],
    ["知识节点", stats.nodes || 0, `${stats.documents || 0} 份文档`],
    ["孤立内容", stats.orphans || 0, "建议补充专栏或关联"],
  ].map(([label, value, note]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");

  const query = document.querySelector("[data-organization-search]")?.value.trim().toLowerCase() || "";
  const type = document.querySelector("[data-organization-type]")?.value || "";
  const onlyOrphans = document.querySelector("[data-organization-orphans]")?.checked;
  const rows = (organizationData?.entities || []).filter((item) => {
    if (type && item.entity_type !== type) return false;
    if (onlyOrphans && item.connections !== 0) return false;
    return !query || `${item.title} ${item.slug}`.toLowerCase().includes(query);
  });
  listTarget.innerHTML = rows.length ? rows.map((item) => `
    <button type="button" class="${item.connections === 0 ? "is-orphan" : ""} ${activeOrganizationEntity?.entity_type === item.entity_type && activeOrganizationEntity?.id === item.id ? "is-active" : ""}" data-organization-entity="${item.entity_type}:${item.id}">
      <i>${escapeHtml({ knowledge_column: "COL", knowledge_node: "NODE", article: "POST", document: "DOC", project: "PROJ" }[item.entity_type] || "ITEM")}</i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(item.slug)}</small></span>
      <b>${item.connections === 0 ? "未关联" : `${item.connections} 条`}</b>
    </button>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>没有匹配内容</strong><span>调整筛选条件后重试。</span></div>`;
}

function relationOtherTitle(link, entity) {
  return link.source_type === entity.entity_type && link.source_id === entity.id ? link.target_title : link.source_title;
}

function renderOrganizationDetail() {
  const target = document.querySelector("[data-organization-detail]");
  if (!target) return;
  if (!activeOrganizationEntity || !activeOrganizationBacklinks) {
    target.innerHTML = `<div class="workspace-empty-state"><i>⌁</i><strong>选择一个内容</strong><span>这里会显示它的正向关系与反向链接。</span></div>`;
    return;
  }
  const renderLinks = (title, rows) => `<section class="backlink-group"><h3>${title}（${rows.length}）</h3>${rows.length ? rows.map((link) => `<article><strong>${escapeHtml(relationOtherTitle(link, activeOrganizationEntity))}</strong><span>${escapeHtml(organizationTypeLabel(link.source_type))} → ${escapeHtml(link.relation_type)} → ${escapeHtml(organizationTypeLabel(link.target_type))}</span></article>`).join("") : `<p class="empty">暂无记录。</p>`}</section>`;
  target.innerHTML = `
    <header class="organization-detail-head"><span>${escapeHtml(organizationTypeLabel(activeOrganizationEntity.entity_type)).toUpperCase()}</span><h2>${escapeHtml(activeOrganizationEntity.title)}</h2><p>${escapeHtml(activeOrganizationEntity.slug)} · 共 ${activeOrganizationBacklinks.total} 条连接</p></header>
    <button type="button" data-organization-open-editor>打开对应编辑器</button>
    ${renderLinks("反向链接", activeOrganizationBacklinks.inbound || [])}
    ${renderLinks("正向关系", activeOrganizationBacklinks.outbound || [])}
  `;
}

async function loadOrganization() {
  organizationData = await cmsRequest("/admin/workspace/organization");
  if (activeOrganizationEntity) {
    activeOrganizationEntity = organizationData.entities.find((item) => item.entity_type === activeOrganizationEntity.entity_type && item.id === activeOrganizationEntity.id) || null;
  }
  renderOrganization();
  if (!activeOrganizationEntity) renderOrganizationDetail();
}

async function selectOrganizationEntity(value) {
  const [entityType, rawId] = String(value).split(":");
  activeOrganizationEntity = organizationData?.entities?.find((item) => item.entity_type === entityType && item.id === Number(rawId)) || null;
  if (!activeOrganizationEntity) return;
  activeOrganizationBacklinks = await cmsRequest(`/admin/workspace/backlinks/${entityType}/${rawId}`);
  renderOrganization();
  renderOrganizationDetail();
}

async function openOrganizationEditor() {
  if (!activeOrganizationEntity) return;
  const { entity_type: type, id } = activeOrganizationEntity;
  if (type === "knowledge_node") {
    activeKnowledgeNode = knowledgeNodes.find((node) => node.id === id) || activeKnowledgeNode;
    await navigateAdminRoute("knowledge-nodes");
    if (activeKnowledgeNode) setKnowledgeNodeForm(activeKnowledgeNode);
  } else if (type === "document") {
    await navigateAdminRoute("documents");
    await selectDocument(id);
  } else if (type === "article") {
    activeEntityType = "post";
    await navigateAdminRoute("articles");
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === id) || activeEntry;
    if (activeEntry) setEntryForm(activeEntry);
    setCmsWorkspaceMode("editor");
  } else if (type === "knowledge_column") {
    activeKnowledgeColumn = knowledgeColumns.find((column) => column.id === id) || activeKnowledgeColumn;
    await navigateAdminRoute("knowledge-columns");
    if (activeKnowledgeColumn) setColumnForm(activeKnowledgeColumn);
  }
}

async function openWorkspaceEntity(entityType, entityId) {
  const id = Number(entityId);
  if (entityType === "project") {
    activeEntityType = "project";
    await navigateAdminRoute("projects");
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === id) || null;
    if (activeEntry) {
      setEntryForm(activeEntry);
      setCmsWorkspaceMode("editor");
    }
    return;
  }
  if (!organizationData) await loadOrganization();
  activeOrganizationEntity = organizationData?.entities?.find((item) => item.entity_type === entityType && item.id === id) || {
    id, entity_type: entityType, title: "", slug: "",
  };
  await openOrganizationEditor();
}
