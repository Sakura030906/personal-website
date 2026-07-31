function reviewStatusLabel(item) {
  if (item.status === "suggested") return "建议回顾";
  if (item.status === "pending") return "今日到期";
  return item.next_review_at ? `下次 ${formatWorkspaceTime(item.next_review_at)}` : "已安排";
}

function renderReviewSearchResults() {
  const target = document.querySelector("[data-review-search-results]");
  if (!target) return;
  if (!reviewSearchResults.length) {
    target.innerHTML = `<div class="workspace-empty-state"><i>⌕</i><strong>没有匹配内容</strong><span>尝试更短的关键词或切换内容类型。</span></div>`;
    return;
  }
  target.innerHTML = reviewSearchResults.map((item) => `<article>
    <button type="button" class="review-search-main" data-review-open="${escapeHtml(item.entity_type)}:${item.id}">
      <i>${escapeHtml({ article: "POST", knowledge_node: "NODE", knowledge_column: "COL", document: "DOC", project: "PROJ" }[item.entity_type] || "ITEM")}</i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(item.visibility || "private")} ${item.status ? `· ${escapeHtml(item.status)}` : ""}</small><em>${escapeHtml(item.summary || item.slug || "暂无摘要")}</em></span>
      <b>打开 ›</b>
    </button>
    <button type="button" class="review-search-queue" data-review-quick-queue="${escapeHtml(item.entity_type)}:${item.id}">＋ 加入今日</button>
  </article>
  `).join("");
}

async function searchReviewWorkspace() {
  const query = document.querySelector("[data-review-search]")?.value.trim() || "";
  const type = document.querySelector("[data-review-search-type]")?.value || "";
  if (!query) {
    reviewSearchResults = [];
    const target = document.querySelector("[data-review-search-results]");
    if (target) target.innerHTML = `<div class="workspace-empty-state"><i>⌕</i><strong>搜索整个第二大脑</strong><span>后台检索包含私有内容、草稿和未发布知识。</span></div>`;
    return;
  }
  const response = await cmsRequest(`/admin/workspace/search?q=${encodeURIComponent(query)}&entity_type=${encodeURIComponent(type)}&limit=30`);
  reviewSearchResults = response.items || [];
  renderReviewSearchResults();
}

