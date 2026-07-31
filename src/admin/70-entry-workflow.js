function renderEntryReadiness() {
  try {
    renderEditorReadiness("[data-entry-readiness]", "[data-entry-readiness-summary]", entryReadinessChecks());
  } catch {
    renderEditorReadiness("[data-entry-readiness]", "[data-entry-readiness-summary]", [
      { label: "修正编辑器中的格式错误", ready: false },
    ]);
  }
}

function renderMarkdownPreview() {
  const target = document.querySelector("[data-markdown-preview]");
  if (!target) return;
  target.innerHTML = markdownToHtml(document.querySelector("[data-entry-content]")?.value || "");
}

function renderEntryList() {
  const target = document.querySelector("[data-entry-list]");
  if (!target) return;
  const entries = cmsEntries.filter((entry) => entry.entity_type === activeEntityType);
  target.innerHTML = entries.length
    ? `
      <div class="entry-table-head"><span>标题</span><span>分类</span><span>状态</span><span>更新时间</span></div>
      ${entries
        .map(
          (entry) => `
            <button type="button" data-entry-id="${entry.id}" class="${activeEntry?.id === entry.id ? "is-active" : ""}">
              <strong>${escapeHtml(entry.title)}</strong>
              <span>${escapeHtml(entry.category || "-")}</span>
              <em>${escapeHtml(entry.status)}</em>
              <time>${escapeHtml(formatDateTime(entry.updated_at || entry.created_at) || "-")}</time>
            </button>
          `,
        )
        .join("")}
    `
    : `<p class="empty">暂无${entityLabels[activeEntityType]}，可以点击新建。</p>`;
}

