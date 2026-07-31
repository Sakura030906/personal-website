function renderProactiveDashboard(payload = proactiveDashboard) {
  const statsTarget = document.querySelector("[data-proactive-stats]");
  const taskTarget = document.querySelector("[data-proactive-tasks]");
  const memoryTarget = document.querySelector("[data-memory-list]");
  if (!statsTarget || !taskTarget || !memoryTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    taskTarget.innerHTML = `<p class="empty">登录 CMS 后生成今日任务。</p>`;
    memoryTarget.innerHTML = `<p class="empty">暂无长期记忆。</p>`;
    return;
  }
  const stats = payload.stats || {};
  statsTarget.innerHTML = [
    ["待处理", stats.open_tasks || 0], ["高优先级", stats.high_priority || 0],
    ["记忆候选", stats.memory_candidates || 0], ["已确认", stats.active_memories || 0],
    ["公开上下文", stats.public_memories || 0],
  ].map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("");
  taskTarget.innerHTML = (payload.tasks || []).length ? payload.tasks.map((task) => `
    <article class="proactive-task is-${escapeHtml(task.priority)}">
      <div><span>${escapeHtml(task.priority)} · ${escapeHtml(task.task_type)}</span><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.description || "")}</p></div>
      <div class="actions left"><button type="button" data-proactive-task="${task.id}:completed">完成</button><button type="button" class="secondary" data-proactive-task="${task.id}:dismissed">忽略</button></div>
    </article>`).join("") : `<p class="empty success">今天没有待处理任务。</p>`;
  memoryTarget.innerHTML = (payload.memories || []).length ? payload.memories.map((memory) => `
    <article class="memory-item is-${escapeHtml(memory.status)}">
      <div><span>${escapeHtml(memory.memory_type)} · ${escapeHtml(memory.visibility)} · ${escapeHtml(memory.status)}</span><strong>${escapeHtml(memory.title)}</strong><p>${escapeHtml(memory.content)}</p></div>
      <div class="actions left">
        ${memory.status === "candidate" ? `<button type="button" data-memory-action="${memory.id}:active:${memory.visibility}">确认</button>` : ""}
        ${memory.status === "active" ? `<button type="button" class="secondary" data-memory-action="${memory.id}:archived:${memory.visibility}">归档</button>` : ""}
        ${memory.status !== "archived" ? `<button type="button" class="secondary" data-memory-action="${memory.id}:${memory.status}:${memory.visibility === "public" ? "private" : "public"}">${memory.visibility === "public" ? "设为私有" : "允许公开"}</button>` : ""}
      </div>
    </article>`).join("") : `<p class="empty">暂无长期记忆。</p>`;
}

