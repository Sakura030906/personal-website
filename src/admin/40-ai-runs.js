function renderAiRunStats(stats = {}) {
  const target = document.querySelector("[data-ai-run-stats]");
  if (!target) return;
  const rows = [
    ["Runs", stats.total ?? 0, "最近问答数量"],
    ["Quality", stats.avg_quality ?? 0, "平均引用质量"],
    ["Latency", `${stats.avg_latency_ms ?? 0}ms`, "平均服务端延迟"],
    ["Local", stats.local_runs ?? 0, "本地生成"],
    ["LLM", stats.llm_runs ?? 0, "模型生成"],
  ];
  target.innerHTML = rows
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
}

function renderAiRunList() {
  const target = document.querySelector("[data-ai-run-list]");
  if (!target) return;
  target.innerHTML = aiRuns.length
    ? aiRuns
        .map(
          (run) => `
            <button type="button" data-ai-run-id="${run.id}" class="${activeAiRun?.id === run.id ? "is-active" : ""}">
              <span>${escapeHtml(formatDateTime(run.created_at))}</span>
              <strong>${escapeHtml(run.question)}</strong>
              <small>Q ${escapeHtml(run.quality_score)} · ${escapeHtml(run.latency_ms)}ms · ${escapeHtml(run.generator)} · ${escapeHtml((run.sources || []).length)} sources</small>
            </button>
          `,
        )
        .join("")
    : `<p class="empty">暂无 AI Runs。先到公开站 AI Lab 提问一次。</p>`;
}

