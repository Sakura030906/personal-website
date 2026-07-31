function scoreEntry(entry, query) {
  const text = entry.text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery
    .split(/[\s,，。?？/、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  let score = text.includes(normalizedQuery) ? 8 : 0;
  tokens.forEach((token) => {
    if (text.includes(token)) score += 2;
  });
  return score;
}

function renderAgentTask(task) {
  const statusTarget = document.querySelector("[data-agent-status]");
  const planTarget = document.querySelector("[data-agent-plan]");
  const resultTarget = document.querySelector("[data-agent-result]");
  if (!statusTarget || !planTarget || !resultTarget) return;

  statusTarget.textContent = `Task #${task.id} · ${task.status} · ${task.planner || "local"} planner · ${task.tool_calls || 0} tool calls`;
  const running = ["pending", "queued", "running", "cancel_requested"].includes(task.status);
  const awaitingConfirmation = task.status === "awaiting_confirmation";
  const runButton = document.querySelector("[data-agent-run]");
  const cancelButton = document.querySelector("[data-agent-cancel]");
  const retryButton = document.querySelector("[data-agent-retry]");
  const approveButton = document.querySelector("[data-agent-approve]");
  const denyButton = document.querySelector("[data-agent-deny]");
  if (runButton) {
    runButton.disabled = running || awaitingConfirmation;
    runButton.hidden = running || awaitingConfirmation;
  }
  if (cancelButton) cancelButton.hidden = !(running || awaitingConfirmation);
  if (retryButton) retryButton.hidden = !["failed", "cancelled"].includes(task.status);
  if (approveButton) approveButton.hidden = !awaitingConfirmation;
  if (denyButton) denyButton.hidden = !awaitingConfirmation;
  const steps = (task.steps || []).length
    ? task.steps
    : (task.plan || []).map((step, index) => ({
        step_index: index,
        tool_name: step.tool,
        status: "planned",
        input: step.input || {},
        duration_ms: 0,
        reason: step.reason,
      }));
  planTarget.innerHTML = steps
    .map(
      (step) => `
        <article class="agent-runtime-step ${step.status === "failed" ? "is-failed" : ""}">
          <span>Step ${escapeHtml(Number(step.step_index) + 1)} · ${escapeHtml(step.status)} · ${escapeHtml(step.planner || "preview")}</span>
          <strong>${escapeHtml(step.tool_name)}</strong>
          <small>${escapeHtml(step.reason || JSON.stringify(step.input || {}))}</small>
          ${step.duration_ms ? `<small>${escapeHtml(step.duration_ms)}ms</small>` : ""}
          ${step.error ? `<p>${escapeHtml(step.error)}</p>` : ""}
        </article>
      `,
    )
    .join("");

  const result = task.result || {};
  const sources = result.sources || [];
  const grounding = result.grounding || {};
  resultTarget.innerHTML = ["completed", "cancelled"].includes(task.status)
    ? `
        <strong>Result</strong>
        <div class="agent-result-metrics">
          <span>${escapeHtml(result.generator || "local-agent")}</span>
          <span>Quality ${escapeHtml(result.quality_score ?? 0)}</span>
          <span>${escapeHtml(grounding.status || "unknown")}</span>
          <span>Support ${escapeHtml(Math.round((Number(grounding.support_score) || 0) * 100))}%</span>
          <span>${escapeHtml(result.latency_ms || 0)}ms</span>
        </div>
        <p class="agent-result-answer">${escapeHtml(result.answer || "任务已完成。").replace(/\n/g, "<br>")}</p>
        ${sources.length
          ? `<div class="source-list">${sources.map((source, index) => `<div><span>[${index + 1}] ${escapeHtml(source.entity_type || "content")}</span><strong><a href="${escapeHtml(source.url || "#")}">${escapeHtml(source.title || source.slug)}</a></strong><p>${escapeHtml(source.summary || source.context || "")}</p></div>`).join("")}</div>`
          : ""}
      `
    : task.status === "failed"
      ? `<strong>执行失败</strong><p>${escapeHtml(task.error || "未知错误")}</p>`
      : task.status === "awaiting_confirmation"
        ? `<strong>等待人工确认</strong><p>${escapeHtml(task.pending_confirmation?.reason || "下一步工具调用需要确认。")}</p><small>${escapeHtml(task.pending_confirmation?.tool || "")}</small>`
      : `<p>计划已创建，准备执行。</p>`;
}

function agentTaskUrl(taskId, action = "") {
  const suffix = action ? `/${action}` : "";
  return `${agentApiUrl}/tasks/${taskId}${suffix}?session_id=${encodeURIComponent(aiSessionId)}`;
}

function stopAgentPolling() {
  if (agentPollTimer) window.clearTimeout(agentPollTimer);
  agentPollTimer = null;
}

async function pollAgentTask(taskId) {
  stopAgentPolling();
  try {
    const response = await fetch(agentTaskUrl(taskId), { credentials: "include" });
    if (!response.ok) throw new Error(`Agent status failed: ${response.status}`);
    const task = await response.json();
    renderAgentTask(task);
    if (["pending", "queued", "running", "cancel_requested"].includes(task.status)) {
      agentPollTimer = window.setTimeout(() => pollAgentTask(taskId), 400);
    }
  } catch (error) {
    const statusTarget = document.querySelector("[data-agent-status]");
    if (statusTarget) statusTarget.textContent = error instanceof Error ? error.message : "任务状态读取失败";
  }
}

async function invokeAgentAction(action, body) {
  if (!activeAgentTaskId) return null;
  const response = await fetch(agentTaskUrl(activeAgentTaskId, action), {
    method: "POST",
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`Agent ${action} failed: ${response.status}`);
  const task = await response.json();
  renderAgentTask(task);
  return task;
}

async function runAgentTask() {
  const goalInput = document.querySelector("[data-agent-goal]");
  const button = document.querySelector("[data-agent-run]");
  const statusTarget = document.querySelector("[data-agent-status]");
  const goal = goalInput?.value.trim() || "";
  if (!goal) {
    if (statusTarget) statusTarget.textContent = "请先输入任务目标";
    return;
  }

  stopAgentPolling();
  activeAgentTaskId = null;
  button.disabled = true;
  if (statusTarget) statusTarget.textContent = "正在创建只读执行计划...";
  try {
    const createResponse = await fetch(`${agentApiUrl}/tasks`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, session_id: aiSessionId, max_steps: 6 }),
    });
    if (!createResponse.ok) throw new Error(`Agent create failed: ${createResponse.status}`);
    const created = await createResponse.json();
    renderAgentTask(created);
    activeAgentTaskId = created.id;
    if (statusTarget) statusTarget.textContent = `Task #${created.id} · 正在进入执行队列...`;
    await invokeAgentAction("start");
    await pollAgentTask(created.id);
  } catch (error) {
    if (statusTarget) statusTarget.textContent = "FastAPI Agent Runtime 未连接";
    document.querySelector("[data-agent-result]").innerHTML = `<p>${escapeHtml(error instanceof Error ? error.message : "Agent 执行失败")}</p>`;
  } finally {
    if (!activeAgentTaskId) button.disabled = false;
  }
}

