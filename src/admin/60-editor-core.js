function showToast(message) {
  const toast = document.querySelector("[data-toast]");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function safePreviewUrl(value, kind = "link") {
  const raw = String(value || "").trim();
  if (!raw) return kind === "image" ? "" : "#";
  if (/^(#|\/|\.\/|\.\.\/)/.test(raw)) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    const allowed = kind === "image" ? ["http:", "https:"] : ["http:", "https:", "mailto:"];
    return allowed.includes(parsed.protocol) ? raw : (kind === "image" ? "" : "#");
  } catch {
    return kind === "image" ? "" : "#";
  }
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

function parseMetadata(entry) {
  return parseJson(entry?.metadata_json, {});
}

function parseArrayJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return null;
  }
}

function stringifyMetadata(value) {
  return JSON.stringify(value || {}, null, 2);
}

function uniqueValues(values) {
  return [...new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function currentEntryDraftForSuggestion() {
  let metadata = {};
  const metadataInput = document.querySelector("[data-entry-metadata]");
  if (metadataInput) metadata = parseJson(metadataInput.value, {});
  return {
    id: activeEntry?.id || null,
    entity_type: activeEntityType,
    title: document.querySelector("[data-entry-title]")?.value.trim() || activeEntry?.title || "",
    summary: document.querySelector("[data-entry-summary]")?.value.trim() || "",
    category: document.querySelector("[data-entry-category]")?.value.trim() || "",
    content_md: document.querySelector("[data-entry-content]")?.value || "",
    metadata_json: JSON.stringify(metadata),
  };
}

function renderAutoRelationSuggestions(payload = relationSuggestionPayload) {
  const target = document.querySelector("[data-auto-relation-results]");
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">保存或填写内容后，可以点击推荐关联。</p>`;
    return;
  }

  const labels = { project: "项目", knowledge: "知识", post: "文章", reading: "阅读" };
  const groups = payload.groups || {};
  const sections = ["project", "knowledge", "post", "reading"].map((type) => {
    const items = groups[type] || [];
    return `
      <article>
        <h4>${labels[type]}</h4>
        ${
          items.length
            ? items
                .map(
                  (item) => `
                    <button type="button" data-relation-item="${escapeHtml(item.id)}" data-relation-type="${escapeHtml(type)}">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.category || item.slug)} · score ${escapeHtml(item.score)}</span>
                    </button>
                  `,
                )
                .join("")
            : `<p class="empty">暂无推荐。</p>`
        }
      </article>
    `;
  });
  target.innerHTML = sections.join("");
}

function relationItemsByType(type) {
  return relationSuggestionPayload?.groups?.[type] || [];
}

function applyRelationItems(type, items) {
  if (!items.length) return;
  const metadataInput = document.querySelector("[data-entry-metadata]");
  const metadata = parseJson(metadataInput.value, {});
  const titles = items.map((item) => item.title);

  if (type === "project") {
    metadata.relatedProjects = uniqueValues([...(metadata.relatedProjects || []), ...titles]);
    document.querySelector("[data-entry-related]").value = metadata.relatedProjects.join(", ");
  }
  if (type === "knowledge") {
    metadata.relatedKnowledge = uniqueValues([...(metadata.relatedKnowledge || []), ...titles]);
    document.querySelector("[data-entry-related-knowledge]").value = metadata.relatedKnowledge.join(", ");
  }
  if (type === "post") {
    metadata.relatedPosts = uniqueValues([...(metadata.relatedPosts || []), ...titles]);
    document.querySelector("[data-entry-related-posts]").value = metadata.relatedPosts.join(", ");
  }
  if (type === "reading") {
    metadata.relatedReading = uniqueValues([...(metadata.relatedReading || []), ...titles]);
    document.querySelector("[data-entry-related-reading]").value = metadata.relatedReading.join(", ");
  }

  metadataInput.value = stringifyMetadata(metadata);
  if (activeEntityType === "knowledge") renderRelationSuggestions(metadata);
}