function renderAiRunDetail(run = activeAiRun) {
  const target = document.querySelector("[data-ai-run-detail]");
  if (!target) return;
  if (!run) {
    target.innerHTML = `<p class="empty">选择一条问答日志查看详情。</p>`;
    return;
  }
  const sources = run.sources || [];
  const trace = run.trace || [];
  const queryPlan = run.query_plan || {};
  const grounding = run.grounding || {};
  target.innerHTML = `
    <div class="ai-run-detail-head">
      <div>
        <span>#${escapeHtml(run.id)} · ${escapeHtml(formatDateTime(run.created_at))}</span>
        <h3>${escapeHtml(run.question)}</h3>
      </div>
      <div class="ai-run-metrics">
        <span>Quality <strong>${escapeHtml(run.quality_score)}</strong></span>
        <span>Latency <strong>${escapeHtml(run.latency_ms)}ms</strong></span>
        <span>Generator <strong>${escapeHtml(run.generator)}</strong></span>
        <span>Grounding <strong>${escapeHtml(grounding.status || "legacy")}</strong></span>
        <span>Support <strong>${Math.round((Number(grounding.support_score) || 0) * 100)}%</strong></span>
      </div>
    </div>
    <section>
      <h4>Answer</h4>
      <p>${escapeHtml(run.answer)}</p>
    </section>
    <section>
      <h4>Sources</h4>
      ${
        sources.length
          ? sources
              .map(
                (source) => `
                  <div class="ai-run-source">
                    <strong>${escapeHtml(source.title || source.slug)}</strong>
                    <span>${escapeHtml(source.entity_type)} · ${escapeHtml(source.slug)} · score ${escapeHtml(source.score)} · fusion ${escapeHtml(source.fusion_score ?? 0)} · rerank ${escapeHtml(source.rerank_score ?? 0)} · context ${escapeHtml(source.compressed_chars ?? 0)}/${escapeHtml(source.original_chars ?? 0)} chars · chunk ${escapeHtml(source.chunk_index ?? "-")} · lex ${escapeHtml(source.lexical_score ?? 0)} · vec ${escapeHtml(source.vector_score ?? 0)}</span>
                    <p>${escapeHtml(source.summary || "")}</p>
                    ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a>` : ""}
                    ${(source.matched_chunk || source.context) ? `<blockquote>${escapeHtml(source.matched_chunk || source.context)}</blockquote>` : ""}
                  </div>
                `,
              )
              .join("")
          : `<p class="empty">没有引用来源。</p>`
      }
    </section>
    <section>
      <h4>Grounding Report</h4>
      <p>${escapeHtml(grounding.reason || "旧记录没有校验报告。")}</p>
      <p>Evidence ${Math.round((Number(grounding.confidence) || 0) * 100)}% · Claims ${escapeHtml(grounding.supported_claims ?? 0)}/${escapeHtml(grounding.total_claims ?? 0)} · Citations ${Math.round((Number(grounding.citation_coverage) || 0) * 100)}%</p>
      ${(grounding.invalid_citations || []).length ? `<p>无效引用：${escapeHtml(grounding.invalid_citations.join(", "))}</p>` : ""}
      ${(grounding.unsupported_claims || []).length ? `<ul>${grounding.unsupported_claims.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    </section>
    <section>
      <h4>Query Plan</h4>
      ${(queryPlan.queries || []).length
        ? `<ol>${queryPlan.queries.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
           <p>${escapeHtml((queryPlan.concepts || []).join(" · "))}</p>`
        : `<p class="empty">这条历史记录没有 Query Plan。</p>`}
    </section>
    <section>
      <h4>Trace</h4>
      ${
        trace.length
          ? `<ol>${trace.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`
          : `<p class="empty">没有 trace。</p>`
      }
    </section>
    <details class="advanced-json" open>
      <summary>Prompt Context</summary>
      <pre>${escapeHtml(run.prompt_context || "")}</pre>
    </details>
  `;
}

function renderAgentRunStats(stats = {}) {
  const target = document.querySelector("[data-agent-run-stats]");
  if (!target) return;
  const rows = [
    ["Runs", stats.total ?? 0, "最近任务数量"],
    ["Success", `${Math.round((Number(stats.success_rate) || 0) * 100)}%`, `${stats.completed ?? 0} 成功`],
    ["Failed", stats.failed ?? 0, "执行失败"],
    ["Quality", stats.avg_quality ?? 0, "平均答案质量"],
    ["P95", `${stats.p95_latency_ms ?? 0}ms`, `平均 ${stats.avg_latency_ms ?? 0}ms`],
    ["Tools", stats.tool_calls ?? 0, "工具调用总数"],
    ["Tokens", (stats.prompt_tokens ?? 0) + (stats.completion_tokens ?? 0), "输入 + 输出"],
    ["Cost", `$${Number(stats.estimated_cost_usd || 0).toFixed(6)}`, "模型估算成本"],
  ];
  target.innerHTML = rows.map(([label, value, note]) => `
    <article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><p>${escapeHtml(note)}</p></article>
  `).join("");
}

function renderAgentEvaluation(payload = agentEvaluation) {
  const target = document.querySelector("[data-agent-eval-results]");
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">运行评测后查看 Agent 工具路由、来源、质量和延迟。</p>`;
    return;
  }
  const stats = payload.stats || {};
  target.innerHTML = `
    <div class="rag-eval-summary">
      <strong>Agent Eval ${Math.round((Number(stats.success_rate) || 0) * 100)}%</strong>
      <span>${escapeHtml(stats.passed ?? 0)}/${escapeHtml(stats.cases ?? 0)} passed</span>
      <span>Tool path ${Math.round((Number(stats.tool_path_rate) || 0) * 100)}%</span>
      <span>Sources ${Math.round((Number(stats.source_hit_rate) || 0) * 100)}%</span>
      <span>Avg ${escapeHtml(stats.avg_latency_ms ?? 0)}ms</span>
      <span>Cost $${Number(stats.estimated_cost_usd || 0).toFixed(6)}</span>
    </div>
    ${(payload.cases || []).map((item) => `
      <article class="rag-eval-case ${item.success ? "hit" : "miss"}">
        <div>
          <span>${escapeHtml(item.category)} · ${item.success ? "PASS" : "FAIL"} · run #${escapeHtml(item.run_id)}</span>
          <h3>${escapeHtml(item.goal)}</h3>
          <p>${escapeHtml((item.tools || []).join(" → ") || "没有完成工具调用")}</p>
          <small>Q ${escapeHtml(item.quality_score)} · ${escapeHtml(item.latency_ms)}ms${(item.missing_tools || []).length ? ` · 缺少工具：${escapeHtml(item.missing_tools.join(", "))}` : ""}${(item.missing_slugs || []).length ? ` · 缺少来源：${escapeHtml(item.missing_slugs.join(", "))}` : ""}</small>
        </div>
      </article>
    `).join("")}
  `;
}

function renderAgentRunList() {
  const target = document.querySelector("[data-agent-run-list]");
  if (!target) return;
  target.innerHTML = agentRuns.length
    ? agentRuns.map((run) => `
        <button type="button" data-agent-run-id="${run.id}" class="${activeAgentRun?.id === run.id ? "is-active" : ""}">
          <span>${escapeHtml(formatDateTime(run.created_at))}</span>
          <strong>${escapeHtml(run.goal)}</strong>
          <small>${escapeHtml(run.status)} · ${escapeHtml(run.planner)} · ${escapeHtml(run.tool_calls)} tools · ${escapeHtml((run.prompt_tokens || 0) + (run.completion_tokens || 0))} tokens · Q ${escapeHtml(run.result?.quality_score ?? 0)}</small>
        </button>
      `).join("")
    : `<p class="empty">暂无 Agent Runs。先到公开站 AI Lab 执行一次任务。</p>`;
}

function renderAgentRunDetail(run = activeAgentRun) {
  const target = document.querySelector("[data-agent-run-detail]");
  if (!target) return;
  if (!run) {
    target.innerHTML = `<p class="empty">选择一条 Agent 任务查看详情。</p>`;
    return;
  }
  const result = run.result || {};
  const grounding = result.grounding || {};
  const sources = result.sources || [];
  const steps = run.steps || [];
  target.innerHTML = `
    <div class="ai-run-detail-head">
      <div><span>#${escapeHtml(run.id)} · ${escapeHtml(formatDateTime(run.created_at))}</span><h3>${escapeHtml(run.goal)}</h3></div>
      <div class="ai-run-metrics">
        <span>Status <strong>${escapeHtml(run.status)}</strong></span>
        <span>Planner <strong>${escapeHtml(run.planner)}</strong></span>
        <span>Mode <strong>${escapeHtml(run.planner_mode)}</strong></span>
        <span>Quality <strong>${escapeHtml(result.quality_score ?? 0)}</strong></span>
        <span>Generator <strong>${escapeHtml(result.generator || "-")}</strong></span>
        <span>Grounding <strong>${escapeHtml(grounding.status || "-")}</strong></span>
        <span>Support <strong>${Math.round((Number(grounding.support_score) || 0) * 100)}%</strong></span>
        <span>Resumes <strong>${escapeHtml(run.resume_count || 0)}</strong></span>
        <span>Tokens <strong>${escapeHtml((run.prompt_tokens || 0) + (run.completion_tokens || 0))}</strong></span>
        <span>Cost <strong>$${Number(run.estimated_cost_usd || 0).toFixed(6)}</strong></span>
        ${run.failure_category ? `<span>Failure <strong>${escapeHtml(run.failure_category)}</strong></span>` : ""}
      </div>
    </div>
    <section><h4>Answer</h4><p>${escapeHtml(result.answer || run.error || "尚无结果")}</p></section>
    <section>
      <h4>Execution Steps</h4>
      ${steps.length ? steps.map((step) => `
        <div class="ai-run-source">
          <strong>Step ${escapeHtml(Number(step.step_index) + 1)} · ${escapeHtml(step.tool_name)}</strong>
          <span>${escapeHtml(step.status)} · ${escapeHtml(step.duration_ms)}ms · ${escapeHtml(step.decision?.provider || run.planner)}</span>
          <p>${escapeHtml(step.reason || "")}</p>
          <pre>${escapeHtml(JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2))}</pre>
        </div>
      `).join("") : `<p class="empty">没有工具步骤。</p>`}
    </section>
    <section>
      <h4>Sources</h4>
      ${sources.length ? sources.map((source, index) => `
        <div class="ai-run-source"><strong>[${index + 1}] ${escapeHtml(source.title || source.slug)}</strong><span>${escapeHtml(source.entity_type)} · ${escapeHtml(source.slug)} · score ${escapeHtml(source.score ?? 0)}</span><p>${escapeHtml(source.summary || source.context || "")}</p></div>
      `).join("") : `<p class="empty">没有可用来源。</p>`}
    </section>
    <section><h4>Planner Trace</h4><pre>${escapeHtml(JSON.stringify(run.planner_trace || [], null, 2))}</pre></section>
    <section><h4>Stop Reason</h4><p>${escapeHtml(result.stop_reason || run.error || "-")}</p></section>
    ${(run.pending_confirmation && Object.keys(run.pending_confirmation).length) ? `<section><h4>Pending Confirmation</h4><pre>${escapeHtml(JSON.stringify(run.pending_confirmation, null, 2))}</pre></section>` : ""}
  `;
}