async function cancelAgentTask() {
  try {
    await invokeAgentAction("cancel");
    await pollAgentTask(activeAgentTaskId);
  } catch (error) {
    document.querySelector("[data-agent-status]").textContent = error instanceof Error ? error.message : "取消失败";
  }
}

async function retryAgentTask() {
  try {
    await invokeAgentAction("retry");
    await pollAgentTask(activeAgentTaskId);
  } catch (error) {
    document.querySelector("[data-agent-status]").textContent = error instanceof Error ? error.message : "重试失败";
  }
}

async function confirmAgentTask(approved) {
  try {
    const task = await invokeAgentAction("confirm", { approved });
    if (task && approved) await pollAgentTask(activeAgentTaskId);
  } catch (error) {
    document.querySelector("[data-agent-status]").textContent = error instanceof Error ? error.message : "确认失败";
  }
}

async function answerStaticQuestion(content) {
  const query = document.querySelector("[data-ai-question]").value.trim();
  const target = document.querySelector("[data-ai-answer]");
  const traceTarget = document.querySelector("[data-ai-trace]");
  const examples = content.aiShowcase?.examples || [];

  if (!query) {
    target.innerHTML = "<p>先输入一个问题，例如：EduRAG 准备用哪些技术？</p>";
    if (traceTarget) traceTarget.innerHTML = renderTrace(["等待问题", "准备检索站内内容", "返回引用来源"], "idle");
    return;
  }

  const startedAt = performance.now();
  if (traceTarget) {
    traceTarget.innerHTML = renderTrace(["发送问题到 FastAPI", "等待 RAG 检索", "生成回答"], "idle");
  }
  target.innerHTML = "<p>正在检索站内内容...</p>";
  const scope = readAiRetrievalScope();

  try {
    const response = await fetch(aiApiUrl, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: query, limit: 5, session_id: aiSessionId, scope }),
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const result = await response.json();
    const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
    const sources = result.sources || [];
    const grounding = result.grounding || {};

    if (traceTarget) {
      traceTarget.innerHTML = renderTrace(result.trace || ["FastAPI RAG", "Vector Search", "Answer"]);
    }

    target.innerHTML = `
      <strong>Answer</strong>
      <p>${escapeHtml(result.answer || "")}</p>
      ${renderCitationQuality(sources)}
      <div class="run-metrics">
        <span>Grounding <strong>${escapeHtml(grounding.status || "-")}</strong></span>
        <span>Evidence <strong>${Math.round((Number(grounding.confidence) || 0) * 100)}%</strong></span>
        <span>Claim Support <strong>${Math.round((Number(grounding.support_score) || 0) * 100)}%</strong></span>
        <span>Citations <strong>${Math.round((Number(grounding.citation_coverage) || 0) * 100)}%</strong></span>
      </div>
      ${renderSourceList(sources)}
      ${renderAiFeedbackControls(result.memory_id)}
      <details class="prompt-box">
        <summary>Prompt Context</summary>
        <pre>${escapeHtml(result.prompt_context || "")}</pre>
      </details>
      <div class="run-metrics">
        <span>Latency <strong>${escapeHtml(result.latency_ms || elapsed)}ms</strong></span>
        <span>Sources <strong>${sources.length}</strong></span>
        <span>Memory <strong>${result.memory_id || "-"}</strong></span>
        <span>Generator <strong>${escapeHtml(result.generator || "local")}</strong></span>
        <span>Scope <strong>${escapeHtml(activeAiScopeLabel())}</strong></span>
        <span>Quality <strong>${escapeHtml(result.quality_score ?? citationQuality(sources).score)}</strong></span>
      </div>
    `;
    await renderAiHistory();
    return;
  } catch {
    if (traceTarget) {
      traceTarget.innerHTML = renderTrace(["FastAPI 未连接", "退回静态检索", "返回本地结果"]);
    }
    if (Object.keys(scope).length) {
      target.innerHTML = `<p>“${escapeHtml(activeAiScopeLabel())}”范围检索需要连接 FastAPI。当前没有退回全站搜索，以免返回范围外内容。</p>`;
      return;
    }
  }

  const example = examples.find((item) => query.includes(item.question) || item.question.includes(query));
  const ranked = buildRagSources(content, query, 6);

  const answer = example
    ? example.answer
    : ranked.length
      ? buildLocalGroundedAnswer(query, ranked)
      : "当前静态内容里没有找到明显匹配项，并且 FastAPI 后端没有连接。";
  const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
  const promptPreview = buildPromptPreview(query, ranked);

  if (traceTarget) {
    traceTarget.innerHTML = renderTrace([
      "解析问题与关键词",
      "检索文章 / 项目 / 知识网络",
      `命中 ${ranked.length} 个站内上下文`,
      "生成带引用的静态回答",
    ]);
  }

  target.innerHTML = `
    <strong>Answer</strong>
    <p>${escapeHtml(answer)}</p>
    ${renderCitationQuality(ranked)}
    ${renderSourceList(ranked)}
    <details class="prompt-box">
      <summary>Prompt Context</summary>
      <pre>${escapeHtml(promptPreview)}</pre>
    </details>
    <div class="run-metrics">
      <span>Latency <strong>${elapsed}ms</strong></span>
      <span>Sources <strong>${ranked.length}</strong></span>
      <span>Token <strong>0</strong></span>
      <span>Cost <strong>¥0</strong></span>
    </div>
  `;
}

