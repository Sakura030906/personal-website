function aiScopeCatalogKey(type) {
  return { column: "columns", node: "nodes", article: "articles", document: "documents" }[type] || "";
}

function renderAiScopeValues() {
  const typeSelect = document.querySelector("[data-ai-scope-type]");
  const valueSelect = document.querySelector("[data-ai-scope-value]");
  const valueWrap = document.querySelector("[data-ai-scope-value-wrap]");
  const note = document.querySelector("[data-ai-scope-note]");
  if (!typeSelect || !valueSelect || !valueWrap || !note) return;
  const type = typeSelect.value;
  const key = aiScopeCatalogKey(type);
  const items = key ? aiScopeCatalog[key] || [] : [];
  valueWrap.hidden = type === "all";
  valueSelect.innerHTML = items.length
    ? items.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join("")
    : `<option value="">暂无可用内容</option>`;
  const savedValue = localStorage.getItem(`portfolio.ai.scope.${type}`) || "";
  if (savedValue && items.some((item) => String(item.id) === savedValue)) valueSelect.value = savedValue;
  const labels = { column: "专栏", node: "知识节点", article: "文章", document: "文档" };
  note.textContent = type === "all"
    ? "检索全部已公开且允许 AI 使用的内容。"
    : items.length
      ? `只检索与所选${labels[type]}直接关联的公开内容。`
      : `当前没有可用于 AI 检索的公开${labels[type]}。`;
}

async function loadAiScopeCatalog() {
  try {
    const response = await fetch(`${aiApiUrl.replace(/\/ask$/, "")}/scopes`, { cache: "no-store", credentials: "include" });
    if (!response.ok) throw new Error(`Scope request failed: ${response.status}`);
    aiScopeCatalog = await response.json();
  } catch {
    aiScopeCatalog = { columns: [], nodes: [], articles: [], documents: [] };
  }
  renderAiScopeValues();
}

function setupAiScopeSelector() {
  const typeSelect = document.querySelector("[data-ai-scope-type]");
  const valueSelect = document.querySelector("[data-ai-scope-value]");
  if (!typeSelect || !valueSelect) return;
  const savedType = localStorage.getItem("portfolio.ai.scope.type") || "all";
  if ([...typeSelect.options].some((option) => option.value === savedType)) typeSelect.value = savedType;
  typeSelect.onchange = () => {
    localStorage.setItem("portfolio.ai.scope.type", typeSelect.value);
    renderAiScopeValues();
  };
  valueSelect.onchange = () => {
    localStorage.setItem(`portfolio.ai.scope.${typeSelect.value}`, valueSelect.value);
  };
  renderAiScopeValues();
  loadAiScopeCatalog();
}

function readAiRetrievalScope() {
  const type = document.querySelector("[data-ai-scope-type]")?.value || "all";
  const id = Number(document.querySelector("[data-ai-scope-value]")?.value || 0);
  if (type === "all") return {};
  const selectedId = id || -1;
  if (type === "column") return { column_ids: [selectedId] };
  if (type === "node") return { node_ids: [selectedId] };
  if (type === "article") return { article_ids: [selectedId] };
  if (type === "document") return { entity_types: ["document"], document_ids: [selectedId] };
  return {};
}

function activeAiScopeLabel() {
  const type = document.querySelector("[data-ai-scope-type]")?.value || "all";
  if (type === "all") return "全部公开内容";
  const select = document.querySelector("[data-ai-scope-value]");
  return select?.selectedOptions?.[0]?.textContent || "未选择";
}