function renderReviewDashboard() {
  const statsTarget = document.querySelector("[data-review-stats]");
  const queueTarget = document.querySelector("[data-review-queue]");
  const recentTarget = document.querySelector("[data-review-recent]");
  const recommendationsTarget = document.querySelector("[data-review-recommendations]");
  const upcomingTarget = document.querySelector("[data-review-upcoming]");
  const summaryTarget = document.querySelector("[data-review-daily-summary]");
  if (!statsTarget || !queueTarget || !recentTarget || !recommendationsTarget || !upcomingTarget || !summaryTarget) return;
  const stats = reviewDashboard?.stats || {};
  const summary = reviewDashboard?.daily_summary || {};
  summaryTarget.innerHTML = `
    <div><span>TODAY · ${escapeHtml(summary.date || "")}</span><strong>今天，让知识重新进入工作。</strong><small>记录 ${summary.captured_today || 0} 条 · 修改 ${summary.changed_today || 0} 项 · 回顾 ${summary.reviewed_today || 0} 项</small></div>
    <div class="review-streak"><strong>${summary.review_streak || 0}</strong><span>连续回顾天数</span></div>
  `;
  statsTarget.innerHTML = [
    ["今日到期", stats.due || 0, "需要重新阅读"],
    ["已安排", stats.scheduled || 0, "进入回顾周期"],
    ["累计回顾", stats.reviewed || 0, "主动复习次数"],
    ["尚未回顾", stats.unreviewed || 0, "待建立记忆"],
  ].map(([label, value, note]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");

  const queue = reviewDashboard?.queue || [];
  document.querySelector("[data-review-queue-count]").textContent = `${queue.length} 项`;
  queueTarget.innerHTML = queue.length ? queue.map((item) => {
    const entity = item.entity || {};
    return `<article>
      <label class="review-row-select"><input type="checkbox" data-review-select="${item.entity_type}:${item.entity_id}" aria-label="选择 ${escapeHtml(entity.title || "未命名")}" /></label>
      <button type="button" class="review-item-main" data-review-open="${escapeHtml(item.entity_type)}:${item.entity_id}">
        <i>${escapeHtml(organizationTypeLabel(item.entity_type).slice(0, 1))}</i>
        <span><strong>${escapeHtml(entity.title || "未命名")}</strong><small>${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(reviewStatusLabel(item))}</small><em>${escapeHtml(entity.summary || entity.slug || "暂无摘要")}</em></span>
      </button>
      <div class="review-item-actions">
        <button type="button" data-review-action="reviewed:${item.entity_type}:${item.entity_id}:7">完成 · 7 天</button>
        <button type="button" class="secondary" data-review-action="snooze:${item.entity_type}:${item.entity_id}:1">明天再看</button>
        <button type="button" class="secondary" data-review-edit="${item.entity_type}:${item.entity_id}">设置</button>
      </div>
      <section class="review-item-editor" data-review-editor="${item.entity_type}:${item.entity_id}" hidden>
        <label>下次间隔<input type="number" min="1" max="365" value="${Number(item.interval_days) || 7}" data-review-editor-days />天</label>
        <label>回顾备注<input value="${escapeHtml(item.note || "")}" data-review-editor-note placeholder="记录理解、疑问或下次关注点" /></label>
        <button type="button" data-review-custom-action="reviewed:${item.entity_type}:${item.entity_id}">保存并完成</button>
        <button type="button" class="secondary" data-review-custom-action="snooze:${item.entity_type}:${item.entity_id}">仅安排时间</button>
      </section>
    </article>`;
  }).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>今日回顾已完成</strong><span>新的到期内容会自动出现在这里。</span></div>`;

  const reasonLabels = { contains: "同一专栏", references: "引用关系", related_to: "相关知识", content_similarity: "内容相似", highly_connected: "知识枢纽", uses: "使用关系", depends_on: "依赖关系" };
  const compactRows = (rows, mode = "recent") => rows.length ? rows.map((item) => `
    <button type="button" data-review-open="${escapeHtml(item.entity_type)}:${item.id}">
      <i>${escapeHtml(organizationTypeLabel(item.entity_type).slice(0, 1))}</i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${mode === "recommendation" ? `${escapeHtml(item.source_title || "知识网络")} · ${escapeHtml(reasonLabels[item.reason] || item.reason || "关联")}` : mode === "upcoming" ? `${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(reviewStatusLabel(item))}` : `${escapeHtml(organizationTypeLabel(item.entity_type))} · ${escapeHtml(formatWorkspaceTime(item.updated_at))}`}</small></span>
      <b>›</b>
    </button>
  `).join("") : `<p class="empty">暂无内容。</p>`;
  recentTarget.innerHTML = compactRows(reviewDashboard?.recent || []);
  recommendationsTarget.innerHTML = compactRows(reviewDashboard?.recommendations || [], "recommendation");
  upcomingTarget.innerHTML = compactRows((reviewDashboard?.upcoming || []).map((item) => ({
    ...(item.entity || {}), entity_type: item.entity_type, id: item.entity_id,
    status: item.status, next_review_at: item.next_review_at,
  })), "upcoming");
  updateReviewSelectedCount();

  const badge = document.querySelector("[data-review-badge]");
  if (badge) {
    badge.textContent = stats.due || 0;
    badge.hidden = !stats.due;
  }
}

async function loadReviewDashboard() {
  reviewDashboard = await cmsRequest("/admin/workspace/review");
  renderReviewDashboard();
}

async function updateReviewEntity(action, entityType, entityId, intervalDays, note = "") {
  await cmsRequest(`/admin/workspace/review/${entityType}/${entityId}`, {
    method: "POST",
    body: JSON.stringify({ action, interval_days: Number(intervalDays) || 7, note }),
  });
  showToast(action === "reviewed" ? "已完成回顾并安排下次复习" : "已调整回顾时间");
  await loadReviewDashboard();
}

function selectedReviewTargets() {
  return [...document.querySelectorAll("[data-review-select]:checked")].map((input) => {
    const [entity_type, entity_id] = input.dataset.reviewSelect.split(":");
    return { entity_type, entity_id: Number(entity_id) };
  });
}

function updateReviewSelectedCount() {
  const selected = selectedReviewTargets();
  const target = document.querySelector("[data-review-selected-count]");
  if (target) target.textContent = `已选 ${selected.length} 项`;
  const selectAll = document.querySelector("[data-review-select-all]");
  const total = document.querySelectorAll("[data-review-select]").length;
  if (selectAll) {
    selectAll.checked = total > 0 && selected.length === total;
    selectAll.indeterminate = selected.length > 0 && selected.length < total;
  }
}

async function batchReviewEntities(action) {
  const targets = selectedReviewTargets();
  if (!targets.length) throw new Error("请先选择需要处理的内容");
  const intervalDays = Number(document.querySelector("[data-review-batch-days]")?.value) || 7;
  const response = await cmsRequest("/admin/workspace/review/batch", {
    method: "POST",
    body: JSON.stringify({ action, interval_days: intervalDays, note: "", targets }),
  });
  showToast(`已处理 ${response.updated || targets.length} 项内容`);
  await loadReviewDashboard();
}

function maintenancePriorityLabel(priority) {
  return { high: "高", medium: "中", low: "低" }[priority] || priority;
}

function maintenanceCategoryLabel(category) {
  return {
    organize: "待整理", content: "内容质量", relationship: "知识关系",
    review: "回顾", system: "系统",
  }[category] || category;
}

function maintenanceActionLabel(task) {
  return {
    organize: "开始整理", review: "立即回顾", relate: "建立关系",
    edit: "完善内容", repair: "检查文档", open: "打开",
  }[task.action] || "处理";
}

function renderMaintenanceTrend(report) {
  const target = document.querySelector("[data-maintenance-trend]");
  if (!target) return;
  const rows = report?.trend || [];
  const maximum = Math.max(1, ...rows.map((item) => item.total || 0));
  target.innerHTML = rows.map((item) => {
    const captured = Math.max(0, Number(item.captured) || 0);
    const reviewed = Math.max(0, Number(item.reviewed) || 0);
    const changed = Math.max(0, (Number(item.total) || 0) - captured - reviewed);
    const scale = 100 / maximum;
    return `<article title="${escapeHtml(item.date)} · 共 ${item.total || 0} 次活动">
      <div class="maintenance-bar">
        <i data-kind="changed" style="height:${Math.max(changed * scale, changed ? 4 : 0)}%"></i>
        <i data-kind="captured" style="height:${Math.max(captured * scale, captured ? 4 : 0)}%"></i>
        <i data-kind="reviewed" style="height:${Math.max(reviewed * scale, reviewed ? 4 : 0)}%"></i>
      </div>
      <span>${escapeHtml(item.date.slice(5))}</span>
    </article>`;
  }).join("");
}

function renderMaintenanceTasks() {
  const target = document.querySelector("[data-maintenance-tasks]");
  if (!target) return;
  const priority = document.querySelector("[data-maintenance-priority]")?.value || "";
  const category = document.querySelector("[data-maintenance-category]")?.value || "";
  const allTasks = maintenanceDashboard?.maintenance?.tasks || [];
  const tasks = allTasks.filter((task) => (!priority || task.priority === priority) && (!category || task.category === category));
  document.querySelector("[data-maintenance-task-count]").textContent = `${tasks.length} 项`;
  target.innerHTML = tasks.length ? tasks.map((task) => `
    <article>
      <i data-priority="${escapeHtml(task.priority)}">${escapeHtml(maintenancePriorityLabel(task.priority))}</i>
      <div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(maintenanceCategoryLabel(task.category))} · ${escapeHtml(task.reason)}</span></div>
      <button type="button" data-maintenance-task="${escapeHtml(task.id)}">${escapeHtml(maintenanceActionLabel(task))}</button>
    </article>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>当前筛选下没有维护任务</strong><span>知识系统处于清洁状态。</span></div>`;
}

function renderMaintenanceAiInbox() {
  const select = document.querySelector("[data-maintenance-ai-inbox]");
  if (!select) return;
  const pending = inboxItems.filter((item) => item.status !== "processed" && item.status !== "archived");
  const selected = select.value;
  select.innerHTML = pending.length
    ? `<option value="">选择一条记录</option>${pending.map((item) => `<option value="${item.id}">${escapeHtml(item.title || item.body.slice(0, 40) || "未命名记录")}</option>`).join("")}`
    : `<option value="">收件箱已整理完</option>`;
  if (pending.some((item) => String(item.id) === selected)) select.value = selected;
}

function renderMaintenanceAiSuggestion(payload) {
  const target = document.querySelector("[data-maintenance-ai-result]");
  if (!target) return;
  if (!payload?.suggestion) {
    target.innerHTML = `<div class="workspace-empty-state"><i>AI</i><strong>先选择一条记录</strong><span>建议不会自动写入或发布。</span></div>`;
    return;
  }
  const suggestion = payload.suggestion;
  const typeLabel = { knowledge: "知识节点", post: "文章", project: "项目", reading: "阅读记录" }[suggestion.entity_type] || suggestion.entity_type;
  target.innerHTML = `
    <div class="maintenance-ai-meta"><span>${escapeHtml(payload.model_applied ? "MODEL" : "LOCAL")}</span><em>${Math.round((suggestion.confidence || 0) * 100)}% 置信度</em></div>
    <h3>${escapeHtml(suggestion.title)}</h3>
    <p>${escapeHtml(suggestion.summary || "暂无摘要")}</p>
    <dl><div><dt>建议类型</dt><dd>${escapeHtml(typeLabel)}</dd></div><div><dt>标签</dt><dd>${escapeHtml((suggestion.tag_names || []).join(" · ") || "未识别")}</dd></div><div><dt>知识连接</dt><dd>${(suggestion.column_ids || []).length} 个专栏 · ${(suggestion.node_ids || []).length} 个节点</dd></div></dl>
    <ul>${(suggestion.reasons || []).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
    <small>${escapeHtml(payload.safety || "")}</small>
    <button type="button" data-maintenance-ai-apply>带入整理表单</button>
  `;
}

function renderKnowledgeOpportunities() {
  const target = document.querySelector("[data-maintenance-opportunities]");
  if (!target) return;
  const opportunities = maintenanceDashboard?.opportunities || {};
  const duplicates = opportunities.duplicates || [];
  const relations = opportunities.relations || [];
  const group = (title, rows, kind) => rows.length ? `
    <section>
      <h3>${escapeHtml(title)} <span>${rows.length}</span></h3>
      ${rows.slice(0, 6).map((item) => `
        <article>
          <div><strong>${escapeHtml(item.source_title)} <i>↔</i> ${escapeHtml(item.target_title)}</strong><span>${escapeHtml(item.reason)} · ${Math.round((item.score || 0) * 100)}%</span></div>
          <button type="button" data-maintenance-opportunity="${kind}:${item.source_id}:${item.target_id}">${kind === "relation" ? "确认关联" : "检查重复"}</button>
        </article>
      `).join("")}
    </section>
  ` : "";
  target.innerHTML = duplicates.length || relations.length
    ? `${group("疑似重复", duplicates, "duplicate")}${group("推荐关系", relations, "relation")}<small>已扫描 ${opportunities.scanned_nodes || 0} 个知识节点${opportunities.truncated ? "，仅分析最近更新的 250 个" : ""}</small>`
    : `<div class="workspace-empty-state"><i>✓</i><strong>没有发现明显问题</strong><span>当前节点之间没有高置信度的重复或缺失关系。</span></div>`;
}

function renderAiWorkflowDashboard() {
  const statsTarget = document.querySelector("[data-ai-workflow-stats]");
  const queueTarget = document.querySelector("[data-ai-workflow-queue]");
  if (!statsTarget || !queueTarget) return;
  const stats = aiWorkflowDashboard?.stats || {};
  const rows = [
    [stats.pending || 0, "待确认"],
    [`${Math.round((stats.adoption_rate || 0) * 100)}%`, "历史采用率"],
    [`${Math.round((stats.avg_confidence || 0) * 100)}%`, "平均置信度"],
    [`${Math.round((stats.tag_coverage || 0) * 100)}%`, "标签覆盖"],
    [`${Math.round((stats.relation_coverage || 0) * 100)}%`, "关系覆盖"],
    [`${Math.round((stats.avg_readiness || 0) * 100)}%`, "整理就绪度"],
  ];
  statsTarget.innerHTML = rows.map(([value, label]) => `<article><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`).join("");
  const queue = aiWorkflowDashboard?.queue || [];
  queueTarget.innerHTML = queue.length ? queue.map((row) => {
    const item = row.item || {};
    const suggestion = row.suggestion || {};
    const typeLabel = { knowledge: "知识节点", post: "文章", project: "项目", reading: "阅读记录" }[suggestion.entity_type] || suggestion.entity_type;
    const connectionCount = (suggestion.column_ids || []).length + (suggestion.node_ids || []).length;
    return `<article>
      <div class="maintenance-workflow-source"><span>INBOX</span><strong>${escapeHtml(item.title || item.body?.slice(0, 50) || "未命名记录")}</strong><small>${escapeHtml(item.body?.slice(0, 90) || item.source_url || "暂无内容")}</small></div>
      <div class="maintenance-workflow-suggestion"><span>${escapeHtml(row.model_applied ? "MODEL" : "LOCAL")} · ${escapeHtml(typeLabel)} · ${Math.round((suggestion.confidence || 0) * 100)}%</span><strong>${escapeHtml(suggestion.title || "未命名建议")}</strong><small>${escapeHtml((suggestion.tag_names || []).join(" · ") || "暂无标签")} · ${connectionCount} 个知识连接</small></div>
      <div class="maintenance-workflow-row-actions"><button type="button" data-ai-workflow-adopt="${item.id}">采用</button><button type="button" class="secondary" data-ai-workflow-reject="${item.id}">忽略</button></div>
    </article>`;
  }).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>AI 整理队列已清空</strong><span>新的收件箱记录会自动进入下一轮分析。</span></div>`;
}

function renderMaintenanceDashboard() {
  if (!maintenanceDashboard) return;
  const report = maintenanceDashboard.report || {};
  const summary = report.summary || {};
  const maintenance = maintenanceDashboard.maintenance || {};
  const period = report.period || {};
  document.querySelector("[data-maintenance-period]").textContent = `${period.start || ""} 至 ${period.end || ""} · ${summary.active_days || 0} 个活跃日`;
  const stats = [
    [summary.captured || 0, "新记录", "进入收件箱"],
    [summary.created || 0, "新建内容", `${summary.touched_entities || 0} 项被触达`],
    [summary.reviewed || 0, "完成回顾", "重新进入工作记忆"],
    [maintenance.stats?.total || 0, "待维护", `${maintenance.stats?.high || 0} 项高优先级`],
  ];
  document.querySelector("[data-maintenance-stats]").innerHTML = stats.map(([value, label, note]) => `<article><strong>${value}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></article>`).join("");
  renderMaintenanceTrend(report);
  renderMaintenanceTasks();
  const focus = document.querySelector("[data-maintenance-focus]");
  const top = report.top_entities || [];
  focus.innerHTML = top.length ? top.map((item, index) => `<article><i>${index + 1}</i><span><strong>${escapeHtml(item.title)}</strong><small>${item.events} 次操作</small></span></article>`).join("") : `<div class="workspace-empty-state"><i>·</i><strong>本期暂无活动</strong><span>开始记录后会生成关注重点。</span></div>`;
  const badge = document.querySelector("[data-maintenance-badge]");
  if (badge) {
    badge.textContent = maintenance.stats?.high || 0;
    badge.hidden = !(maintenance.stats?.high || 0);
  }
  renderMaintenanceAiInbox();
  renderKnowledgeOpportunities();
  renderAiWorkflowDashboard();
}

async function loadMaintenanceDashboard() {
  const days = Number(document.querySelector("[data-maintenance-days]")?.value) || 7;
  if (!inboxItems.length) await loadInbox();
  maintenanceDashboard = await cmsRequest(`/admin/workspace/maintenance?days=${days}`);
  aiWorkflowDashboard = await cmsRequest("/admin/workspace/ai-workflow?limit=20");
  renderMaintenanceDashboard();
}

async function loadAiWorkflowDashboard() {
  aiWorkflowDashboard = await cmsRequest("/admin/workspace/ai-workflow?limit=20");
  renderAiWorkflowDashboard();
}

async function runBatchInboxSuggestions(mode = "local") {
  const current = aiWorkflowDashboard?.queue || [];
  const itemIds = current.slice(0, mode === "auto" ? 5 : 25).map((row) => row.item.id);
  if (!itemIds.length) throw new Error("当前没有待分析的收件箱记录");
  const target = document.querySelector("[data-ai-workflow-queue]");
  target.innerHTML = `<div class="workspace-empty-state"><i>AI</i><strong>正在批量分析 ${itemIds.length} 条记录</strong><span>${mode === "auto" ? "调用已配置模型并保留本地降级能力。" : "使用本地规则匹配类型、标签与知识连接。"}</span></div>`;
  const response = await cmsRequest("/admin/inbox/suggestions/batch", {
    method: "POST",
    body: JSON.stringify({ item_ids: itemIds, limit: itemIds.length, mode }),
  });
  aiWorkflowDashboard.queue = response.items || [];
  renderAiWorkflowDashboard();
  showToast(`已完成 ${response.processed || 0} 条整理建议`);
}

async function recordAiWorkflowDecision(payload, decision, note = "") {
  if (!payload?.item?.id || !payload?.suggestion) return;
  const suggestion = payload.suggestion;
  await cmsRequest("/admin/workspace/ai-workflow/decision", {
    method: "POST",
    body: JSON.stringify({
      item_id: payload.item.id,
      suggestion_id: `inbox:${payload.item.id}:${suggestion.slug || "suggestion"}`,
      decision,
      confidence: Number(suggestion.confidence) || 0,
      suggested_type: suggestion.entity_type || "knowledge",
      note,
    }),
  });
}

async function adoptAiWorkflowSuggestion(itemId) {
  const payload = (aiWorkflowDashboard?.queue || []).find((row) => row.item?.id === Number(itemId));
  if (!payload) return;
  activeInboxSuggestion = { ...payload, generator: "workflow", model_applied: false, safety: "建议仅用于预填充，必须由管理员确认后才能创建草稿。" };
  await applyInboxOrganizationSuggestion();
}

async function rejectAiWorkflowSuggestion(itemId) {
  const payload = (aiWorkflowDashboard?.queue || []).find((row) => row.item?.id === Number(itemId));
  if (!payload) return;
  await recordAiWorkflowDecision(payload, "rejected", "管理员在整理队列中忽略该建议");
  showToast("已记录忽略决定，后续质量统计会纳入本次反馈");
  await loadAiWorkflowDashboard();
}

async function runInboxOrganizationSuggestion() {
  const itemId = Number(document.querySelector("[data-maintenance-ai-inbox]")?.value);
  if (!itemId) throw new Error("请先选择一条待整理记录");
  const target = document.querySelector("[data-maintenance-ai-result]");
  target.innerHTML = `<div class="workspace-empty-state"><i>AI</i><strong>正在分析内容</strong><span>匹配类型、标签、专栏与知识节点。</span></div>`;
  activeInboxSuggestion = await cmsRequest(`/admin/inbox/${itemId}/suggest`, { method: "POST" });
  renderMaintenanceAiSuggestion(activeInboxSuggestion);
}

async function applyInboxOrganizationSuggestion() {
  const payload = activeInboxSuggestion;
  if (!payload?.suggestion) return;
  const suggestion = payload.suggestion;
  await recordAiWorkflowDecision(payload, "adopted", "管理员采用建议并带入整理表单");
  await navigateAdminRoute("inbox");
  openInboxOrganizer(payload.item.id);
  document.querySelector("[data-inbox-target-type]").value = suggestion.entity_type || "knowledge";
  document.querySelector("[data-inbox-target-title]").value = suggestion.title || "";
  document.querySelector("[data-inbox-target-slug]").value = suggestion.slug || slugify(suggestion.title || "");
  document.querySelector("[data-inbox-target-summary]").value = suggestion.summary || "";
  document.querySelector("[data-inbox-target-tags]").value = (suggestion.tag_names || []).join(", ");
  document.querySelector("[data-inbox-target-visibility]").value = "private";
  document.querySelector("[data-inbox-target-node-type]").value = suggestion.node_type || "concept";
  document.querySelectorAll("[data-inbox-target-columns] input").forEach((input) => {
    input.checked = (suggestion.column_ids || []).includes(Number(input.value));
  });
  document.querySelectorAll("[data-inbox-target-nodes] input").forEach((input) => {
    input.checked = (suggestion.node_ids || []).includes(Number(input.value));
  });
  const primary = document.querySelector("[data-inbox-target-primary-column]");
  primary.value = suggestion.primary_column_id || "";
  updateInboxOrganizerMode();
  document.querySelector("[data-inbox-organize-status]").textContent = "AI 建议已带入，请确认后再创建草稿。";
  document.querySelector("[data-inbox-organizer]").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleMaintenanceTask(taskId) {
  const task = maintenanceDashboard?.maintenance?.tasks?.find((item) => item.id === taskId);
  if (!task) return;
  if (task.action === "organize") {
    await navigateAdminRoute("inbox");
    openInboxOrganizer(task.entity_id);
    return;
  }
  if (task.action === "review") {
    if (task.entity_type && task.entity_id) {
      await updateReviewEntity("queue", task.entity_type, task.entity_id, 1, "由维护清单加入今日回顾");
    }
    await navigateAdminRoute("review");
    return;
  }
  if (task.entity_type && task.entity_id) await openWorkspaceEntity(task.entity_type, task.entity_id);
  else if (task.route) await navigateAdminRoute(task.route);
}

async function handleKnowledgeOpportunity(value) {
  const [kind, sourceIdValue, targetIdValue] = value.split(":");
  const sourceId = Number(sourceIdValue);
  const targetId = Number(targetIdValue);
  const opportunities = maintenanceDashboard?.opportunities || {};
  const rows = kind === "relation" ? opportunities.relations || [] : opportunities.duplicates || [];
  const item = rows.find((candidate) => candidate.source_id === sourceId && candidate.target_id === targetId);
  if (!item) return;
  if (kind === "duplicate") {
    showToast(`请对比“${item.source_title}”与“${item.target_title}”后决定是否合并`);
    await openWorkspaceEntity("knowledge_node", sourceId);
    return;
  }
  await cmsRequest("/admin/knowledge-relations", {
    method: "POST",
    body: JSON.stringify({
      source_node_id: sourceId,
      target_node_id: targetId,
      relation_type: item.relation_type || "related_to",
      relation_label: "AI 辅助发现",
      description: item.reason || "由知识维护工作流推荐",
      weight: Math.max(0.1, Math.min(10, Number(item.score) || 1)),
      direction: "bidirectional",
      is_active: true,
      is_public: item.is_public === true,
    }),
  });
  showToast(`已建立“${item.source_title}”与“${item.target_title}”的关系`);
  await loadMaintenanceDashboard();
  await loadKnowledgeGraphData();
}

function maintenanceReportText() {
  const report = maintenanceDashboard?.report;
  const maintenance = maintenanceDashboard?.maintenance;
  if (!report || !maintenance) return "";
  return [
    `第二大脑周报（${report.period.start} 至 ${report.period.end}）`,
    `活跃 ${report.summary.active_days} 天，记录 ${report.summary.captured} 条，新建 ${report.summary.created} 项，修改 ${report.summary.changed} 项，回顾 ${report.summary.reviewed} 项。`,
    `当前维护任务 ${maintenance.stats.total} 项，其中高优先级 ${maintenance.stats.high} 项、孤立内容 ${maintenance.stats.orphans} 项、待整理收件 ${maintenance.stats.inbox} 项。`,
    `本期重点：${(report.top_entities || []).map((item) => `${item.title}（${item.events}）`).join("、") || "暂无"}`,
  ].join("\n");
}

function renderActivity() {
  const target = document.querySelector("[data-activity-list]");
  if (!target) return;
  const labels = { captured: "记录", created: "创建", updated: "更新", published: "发布", archived: "归档", trashed: "移至回收站", restored: "恢复", promoted: "整理" };
  target.innerHTML = activityEvents.length ? activityEvents.map((event) => `
    <article><i></i><time>${escapeHtml(formatWorkspaceTime(event.created_at))}</time><div><strong>${escapeHtml(labels[event.action] || event.action)} · ${escapeHtml(event.entity_title || "未命名")}</strong><span>${escapeHtml(entityLabels[event.entity_type] || event.entity_type)} · ${escapeHtml(event.actor_email || "system")}</span></div></article>
  `).join("") : `<div class="workspace-empty-state"><i>◷</i><strong>暂无活动记录</strong><span>新建、修改、发布和恢复操作会记录在这里。</span></div>`;
}

async function loadActivity() {
  activityEvents = await cmsRequest("/admin/activity?limit=100");
  renderActivity();
}

function renderTrash() {
  const target = document.querySelector("[data-trash-list]");
  if (!target) return;
  target.innerHTML = trashItems.length ? trashItems.map((item) => `
    <article class="trash-row"><i>⌫</i><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(entityLabels[item.entity_type] || item.entity_type)} · 删除于 ${escapeHtml(formatWorkspaceTime(item.deleted_at))}</span></div><button type="button" data-trash-restore="${item.entity_type}:${item.id}">恢复</button></article>
  `).join("") : `<div class="workspace-empty-state"><i>✓</i><strong>回收站为空</strong><span>删除的内容会安全保留在这里。</span></div>`;
}

async function loadTrash() {
  trashItems = await cmsRequest("/admin/trash");
  renderTrash();
  await loadWorkspaceOverview();
}

async function restoreTrashItem(value) {
  const [entityType, entityId] = value.split(":");
  await cmsRequest(`/admin/trash/${entityType}/${entityId}/restore`, { method: "POST" });
  showToast("内容已恢复");
  await loadTrash();
  await loadEntries();
  await loadKnowledgeGraphData();
  await loadDocuments();
}