function renderContentOps(payload = contentOps) {
  const statsTarget = document.querySelector("[data-content-ops-stats]");
  const boardTarget = document.querySelector("[data-content-ops-board]");
  if (!statsTarget || !boardTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    boardTarget.innerHTML = `<p class="empty">登录 CMS 后加载 Content Ops。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Tasks", stats.tasks ?? 0, "总任务"],
    ["High", stats.high ?? 0, "高优先级"],
    ["Medium", stats.medium ?? 0, "中优先级"],
    ["Hidden", stats.hidden ?? 0, "已完成/忽略"],
    ["Search", stats.search_gaps ?? 0, "搜索缺口"],
    ["AI", stats.ai_issues ?? 0, "AI 改进项"],
    ["Relation", stats.relation_issues ?? 0, "关系问题"],
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

  const labels = { high: "High", medium: "Medium", low: "Low" };
  const tasks = payload.tasks || [];
  boardTarget.innerHTML = Object.entries(labels)
    .map(([priority, label]) => {
      const currentTasks = tasks.filter((task) => task.priority === priority);
      return `
        <section class="content-ops-column ${escapeHtml(priority)}">
          <h3>${escapeHtml(label)} <span>${currentTasks.length}</span></h3>
          <div>
            ${
              currentTasks.length
                ? currentTasks
                    .map((task, index) => {
                      const globalIndex = tasks.indexOf(task);
                      return `
                        <article class="content-ops-task">
                          <span>${escapeHtml(task.source)} · ${escapeHtml(task.meta || "")}</span>
                          <strong>${escapeHtml(task.title)}</strong>
                          <p>${escapeHtml(task.detail || "")}</p>
                          <div class="content-ops-actions">
                            <button type="button" data-content-ops-task="${globalIndex}">${escapeHtml(contentOpsActionLabel(task.action?.kind))}</button>
                            <button type="button" data-content-ops-state="${globalIndex}" data-content-ops-status="done">完成</button>
                            <button type="button" data-content-ops-state="${globalIndex}" data-content-ops-status="ignored">忽略</button>
                          </div>
                        </article>
                      `;
                    })
                    .join("")
                : `<p class="empty">暂无任务。</p>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}

function contentOpsActionLabel(kind) {
  return {
    create_gap_draft: "生成草稿",
    create_feedback_draft: "生成草稿",
    fix_relation: "修复反链",
    review_relation: "查看问题",
    open_entry: "打开编辑",
    publish_entry: "发布",
  }[kind] || "处理";
}

function renderSearchAnalytics(payload = searchAnalytics) {
  const statsTarget = document.querySelector("[data-search-analytics-stats]");
  const topTarget = document.querySelector("[data-top-search-queries]");
  const emptyTarget = document.querySelector("[data-empty-search-queries]");
  const recentTarget = document.querySelector("[data-recent-search-events]");
  if (!statsTarget || !topTarget || !emptyTarget || !recentTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    topTarget.innerHTML = `<p class="empty">登录 CMS 后加载搜索分析。</p>`;
    emptyTarget.innerHTML = `<p class="empty">暂无数据。</p>`;
    recentTarget.innerHTML = `<p class="empty">暂无数据。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Events", stats.events ?? 0, "总事件"],
    ["Searches", stats.searches ?? 0, "搜索次数"],
    ["Clicks", stats.clicks ?? 0, "点击次数"],
    ["No Result", stats.no_results ?? 0, "无结果搜索"],
    ["CTR", stats.click_rate ?? 0, "点击率"],
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

  topTarget.innerHTML = (payload.top_queries || []).length
    ? payload.top_queries
        .map(
          (item) => `
            <div class="analytics-row">
              <strong>${escapeHtml(item.query)}</strong>
              <span>${escapeHtml(item.count)} 次 · ${escapeHtml((item.sources || []).join(" / "))} · 无结果 ${escapeHtml(item.no_result)}</span>
            </div>
          `,
        )
        .join("")
    : `<p class="empty">暂无热门关键词。</p>`;

  emptyTarget.innerHTML = (payload.no_result_queries || []).length
    ? payload.no_result_queries
        .map(
          (item) => `
            <div class="analytics-row warning">
              <strong>${escapeHtml(item.query)}</strong>
              <span>${escapeHtml(item.count)} 次没有结果，适合补文章或知识节点。</span>
            </div>
          `,
        )
        .join("")
    : `<p class="empty success">暂时没有无结果搜索。</p>`;

  recentTarget.innerHTML = (payload.recent_events || []).length
    ? payload.recent_events
        .slice(0, 18)
        .map(
          (event) => `
            <div class="analytics-row">
              <strong>${escapeHtml(event.query || event.selected_title || "-")}</strong>
              <span>${escapeHtml(event.event_type)} · ${escapeHtml(event.source)} · ${escapeHtml(event.result_count)} results · ${escapeHtml(formatDateTime(event.created_at))}</span>
              ${event.selected_title ? `<small>→ ${escapeHtml(event.selected_type)} · ${escapeHtml(event.selected_title)}</small>` : ""}
            </div>
          `,
        )
        .join("")
    : `<p class="empty">暂无最近事件。</p>`;
}

function renderContentGaps(payload = contentGaps) {
  const statsTarget = document.querySelector("[data-content-gap-stats]");
  const listTarget = document.querySelector("[data-content-gap-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载内容缺口。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Gaps", stats.gaps ?? 0, "待补内容"],
    ["High", stats.high ?? 0, "高优先级"],
    ["Medium", stats.medium ?? 0, "中优先级"],
    ["Low", stats.low ?? 0, "低优先级"],
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

  listTarget.innerHTML = (payload.gaps || []).length
    ? payload.gaps
        .map(
          (gap, index) => `
            <article class="content-gap ${escapeHtml(gap.priority)}">
              <div>
                <span>${escapeHtml(gap.priority)} · ${escapeHtml(gap.suggested_type)} · ${escapeHtml(gap.count)} 次</span>
                <h3>${escapeHtml(gap.suggested_title || gap.query)}</h3>
                <p>${escapeHtml(gap.reason)}</p>
                <small>搜索词：${escapeHtml(gap.query)} · 来源：${escapeHtml((gap.sources || []).join(" / "))} · ${escapeHtml(formatDateTime(gap.last_seen))}</small>
              </div>
              <div class="actions left">
                <button type="button" data-gap-draft="${index}" data-gap-type="${escapeHtml(gap.suggested_type)}">生成草稿</button>
                <button type="button" data-gap-draft="${index}" data-gap-type="post">文章</button>
                <button type="button" data-gap-draft="${index}" data-gap-type="knowledge">知识节点</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="empty success">暂时没有明显内容缺口。</p>`;
}

function renderRelationHealth(payload = relationHealth) {
  const statsTarget = document.querySelector("[data-relation-health-stats]");
  const listTarget = document.querySelector("[data-relation-health-list]");
  if (!statsTarget || !listTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    listTarget.innerHTML = `<p class="empty">登录 CMS 后加载关系健康检查。</p>`;
    return;
  }

  const stats = payload.stats || {};
  const rows = [
    ["Entries", stats.entries ?? 0, "参与检查"],
    ["Issues", stats.issues ?? 0, "关系问题"],
    ["Backlinks", stats.missing_backlinks ?? 0, "缺失反链"],
    ["Targets", stats.missing_targets ?? 0, "目标不存在"],
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
            <article class="relation-health-issue ${escapeHtml(issue.kind)}">
              <div>
                <span>${escapeHtml(issue.kind)} · ${escapeHtml(issue.source_type)} → ${escapeHtml(issue.target_type)}</span>
                <h3>${escapeHtml(issue.source_title)} → ${escapeHtml(issue.target_title)}</h3>
                <p>${escapeHtml(issue.message)}</p>
                ${issue.missing_field ? `<small>需要在目标条目的 ${escapeHtml(issue.missing_field)} 中加入：${escapeHtml(issue.missing_value)}</small>` : ""}
              </div>
              ${
                issue.kind === "missing_backlink"
                  ? `<button type="button" data-relation-fix="${index}">修复反链</button>`
                  : `<em>需要手动确认目标是否已改名</em>`
              }
            </article>
          `,
        )
        .join("")
    : `<p class="empty success">关系网络是双向的，暂时没有明显问题。</p>`;
}

function renderPublishWorkflow(payload = publishWorkflow) {
  const statsTarget = document.querySelector("[data-publish-workflow-stats]");
  const boardTarget = document.querySelector("[data-publish-board]");
  if (!statsTarget || !boardTarget) return;
  if (!payload) {
    statsTarget.innerHTML = "";
    boardTarget.innerHTML = `<p class="empty">登录 CMS 后加载发布流程。</p>`;
    return;
  }

  const labels = {
    draft: "草稿",
    needs_content: "待补正文",
    needs_seo: "待补 SEO",
    needs_relations: "待补关系",
    ready: "可发布",
    published: "已发布",
  };
  const columns = payload.columns || {};
  const stats = payload.stats || {};
  statsTarget.innerHTML = Object.entries(labels)
    .map(
      ([key, label]) => `
        <article>
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(stats[key] ?? 0)}</strong>
          <p>${escapeHtml(key)}</p>
        </article>
      `,
    )
    .join("");

  boardTarget.innerHTML = Object.entries(labels)
    .map(([key, label]) => {
      const entries = columns[key] || [];
      return `
        <section class="publish-column ${escapeHtml(key)}">
          <h3>${escapeHtml(label)} <span>${entries.length}</span></h3>
          <div>
            ${
              entries.length
                ? entries
                    .map(
                      (entry) => `
                        <article class="publish-card">
                          <span>${escapeHtml(entityLabels[entry.entity_type] || entry.entity_type)} · ${escapeHtml(entry.status)}</span>
                          <strong>${escapeHtml(entry.title)}</strong>
                          <p>${escapeHtml(entry.summary || entry.slug)}</p>
                          ${
                            (entry.blockers || []).length
                              ? `<ul>${entry.blockers.map((blocker) => `<li>${escapeHtml(blocker.message)}</li>`).join("")}</ul>`
                              : `<small>没有阻塞项。</small>`
                          }
                          <div class="actions left">
                            <button type="button" data-workflow-open="${entry.id}" data-workflow-type="${escapeHtml(entry.entity_type)}">编辑</button>
                            ${
                              key === "ready"
                                ? `<button type="button" data-workflow-publish="${entry.id}" data-workflow-type="${escapeHtml(entry.entity_type)}">发布</button>`
                                : ""
                            }
                          </div>
                        </article>
                      `,
                    )
                    .join("")
                : `<p class="empty">暂无内容。</p>`
            }
          </div>
        </section>
      `;
    })
    .join("");
}
