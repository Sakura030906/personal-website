function documentStatusLabel(status) {
  return { ready: "可检索", disabled: "已停用", processing: "解析中", error: "解析失败" }[status] || status;
}

function renderDocumentUploadOptions() {
  const select = document.querySelector("[data-document-upload-column]");
  if (!select) return;
  select.innerHTML = `<option value="">未指定</option>${knowledgeColumns
    .map((column) => `<option value="${column.id}">${escapeHtml(column.name)}</option>`)
    .join("")}`;
}

function renderDocumentStats() {
  const target = document.querySelector("[data-document-stats]");
  if (!target) return;
  const chunkCount = documents.reduce((sum, item) => sum + Number(item.chunk_count || 0), 0);
  const readyCount = documents.filter((item) => item.status === "ready").length;
  const errorCount = documents.filter((item) => item.status === "error").length;
  target.innerHTML = [
    ["文档", documents.length, "已纳入管理"],
    ["可检索", readyCount, "当前启用"],
    ["切片", chunkCount, "可单独编辑"],
    ["异常", errorCount, errorCount ? "需要重新解析" : "解析状态正常"],
  ].map(([label, value, note]) => `<article><span>${label}</span><strong>${value}</strong><p>${note}</p></article>`).join("");
}

function renderDocumentList() {
  const target = document.querySelector("[data-document-list]");
  if (!target) return;
  target.innerHTML = documents.length ? documents.map((item) => `
    <button type="button" data-document-id="${item.id}" class="${activeDocument?.id === item.id ? "is-active" : ""}">
      <span class="document-list-heading"><strong>${escapeHtml(item.title)}</strong><em data-status="${escapeHtml(item.status)}">${escapeHtml(documentStatusLabel(item.status))}</em></span>
      <small>${escapeHtml(item.original_filename)} · ${item.chunk_count || 0} 个切片 · r${item.revision || 1}</small>
    </button>
  `).join("") : `<p class="empty">暂无文档，上传第一份资料开始构建文档知识库。</p>`;
}

function documentNodeOptions(item) {
  const selected = new Set((item.node_ids || []).map(Number));
  return knowledgeNodes.length ? knowledgeNodes.map((node) => `
    <label><input type="checkbox" value="${node.id}" ${selected.has(node.id) ? "checked" : ""} />${escapeHtml(node.title)}</label>
  `).join("") : `<span>暂无知识节点</span>`;
}

function documentColumnOptions(selectedId) {
  return `<option value="">未指定</option>${knowledgeColumns.map((column) => `
    <option value="${column.id}" ${Number(selectedId) === column.id ? "selected" : ""}>${escapeHtml(column.name)}</option>
  `).join("")}`;
}

function renderDocumentChunks(item) {
  return (item.chunks || []).length ? item.chunks.map((chunk) => `
    <details class="document-chunk" data-document-chunk="${chunk.id}" ${chunk.chunk_index === 0 ? "open" : ""}>
      <summary>
        <span><strong>#${chunk.chunk_index + 1} ${escapeHtml(chunk.heading || "未命名切片")}</strong><small>${chunk.token_count || 0} tokens · ${escapeHtml(chunk.embedding_provider || "local")}</small></span>
        <em>${chunk.is_enabled ? "启用" : "停用"}</em>
      </summary>
      <div class="document-chunk-form">
        <div class="grid three">
          <label>标题<input data-chunk-heading value="${escapeHtml(chunk.heading || "")}" /></label>
          <label>起始页<input data-chunk-page-start type="number" min="1" value="${chunk.page_start || ""}" /></label>
          <label>结束页<input data-chunk-page-end type="number" min="1" value="${chunk.page_end || ""}" /></label>
        </div>
        <label>切片正文<textarea data-chunk-content rows="8">${escapeHtml(chunk.content || "")}</textarea></label>
        <div class="grid two compact-grid">
          <label>元数据 JSON<textarea data-chunk-metadata rows="3">${escapeHtml(JSON.stringify(chunk.metadata || {}, null, 2))}</textarea></label>
          <label class="check-row"><input data-chunk-enabled type="checkbox" ${chunk.is_enabled ? "checked" : ""} />允许检索这个切片</label>
        </div>
        <div class="actions left"><button type="button" data-document-chunk-save="${chunk.id}">保存切片</button></div>
      </div>
    </details>
  `).join("") : `<p class="empty">没有可编辑切片。请检查解析错误或重新切片。</p>`;
}