function buildPromptPreview(query, sources) {
  return [
    `Question: ${query}`,
    "",
    "Context:",
    ...sources.map((source, index) =>
      [
        `${index + 1}. [${sourceLabel(source)}] ${source.title}`,
        `Summary: ${source.summary || source.subtitle || ""}`,
        source.context ? `Graph Context: ${source.context}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
    "Instruction: 基于站内内容回答；如果证据不足，明确说明当前内容不足。",
  ].join("\n");
}

function resetDetailViews() {
  const pairs = [
    ["[data-posts]", "[data-post-article]"],
    ["[data-projects]", "[data-project-detail]"],
    ["[data-knowledge]", "[data-knowledge-detail]"],
  ];

  pairs.forEach(([listSelector, detailSelector]) => {
    const list = document.querySelector(listSelector);
    const detail = document.querySelector(detailSelector);
    if (list) list.hidden = false;
    if (detail) detail.hidden = true;
  });

  const postOverviewHead = document.querySelector("[data-post-overview-head]");
  const postColumns = document.querySelector("[data-post-columns]");
  const postColumnDetail = document.querySelector("[data-post-column-detail]");
  if (postOverviewHead) postOverviewHead.hidden = false;
  if (postColumns) postColumns.hidden = false;
  if (postColumnDetail) postColumnDetail.hidden = true;
  document.querySelector('[data-view="posts"]')?.classList.remove("is-article-detail");

  const knowledgeOverview = document.querySelector("[data-knowledge-overview]");
  const knowledgeColumnDetail = document.querySelector("[data-column-detail]");
  const knowledgeNodeDetail = document.querySelector("[data-node-detail]");
  const hiddenNormalizedNodes = document.querySelector("[data-normalized-knowledge-nodes]");
  if (knowledgeOverview) knowledgeOverview.hidden = false;
  if (knowledgeColumnDetail) knowledgeColumnDetail.hidden = true;
  if (knowledgeNodeDetail) knowledgeNodeDetail.hidden = true;
  if (hiddenNormalizedNodes) hiddenNormalizedNodes.hidden = true;
  document.querySelector(".knowledge-nav-root")?.classList.add("is-active");
  document.querySelectorAll("[data-knowledge-nav] a").forEach((link) => link.classList.remove("is-active"));
}

function setRoute(content) {
  const rawHash = window.location.hash.replace("#", "") || "home";
  let hash = rawHash;
  try {
    hash = decodeURIComponent(rawHash);
  } catch {
    hash = rawHash;
  }
  const isPostColumn = hash.startsWith("post-column-");
  const isPost = hash.startsWith("post-");
  const isProject = hash.startsWith("project-");
  const isKnowledge = hash.startsWith("knowledge-");
  const isColumn = hash.startsWith("column-");
  const isNode = hash.startsWith("node-");
  const requestedRoute = isPostColumn || isPost ? "posts" : isProject ? "projects" : isKnowledge || isColumn || isNode ? "knowledge" : hash;
  const route = document.querySelector(`[data-view="${requestedRoute}"]`) ? requestedRoute : "home";
  const activeRoute = ["building", "changelog"].includes(route) ? "now" : route;

  document.querySelectorAll("[data-route]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === activeRoute);
  });

  document.querySelectorAll("[data-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === route);
  });

  resetDetailViews();
  if ((content.knowledgeNodes || []).length) {
    const legacyKnowledge = document.querySelector("[data-knowledge]");
    if (legacyKnowledge) legacyKnowledge.hidden = true;
  }

  if (!isPost || isPostColumn) updateDefaultSeo(content);
  if (isPostColumn) renderPostColumn(content, hash.replace("post-column-", ""));
  else if (isPost) renderArticle(content, hash.replace("post-", ""));
  if (isProject) renderProjectDetail(content, hash.replace("project-", ""));
  if (isKnowledge) renderKnowledgeDetail(content, hash.replace("knowledge-", ""));
  if (isColumn) renderKnowledgeColumnDetail(content, hash.replace("column-", ""));
  if (isNode) renderKnowledgeNodeDetail(content, hash.replace("node-", ""));

  if (route === "graph") {
    window.requestAnimationFrame(() => {
      if ((content.knowledgeNodes || []).length) renderDatabaseKnowledgeGraph(content);
      else {
        const map = document.querySelector("[data-knowledge-map]");
        if (map) map.innerHTML = `<div class="empty-state"><strong>还没有公开图谱数据</strong><p>先在后台创建知识节点和显式关系。</p></div>`;
      }
    });
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function render(content) {
  appContent = content;
  renderProfile(content);
  renderSiteModules(content);
  renderProjects(content);
  renderPosts(content);
  renderKnowledge(content);
  renderKnowledgeColumns(content);
  renderNormalizedKnowledgeNodes(content);
  renderRoadmap(content);
  renderAbout(content);
  renderAi(content);
  renderStats(content);
  renderNow(content);
  renderBuilding(content);
  renderChangelog(content);
  renderPills("[data-tech-stack]", content.techStack || []);
  setupGlobalSearch(content);
  const yearTarget = document.querySelector("[data-year]");
  if (yearTarget) yearTarget.textContent = new Date().getFullYear();
  setRoute(content);
  window.addEventListener("hashchange", () => setRoute(content));
}

async function loadContent() {
  let localContent = fallbackContent;
  try {
    const response = await fetch(contentUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Content request failed: ${response.status}`);
    localContent = await response.json();
  } catch (error) {
    console.warn(error);
  }

  try {
    const response = await fetch(`${portfolioApiUrl}/content/site`, { cache: "no-store", signal: AbortSignal.timeout(1800) });
    if (!response.ok) throw new Error(`Site settings request failed: ${response.status}`);
    const serverContent = await response.json();
    if (serverContent && typeof serverContent === "object" && Object.keys(serverContent).length) {
      localContent = { ...localContent, ...serverContent };
    }
  } catch (error) {
    console.warn(error);
  }

  try {
    const response = await fetch(`${portfolioApiUrl}/content/public`, { cache: "no-store", signal: AbortSignal.timeout(1800) });
    if (!response.ok) throw new Error(`Public CMS request failed: ${response.status}`);
    const published = await response.json();
    return {
      ...localContent,
      posts: Array.isArray(published.posts) && published.posts.length ? published.posts : localContent.posts,
      projects: Array.isArray(published.projects) ? published.projects : localContent.projects,
      knowledgeBase: Array.isArray(published.knowledgeBase) && published.knowledgeBase.length ? published.knowledgeBase : localContent.knowledgeBase,
      knowledgeColumns: Array.isArray(published.knowledgeColumns) && published.knowledgeColumns.length ? published.knowledgeColumns : (localContent.knowledgeColumns || []),
      knowledgeNodes: Array.isArray(published.knowledgeNodes) && published.knowledgeNodes.length ? published.knowledgeNodes : (localContent.knowledgeNodes || []),
      knowledgeGraph: published.knowledgeGraph && typeof published.knowledgeGraph === "object" && Array.isArray(published.knowledgeGraph.nodes) && published.knowledgeGraph.nodes.length ? published.knowledgeGraph : (localContent.knowledgeGraph || { nodes: [], edges: [], stats: {} }),
    };
  } catch (error) {
    console.warn(error);
    return localContent;
  }
}

loadContent().then(render);