function emptyEvalSuite() {
  return {
    id: null, name: "", slug: "", eval_type: "rag", description: "", is_active: true, version: 1,
    cases: [{ id: "case-1", question: "", expected_terms: [], expected_slugs: [] }],
  };
}

function setEvalSuiteForm(suite = emptyEvalSuite()) {
  activeEvalSuite = suite;
  document.querySelector("[data-eval-name]").value = suite.name || "";
  document.querySelector("[data-eval-slug]").value = suite.slug || "";
  document.querySelector("[data-eval-type]").value = suite.eval_type || "rag";
  document.querySelector("[data-eval-description]").value = suite.description || "";
  document.querySelector("[data-eval-active]").checked = suite.is_active !== false;
  document.querySelector("[data-eval-cases]").value = JSON.stringify(suite.cases || [], null, 2);
  document.querySelector("[data-eval-version]").textContent = suite.id ? `固定样本 v${suite.version} · ${suite.case_count || suite.cases?.length || 0} 条` : "新评测集";
  document.querySelector("[data-eval-run-local]").disabled = !suite.id;
  document.querySelector("[data-eval-run-auto]").disabled = !suite.id || suite.eval_type !== "agent";
  renderEvaluationDashboard();
}

function readEvalSuiteForm() {
  const casesInput = document.querySelector("[data-eval-cases]");
  const cases = parseArrayJson(casesInput.value, null);
  if (!cases?.length) {
    casesInput.classList.add("is-invalid");
    throw new Error("固定样本必须是至少包含一条记录的 JSON 数组");
  }
  casesInput.classList.remove("is-invalid");
  const name = document.querySelector("[data-eval-name]").value.trim();
  return {
    name,
    slug: document.querySelector("[data-eval-slug]").value.trim() || slugify(name),
    eval_type: document.querySelector("[data-eval-type]").value,
    description: document.querySelector("[data-eval-description]").value.trim(),
    cases,
    is_active: document.querySelector("[data-eval-active]").checked,
  };
}