function renderDocumentEditor() {
  const target = document.querySelector("[data-document-editor]");
  if (!target) return;
  if (!activeDocument) {
    target.innerHTML = `<p class="empty">选择一份文档查看解析结果。</p>`;
    return;
  }
  documentEditorHydrating = true;
  window.clearTimeout(documentAutosaveTimer);
  documentAutosaveDirty = false;
  const item = activeDocument;
  target.innerHTML = `
    <div class="editor-command-bar">
      <div><span>DOCUMENT</span><strong data-document-shell-title>${escapeHtml(item.title)}</strong></div>
      <div class="editor-command-state"><i data-document-shell-visibility>${escapeHtml((item.visibility || "private").toUpperCase())}</i><b data-document-save-status data-state="saved">已保存 · r${item.revision || 1}</b></div>
    </div>
    <div class="document-editor-header">
      <div>
        <span class="document-kicker">${escapeHtml(item.original_filename)} · ${(Number(item.size_bytes || 0) / 1024).toFixed(1)} KB</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.parser)} · ${escapeHtml(documentStatusLabel(item.status))} · revision ${item.revision || 1}</p>
      </div>
      <a href="${cmsResourceUrl(item.file_url)}" target="_blank" rel="noreferrer">查看原文件</a>
    </div>
    ${item.parse_error ? `<div class="document-error"><strong>解析失败</strong><p>${escapeHtml(item.parse_error)}</p></div>` : ""}
    <div class="grid two">
      <label>标题<input data-document-title value="${escapeHtml(item.title || "")}" /></label>
      <label>URL 标识<input data-document-slug value="${escapeHtml(item.slug || "")}" /></label>
      <label>可见性<select data-document-visibility>
        ${["private", "unlisted", "public"].map((value) => `<option value="${value}" ${item.visibility === value ? "selected" : ""}>${value}</option>`).join("")}
      </select></label>
      <label>所属专栏<select data-document-column>${documentColumnOptions(item.column_id)}</select></label>
    </div>
    <label>摘要<textarea data-document-summary rows="3">${escapeHtml(item.summary || "")}</textarea></label>
    <div class="document-node-links">
      <strong>关联知识节点</strong>
      <label class="relation-search">搜索节点<input data-document-link-search placeholder="输入节点名称筛选" /></label>
      <div data-document-nodes>${documentNodeOptions(item)}</div>
    </div>
    <div class="grid two compact-grid">
      <label>元数据 JSON<textarea data-document-metadata rows="4">${escapeHtml(JSON.stringify(item.metadata || {}, null, 2))}</textarea></label>
      <label class="check-row"><input data-document-ai-search type="checkbox" ${item.allow_ai_search ? "checked" : ""} />允许 AI 检索此文档</label>
    </div>
    <section class="editor-readiness">
      <div><span>检索准备</span><strong data-document-readiness-summary>0 / 0</strong></div>
      <ul data-document-readiness></ul>
    </section>
    <div class="actions left document-actions">
      <button type="button" data-document-save>保存文档</button>
      <button type="button" data-document-toggle ${!["ready", "disabled"].includes(item.status) ? "disabled" : ""}>${item.status === "ready" ? "停用检索" : "启用检索"}</button>
      <button type="button" class="danger" data-document-delete>删除文档</button>
    </div>
    <section class="document-rechunk">
      <div><strong>切片设置</strong><span>重新切片会先保存当前版本。</span></div>
      <label>长度<input data-document-chunk-size type="number" min="200" max="4000" value="${item.chunk_size || 900}" /></label>
      <label>重叠<input data-document-chunk-overlap type="number" min="0" max="1000" value="${item.chunk_overlap || 150}" /></label>
      <button type="button" data-document-rechunk>重新解析</button>
    </section>
    <section class="document-chunks-section">
      <div class="panel-title compact"><div><h3>切片编辑</h3><p>${item.enabled_chunk_count || 0}/${item.chunk_count || 0} 个切片已启用。</p></div></div>
      <div data-document-chunks>${renderDocumentChunks(item)}</div>
    </section>
    <section class="version-panel">
      <div class="panel-title compact"><h3>文档版本</h3><button type="button" data-document-versions>刷新版本</button></div>
      <div class="version-list" data-document-version-list><p class="empty">点击刷新查看版本。</p></div>
      <pre class="version-diff" data-document-version-diff hidden></pre>
    </section>
  `;
  renderDocumentReadiness();
  documentEditorHydrating = false;
}