function applyAllRelationSuggestions() {
  ["project", "knowledge", "post", "reading"].forEach((type) => applyRelationItems(type, relationItemsByType(type).slice(0, type === "knowledge" ? 5 : 3)));
  showToast("已应用推荐关联");
}

function markdownToHtml(markdown = "") {
  const lines = String(markdown).split("\n");
  const html = [];
  let inCode = false;
  let codeLines = [];
  let inList = false;

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  function inline(value) {
    return escapeHtml(value)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        const safe = safePreviewUrl(url, "image");
        return safe ? `<img alt="${alt}" src="${escapeHtml(safe)}" />` : alt;
      })
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${escapeHtml(safePreviewUrl(url))}" target="_blank" rel="noreferrer">${label}</a>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return html.join("");
}

function defaultEntry(entityType = activeEntityType) {
  const label = entityLabels[entityType];
  const slug = `${entityType}-${Date.now()}`;
  const metadata =
    entityType === "post"
      ? { date: new Date().toISOString().slice(0, 10), tags: [], seoTitle: "", seoDescription: "", canonical: "", cover: "" }
      : entityType === "project"
        ? { stack: [], github: "", demo: "", status: "规划中" }
        : entityType === "reading"
          ? { author: "", status: "想读", progress: 0, highlights: [], relatedKnowledge: [], relatedProjects: [], relatedPosts: [] }
          : { items: [], relatedProjects: [], relatedKnowledge: [], relatedReading: [], relatedPosts: [], notes: [] };

  return {
    id: null,
    entity_type: entityType,
    slug,
    title: `新${label}`,
    summary: "",
    content_md: "",
    metadata_json: stringifyMetadata(metadata),
    status: "draft",
    visibility: "public",
    revision: 1,
    category: entityType === "post" ? "技术学习" : label,
  };
}

function relationSuggestions(metadata = {}) {
  const knowledge = (state?.knowledgeBase || []).map((item) => item.topic).filter(Boolean);
  const projects = (state?.projects || []).map((item) => item.name).filter(Boolean);
  const reading = (state?.reading || []).map((item) => item.title).filter(Boolean);
  const posts = (state?.posts || []).map((item) => item.title).filter(Boolean);
  const selected = [
    ...(metadata.relatedKnowledge || []),
    ...(metadata.relatedProjects || []),
    ...(metadata.relatedReading || []),
    ...(metadata.relatedPosts || []),
  ];
  return { knowledge, projects, reading, posts, selected };
}

function renderRelationSuggestions(metadata = {}) {
  const target = document.querySelector("[data-relation-suggestions]");
  if (!target) return;
  const groups = relationSuggestions(metadata);
  const chips = [
    ...groups.knowledge.slice(0, 8).map((item) => ["知识", item]),
    ...groups.projects.slice(0, 6).map((item) => ["项目", item]),
    ...groups.reading.slice(0, 4).map((item) => ["阅读", item]),
    ...groups.posts.slice(0, 4).map((item) => ["文章", item]),
  ];
  target.innerHTML = chips.length
    ? `
      <strong>可用关联</strong>
      <div>
        ${chips.map(([type, item]) => `<span class="${groups.selected.includes(item) ? "is-selected" : ""}">${escapeHtml(type)} · ${escapeHtml(item)}</span>`).join("")}
      </div>
    `
    : `<p class="empty">添加项目、阅读或文章后，这里会显示可关联内容。</p>`;
}

function toggleKnowledgeRelationEditor(metadata = {}) {
  const panel = document.querySelector("[data-knowledge-relation-editor]");
  if (!panel) return;
  const isKnowledge = activeEntityType === "knowledge";
  panel.hidden = !isKnowledge;
  document.querySelector("[data-entry-related]").closest("label").firstChild.textContent = isKnowledge ? "关联项目" : "关联项目";
  if (isKnowledge) renderRelationSuggestions(metadata);
}