function renderVersionList(versions) {
  const target = document.querySelector("[data-version-list]");
  if (!target) return;
  target.innerHTML = versions.length
    ? versions
        .map((version) => {
          const snapshot = parseJson(version.snapshot_json, {});
          const reasons = {
            created: "创建",
            autosave: "自动保存",
            manual_save: "手动保存",
            published: "发布",
            archived: "归档",
            before_restore: "恢复前备份",
          };
          return `
            <div class="version-row">
              <div>
                <strong>${escapeHtml(snapshot.title || "未命名版本")}</strong>
                <small>${escapeHtml(reasons[version.reason] || version.reason || "保存")} · ${escapeHtml(formatDateTime(version.created_at))}</small>
              </div>
              <div class="version-actions">
                <button type="button" data-version-diff="${version.id}">查看差异</button>
                <button type="button" data-version-restore="${version.id}">恢复</button>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="empty">暂无版本记录。</p>`;
}

async function loadEntries() {
  const [articleEntries, legacyEntries] = await Promise.all([
    cmsRequest("/admin/articles"),
    cmsRequest("/admin/entries"),
  ]);
  cmsEntries = [...articleEntries, ...legacyEntries.filter((entry) => entry.entity_type !== "post")];
  renderHealthDashboard();
  const entries = cmsEntries.filter((entry) => entry.entity_type === activeEntityType);
  if (activeEntry?.id) {
    activeEntry = cmsEntries.find((entry) => entry.id === activeEntry.id) || entries[0] || defaultEntry();
  } else {
    activeEntry = entries[0] || defaultEntry();
  }
  renderEntryList();
  setEntryForm(activeEntry);
  if (activeEntry.id) {
    await loadEntryDraft(activeEntry);
    await loadVersions();
  }
  renderAdminDashboard();
}

async function loadAiRuns() {
  const sessionId = document.querySelector("[data-ai-runs-session]")?.value.trim();
  const query = new URLSearchParams({ limit: "30" });
  if (sessionId) query.set("session_id", sessionId);
  const payload = await cmsRequest(`/admin/ai-runs?${query.toString()}`);
  aiRuns = payload.runs || [];
  activeAiRun = aiRuns[0] || null;
  renderAiRunStats(payload.stats || {});
  renderAiRunList();
  renderAiRunDetail();
}

async function loadAgentRuns() {
  const sessionId = document.querySelector("[data-agent-runs-session]")?.value.trim();
  const query = new URLSearchParams({ limit: "30" });
  if (sessionId) query.set("session_id", sessionId);
  const payload = await cmsRequest(`/admin/agent-runs?${query.toString()}`);
  agentRuns = payload.runs || [];
  activeAgentRun = agentRuns[0] || null;
  renderAgentRunStats(payload.stats || {});
  renderAgentRunList();
  renderAgentRunDetail();
  renderAdminDashboard();
}

async function evaluateAgentSuite() {
  agentEvaluation = await cmsRequest("/admin/agent/evaluate", {
    method: "POST",
    body: JSON.stringify({ planner_mode: "local" }),
  });
  renderAgentEvaluation();
  await loadAgentRuns();
  showToast("Agent 评测完成");
}

async function loadRagIndex() {
  ragIndex = await cmsRequest("/admin/rag/status");
  renderRagIndex();
  renderAdminDashboard();
}

async function rebuildRagIndex() {
  await cmsRequest("/admin/rag/rebuild", { method: "POST" });
  showToast("RAG 索引已重建");
  await loadRagIndex();
}

async function evaluateRagIndex() {
  ragEvaluation = await cmsRequest("/admin/rag/evaluate", {
    method: "POST",
    body: JSON.stringify({}),
  });
  showToast("RAG 评测完成");
  renderRagEvaluation();
}

async function loadAiFeedback() {
  aiFeedback = await cmsRequest("/admin/ai-feedback?limit=80");
  renderAiFeedback();
}

async function loadProactiveDashboard(refresh = false) {
  proactiveDashboard = await cmsRequest(`/admin/proactive/dashboard?refresh=${refresh ? "true" : "false"}`);
  renderProactiveDashboard();
}

async function updateProactiveTask(value) {
  const [id, status] = String(value || "").split(":");
  await cmsRequest(`/admin/proactive/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  showToast(status === "completed" ? "任务已完成" : "任务已忽略");
  await loadProactiveDashboard(false);
}

async function createLongTermMemory(event) {
  event.preventDefault();
  await cmsRequest("/admin/long-term-memories", {
    method: "POST",
    body: JSON.stringify({
      title: document.querySelector("[data-memory-title]").value.trim(),
      content: document.querySelector("[data-memory-content]").value.trim(),
      memory_type: document.querySelector("[data-memory-type]").value,
      visibility: document.querySelector("[data-memory-visibility]").value,
      status: "candidate",
    }),
  });
  event.currentTarget.reset();
  showToast("已加入记忆候选，确认后才会生效");
  await loadProactiveDashboard(false);
}

async function updateLongTermMemory(value) {
  const [id, status, visibility] = String(value || "").split(":");
  await cmsRequest(`/admin/long-term-memories/${id}`, { method: "PATCH", body: JSON.stringify({ status, visibility }) });
  showToast(status === "active" ? "长期记忆已确认" : "长期记忆已更新");
  await loadProactiveDashboard(false);
}

async function loadContentOps() {
  contentOps = await cmsRequest("/admin/content-ops");
  renderContentOps();
}

async function refreshOpsDependencies() {
  await loadContentOps();
  await loadRagIndex();
  await loadAiFeedback();
  await loadContentGaps();
  await loadRelationHealth();
  await loadPublishWorkflow();
  await loadWorkspaceOverview();
  await loadInbox();
  await loadActivity();
}

async function setContentOpsTaskState(index, status = "ignored") {
  const task = contentOps?.tasks?.[Number(index)];
  if (!task?.id) return;
  await cmsRequest("/admin/content-ops/task-state", {
    method: "POST",
    body: JSON.stringify({
      task_id: task.id,
      status,
    }),
  });
  showToast(status === "done" ? "任务已完成" : "任务已忽略");
  await loadContentOps();
}

async function createAiFeedbackDraft(index, entityType) {
  const issue = aiFeedback?.issues?.[Number(index)];
  if (!issue) return;
  const draft = await cmsRequest("/admin/ai-feedback/draft", {
    method: "POST",
    body: JSON.stringify({
      feedback_id: issue.feedback_id,
      question: issue.question,
      title: issue.suggested_title,
      entity_type: entityType || issue.suggested_type || "post",
    }),
  });
  showToast(`已生成反馈草稿：${draft.title}`);
  activeEntityType = draft.entity_type;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  await loadEntries();
  activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
  setEntryForm(activeEntry);
  renderEntryList();
  await loadAiFeedback();
  await loadRagIndex();
  await loadPublishWorkflow();
}

async function handleContentOpsTask(index) {
  const task = contentOps?.tasks?.[Number(index)];
  const action = task?.action || {};
  if (!task || !action.kind) return;

  if (action.kind === "create_gap_draft") {
    const draft = await cmsRequest("/admin/content-gaps/draft", {
      method: "POST",
      body: JSON.stringify({
        query: action.query,
        title: action.title,
        entity_type: action.entity_type || "post",
      }),
    });
    showToast(`已生成草稿：${draft.title}`);
    activeEntityType = draft.entity_type;
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
    setEntryForm(activeEntry);
    renderEntryList();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
    return;
  }

  if (action.kind === "create_feedback_draft") {
    const draft = await cmsRequest("/admin/ai-feedback/draft", {
      method: "POST",
      body: JSON.stringify({
        feedback_id: action.feedback_id,
        question: action.question,
        title: action.title,
        entity_type: action.entity_type || "post",
      }),
    });
    showToast(`已生成反馈草稿：${draft.title}`);
    activeEntityType = draft.entity_type;
    await loadEntries();
    activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
    setEntryForm(activeEntry);
    renderEntryList();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
    return;
  }

  if (action.kind === "fix_relation") {
    await cmsRequest("/admin/relation-health/fix", {
      method: "POST",
      body: JSON.stringify({
        target_id: action.target_id,
        missing_field: action.missing_field,
        missing_value: action.missing_value,
      }),
    });
    showToast("反向关联已修复");
    await loadEntries();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
    return;
  }

  if (action.kind === "open_entry" || action.kind === "review_relation") {
    if (action.entry_id) {
      await openWorkflowEntry(action.entry_id, action.entity_type);
    }
    showToast(action.kind === "review_relation" ? "需要手动确认关系目标" : "已打开编辑项");
    return;
  }

  if (action.kind === "publish_entry") {
    const path = action.entity_type === "post"
      ? `/admin/articles/${action.entry_id}/publish`
      : `/admin/entries/${action.entry_id}/publish`;
    await cmsRequest(path, { method: "POST" });
    showToast("已发布");
    await loadEntries();
    await setContentOpsTaskState(index, "done");
    await refreshOpsDependencies();
  }
}

async function loadSearchAnalytics() {
  searchAnalytics = await cmsRequest("/admin/search-analytics?limit=100");
  renderSearchAnalytics();
}

async function loadContentGaps() {
  contentGaps = await cmsRequest("/admin/content-gaps?limit=20");
  renderContentGaps();
}

async function loadRelationHealth() {
  relationHealth = await cmsRequest("/admin/relation-health");
  renderRelationHealth();
}

async function loadPublishWorkflow() {
  publishWorkflow = await cmsRequest("/admin/publish-workflow");
  renderPublishWorkflow();
}

async function loadRelationSuggestions() {
  relationSuggestionPayload = await cmsRequest("/admin/relation-suggestions", {
    method: "POST",
    body: JSON.stringify(currentEntryDraftForSuggestion()),
  });
  renderAutoRelationSuggestions();
  showToast("关联推荐已刷新");
}

async function fixRelationIssue(index) {
  const issue = relationHealth?.issues?.[Number(index)];
  if (!issue || issue.kind !== "missing_backlink") return;
  await cmsRequest("/admin/relation-health/fix", {
    method: "POST",
    body: JSON.stringify({
      target_id: issue.target_id,
      missing_field: issue.missing_field,
      missing_value: issue.missing_value,
    }),
  });
  showToast("反向关联已修复");
  await loadEntries();
  await loadRagIndex();
  await loadRelationHealth();
  await loadContentOps();
  renderHealthDashboard();
}

async function openWorkflowEntry(entryId, entityType) {
  activeEntityType = entityType;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  await loadEntries();
  activeEntry = cmsEntries.find((entry) => String(entry.id) === String(entryId)) || activeEntry;
  setEntryForm(activeEntry);
  renderEntryList();
  if (activeEntry?.id) await loadVersions();
  showToast("已打开编辑项");
}

async function publishWorkflowEntry(entryId, entityType) {
  const path = entityType === "post" ? `/admin/articles/${entryId}/publish` : `/admin/entries/${entryId}/publish`;
  await cmsRequest(path, { method: "POST" });
  showToast("已发布");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadRelationHealth();
  await loadContentOps();
  activeEntityType = entityType || activeEntityType;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  renderEntryList();
}

async function createGapDraft(index, entityType) {
  const gap = contentGaps?.gaps?.[Number(index)];
  if (!gap) return;
  const draft = await cmsRequest("/admin/content-gaps/draft", {
    method: "POST",
    body: JSON.stringify({
      query: gap.query,
      title: gap.suggested_title,
      entity_type: entityType || gap.suggested_type,
    }),
  });
  showToast(`已生成草稿：${draft.title}`);
  activeEntityType = draft.entity_type;
  document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current.dataset.entityTab === activeEntityType));
  await loadEntries();
  activeEntry = cmsEntries.find((entry) => entry.id === draft.id) || draft;
  setEntryForm(activeEntry);
  renderEntryList();
  await loadContentGaps();
  await loadSearchAnalytics();
  await loadRagIndex();
  await loadRelationHealth();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function saveEntry(forceStatus) {
  window.clearTimeout(autosaveTimer);
  setAutosaveStatus("正在保存…", "saving");
  const payload = readEntryForm();
  if (forceStatus) payload.status = forceStatus;
  const isArticle = activeEntityType === "post";
  const path = isArticle
    ? activeEntry?.id ? `/admin/articles/${activeEntry.id}` : "/admin/articles"
    : activeEntry?.id ? `/admin/entries/${activeEntry.id}` : "/admin/entries";
  const method = activeEntry?.id ? "PATCH" : "POST";
  if (activeEntry?.id) payload.expected_revision = activeEntry.revision;
  const saved = await cmsRequest(path, {
    method,
    body: JSON.stringify(payload),
  });
  activeEntry = saved;
  autosaveDirty = false;
  setAutosaveStatus(`已保存 · revision ${saved.revision}`, "saved");
  showToast("内容已保存");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function publishEntry() {
  const missing = entryReadinessChecks().filter((item) => !item.ready);
  if (missing.length && !confirm(`还有 ${missing.length} 项发布准备未完成：\n\n${missing.map((item) => `· ${item.label}`).join("\n")}\n\n仍然继续发布吗？`)) return;
  if (!activeEntry?.id) {
    await saveEntry("draft");
  } else {
    await saveEntry();
  }
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}/publish` : `/admin/entries/${activeEntry.id}/publish`;
  activeEntry = await cmsRequest(path, { method: "POST" });
  showToast("已发布");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function archiveEntry() {
  if (!activeEntry?.id) {
    showToast("新内容尚未保存，无需归档");
    return;
  }
  if (!confirm(`确定归档「${activeEntry.title}」吗？归档后不会在公开网站显示。`)) return;
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}/archive` : `/admin/entries/${activeEntry.id}/archive`;
  activeEntry = await cmsRequest(path, { method: "POST" });
  autosaveDirty = false;
  showToast("已归档，可从 CMS 列表继续查看和恢复");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function deleteEntry() {
  if (!activeEntry?.id) {
    setEntryForm(defaultEntry());
    return;
  }
  if (!confirm(`确定将「${activeEntry.title}」移至回收站吗？之后可以恢复。`)) return;
  const path = activeEntityType === "post" ? `/admin/articles/${activeEntry.id}` : `/admin/entries/${activeEntry.id}`;
  await cmsRequest(path, { method: "DELETE" });
  activeEntry = null;
  showToast("已移至回收站");
  await loadEntries();
  await loadRagIndex();
  await loadPublishWorkflow();
  await loadContentOps();
}

async function loadVersions() {
  if (!activeEntry?.id) {
    renderVersionList([]);
    return;
  }
  const path = activeEntityType === "post"
    ? `/admin/articles/${activeEntry.id}/versions`
    : `/admin/versions/${activeEntry.entity_type}/${activeEntry.id}`;
  const versions = await cmsRequest(path);
  renderVersionList(versions);
}

async function loadEntryDraft(entry = activeEntry) {
  if (!entry?.id) return;
  const path = activeEntityType === "post" ? `/admin/articles/${entry.id}/draft` : `/admin/entries/${entry.id}/draft`;
  const draft = await cmsRequest(path);
  if (draft?.payload) setEntryForm(entry, draft.payload, draft.saved_at);
}

async function loadVersionDiff(versionId) {
  const path = activeEntityType === "post" ? `/admin/articles/versions/${versionId}/diff` : `/admin/versions/${versionId}/diff`;
  const diff = await cmsRequest(path);
  const target = document.querySelector("[data-version-diff]");
  const fields = (diff.changed_fields || []).join("、") || "无字段变化";
  target.textContent = `变更字段：${fields}\n\n${diff.content_diff || "正文没有变化。"}`;
  target.hidden = false;
}

async function restoreVersion(versionId) {
  const path = activeEntityType === "post" ? `/admin/articles/versions/${versionId}/restore` : `/admin/versions/${versionId}/restore`;
  activeEntry = await cmsRequest(path, { method: "POST" });
  showToast("已恢复版本");
  await loadEntries();
  await loadRagIndex();
  await loadContentOps();
}

function scheduleEntryAutosave() {
  if (suppressEditorEvents || !cmsToken) return;
  document.querySelector("[data-entry-shell-title]").textContent = document.querySelector("[data-entry-title]").value.trim() || `新${entityLabels[activeEntityType] || "内容"}`;
  document.querySelector("[data-entry-shell-visibility]").textContent = document.querySelector("[data-entry-visibility]").value.toUpperCase();
  renderEntryReadiness();
  autosaveDirty = true;
  setAutosaveStatus("有未保存修改", "dirty");
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => guarded(performAutosave), 1800);
}

async function performAutosave() {
  if (!autosaveDirty || autosaveInFlight || !cmsToken) return;
  const payload = readEntryForm();
  if (!payload.title) {
    setAutosaveStatus("填写标题后自动保存", "idle");
    return;
  }

  autosaveInFlight = true;
  setAutosaveStatus("正在自动保存…", "saving");
  try {
    if (!activeEntry?.id) {
      const initialPayload = { ...payload, status: "draft" };
      const createPath = activeEntityType === "post" ? "/admin/articles" : "/admin/entries";
      activeEntry = await cmsRequest(createPath, {
        method: "POST",
        body: JSON.stringify(initialPayload),
      });
      cmsEntries.unshift(activeEntry);
      renderEntryList();
    }

    const autosavePath = activeEntityType === "post"
      ? `/admin/articles/${activeEntry.id}/autosave`
      : `/admin/entries/${activeEntry.id}/autosave`;
    const draft = await cmsRequest(autosavePath, {
      method: "POST",
      body: JSON.stringify({ ...payload, expected_revision: activeEntry.revision }),
    });
    autosaveDirty = false;
    setAutosaveStatus(`自动草稿已保存 · ${formatDateTime(draft.saved_at)}`, "saved");
  } catch (error) {
    if (error?.status === 409) {
      setAutosaveStatus("检测到其他页面的修改，请刷新后继续", "conflict");
    } else {
      setAutosaveStatus("自动保存失败，将继续保留当前输入", "error");
    }
    throw error;
  } finally {
    autosaveInFlight = false;
  }
}

function insertIntoContent(text) {
  const textarea = document.querySelector("[data-entry-content]");
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  renderMarkdownPreview();
}

async function uploadAsset() {
  const input = document.querySelector("[data-asset-file]");
  const file = input.files?.[0];
  if (!file) {
    showToast("先选择一个文件");
    return;
  }
  const formData = new FormData();
  formData.append("file", file);
  const asset = await cmsRequest("/admin/assets", {
    method: "POST",
    body: formData,
  });
  const url = cmsResourceUrl(asset.url);
  const markdown = file.type?.startsWith("image/")
    ? `\n![${asset.filename}](${url})\n`
    : `\n[${asset.filename}](${url})\n`;
  insertIntoContent(markdown);
  input.value = "";
  showToast("文件已上传并插入 Markdown");
}

async function save() {
  if (!cmsToken) throw new Error("请先登录服务器后台");
  await cmsRequest("/admin/site", {
    method: "POST",
    body: JSON.stringify({ data: state }),
  });
  showToast("站点设置已保存到服务器");
}

function cmsApiBase() {
  return document.querySelector("[data-cms-api]")?.value.replace(/\/+$/, "") || cmsConfig.api;
}

function cmsResourceUrl(path) {
  const value = String(path || "");
  return /^https?:\/\//i.test(value) ? value : `${cmsApiBase()}${value}`;
}

function setCmsStatus(message) {
  document.querySelectorAll("[data-cms-status]").forEach((target) => {
    target.textContent = message;
  });
}

async function cmsRequest(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
    ...(options.headers || {}),
  };
  const response = await fetch(`${cmsApiBase()}${path}`, { ...options, headers, credentials: "include" });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try {
      const payload = JSON.parse(raw);
      message = typeof payload.detail === "string" ? payload.detail : payload.detail?.message || raw;
    } catch {
      // Keep the response text when the server does not return JSON.
    }
    const error = new Error(message || `CMS request failed: ${response.status}`);
    error.status = response.status;
    if (response.status === 401) {
      cmsToken = "";
      currentCmsUser = null;
      setCmsStatus("登录已失效");
    }
    throw error;
  }
  return response.json();
}