function readDocumentPayload() {
  return {
    title: document.querySelector("[data-document-title]").value.trim(),
    slug: document.querySelector("[data-document-slug]").value.trim(),
    summary: document.querySelector("[data-document-summary]").value.trim(),
    visibility: document.querySelector("[data-document-visibility]").value,
    allow_ai_search: document.querySelector("[data-document-ai-search]").checked,
    column_id: Number(document.querySelector("[data-document-column]").value) || null,
    node_ids: [...document.querySelectorAll("[data-document-nodes] input:checked")].map((input) => Number(input.value)),
    metadata: parseJsonField("[data-document-metadata]", "文档元数据"),
    expected_revision: activeDocument?.revision,
  };
}

function renderDocumentReadiness() {
  if (!activeDocument || !document.querySelector("[data-document-readiness]")) return;
  let payload;
  try { payload = readDocumentPayload(); } catch { payload = { title: "", slug: "", summary: "", node_ids: [], column_id: null, allow_ai_search: false }; }
  renderEditorReadiness("[data-document-readiness]", "[data-document-readiness-summary]", [
    { label: "标题与 URL 标识", ready: Boolean(payload.title && payload.slug) },
    { label: "摘要不少于 20 字", ready: payload.summary.length >= 20 },
    { label: "文档解析成功", ready: ["ready", "disabled"].includes(activeDocument.status) },
    { label: "至少一个切片已启用", ready: Number(activeDocument.enabled_chunk_count || 0) > 0 },
    { label: "已指定所属专栏", ready: Boolean(payload.column_id) },
    { label: "已关联知识节点", ready: payload.node_ids.length > 0 },
  ]);
}

async function selectDocument(documentId) {
  activeDocument = await cmsRequest(`/admin/documents/${documentId}`);
  renderDocumentList();
  renderDocumentEditor();
}

async function loadDocuments() {
  documents = await cmsRequest("/admin/documents");
  renderDocumentUploadOptions();
  renderDocumentStats();
  renderDocumentList();
  if (activeDocument?.id && documents.some((item) => item.id === activeDocument.id)) {
    await selectDocument(activeDocument.id);
  } else if (documents[0]) {
    await selectDocument(documents[0].id);
  } else {
    activeDocument = null;
    renderDocumentEditor();
  }
  renderAdminDashboard();
}

async function uploadDocument() {
  const fileInput = document.querySelector("[data-document-file]");
  if (!fileInput.files?.[0]) throw new Error("请先选择文档");
  const form = new FormData();
  form.append("file", fileInput.files[0]);
  form.append("title", document.querySelector("[data-document-upload-title]").value.trim());
  form.append("visibility", document.querySelector("[data-document-upload-visibility]").value);
  const columnId = document.querySelector("[data-document-upload-column]").value;
  if (columnId) form.append("column_id", columnId);
  activeDocument = await cmsRequest("/admin/documents", { method: "POST", body: form });
  fileInput.value = "";
  document.querySelector("[data-document-upload-title]").value = "";
  showToast(activeDocument.status === "ready" ? "文档已解析并生成切片" : "文档已上传，但解析失败");
  await loadDocuments();
}

function parseJsonField(selector, label) {
  try {
    return JSON.parse(document.querySelector(selector).value || "{}");
  } catch {
    throw new Error(`${label}必须是有效 JSON`);
  }
}

async function saveDocument() {
  if (!activeDocument?.id) return;
  window.clearTimeout(documentAutosaveTimer);
  const payload = readDocumentPayload();
  if (!payload.title || !payload.slug) throw new Error("标题和 URL 标识不能为空");
  setEditorStatus("[data-document-save-status]", "正在保存…", "saving");
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}`, { method: "PATCH", body: JSON.stringify(payload) });
  documentAutosaveDirty = false;
  setEditorStatus("[data-document-save-status]", `已保存 · r${activeDocument.revision || 1}`, "saved");
  showToast("文档已保存并记录版本");
  await loadDocuments();
}

function scheduleDocumentAutosave() {
  if (documentEditorHydrating || !cmsToken || !activeDocument?.id) return;
  renderDocumentReadiness();
  document.querySelector("[data-document-shell-title]").textContent = document.querySelector("[data-document-title]").value.trim() || "未命名文档";
  document.querySelector("[data-document-shell-visibility]").textContent = document.querySelector("[data-document-visibility]").value.toUpperCase();
  setEditorStatus("[data-document-save-status]", "有未保存修改", "dirty");
  documentAutosaveDirty = true;
  window.clearTimeout(documentAutosaveTimer);
  documentAutosaveTimer = window.setTimeout(() => guarded(performDocumentAutosave), 2800);
}

async function performDocumentAutosave() {
  if (!activeDocument?.id || documentAutosaveInFlight || !documentAutosaveDirty) return;
  const payload = readDocumentPayload();
  if (!payload.title || !payload.slug) return;
  documentAutosaveInFlight = true;
  setEditorStatus("[data-document-save-status]", "正在自动保存…", "saving");
  try {
    activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}`, {
      method: "PATCH", body: JSON.stringify(payload),
    });
    documentAutosaveDirty = false;
    setEditorStatus("[data-document-save-status]", `已自动保存 · r${activeDocument.revision || 1}`, "saved");
  } finally {
    documentAutosaveInFlight = false;
  }
}