function togglePostSeoEditor() {
  const panel = document.querySelector("[data-post-seo-editor]");
  if (panel) panel.hidden = activeEntityType !== "post";
  const enhancement = document.querySelector("[data-entry-enhancement-panel]");
  if (enhancement) enhancement.hidden = activeEntityType !== "post";
}

const enhancementFieldLabels = {
  summary: "摘要",
  tags: "标签",
  seo_title: "SEO 标题",
  seo_description: "SEO 描述",
  related_articles: "关联文章",
  related_nodes: "关联知识节点",
};

function enhancementValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "object" ? item.title || item.id : item)).filter(Boolean).join(" · ") || "无";
  }
  return String(value || "无");
}

function renderContentEnhancement(kind) {
  const payload = kind === "node" ? nodeEnhancement : articleEnhancement;
  const target = document.querySelector(`[data-${kind}-enhancement-result]`);
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">${kind === "node" ? "先保存节点，再生成增强建议。" : "保存文章后，可以生成字段级建议。"}</p>`;
    return;
  }
  const changed = (payload.fields || []).filter((field) => field.changed);
  target.innerHTML = `
    <div class="ai-enhancement-meta"><span>${escapeHtml(payload.model_applied ? "MODEL" : "LOCAL")}</span><span>基于 revision ${escapeHtml(payload.revision)}</span><span>${changed.length} 个字段可优化</span></div>
    <div class="ai-enhancement-fields">
      ${(payload.fields || []).map((field) => `
        <label class="ai-enhancement-field ${field.changed ? "is-changed" : ""}">
          <input type="checkbox" data-enhancement-field="${escapeHtml(field.field)}" ${field.changed ? "checked" : ""} ${field.changed ? "" : "disabled"} />
          <span class="ai-enhancement-field-name">${escapeHtml(enhancementFieldLabels[field.field] || field.field)}</span>
          <div><small>当前</small><p>${escapeHtml(enhancementValue(field.current))}</p></div>
          <i>→</i>
          <div><small>建议</small><p>${escapeHtml(enhancementValue(field.proposed))}</p></div>
        </label>
      `).join("")}
    </div>
    <div class="ai-enhancement-footer"><small>${escapeHtml(payload.safety || "必须确认后才会写入。")}</small><button type="button" data-${kind}-enhancement-apply ${changed.length ? "" : "disabled"}>应用已选字段</button></div>
  `;
}

async function suggestContentEnhancement(kind, mode = "local") {
  const entity = kind === "node" ? activeKnowledgeNode : activeEntry;
  if (!entity?.id || (kind === "entry" && activeEntityType !== "post")) {
    throw new Error(kind === "node" ? "请先保存知识节点" : "请先保存文章");
  }
  const target = document.querySelector(`[data-${kind}-enhancement-result]`);
  target.innerHTML = `<p class="empty">正在${mode === "auto" ? "调用模型" : "分析内容"}…</p>`;
  const path = kind === "node"
    ? `/admin/knowledge-nodes/${entity.id}/enhancement/suggest`
    : `/admin/articles/${entity.id}/enhancement/suggest`;
  const payload = await cmsRequest(path, { method: "POST", body: JSON.stringify({ mode }) });
  if (kind === "node") nodeEnhancement = payload;
  else articleEnhancement = payload;
  renderContentEnhancement(kind);
}

