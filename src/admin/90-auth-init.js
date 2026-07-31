async function cmsLogin() {
  const email = document.querySelector("[data-cms-email]").value.trim();
  const password = document.querySelector("[data-cms-password]").value;
  cmsConfig.api = cmsApiBase();
  cmsConfig.email = email;
  localStorage.setItem("portfolio.cms.api", cmsConfig.api);
  localStorage.setItem("portfolio.cms.email", email);

  await cmsRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  cmsToken = "cookie";
  setCmsStatus("已连接 CMS");
  showToast("CMS 登录成功");
  await loadCurrentAccount();
  await loadKnowledgeColumns();
  await loadKnowledgeGraphData();
  await loadDocuments();
  await loadEntries();
  await loadAiRuns();
  await loadAgentRuns();
  await loadRagIndex();
  await loadAiFeedback();
  await loadContentOps();
  await loadSearchAnalytics();
  await loadContentGaps();
  await loadRelationHealth();
  await loadPublishWorkflow();
  await loadWorkspaceOverview();
  await loadInbox();
  await loadActivity();
}

async function pushToCms() {
  await cmsRequest("/admin/site", {
    method: "POST",
    body: JSON.stringify({ data: state }),
  });
  setCmsStatus("服务器数据已保存");
  showToast("站点设置已保存到服务器数据库");
  await loadRagIndex();
}

async function pullFromCms() {
  const nextState = await cmsRequest("/admin/site");
  state = nextState;
  render();
  setCmsStatus("已读取服务器数据");
  showToast("已刷新服务器站点设置");
}

async function guarded(action) {
  try {
    await action();
  } catch (error) {
    showToast(error instanceof Error ? error.message : "操作失败");
  }
}