async function toggleDocument() {
  if (!activeDocument?.id) return;
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}/toggle`, { method: "POST" });
  showToast(activeDocument.status === "ready" ? "文档检索已启用" : "文档检索已停用");
  await loadDocuments();
}

async function rechunkDocument() {
  if (!activeDocument?.id || !confirm("重新解析会替换当前切片，旧内容会保存在版本历史中。是否继续？")) return;
  const payload = {
    chunk_size: Number(document.querySelector("[data-document-chunk-size]").value),
    chunk_overlap: Number(document.querySelector("[data-document-chunk-overlap]").value),
  };
  activeDocument = await cmsRequest(`/admin/documents/${activeDocument.id}/rechunk`, { method: "POST", body: JSON.stringify(payload) });
  showToast("文档已重新解析并生成切片");
  await loadDocuments();
}

async function saveDocumentChunk(chunkId) {
  const block = document.querySelector(`[data-document-chunk="${chunkId}"]`);
  if (!block) return;
  const numberOrNull = (selector) => Number(block.querySelector(selector).value) || null;
  const metadataField = block.querySelector("[data-chunk-metadata]");
  let metadata;
  try { metadata = JSON.parse(metadataField.value || "{}"); } catch { throw new Error("切片元数据必须是有效 JSON"); }
  await cmsRequest(`/admin/document-chunks/${chunkId}`, {
    method: "PATCH",
    body: JSON.stringify({
      heading: block.querySelector("[data-chunk-heading]").value.trim(),
      content: block.querySelector("[data-chunk-content]").value.trim(),
      page_start: numberOrNull("[data-chunk-page-start]"),
      page_end: numberOrNull("[data-chunk-page-end]"),
      metadata,
      is_enabled: block.querySelector("[data-chunk-enabled]").checked,
    }),
  });
  showToast("切片已保存并重新生成向量");
  await selectDocument(activeDocument.id);
}

async function loadDocumentVersions() {
  if (!activeDocument?.id) return;
  const versions = await cmsRequest(`/admin/documents/${activeDocument.id}/versions`);
  const target = document.querySelector("[data-document-version-list]");
  target.innerHTML = versions.length ? versions.map((version) => `
    <div class="version-row"><div><strong>${escapeHtml(version.reason)}</strong><span>${escapeHtml(formatDateTime(version.created_at))} · ${escapeHtml(version.created_by_email || "system")}</span></div><div class="version-actions"><button type="button" data-document-version-diff="${version.id}">查看差异</button><button type="button" data-document-version-restore="${version.id}">恢复</button></div></div>
  `).join("") : `<p class="empty">暂无版本。</p>`;
}

async function loadDocumentVersionDiff(versionId) {
  const diff = await cmsRequest(`/admin/documents/versions/${versionId}/diff`);
  const target = document.querySelector("[data-document-version-diff]");
  target.textContent = `变更字段：${(diff.changed_fields || []).join("、") || "无字段变化"}\n\n${diff.content_diff || "切片正文没有变化。"}`;
  target.hidden = false;
}

async function restoreDocumentVersion(versionId) {
  if (!confirm("确定恢复该文档版本吗？当前状态会先保存为新版本。")) return;
  activeDocument = await cmsRequest(`/admin/documents/versions/${versionId}/restore`, { method: "POST" });
  showToast("文档版本已恢复");
  await loadDocuments();
  await loadDocumentVersions();
}

async function deleteDocument() {
  if (!activeDocument?.id || !confirm(`将「${activeDocument.title}」移至回收站？文档、切片和版本都会保留。`)) return;
  await cmsRequest(`/admin/documents/${activeDocument.id}`, { method: "DELETE" });
  activeDocument = null;
  showToast("文档已移至回收站");
  await loadDocuments();
}