async function applyContentEnhancement(kind) {
  const payload = kind === "node" ? nodeEnhancement : articleEnhancement;
  const entity = kind === "node" ? activeKnowledgeNode : activeEntry;
  if (!payload || !entity?.id) return;
  const panel = document.querySelector(`[data-${kind}-enhancement-panel]`);
  const selectedFields = [...panel.querySelectorAll("[data-enhancement-field]:checked")].map((input) => input.dataset.enhancementField);
  if (!selectedFields.length) throw new Error("请至少选择一个需要应用的字段");
  const path = kind === "node"
    ? `/admin/knowledge-nodes/${entity.id}/enhancement/apply`
    : `/admin/articles/${entity.id}/enhancement/apply`;
  const result = await cmsRequest(path, {
    method: "POST",
    body: JSON.stringify({ expected_revision: payload.revision, selected_fields: selectedFields, proposal: payload.proposal }),
  });
  if (kind === "node") {
    activeKnowledgeNode = result.node;
    const index = knowledgeNodes.findIndex((item) => item.id === result.node.id);
    if (index >= 0) knowledgeNodes[index] = result.node;
    setKnowledgeNodeForm(result.node);
    renderKnowledgeNodeList();
    await loadKnowledgeNodeVersions();
  } else {
    activeEntry = result.article;
    const index = cmsEntries.findIndex((item) => item.id === result.article.id);
    if (index >= 0) cmsEntries[index] = result.article;
    setEntryForm(result.article);
    renderEntryList();
    await loadVersions();
  }
  showToast(`已应用 ${selectedFields.length} 个增强字段`);
}

function syncMetadataPreviewFromFields() {
  const metadataInput = document.querySelector("[data-entry-metadata]");
  if (!metadataInput) return;
  const metadata = parseJson(metadataInput.value, null);
  if (metadata === null) return;

  const keywordKey = keywordKeys[activeEntityType] || "tags";
  metadata[keywordKey] = splitValues(document.querySelector("[data-entry-keywords]").value);
  metadata.relatedProjects = splitValues(document.querySelector("[data-entry-related]").value);

  if (activeEntityType === "post") {
    metadata.seoTitle = document.querySelector("[data-entry-seo-title]").value.trim();
    metadata.seoDescription = document.querySelector("[data-entry-seo-description]").value.trim();
    metadata.canonical = document.querySelector("[data-entry-canonical]").value.trim();
    metadata.cover = document.querySelector("[data-entry-cover]").value.trim();
    metadata.columnCover = document.querySelector("[data-entry-column-cover]").value.trim();
    metadata.columnDescription = document.querySelector("[data-entry-column-description]").value.trim();
    metadata.bodyFontSize = Math.max(14, Math.min(24, Number(document.querySelector("[data-entry-body-font-size]").value) || 18));
    metadata.columnIds = [...document.querySelectorAll("[data-entry-columns] input:checked")].map((input) => Number(input.value));
    const primaryColumn = document.querySelector("[data-entry-primary-column]").value;
    metadata.primaryColumnId = primaryColumn ? Number(primaryColumn) : null;
  }

  if (activeEntityType === "knowledge") {
    metadata.relatedKnowledge = splitValues(document.querySelector("[data-entry-related-knowledge]").value);
    metadata.relatedReading = splitValues(document.querySelector("[data-entry-related-reading]").value);
    metadata.relatedPosts = splitValues(document.querySelector("[data-entry-related-posts]").value);
    metadata.noteLinks = splitValues(document.querySelector("[data-entry-note-links]").value);
    const notesInput = document.querySelector("[data-entry-notes-json]");
    const notes = parseArrayJson(notesInput.value, []);
    if (notes !== null) {
      notesInput.classList.remove("is-invalid");
      metadata.notes = notes;
    } else {
      notesInput.classList.add("is-invalid");
    }
  }

  metadataInput.value = stringifyMetadata(metadata);
  if (activeEntityType === "knowledge") renderRelationSuggestions(metadata);
  if (activeEntityType === "post") renderArticleColumnEditor(metadata);
}

function setAutosaveStatus(message, state = "idle") {
  const target = document.querySelector("[data-autosave-status]");
  if (!target) return;
  target.textContent = message;
  target.dataset.state = state;
}