function activateAiLabPanel(panelName = "overview") {
  const validPanel = document.querySelector(`[data-lab-panel="${panelName}"]`) ? panelName : "overview";
  document.querySelectorAll("[data-lab-panel]").forEach((panel) => {
    const active = panel.dataset.labPanel === validPanel;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  document.querySelectorAll(".ai-lab-navigation [data-lab-open]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.labOpen === validPanel);
  });
  document.querySelector(".ai-lab-workspace")?.scrollTo?.({ top: 0, behavior: "smooth" });
}

function bindAiLabNavigation() {
  const labView = document.querySelector(".ai-lab-view");
  if (!labView) return;
  labView.onclick = (event) => {
    const opener = event.target.closest("[data-lab-open]");
    if (!opener) return;
    event.preventDefault();
    activateAiLabPanel(opener.dataset.labOpen);
  };
  const search = labView.querySelector("[data-lab-search]");
  if (search) {
    search.onkeydown = (event) => {
      if (event.key !== "Enter" || !search.value.trim()) return;
      activateAiLabPanel("rag");
      const question = document.querySelector("[data-ai-question]");
      if (question) {
        question.value = search.value.trim();
        question.focus();
      }
    };
  }
  activateAiLabPanel("overview");
}

function renderAiLabOverview(content, ai) {
  const searchableCount = flattenSearchContent(content).length;
  const nodes = content.knowledgeNodes || [];
  const graphEdges = content.knowledgeGraph?.edges || [];
  const columns = content.knowledgeColumns || [];
  const posts = (content.posts || []).filter((post) => post.status !== "draft");
  const history = aiRenderedHistory;
  const capabilities = document.querySelector("[data-lab-capabilities]");
  if (capabilities) {
    capabilities.innerHTML = `
      <article class="ai-capability-card rag">
        <header><i>R</i><div><h3>RAG Studio</h3><p>构建知识检索与问答系统</p></div><span>${escapeHtml(ai.status || "运行中")}</span></header>
        <div class="ai-flow-row"><span>文档</span><b>→</b><span>切块</span><b>→</b><span>检索</span><b>→</b><span>重排</span><b>→</b><span>生成</span></div>
        <button type="button" data-lab-open="rag">进入 RAG Studio <span>→</span></button>
      </article>
      <article class="ai-capability-card agent">
        <header><i>A</i><div><h3>Agent Studio</h3><p>开发和调试智能任务流程</p></div><span>只读 Beta</span></header>
        <div class="ai-flow-row"><span>规划</span><b>→</b><span>工具</span><b>→</b><span>记忆</span><b>→</b><span>执行</span><b>→</b><span>评估</span></div>
        <button type="button" data-lab-open="agent">进入 Agent Studio <span>→</span></button>
      </article>
      <article class="ai-capability-card experiment">
        <header><i>E</i><div><h3>Experiment</h3><p>实验记录、评估与对比</p></div><span>已接入评测</span></header>
        <div class="ai-mini-chart" aria-label="实验迭代趋势示意"><i style="height:28%"></i><i style="height:38%"></i><i style="height:34%"></i><i style="height:52%"></i><i style="height:45%"></i><i style="height:68%"></i><i style="height:82%"></i></div>
        <button type="button" data-lab-open="experiment">查看实验 <span>→</span></button>
      </article>
    `;
  }

  const status = document.querySelector("[data-lab-system-status]");
  if (status) {
    const statusItems = [
      ["▣", "可检索内容", searchableCount.toLocaleString("zh-CN"), `${posts.length} 篇文章 · ${columns.length} 个专栏`],
      ["◎", "知识节点", nodes.length.toLocaleString("zh-CN"), `${graphEdges.length} 条显式关系`],
      ["⌁", "检索模式", "Hybrid", "向量 + 关键词 + 图谱"],
      ["◇", "Agent Runtime", "Ready", "只读白名单工具"],
      ["○", "问答记录", history.length.toLocaleString("zh-CN"), "服务器 Memory"],
      ["✓", "引用能力", "Enabled", "回答可跳转来源"],
    ];
    status.innerHTML = statusItems.map(([icon, label, value, note]) => `<article><i>${icon}</i><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  }

  const activity = document.querySelector("[data-lab-activity]");
  if (activity) {
    const historyActivity = history.slice(0, 3).map((item) => ({
      icon: "Q",
      title: `查询：“${item.question}”`,
      type: "RAG",
      status: "已完成",
      time: item.createdAt || "最近",
    }));
    const contentActivity = [
      ...(content.changelog || []).slice(0, 2).map((item) => ({ icon: "U", title: `发布 ${item.version} ${item.title}`, type: "系统", status: "已更新", time: item.date })),
      ...posts.slice(0, 2).map((item) => ({ icon: "D", title: `发布文章：${item.title}`, type: "内容", status: "已发布", time: item.date || item.published_at })),
    ];
    activity.innerHTML = [...historyActivity, ...contentActivity].slice(0, 5).map((item) => `
      <article><i>${escapeHtml(item.icon)}</i><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.type)}</span><em>${escapeHtml(item.status)}</em><time>${escapeHtml(item.time || "最近")}</time></article>
    `).join("");
  }

  const quick = document.querySelector("[data-lab-quick-actions]");
  if (quick) {
    quick.innerHTML = `
      <button type="button" data-lab-open="rag"><i>▣</i><div><strong>新建 RAG 会话</strong><span>指定范围，检索知识并生成回答</span></div><b>＋</b></button>
      <button type="button" data-lab-open="agent"><i>◇</i><div><strong>运行 Agent</strong><span>输入目标，查看规划和工具步骤</span></div><b>＋</b></button>
      <a href="admin/" target="_blank" rel="noreferrer"><i>⇧</i><div><strong>上传数据</strong><span>导入文档并管理知识内容</span></div><b>＋</b></a>
      <button type="button" data-lab-open="experiment"><i>△</i><div><strong>查看实验</strong><span>检查评测能力与演进计划</span></div><b>＋</b></button>
    `;
  }

  const architecture = document.querySelector("[data-lab-architecture]");
  if (architecture) {
    const layers = [
      ["数据层", "文章 · 文档 · 知识节点"],
      ["知识层", "Chunk · Embedding"],
      ["检索层", "Milvus · Multi-Query · RRF"],
      ["生成层", "Reranker · Grounding · LLM"],
      ["Agent 层", "Planner · Tools · Memory"],
    ];
    architecture.innerHTML = layers.map(([title, description], index) => `<article><i>${index + 1}</i><strong>${title}</strong><span>${description}</span></article>${index < layers.length - 1 ? "<b>→</b>" : ""}`).join("");
  }

  const experiments = document.querySelector("[data-lab-experiments]");
  if (experiments) {
    const experimentItems = [
      ["RAG 检索评测", "Multi-Query、RRF、Reranker 与 Grounding 已进入评测链路。", "已接入"],
      ["Agent Runtime 评测", "记录任务规划、工具路径、最终状态和执行审计。", "已接入"],
      ["下一步实验", "继续补充真实测试集、延迟基线和检索质量对比。", "进行中"],
    ];
    experiments.innerHTML = experimentItems.map(([title, description, state], index) => `<article><span>Experiment 0${index + 1}</span><h2>${title}</h2><p>${description}</p><strong>${state}</strong></article>`).join("");
  }

  const knowledge = document.querySelector("[data-lab-knowledge]");
  if (knowledge) {
    knowledge.innerHTML = `
      <a href="#knowledge"><i>▧</i><div><strong>知识专栏</strong><span>${columns.length} 个专栏，按主题管理知识节点</span></div><b>→</b></a>
      <a href="#graph"><i>⌘</i><div><strong>知识图谱</strong><span>${nodes.length} 个节点，${graphEdges.length} 条显式关系</span></div><b>→</b></a>
      <a href="admin/" target="_blank" rel="noreferrer"><i>＋</i><div><strong>内容管理</strong><span>创建节点、上传文档并建立跨专栏关系</span></div><b>→</b></a>
    `;
  }
}

function renderAi(content) {
  const ai = content.aiShowcase || fallbackContent.aiShowcase;
  const homeTarget = document.querySelector("[data-ai-showcase]");
  if (homeTarget) {
    homeTarget.innerHTML = `
      <div>
        <div class="card-meta"><span>${escapeHtml(ai.status || "规划中")}</span></div>
        <h3>${escapeHtml(ai.title)}</h3>
        <p>${escapeHtml(ai.summary)}</p>
      </div>
      <div class="pipeline">${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    `;
  }

  const aiFull = document.querySelector("[data-ai-full]");
  if (aiFull) {
    const graph = buildKnowledgeNetwork(content);
    aiFull.innerHTML = `
    <div class="section-title">
      <p>Architecture</p>
      <h2>${escapeHtml(ai.title)}</h2>
    </div>
    <p>${escapeHtml(ai.summary)}</p>
    <div class="pipeline lab-pipeline">${(ai.pipeline || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <div class="agent-metrics">
      <div><span>Knowledge Chunks</span><strong>${flattenSearchContent(content).length}</strong></div>
      <div><span>Graph Nodes</span><strong>${graph.nodes.length}</strong></div>
      <div><span>Graph Edges</span><strong>${graph.edges.length}</strong></div>
      <div><span>Retrieval</span><strong>Keyword + Graph</strong></div>
    </div>
    ${detailList("演进规划", ai.roadmap)}
  `;
  }

  renderAiLabOverview(content, ai);
  bindAiLabNavigation();

  const capabilitiesTarget = document.querySelector("[data-ai-capabilities]");
  if (capabilitiesTarget) {
    capabilitiesTarget.innerHTML = (ai.capabilities || [])
      .map(
        (item) => `
          <article class="module-card">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
          </article>
        `,
      )
      .join("");
  }

  const askButton = document.querySelector("[data-ai-ask]");
  const answerTarget = document.querySelector("[data-ai-answer]");
  const traceTarget = document.querySelector("[data-ai-trace]");
  if (askButton && answerTarget) {
    setupAiScopeSelector();
    askButton.onclick = () => answerStaticQuestion(content);
    renderAiHistory();
    answerTarget.innerHTML = `
      <strong>可以先试试：</strong>
      <div class="suggestion-row">
        ${(ai.examples || []).map((item) => `<button type="button" data-question="${escapeHtml(item.question)}">${escapeHtml(item.question)}</button>`).join("")}
      </div>
    `;
    if (traceTarget) {
      traceTarget.innerHTML = renderTrace(["等待问题", "准备检索站内内容", "返回引用来源"], "idle");
    }
    answerTarget.onclick = (event) => {
      const feedbackButton = event.target.closest("[data-ai-feedback]");
      if (feedbackButton) {
        sendAiFeedback(feedbackButton).catch(() => {
          const row = feedbackButton.closest("[data-ai-feedback-memory]");
          if (row) row.querySelector("span").textContent = "反馈提交失败";
        });
        return;
      }
      const button = event.target.closest("[data-question]");
      if (!button) return;
      document.querySelector("[data-ai-question]").value = button.dataset.question;
      answerStaticQuestion(content);
    };
  }

  const agentButton = document.querySelector("[data-agent-run]");
  if (agentButton) agentButton.onclick = runAgentTask;
  const cancelButton = document.querySelector("[data-agent-cancel]");
  const retryButton = document.querySelector("[data-agent-retry]");
  const approveButton = document.querySelector("[data-agent-approve]");
  const denyButton = document.querySelector("[data-agent-deny]");
  if (cancelButton) cancelButton.onclick = cancelAgentTask;
  if (retryButton) retryButton.onclick = retryAgentTask;
  if (approveButton) approveButton.onclick = () => confirmAgentTask(true);
  if (denyButton) denyButton.onclick = () => confirmAgentTask(false);

  document.querySelector("[data-ai-clear-history]")?.addEventListener("click", async () => {
    try {
      await fetch(`${aiApiUrl.replace(/\/ask$/, "")}/memories`, { method: "DELETE", credentials: "include" });
    } catch {
      // The server remains the source of truth; do not create a browser copy.
    }
    aiRenderedHistory = [];
    renderAiHistory();
  });

  document.querySelector("[data-ai-history]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-history-id]");
    if (!button) return;
    const item = aiRenderedHistory.find((record) => String(record.id) === button.dataset.aiHistoryId);
    if (!item) return;
    document.querySelector("[data-ai-question]").value = item.question;
    answerTarget.innerHTML = `
      <strong>History</strong>
      <p>${escapeHtml(item.answer || "")}</p>
      ${renderCitationQuality(item.sources || [])}
      ${renderSourceList(item.sources || [])}
      ${
        item.promptContext
          ? `<details class="prompt-box">
              <summary>Prompt Context</summary>
              <pre>${escapeHtml(item.promptContext)}</pre>
            </details>`
          : ""
      }
      <div class="run-metrics">
        <span>Quality <strong>${escapeHtml(item.qualityScore)}</strong></span>
        <span>Sources <strong>${escapeHtml(item.sourceCount)}</strong></span>
        <span>Generator <strong>${escapeHtml(item.generator || "local")}</strong></span>
        <span>Latency <strong>${escapeHtml(item.latencyMs || "-")}ms</strong></span>
        <span>Time <strong>${escapeHtml(item.createdAt)}</strong></span>
      </div>
    `;
  });
}

function renderTrace(steps, state = "done") {
  return steps
    .map(
      (step, index) => `
        <div class="${state === "idle" && index > 0 ? "" : "is-done"}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(step)}</strong>
        </div>
      `,
    )
    .join("");
}

function normalizeBackendMemory(memory) {
  const sources = Array.isArray(memory.sources) ? memory.sources : [];
  return {
    id: String(memory.id),
    createdAt: memory.created_at ? new Date(memory.created_at).toLocaleString("zh-CN", { hour12: false }) : "",
    question: memory.question,
    answer: memory.answer,
    sources,
    sourceCount: sources.length || (memory.source_slugs || []).length,
    qualityScore: typeof memory.quality_score === "number" ? memory.quality_score : "-",
    generator: memory.generator || "server",
    latencyMs: memory.latency_ms || 0,
    trace: memory.trace || [],
    promptContext: memory.prompt_context || "",
    grounding: memory.grounding || {},
  };
}

async function fetchBackendHistory() {
  const url = `${aiApiUrl.replace(/\/ask$/, "")}/memories?session_id=${encodeURIComponent(aiSessionId)}&limit=12`;
  const response = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error(`Memory request failed: ${response.status}`);
  const memories = await response.json();
  return Array.isArray(memories) ? memories.map(normalizeBackendMemory) : [];
}

function renderAiHistoryList(history, mode = "local") {
  const target = document.querySelector("[data-ai-history]");
  if (!target) return;
  aiRenderedHistory = history;
  target.innerHTML = history.length
    ? history
        .map(
          (item) => `
            <button type="button" data-ai-history-id="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.createdAt)}</span>
              <strong>${escapeHtml(item.question)}</strong>
              <small>${escapeHtml(mode)} · Quality ${escapeHtml(item.qualityScore)} · ${escapeHtml(item.sourceCount)} sources · ${escapeHtml(item.generator || "local")} · ${escapeHtml(item.grounding?.status || "legacy")} · ${escapeHtml(item.latencyMs || "-")}ms</small>
            </button>
          `,
        )
        .join("")
    : `<p>还没有问答记录。</p>`;
}

async function renderAiHistory() {
  try {
    const backendHistory = await fetchBackendHistory();
    if (backendHistory.length) {
      renderAiHistoryList(backendHistory, "server");
      return;
    }
  } catch {
    aiRenderedHistory = [];
    renderAiHistoryList([], "server offline");
  }
}