async function init() {
  const apiInput = document.querySelector("[data-cms-api]");
  if (apiInput) apiInput.value = cmsConfig.api;
  const apiDocs = document.querySelector("[data-api-docs]");
  if (apiDocs) apiDocs.href = `${cmsConfig.api.replace(/\/+$/, "")}/docs`;
  state = await fetch("/data/site.json").then((response) => {
    if (!response.ok) throw new Error("无法读取站点初始配置。");
    return response.json();
  });
  if (cmsToken) {
    try {
      currentCmsUser = await cmsRequest("/auth/me");
      state = await cmsRequest("/admin/site");
    } catch (error) {
      if (error.status !== 404) console.warn(error);
    }
  }
  document.querySelector("[data-cms-api]").value = cmsConfig.api;
  document.querySelector("[data-cms-email]").value = cmsConfig.email;
  setCmsStatus(cmsToken ? "已有登录令牌" : "未连接");
  configureAdminPages();
  render();

  document.querySelectorAll("[data-admin-route]").forEach((button) => {
    button.addEventListener("click", () => guarded(() => navigateAdminRoute(button.dataset.adminRoute)));
  });
  document.querySelectorAll("[data-dashboard-action]").forEach((button) => {
    button.addEventListener("click", () => guarded(async () => {
      const action = button.dataset.dashboardAction;
      if (action === "new-article") {
        await navigateAdminRoute("articles");
        document.querySelector("[data-entry-new]")?.click();
      }
      if (action === "quick-capture") {
        await navigateAdminRoute("inbox");
        resetInboxForm();
        document.querySelector("[data-inbox-title]")?.focus();
      }
      if (action === "new-node") {
        await navigateAdminRoute("knowledge-nodes");
        document.querySelector("[data-node-new]")?.click();
      }
      if (action === "new-relation") {
        await navigateAdminRoute("knowledge-relations");
        document.querySelector("[data-node-relation-new]")?.click();
      }
    }));
  });
  const adminSearch = document.querySelector("[data-admin-search]");
  adminSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !adminSearch.value.trim()) return;
    guarded(async () => {
      await navigateAdminRoute("review");
      document.querySelector("[data-review-search]").value = adminSearch.value.trim();
      await searchReviewWorkspace();
    });
  });
  window.addEventListener("hashchange", () => guarded(() => navigateAdminRoute(window.location.hash.slice(1) || "dashboard", { updateHash: false })));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      adminSearch.focus();
      adminSearch.select();
    }
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.add;
      ensureList(key).push(structuredClone(templates[key]));
      render();
    });
  });

  document.querySelector("[data-save]").addEventListener("click", save);
  document.querySelector("[data-cms-login]").addEventListener("click", () => guarded(cmsLogin));
  document.querySelector("[data-account-refresh]").addEventListener("click", () => guarded(loadCurrentAccount));
  document.querySelector("[data-account-create]").addEventListener("click", () => guarded(createAccount));
  document.querySelector("[data-own-password-change]").addEventListener("click", () => guarded(changeOwnPassword));
  document.querySelector("[data-account-users]").addEventListener("change", (event) => {
    if (event.target.matches("[data-account-role]")) guarded(() => updateAccount(event.target, "role"));
  });
  document.querySelector("[data-account-users]").addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-account-toggle]");
    if (toggle) guarded(() => updateAccount(toggle, "toggle"));
    const reset = event.target.closest("[data-account-reset]");
    if (reset) guarded(() => updateAccount(reset, "reset"));
  });
  document.querySelector("[data-inbox-compose]").addEventListener("click", () => {
    resetInboxForm();
    document.querySelector("[data-inbox-title]")?.focus();
  });
  document.querySelector("[data-inbox-reset]").addEventListener("click", resetInboxForm);
  document.querySelector("[data-inbox-save]").addEventListener("click", () => guarded(saveInboxItem));
  document.querySelector("[data-inbox-refresh]").addEventListener("click", () => guarded(loadInbox));
  document.querySelector("[data-inbox-organizer-close]").addEventListener("click", () => {
    document.querySelector("[data-inbox-organizer]").hidden = true;
  });
  document.querySelector("[data-inbox-target-type]").addEventListener("change", updateInboxOrganizerMode);
  document.querySelector("[data-inbox-target-title]").addEventListener("input", (event) => {
    const slug = document.querySelector("[data-inbox-target-slug]");
    if (!slug.dataset.touched) slug.value = slugify(event.target.value);
  });
  document.querySelector("[data-inbox-target-slug]").addEventListener("input", (event) => {
    event.target.dataset.touched = event.target.value ? "true" : "";
  });
  document.querySelector("[data-inbox-target-search]").addEventListener("input", (event) => {
    filterRelationChoices("[data-inbox-target-columns]", event.target.value);
    filterRelationChoices("[data-inbox-target-nodes]", event.target.value);
  });
  document.querySelector("[data-inbox-target-columns]").addEventListener("change", () => {
    const selected = new Set([...document.querySelectorAll("[data-inbox-target-columns] input:checked")].map((input) => input.value));
    const primary = document.querySelector("[data-inbox-target-primary-column]");
    [...primary.options].forEach((option) => { option.hidden = option.value && !selected.has(option.value); });
    if (primary.value && !selected.has(primary.value)) primary.value = "";
  });
  document.querySelector("[data-inbox-organize-submit]").addEventListener("click", () => guarded(promoteInboxItem));
  document.querySelector("[data-inbox-list]").addEventListener("click", (event) => {
    const open = event.target.closest("[data-inbox-open]");
    if (open) {
      activeInboxItem = inboxItems.find((item) => String(item.id) === open.dataset.inboxOpen) || null;
      if (!activeInboxItem) return;
      document.querySelector("[data-inbox-form-title]").textContent = "编辑记录";
      document.querySelector("[data-inbox-title]").value = activeInboxItem.title || "";
      document.querySelector("[data-inbox-body]").value = activeInboxItem.body || "";
      document.querySelector("[data-inbox-type]").value = activeInboxItem.item_type || "note";
      document.querySelector("[data-inbox-url]").value = activeInboxItem.source_url || "";
      renderInbox();
      return;
    }
    const organize = event.target.closest("[data-inbox-organize]");
    if (organize) openInboxOrganizer(organize.dataset.inboxOrganize);
    const trash = event.target.closest("[data-inbox-trash]");
    if (trash) guarded(() => trashInboxItem(trash.dataset.inboxTrash));
  });
  document.querySelector("[data-review-refresh]").addEventListener("click", () => guarded(loadReviewDashboard));
  document.querySelector("[data-review-search-submit]").addEventListener("click", () => guarded(searchReviewWorkspace));
  document.querySelector("[data-review-search]").addEventListener("keydown", (event) => {
    if (event.key === "Enter") guarded(searchReviewWorkspace);
  });
  document.querySelector("[data-review-search-type]").addEventListener("change", () => {
    if (document.querySelector("[data-review-search]").value.trim()) guarded(searchReviewWorkspace);
  });
  document.querySelector("[data-review-select-all]").addEventListener("change", (event) => {
    document.querySelectorAll("[data-review-select]").forEach((input) => { input.checked = event.target.checked; });
    updateReviewSelectedCount();
  });
  document.querySelector(".review-workspace-panel").addEventListener("change", (event) => {
    if (event.target.matches("[data-review-select]")) updateReviewSelectedCount();
  });
  document.querySelector(".review-workspace-panel").addEventListener("click", (event) => {
    const batchAction = event.target.closest("[data-review-batch-action]");
    if (batchAction) {
      guarded(() => batchReviewEntities(batchAction.dataset.reviewBatchAction));
      return;
    }
    const quickQueue = event.target.closest("[data-review-quick-queue]");
    if (quickQueue) {
      const [entityType, entityId] = quickQueue.dataset.reviewQuickQueue.split(":");
      guarded(() => updateReviewEntity("queue", entityType, entityId, 7));
      return;
    }
    const edit = event.target.closest("[data-review-edit]");
    if (edit) {
      const editor = document.querySelector(`[data-review-editor="${edit.dataset.reviewEdit}"]`);
      if (editor) editor.hidden = !editor.hidden;
      return;
    }
    const customAction = event.target.closest("[data-review-custom-action]");
    if (customAction) {
      const [action, entityType, entityId] = customAction.dataset.reviewCustomAction.split(":");
      const editor = customAction.closest("[data-review-editor]");
      const days = editor?.querySelector("[data-review-editor-days]")?.value || 7;
      const note = editor?.querySelector("[data-review-editor-note]")?.value.trim() || "";
      guarded(() => updateReviewEntity(action, entityType, entityId, days, note));
      return;
    }
    const open = event.target.closest("[data-review-open]");
    if (open) {
      const [entityType, entityId] = open.dataset.reviewOpen.split(":");
      guarded(() => openWorkspaceEntity(entityType, entityId));
      return;
    }
    const actionButton = event.target.closest("[data-review-action]");
    if (actionButton) {
      const [action, entityType, entityId, intervalDays] = actionButton.dataset.reviewAction.split(":");
      guarded(() => updateReviewEntity(action, entityType, entityId, intervalDays));
    }
  });
  document.querySelector("[data-maintenance-refresh]").addEventListener("click", () => guarded(loadMaintenanceDashboard));
  document.querySelector("[data-maintenance-days]").addEventListener("change", () => guarded(loadMaintenanceDashboard));
  document.querySelector("[data-maintenance-priority]").addEventListener("change", renderMaintenanceTasks);
  document.querySelector("[data-maintenance-category]").addEventListener("change", renderMaintenanceTasks);
  document.querySelector("[data-maintenance-ai-run]").addEventListener("click", () => guarded(runInboxOrganizationSuggestion));
  document.querySelector("[data-ai-workflow-refresh]").addEventListener("click", () => guarded(loadAiWorkflowDashboard));
  document.querySelector("[data-ai-workflow-local]").addEventListener("click", () => guarded(() => runBatchInboxSuggestions("local")));
  document.querySelector("[data-ai-workflow-auto]").addEventListener("click", () => guarded(() => runBatchInboxSuggestions("auto")));
  document.querySelector("[data-maintenance-copy]").addEventListener("click", () => guarded(async () => {
    const text = maintenanceReportText();
    if (!text) throw new Error("周报尚未加载");
    await navigator.clipboard.writeText(text);
    showToast("周报已复制");
  }));
  document.querySelector(".maintenance-workspace-panel").addEventListener("click", (event) => {
    const task = event.target.closest("[data-maintenance-task]");
    if (task) {
      guarded(() => handleMaintenanceTask(task.dataset.maintenanceTask));
      return;
    }
    const opportunity = event.target.closest("[data-maintenance-opportunity]");
    if (opportunity) {
      guarded(() => handleKnowledgeOpportunity(opportunity.dataset.maintenanceOpportunity));
      return;
    }
    const adopt = event.target.closest("[data-ai-workflow-adopt]");
    if (adopt) {
      guarded(() => adoptAiWorkflowSuggestion(adopt.dataset.aiWorkflowAdopt));
      return;
    }
    const reject = event.target.closest("[data-ai-workflow-reject]");
    if (reject) {
      guarded(() => rejectAiWorkflowSuggestion(reject.dataset.aiWorkflowReject));
      return;
    }
    if (event.target.closest("[data-maintenance-ai-apply]")) guarded(applyInboxOrganizationSuggestion);
  });
  document.querySelector("[data-organization-refresh]").addEventListener("click", () => guarded(loadOrganization));
  document.querySelector("[data-organization-search]").addEventListener("input", renderOrganization);
  document.querySelector("[data-organization-type]").addEventListener("change", renderOrganization);
  document.querySelector("[data-organization-orphans]").addEventListener("change", renderOrganization);
  document.querySelector("[data-organization-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-organization-entity]");
    if (button) guarded(() => selectOrganizationEntity(button.dataset.organizationEntity));
  });
  document.querySelector("[data-organization-detail]").addEventListener("click", (event) => {
    if (event.target.closest("[data-organization-open-editor]")) guarded(openOrganizationEditor);
  });
  document.querySelector("[data-activity-refresh]").addEventListener("click", () => guarded(loadActivity));
  document.querySelector("[data-trash-refresh]").addEventListener("click", () => guarded(loadTrash));
  document.querySelector("[data-trash-list]").addEventListener("click", (event) => {
    const restore = event.target.closest("[data-trash-restore]");
    if (restore) guarded(() => restoreTrashItem(restore.dataset.trashRestore));
  });
  document.querySelector("[data-cms-push]").addEventListener("click", () => guarded(async () => {
    await pushToCms();
    await loadEntries();
  }));
  document.querySelector("[data-cms-pull]").addEventListener("click", () => guarded(pullFromCms));
  document.querySelector("[data-health-refresh]").addEventListener("click", () => {
    renderHealthDashboard();
    showToast("内容健康度已刷新");
  });
  document.querySelector("[data-ai-runs-refresh]").addEventListener("click", () => guarded(loadAiRuns));
  document.querySelector("[data-agent-runs-refresh]").addEventListener("click", () => guarded(loadAgentRuns));
  document.querySelector("[data-agent-evaluate]").addEventListener("click", () => guarded(evaluateAgentSuite));
  document.querySelector("[data-eval-refresh]").addEventListener("click", () => guarded(loadEvaluationDashboard));
  document.querySelector("[data-eval-new]").addEventListener("click", () => setEvalSuiteForm(emptyEvalSuite()));
  document.querySelector("[data-eval-save]").addEventListener("click", () => guarded(saveEvalSuite));
  document.querySelector("[data-eval-run-local]").addEventListener("click", () => guarded(() => runEvaluationSuite("local")));
  document.querySelector("[data-eval-run-auto]").addEventListener("click", () => guarded(() => runEvaluationSuite("auto")));
  document.querySelector("[data-eval-name]").addEventListener("input", (event) => {
    if (!activeEvalSuite?.id && !document.querySelector("[data-eval-slug]").value.trim()) document.querySelector("[data-eval-slug]").value = slugify(event.target.value);
  });
  document.querySelector("[data-eval-suite-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-eval-suite-id]");
    if (!button) return;
    setEvalSuiteForm(evaluationDashboard?.suites?.find((suite) => String(suite.id) === button.dataset.evalSuiteId) || emptyEvalSuite());
  });
  document.querySelector("[data-eval-history]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-eval-run-id]");
    if (button) guarded(() => loadEvaluationRun(button.dataset.evalRunId));
  });
  document.querySelector("[data-eval-run-detail]").addEventListener("click", (event) => {
    if (event.target.closest("[data-eval-detail-close]")) event.currentTarget.hidden = true;
  });
  document.querySelector("[data-rag-index-refresh]").addEventListener("click", () => guarded(loadRagIndex));
  document.querySelector("[data-rag-index-rebuild]").addEventListener("click", () => guarded(rebuildRagIndex));
  document.querySelector("[data-rag-evaluate]").addEventListener("click", () => guarded(evaluateRagIndex));
  document.querySelector("[data-document-refresh]").addEventListener("click", () => guarded(loadDocuments));
  document.querySelector("[data-document-upload-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    guarded(uploadDocument);
  });
  document.querySelector("[data-document-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-document-id]");
    if (button) guarded(() => selectDocument(button.dataset.documentId));
  });
  document.querySelector("[data-document-editor]").addEventListener("click", (event) => {
    const chunkButton = event.target.closest("[data-document-chunk-save]");
    if (chunkButton) {
      guarded(() => saveDocumentChunk(chunkButton.dataset.documentChunkSave));
      return;
    }
    const restoreButton = event.target.closest("[data-document-version-restore]");
    if (restoreButton) {
      guarded(() => restoreDocumentVersion(restoreButton.dataset.documentVersionRestore));
      return;
    }
    const diffButton = event.target.closest("[data-document-version-diff]");
    if (diffButton) {
      guarded(() => loadDocumentVersionDiff(diffButton.dataset.documentVersionDiff));
      return;
    }
    if (event.target.closest("[data-document-save]")) guarded(saveDocument);
    else if (event.target.closest("[data-document-toggle]")) guarded(toggleDocument);
    else if (event.target.closest("[data-document-rechunk]")) guarded(rechunkDocument);
    else if (event.target.closest("[data-document-versions]")) guarded(loadDocumentVersions);
    else if (event.target.closest("[data-document-delete]")) guarded(deleteDocument);
  });
  document.querySelector("[data-document-editor]").addEventListener("input", (event) => {
    if (event.target.matches("[data-document-link-search]")) {
      filterRelationChoices("[data-document-nodes]", event.target.value);
      return;
    }
    if (!event.target.closest("[data-document-chunk]")) scheduleDocumentAutosave();
  });
  document.querySelector("[data-document-editor]").addEventListener("change", (event) => {
    if (!event.target.closest("[data-document-chunk]") && !event.target.matches("[data-document-link-search]")) scheduleDocumentAutosave();
  });
  document.querySelector("[data-ai-feedback-refresh]").addEventListener("click", () => guarded(loadAiFeedback));
  document.querySelector("[data-proactive-refresh]").addEventListener("click", () => guarded(() => loadProactiveDashboard(true)));
  document.querySelector("[data-memory-form]").addEventListener("submit", (event) => guarded(() => createLongTermMemory(event)));
  document.querySelector("[data-proactive-tasks]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-proactive-task]");
    if (button) guarded(() => updateProactiveTask(button.dataset.proactiveTask));
  });
  document.querySelector("[data-memory-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-memory-action]");
    if (button) guarded(() => updateLongTermMemory(button.dataset.memoryAction));
  });
  document.querySelector("[data-content-ops-refresh]").addEventListener("click", () => guarded(loadContentOps));
  document.querySelector("[data-search-analytics-refresh]").addEventListener("click", () => guarded(loadSearchAnalytics));
  document.querySelector("[data-content-gaps-refresh]").addEventListener("click", () => guarded(loadContentGaps));
  document.querySelector("[data-relation-health-refresh]").addEventListener("click", () => guarded(loadRelationHealth));
  document.querySelector("[data-publish-workflow-refresh]").addEventListener("click", () => guarded(loadPublishWorkflow));
  document.querySelector("[data-column-new]").addEventListener("click", () => {
    setColumnForm(emptyKnowledgeColumn());
    renderColumnList();
  });
  document.querySelector("[data-column-save]").addEventListener("click", () => guarded(saveKnowledgeColumn));
  document.querySelector("[data-column-delete]").addEventListener("click", () => guarded(deleteKnowledgeColumn));
  document.querySelector("[data-column-name]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-column-slug]");
    if (!activeKnowledgeColumn?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-column-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-column-id]");
    if (!button) return;
    activeKnowledgeColumn = knowledgeColumns.find((column) => String(column.id) === button.dataset.columnId);
    setColumnForm(activeKnowledgeColumn);
    renderColumnList();
  });
  document.querySelector("[data-node-new]").addEventListener("click", () => {
    setKnowledgeNodeForm(emptyKnowledgeNode());
    renderKnowledgeNodeList();
  });
  document.querySelector("[data-node-refresh]").addEventListener("click", () => guarded(loadKnowledgeGraphData));
  document.querySelector("[data-node-save]").addEventListener("click", () => guarded(saveKnowledgeNode));
  document.querySelector("[data-node-enhancement-local]").addEventListener("click", () => guarded(() => suggestContentEnhancement("node", "local")));
  document.querySelector("[data-node-enhancement-auto]").addEventListener("click", () => guarded(() => suggestContentEnhancement("node", "auto")));
  document.querySelector("[data-node-enhancement-result]").addEventListener("click", (event) => {
    if (event.target.closest("[data-node-enhancement-apply]")) guarded(() => applyContentEnhancement("node"));
  });
  document.querySelector("[data-node-delete]").addEventListener("click", () => guarded(deleteKnowledgeNode));
  document.querySelector("[data-node-title]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-node-slug]");
    if (!activeKnowledgeNode?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-node-link-search]").addEventListener("input", (event) => {
    filterRelationChoices("[data-node-columns]", event.target.value);
    filterRelationChoices("[data-node-articles]", event.target.value);
  });
  document.querySelector("[data-node-columns]").addEventListener("change", () => {
    const draft = { ...readKnowledgeNodeForm(), id: activeKnowledgeNode?.id, revision: activeKnowledgeNode?.revision };
    renderKnowledgeNodeLinks(draft);
  });
  document.querySelector("[data-node-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-id]");
    if (!button) return;
    setKnowledgeNodeForm(knowledgeNodes.find((node) => String(node.id) === button.dataset.nodeId));
    renderKnowledgeNodeList();
    guarded(loadKnowledgeNodeVersions);
  });
  document.querySelector("[data-node-version-list]").addEventListener("click", (event) => {
    const diffButton = event.target.closest("[data-node-version-diff]");
    if (diffButton) {
      guarded(() => loadKnowledgeNodeVersionDiff(diffButton.dataset.nodeVersionDiff));
      return;
    }
    const button = event.target.closest("[data-node-version-restore]");
    if (button) guarded(() => restoreKnowledgeNodeVersion(button.dataset.nodeVersionRestore));
  });
  const nodeForm = document.querySelector(".node-form");
  nodeForm.addEventListener("input", (event) => {
    if (!event.target.matches("[data-node-link-search]")) scheduleKnowledgeNodeAutosave();
  });
  nodeForm.addEventListener("change", scheduleKnowledgeNodeAutosave);
  document.querySelector("[data-node-relation-new]").addEventListener("click", () => {
    setKnowledgeRelationForm(emptyKnowledgeRelation());
    renderKnowledgeRelationList();
  });
  document.querySelector("[data-node-relation-save]").addEventListener("click", () => guarded(saveKnowledgeRelation));
  document.querySelector("[data-node-relation-delete]").addEventListener("click", () => guarded(deleteKnowledgeRelation));
  document.querySelector("[data-node-relation-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node-relation-id]");
    if (!button) return;
    setKnowledgeRelationForm(knowledgeRelations.find((relation) => String(relation.id) === button.dataset.nodeRelationId));
    renderKnowledgeRelationList();
  });

  document.querySelectorAll("[data-entity-tab]").forEach((button) => {
    button.addEventListener("click", () => guarded(async () => {
      await performAutosave();
      activeEntityType = button.dataset.entityTab;
      document.querySelectorAll("[data-entity-tab]").forEach((current) => current.classList.toggle("is-active", current === button));
      await loadEntries();
    }));
  });

  document.querySelector("[data-entry-new]").addEventListener("click", () => guarded(async () => {
    await performAutosave();
    setEntryForm(defaultEntry(activeEntityType));
    renderEntryList();
    setCmsWorkspaceMode("editor");
  }));
  document.querySelector("[data-entry-refresh]").addEventListener("click", () => guarded(loadEntries));
  document.querySelector("[data-entry-save]").addEventListener("click", () => guarded(() => saveEntry()));
  document.querySelector("[data-entry-enhancement-local]").addEventListener("click", () => guarded(() => suggestContentEnhancement("entry", "local")));
  document.querySelector("[data-entry-enhancement-auto]").addEventListener("click", () => guarded(() => suggestContentEnhancement("entry", "auto")));
  document.querySelector("[data-entry-enhancement-result]").addEventListener("click", (event) => {
    if (event.target.closest("[data-entry-enhancement-apply]")) guarded(() => applyContentEnhancement("entry"));
  });
  document.querySelector("[data-entry-publish]").addEventListener("click", () => guarded(publishEntry));
  document.querySelector("[data-entry-archive]").addEventListener("click", () => guarded(archiveEntry));
  document.querySelector("[data-entry-delete]").addEventListener("click", () => guarded(deleteEntry));
  document.querySelector("[data-entry-versions]").addEventListener("click", () => guarded(loadVersions));
  document.querySelector("[data-asset-upload]").addEventListener("click", () => guarded(uploadAsset));
  document.querySelector("[data-relation-refresh]").addEventListener("click", () => guarded(loadRelationSuggestions));
  document.querySelector("[data-relation-apply-all]").addEventListener("click", applyAllRelationSuggestions);
  document.querySelector("[data-entry-content]").addEventListener("input", renderMarkdownPreview);
  [
    "[data-entry-keywords]",
    "[data-entry-related]",
    "[data-entry-seo-title]",
    "[data-entry-seo-description]",
    "[data-entry-canonical]",
    "[data-entry-cover]",
    "[data-entry-column-cover]",
    "[data-entry-column-description]",
    "[data-entry-body-font-size]",
    "[data-entry-related-knowledge]",
    "[data-entry-related-reading]",
    "[data-entry-related-posts]",
    "[data-entry-note-links]",
    "[data-entry-notes-json]",
  ].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", syncMetadataPreviewFromFields);
  });
  document.querySelector("[data-entry-title]").addEventListener("input", (event) => {
    const slugInput = document.querySelector("[data-entry-slug]");
    if (!activeEntry?.id && !slugInput.value.trim()) slugInput.value = slugify(event.target.value);
  });
  document.querySelector("[data-entry-columns]").addEventListener("change", syncMetadataPreviewFromFields);
  document.querySelector("[data-entry-primary-column]").addEventListener("change", syncMetadataPreviewFromFields);

  const entryEditor = document.querySelector("[data-entry-editor]");
  entryEditor.addEventListener("input", scheduleEntryAutosave);
  entryEditor.addEventListener("change", scheduleEntryAutosave);

  document.querySelector("[data-entry-list]").addEventListener("click", (event) => guarded(async () => {
    const button = event.target.closest("[data-entry-id]");
    if (!button) return;
    await performAutosave();
    activeEntry = cmsEntries.find((entry) => String(entry.id) === button.dataset.entryId);
    setEntryForm(activeEntry);
    renderEntryList();
    await loadEntryDraft(activeEntry);
    await loadVersions();
    setCmsWorkspaceMode("editor");
  }));
  document.querySelector("[data-cms-editor-back]")?.addEventListener("click", () => guarded(async () => {
    await performAutosave();
    setCmsWorkspaceMode("list");
  }));

  document.querySelector("[data-ai-run-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-run-id]");
    if (!button) return;
    activeAiRun = aiRuns.find((run) => String(run.id) === button.dataset.aiRunId);
    renderAiRunList();
    renderAiRunDetail();
  });

  document.querySelector("[data-agent-run-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-agent-run-id]");
    if (!button) return;
    activeAgentRun = agentRuns.find((run) => String(run.id) === button.dataset.agentRunId);
    renderAgentRunList();
    renderAgentRunDetail();
  });

  document.querySelector("[data-content-gap-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-gap-draft]");
    if (!button) return;
    guarded(() => createGapDraft(button.dataset.gapDraft, button.dataset.gapType));
  });

  document.querySelector("[data-ai-feedback-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-feedback-draft]");
    if (!button) return;
    guarded(() => createAiFeedbackDraft(button.dataset.aiFeedbackDraft, button.dataset.aiFeedbackType));
  });

  document.querySelector("[data-content-ops-board]").addEventListener("click", (event) => {
    const stateButton = event.target.closest("[data-content-ops-state]");
    if (stateButton) {
      guarded(() => setContentOpsTaskState(stateButton.dataset.contentOpsState, stateButton.dataset.contentOpsStatus));
      return;
    }
    const button = event.target.closest("[data-content-ops-task]");
    if (!button) return;
    guarded(() => handleContentOpsTask(button.dataset.contentOpsTask));
  });

  document.querySelector("[data-relation-health-list]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-relation-fix]");
    if (!button) return;
    guarded(() => fixRelationIssue(button.dataset.relationFix));
  });

  document.querySelector("[data-publish-board]").addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-workflow-open]");
    if (openButton) {
      guarded(() => openWorkflowEntry(openButton.dataset.workflowOpen, openButton.dataset.workflowType));
      return;
    }
    const publishButton = event.target.closest("[data-workflow-publish]");
    if (publishButton) {
      guarded(() => publishWorkflowEntry(publishButton.dataset.workflowPublish, publishButton.dataset.workflowType));
    }
  });

  document.querySelector("[data-auto-relation-results]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-relation-item]");
    if (!button) return;
    const item = relationItemsByType(button.dataset.relationType).find((current) => String(current.id) === button.dataset.relationItem);
    if (!item) return;
    applyRelationItems(button.dataset.relationType, [item]);
    showToast(`已关联：${item.title}`);
  });

  document.querySelector("[data-version-list]").addEventListener("click", (event) => {
    const diffButton = event.target.closest("[data-version-diff]");
    if (diffButton) {
      guarded(() => loadVersionDiff(diffButton.dataset.versionDiff));
      return;
    }
    const button = event.target.closest("[data-version-restore]");
    if (!button) return;
    guarded(() => restoreVersion(button.dataset.versionRestore));
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (activeAdminRoute === "knowledge-nodes") guarded(saveKnowledgeNode);
      else if (activeAdminRoute === "documents") guarded(saveDocument);
      else guarded(() => saveEntry());
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (!autosaveDirty && !autosaveInFlight && !nodeAutosaveDirty && !nodeAutosaveInFlight && !documentAutosaveDirty && !documentAutosaveInFlight) return;
    event.preventDefault();
    event.returnValue = "";
  });

  setEntryForm(defaultEntry(activeEntityType));
  setColumnForm(emptyKnowledgeColumn());
  setKnowledgeNodeForm(emptyKnowledgeNode());
  setKnowledgeRelationForm(emptyKnowledgeRelation());
  try {
    await loadCurrentAccount();
    cmsToken = "cookie";
  } catch (error) {
    if (error?.status !== 401) console.warn("Unable to restore CMS session", error);
  }
  if (cmsToken) {
    guarded(async () => {
      await loadKnowledgeColumns();
      await loadKnowledgeGraphData();
      await loadDocuments();
      await loadEntries();
      await loadWorkspaceOverview();
      await loadInbox();
      await loadActivity();
      await loadMaintenanceDashboard();
    });
    guarded(loadAiRuns);
    guarded(loadAgentRuns);
    guarded(loadEvaluationDashboard);
    guarded(loadRagIndex);
    guarded(loadAiFeedback);
    guarded(() => loadProactiveDashboard(false));
    guarded(loadContentOps);
    guarded(loadSearchAnalytics);
    guarded(loadContentGaps);
    guarded(loadRelationHealth);
    guarded(loadPublishWorkflow);
  }
  await navigateAdminRoute(window.location.hash.slice(1) || "dashboard", { updateHash: false });
}

init();