function setEntryForm(entry, draftPayload = null, draftSavedAt = "") {
  suppressEditorEvents = true;
  window.clearTimeout(autosaveTimer);
  autosaveDirty = false;
  activeEntry = entry || defaultEntry();
  articleEnhancement = null;
  relationSuggestionPayload = null;
  const displayedEntry = draftPayload ? { ...activeEntry, ...draftPayload } : activeEntry;
  const metadata = parseMetadata(displayedEntry);
  const keywordKey = keywordKeys[displayedEntry.entity_type] || "tags";

  document.querySelector("[data-entry-title]").value = displayedEntry.title || "";
  document.querySelector("[data-entry-slug]").value = displayedEntry.slug || "";
  document.querySelector("[data-entry-category]").value = displayedEntry.category || "";
  document.querySelector("[data-entry-status]").value = displayedEntry.status || "draft";
  document.querySelector("[data-entry-visibility]").value = displayedEntry.visibility || "public";
  document.querySelector("[data-entry-summary]").value = displayedEntry.summary || "";
  document.querySelector("[data-entry-content]").value = displayedEntry.content_md || "";
  document.querySelector("[data-entry-metadata]").value = stringifyMetadata(metadata);
  document.querySelector("[data-entry-keywords]").value = (metadata[keywordKey] || []).join(", ");
  document.querySelector("[data-entry-related]").value = (metadata.relatedProjects || []).join(", ");
  document.querySelector("[data-entry-seo-title]").value = metadata.seoTitle || "";
  document.querySelector("[data-entry-seo-description]").value = metadata.seoDescription || "";
  document.querySelector("[data-entry-canonical]").value = metadata.canonical || "";
  document.querySelector("[data-entry-cover]").value = metadata.cover || "";
  document.querySelector("[data-entry-column-cover]").value = metadata.columnCover || "";
  document.querySelector("[data-entry-column-description]").value = metadata.columnDescription || "";
  document.querySelector("[data-entry-body-font-size]").value = metadata.bodyFontSize || 18;
  renderArticleColumnEditor(metadata);
  document.querySelector("[data-entry-related-knowledge]").value = (metadata.relatedKnowledge || []).join(", ");
  document.querySelector("[data-entry-related-reading]").value = (metadata.relatedReading || []).join(", ");
  document.querySelector("[data-entry-related-posts]").value = (metadata.relatedPosts || []).join(", ");
  document.querySelector("[data-entry-note-links]").value = (metadata.noteLinks || []).join(", ");
  document.querySelector("[data-entry-notes-json]").value = JSON.stringify(metadata.notes || [], null, 2);
  document.querySelector("[data-keywords-label]").firstChild.textContent = keywordLabels[displayedEntry.entity_type] || "标签，逗号分隔";
  toggleKnowledgeRelationEditor(metadata);
  togglePostSeoEditor();
  renderContentEnhancement("entry");
  renderMarkdownPreview();
  document.querySelector("[data-entry-shell-kind]").textContent = (entityLabels[displayedEntry.entity_type] || "CONTENT").toUpperCase();
  document.querySelector("[data-entry-shell-title]").textContent = displayedEntry.title || `新${entityLabels[displayedEntry.entity_type] || "内容"}`;
  document.querySelector("[data-entry-shell-visibility]").textContent = (displayedEntry.visibility || "public").toUpperCase();
  renderEntryReadiness();
  renderVersionList([]);
  renderAutoRelationSuggestions();
  document.querySelector("[data-version-diff]").hidden = true;
  setAutosaveStatus(
    draftPayload ? `已恢复自动草稿 · ${formatDateTime(draftSavedAt)}` : activeEntry.id ? `已保存 · revision ${activeEntry.revision || 1}` : "输入后自动创建草稿",
    draftPayload ? "saved" : "idle",
  );
  suppressEditorEvents = false;
}