function evalPrimaryMetric(run) {
  const metrics = run.metrics || {};
  return run.eval_type === "rag" ? `MRR ${metrics.mrr ?? 0}` : `成功率 ${Math.round((Number(metrics.success_rate) || 0) * 100)}%`;
}

function renderEvaluationDashboard(payload = evaluationDashboard) {
  const statsTarget = document.querySelector("[data-eval-stats]");
  const suitesTarget = document.querySelector("[data-eval-suite-list]");
  const historyTarget = document.querySelector("[data-eval-history]");
  if (!statsTarget || !suitesTarget || !historyTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    suitesTarget.innerHTML = `<p class="empty">登录后加载固定评测集。</p>`;
    historyTarget.innerHTML = `<p class="empty">运行评测后显示历史与回归结论。</p>`;
    return;
  }
  const stats = payload.stats || {};
  statsTarget.innerHTML = [
    ["评测集", stats.suites || 0, `${stats.active_suites || 0} 个启用`],
    ["固定样本", stats.cases || 0, "版本化保存"],
    ["历史运行", stats.runs || 0, "可重复对比"],
    ["当前回退", stats.regressions || 0, stats.regressions ? "需要检查" : "未发现回退"],
  ].map(([label, value, note]) => `<article><span>${label}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  suitesTarget.innerHTML = (payload.suites || []).map((suite) => `
    <button type="button" data-eval-suite-id="${suite.id}" class="${activeEvalSuite?.id === suite.id ? "is-active" : ""}">
      <i>${suite.eval_type === "rag" ? "R" : "A"}</i>
      <span><strong>${escapeHtml(suite.name)}</strong><small>${escapeHtml(suite.eval_type.toUpperCase())} · v${suite.version} · ${suite.case_count} 条</small></span>
      <em>${suite.is_active ? "启用" : "停用"}</em>
    </button>
  `).join("") || `<p class="empty">暂无评测集。</p>`;
  historyTarget.innerHTML = (payload.runs || []).length ? `
    <header><strong>运行历史</strong><span>同一评测集、同一模式自动与上一次比较</span></header>
    ${(payload.runs || []).map((run) => {
      const regression = run.regression || {};
      const statusLabel = { baseline: "基线", stable: "稳定", improved: "提升", regressed: "回退" }[regression.status] || regression.status;
      return `<button type="button" data-eval-run-id="${run.id}" class="is-${escapeHtml(regression.status || "baseline")}">
        <span>${escapeHtml(run.eval_type.toUpperCase())} · ${escapeHtml(run.mode)} · suite v${run.suite_version}</span>
        <strong>${escapeHtml(evalPrimaryMetric(run))}</strong>
        <em>${escapeHtml(statusLabel || "基线")} ${regression.delta ? `${regression.delta > 0 ? "+" : ""}${regression.delta}` : ""}</em>
        <time>${escapeHtml(formatDateTime(run.created_at))} · ${escapeHtml(run.duration_ms)}ms</time>
      </button>`;
    }).join("")}
  ` : `<p class="empty">运行评测后显示历史与回归结论。</p>`;
}

async function loadEvaluationDashboard() {
  evaluationDashboard = await cmsRequest("/admin/evaluation/dashboard");
  if (!activeEvalSuite?.id) activeEvalSuite = evaluationDashboard.suites?.[0] || emptyEvalSuite();
  else activeEvalSuite = evaluationDashboard.suites.find((suite) => suite.id === activeEvalSuite.id) || evaluationDashboard.suites?.[0] || emptyEvalSuite();
  setEvalSuiteForm(activeEvalSuite);
}

async function saveEvalSuite() {
  const payload = readEvalSuiteForm();
  const path = activeEvalSuite?.id ? `/admin/evaluation/suites/${activeEvalSuite.id}` : "/admin/evaluation/suites";
  const saved = await cmsRequest(path, { method: activeEvalSuite?.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
  activeEvalSuite = saved;
  await loadEvaluationDashboard();
  showToast(`评测集已保存为 v${saved.version}`);
}

async function runEvaluationSuite(mode = "local") {
  if (!activeEvalSuite?.id) throw new Error("请先保存评测集");
  const button = document.querySelector(mode === "auto" ? "[data-eval-run-auto]" : "[data-eval-run-local]");
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "评测运行中…";
  try {
    const result = await cmsRequest(`/admin/evaluation/suites/${activeEvalSuite.id}/run`, {
      method: "POST", body: JSON.stringify({ mode, limit: 5, published_only: true }),
    });
    await loadEvaluationDashboard();
    renderEvaluationRunDetail(result);
    showToast(`评测完成：${evalPrimaryMetric(result)}`);
  } finally {
    button.textContent = original;
    button.disabled = mode === "auto" && activeEvalSuite?.eval_type !== "agent";
  }
}

function renderEvaluationRunDetail(run) {
  const target = document.querySelector("[data-eval-run-detail]");
  if (!target) return;
  const cases = run.result?.cases || [];
  const comparisons = run.result?.comparisons || [];
  target.hidden = false;
  target.innerHTML = `
    <header><div><span>RUN #${escapeHtml(run.id)} · ${escapeHtml(run.suite?.name || "")}</span><h3>${escapeHtml(evalPrimaryMetric(run))}</h3></div><button type="button" data-eval-detail-close>关闭</button></header>
    ${comparisons.length ? `<div class="evaluation-comparisons">${comparisons.map((item, index) => `<article class="${index === 0 ? "is-best" : ""}"><span>${index === 0 ? "BEST" : "CONFIG"}</span><strong>${escapeHtml(item.name)}</strong><small>MRR ${escapeHtml(item.stats?.mrr ?? 0)} · Top1 ${Math.round((Number(item.stats?.top1_hit_rate) || 0) * 100)}%</small></article>`).join("")}</div>` : ""}
    <div class="evaluation-case-results">${cases.map((item) => `<article class="${item.success === false || item.expected_hit === false ? "is-failed" : ""}"><span>${escapeHtml(item.id || "case")}</span><strong>${escapeHtml(item.question || item.goal)}</strong><small>${item.expected_hit === false ? "未命中期望来源" : item.success === false ? `失败：${escapeHtml((item.missing_tools || []).join("、") || "质量门槛")}` : "通过"}</small></article>`).join("")}</div>
  `;
}

async function loadEvaluationRun(runId) {
  renderEvaluationRunDetail(await cmsRequest(`/admin/evaluation/runs/${runId}`));
}

function renderRagIndex(payload = ragIndex) {
  const statsTarget = document.querySelector("[data-rag-index-stats]");
  const listTarget = document.querySelector("[data-rag-index-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载 RAG 索引状态。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const embedding = stats.embedding || {};
  const llm = stats.llm || {};
  const vectorStore = stats.vector_store || {};
  const reranker = stats.reranker || {};
  const queryExpansion = stats.query_expansion || {};
  const groundingConfig = stats.grounding || {};
  const embeddingProfiles = stats.embedding_profiles || [];
  const rows = [
    ["Chunks", stats.chunks ?? 0, "已索引片段"],
    ["Node Chunks", stats.node_chunks ?? 0, "标准化知识片段"],
    ["Nodes", stats.indexed_nodes ?? 0, "已索引知识节点"],
    ["Documents", stats.indexed_documents ?? 0, `${stats.document_chunks ?? 0} 个启用切片`],
    ["Indexed", stats.indexed_entries ?? 0, "已覆盖内容"],
    ["Sources", stats.source_entries ?? 0, "可索引内容"],
    ["Published", stats.published_entries ?? 0, "已发布内容"],
    ["Coverage", `${Math.round((Number(stats.coverage) || 0) * 100)}%`, "索引覆盖率"],
    ["Embedding", embedding.active_provider || "local", embedding.model || "hash"],
    ["LLM", llm.active_provider || "local", llm.model || "rule fallback"],
    ["Vector DB", vectorStore.active || "local", vectorStore.status || "local"],
    ["Milvus Rows", vectorStore.row_count ?? 0, `${vectorStore.node_row_count ?? 0} node · ${vectorStore.document_row_count ?? 0} document vectors`],
    ["Reranker", reranker.provider || "off", `top ${reranker.top_k ?? "-"} · weight ${reranker.weight ?? 0}`],
    ["Multi Query", queryExpansion.provider || "off", `${queryExpansion.max_queries ?? 1} queries · RRF ${queryExpansion.fusion_k ?? "-"}`],
    ["Grounding", `${Math.round((Number(groundingConfig.evidence_threshold) || 0) * 100)}%`, `${groundingConfig.context_max_chars ?? "-"} chars · answer ${groundingConfig.min_answer_support ?? "-"}`],
    ["Dim", embedding.dimensions ?? "-", "向量维度"],
    ["Updated", stats.last_indexed ? formatDateTime(stats.last_indexed) : "未建立", "最近索引时间"],
  ];
  statsTarget.innerHTML = rows
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

  listTarget.innerHTML = (payload.recent_chunks || []).length
    ? payload.recent_chunks
        .map(
          (chunk) => `
            <article class="rag-index-chunk">
              <div>
                <span>${escapeHtml(entityLabels[chunk.entity_type] || chunk.entity_type)} · ${escapeHtml(chunk.slug)} · #${escapeHtml(chunk.chunk_index)}</span>
                <h3>${escapeHtml(chunk.title)}</h3>
                <p>${escapeHtml(chunk.content)}</p>
                <small>${escapeHtml(chunk.token_count)} tokens · ${escapeHtml(formatDateTime(chunk.updated_at))}</small>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty">还没有索引。点击“重建索引”生成内容片段。</p>`;
  if (embeddingProfiles.length) {
    listTarget.insertAdjacentHTML(
      "afterbegin",
      `<div class="rag-profile-list">
        ${embeddingProfiles
          .map(
            (profile) => `
              <span>${escapeHtml(profile.provider)} · ${escapeHtml(profile.model)} · ${escapeHtml(profile.dimensions)}d · ${escapeHtml(profile.chunks)} chunks</span>
            `,
          )
          .join("")}
      </div>`,
    );
  }
  renderRagEvaluation();
}

function renderRagEvaluation(payload = ragEvaluation) {
  const target = document.querySelector("[data-rag-eval-list]");
  if (!target) return;
  if (!payload) {
    target.innerHTML = `<p class="empty">运行评测后查看 RAG 召回质量。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const tuning = payload.tuning || stats.tuning || {};
  const comparisons = payload.comparisons || [];
  const rows = [
    ["Cases", stats.cases ?? 0, "评测问题"],
    ["Answer Rate", `${Math.round((Number(stats.answer_rate) || 0) * 100)}%`, "有召回来源"],
    ["Hit Rate", `${Math.round((Number(stats.expected_hit_rate) || 0) * 100)}%`, "期望词命中"],
    ["Top1", `${Math.round((Number(stats.top1_hit_rate) || 0) * 100)}%`, "第一名命中"],
    ["MRR", stats.mrr ?? 0, "平均倒数排名"],
    ["Avg Score", stats.avg_top_score ?? 0, "平均 Top 分数"],
  ];
  target.innerHTML = `
    <div class="rag-eval-stats">
      ${rows
        .map(
          ([label, value, note]) => `
            <article>
              <span>${escapeHtml(label)}</span>
              <strong>${escapeHtml(value)}</strong>
              <p>${escapeHtml(note)}</p>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="rag-tuning-summary">
      <span>Current</span>
      <strong>${escapeHtml(tuning.name || "default")}</strong>
      <p>lexical ${escapeHtml(tuning.lexical_weight ?? "-")} · vector ${escapeHtml(tuning.vector_weight ?? "-")} · multi-query ${escapeHtml(tuning.query_expansion ?? "off")} × ${escapeHtml(tuning.multi_query_limit ?? 1)} · reranker ${escapeHtml(tuning.reranker ?? "off")} × ${escapeHtml(tuning.rerank_weight ?? 0)}</p>
    </div>
    ${
      comparisons.length
        ? `<div class="rag-comparison-list">
            ${comparisons
              .map(
                (item, index) => `
                  <article class="${index === 0 ? "is-best" : ""}">
                    <span>${index === 0 ? "Best" : "Config"}</span>
                    <strong>${escapeHtml(item.name)}</strong>
                    <p>MRR ${escapeHtml(item.stats?.mrr ?? 0)} · Top1 ${Math.round((Number(item.stats?.top1_hit_rate) || 0) * 100)}% · Hit ${Math.round((Number(item.stats?.expected_hit_rate) || 0) * 100)}%</p>
                    <small>lex ${escapeHtml(item.tuning?.lexical_weight ?? "-")} · vec ${escapeHtml(item.tuning?.vector_weight ?? "-")} · query ${escapeHtml(item.tuning?.query_expansion ?? "off")} × ${escapeHtml(item.tuning?.multi_query_limit ?? 1)} · rerank ${escapeHtml(item.tuning?.reranker ?? "off")} × ${escapeHtml(item.tuning?.rerank_weight ?? 0)}</small>
                  </article>
                `,
              )
              .join("")}
          </div>`
        : ""
    }
    <div class="rag-eval-cases">
      ${(payload.cases || [])
        .map(
          (item) => `
            <article class="rag-eval-case ${item.expected_hit === false ? "is-miss" : ""}">
              <div>
                <span>${item.expected_hit === null ? "未设置期望词" : item.expected_hit ? "命中" : "未命中"} · ${escapeHtml(item.source_count)} sources</span>
                <h3>${escapeHtml(item.question)}</h3>
                ${
                  item.top_source
                    ? `<p>Top: ${escapeHtml(item.top_source.title)} · ${escapeHtml(item.top_source.retrieval_store || "local")} · rank ${escapeHtml(item.expected_rank || "-")} · final ${escapeHtml(item.top_source.score)} · retrieve ${escapeHtml(item.top_source.retrieval_score ?? "-")} · fusion ${escapeHtml(item.top_source.fusion_score ?? 0)} · rerank ${escapeHtml(item.top_source.rerank_score ?? 0)} ${escapeHtml((item.top_source.rerank_reasons || []).join(" / "))} · queries ${escapeHtml((item.top_source.matched_queries || []).join(" / "))} · ${escapeHtml(item.top_source.matched_chunk || "")}</p>`
                    : `<p>没有召回来源，需要补充知识节点或文章。</p>`
                }
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderAiFeedback(payload = aiFeedback) {
  const statsTarget = document.querySelector("[data-ai-feedback-stats]");
  const listTarget = document.querySelector("[data-ai-feedback-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载 AI 反馈。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Feedback", stats.feedback ?? 0, "反馈总数"],
    ["Useful", stats.useful ?? 0, "有用"],
    ["Not Useful", stats.not_useful ?? 0, "无用"],
    ["Helpful", `${Math.round((Number(stats.helpful_rate) || 0) * 100)}%`, "有用率"],
    ["Low Quality", stats.low_quality_runs ?? 0, "低质量问答"],
    ["Issues", stats.issues ?? 0, "改进线索"],
  ];
  statsTarget.innerHTML = rows
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

  listTarget.innerHTML = (payload.issues || []).length
    ? payload.issues
        .map(
          (issue, index) => `
            <article class="ai-feedback-issue ${escapeHtml(issue.kind)}">
              <div>
                <span>${escapeHtml(issue.kind)} · ${escapeHtml(issue.reason || "feedback")} · ${escapeHtml(issue.count)} 次</span>
                <h3>${escapeHtml(issue.suggested_title || issue.question)}</h3>
                <p>${escapeHtml(issue.question)}</p>
                <small>来源：${escapeHtml((issue.source_slugs || []).join(" / ") || "无引用")} · ${escapeHtml(formatDateTime(issue.last_seen))}</small>
              </div>
              <div class="actions left">
                <button type="button" data-ai-feedback-draft="${index}" data-ai-feedback-type="${escapeHtml(issue.suggested_type || "post")}">生成草稿</button>
                <button type="button" data-ai-feedback-draft="${index}" data-ai-feedback-type="knowledge">知识节点</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty success">暂时没有 AI 反馈改进项。</p>`;
}