function readEntryForm() {
  const metadataInput = document.querySelector("[data-entry-metadata]");
  const metadata = parseJson(metadataInput.value, null);
  if (metadata === null) {
    metadataInput.classList.add("is-invalid");
    throw new Error("元数据 JSON 格式不正确");
  }
  metadataInput.classList.remove("is-invalid");

  const keywordKey = keywordKeys[activeEntityType] || "tags";
  metadata[keywordKey] = splitValues(document.querySelector("[data-entry-keywords]").value);
  metadata.relatedProjects = splitValues(document.querySelector("[data-entry-related]").value);
  if (activeEntityType === "post") {
    metadata.seoTitle = document.querySelector("[data-entry-seo-title]").value.trim();
    metadata.seoDescription = document.querySelector("[data-entry-seo-description]").value.trim();
    metadata.canonical = document.querySelector("[data-entry-canonical]").value.trim();
    metadata.cover = document.querySelector("[data-entry-cover]").value.trim();
    metadata.columnCover = document.querySelector("[data-entry-column-cover]").value.trim();
    metadata.columnDescription = document.querySelector("[data-entry-column-description]").value.trim();
    metadata.bodyFontSize = Math.max(14, Math.min(24, Number(document.querySelector("[data-entry-body-font-size]").value) || 18));
    metadata.columnIds = [...document.querySelectorAll("[data-entry-columns] input:checked")].map((input) => Number(input.value));
    const primaryColumn = document.querySelector("[data-entry-primary-column]").value;
    metadata.primaryColumnId = primaryColumn ? Number(primaryColumn) : null;
  }
  if (activeEntityType === "knowledge") {
    metadata.relatedKnowledge = splitValues(document.querySelector("[data-entry-related-knowledge]").value);
    metadata.relatedReading = splitValues(document.querySelector("[data-entry-related-reading]").value);
    metadata.relatedPosts = splitValues(document.querySelector("[data-entry-related-posts]").value);
    metadata.noteLinks = splitValues(document.querySelector("[data-entry-note-links]").value);
    const notesInput = document.querySelector("[data-entry-notes-json]");
    const notes = parseArrayJson(notesInput.value, []);
    if (notes === null) {
      notesInput.classList.add("is-invalid");
      throw new Error("知识节点 JSON 格式不正确");
    }
    notesInput.classList.remove("is-invalid");
    metadata.notes = notes;
  }

  const title = document.querySelector("[data-entry-title]").value.trim();
  const slug = document.querySelector("[data-entry-slug]").value.trim() || slugify(title);

  return {
    entity_type: activeEntityType,
    slug,
    title,
    summary: document.querySelector("[data-entry-summary]").value.trim(),
    content_md: document.querySelector("[data-entry-content]").value,
    metadata_json: JSON.stringify(metadata),
    status: document.querySelector("[data-entry-status]").value,
    visibility: document.querySelector("[data-entry-visibility]").value,
    category: document.querySelector("[data-entry-category]").value.trim(),
  };
}

function entryReadinessChecks(payload = readEntryForm()) {
  const metadata = parseJson(payload.metadata_json, {});
  const keywords = metadata[keywordKeys[activeEntityType] || "tags"] || [];
  const checks = [
    { label: "标题与 URL 标识", ready: Boolean(payload.title && payload.slug) },
    { label: "摘要不少于 30 字", ready: payload.summary.length >= 30 },
    { label: "正文不少于 120 字", ready: payload.content_md.trim().length >= 120 },
    { label: "至少设置一个标签", ready: keywords.length > 0 },
    { label: "可见性已确认", ready: ["public", "unlisted", "private"].includes(payload.visibility) },
  ];
  if (activeEntityType === "post") {
    checks.push(
      { label: "已设置文章封面", ready: Boolean(metadata.cover) },
      { label: "已设置 SEO 描述", ready: Boolean(metadata.seoDescription || payload.summary.length >= 50) },
      { label: "至少属于一个专栏", ready: (metadata.columnIds || []).length > 0 },
    );
  } else {
    checks.push({ label: "已有内容关联", ready: (metadata.relatedProjects || []).length > 0 || keywords.length > 1 });
  }
  return checks;
}
