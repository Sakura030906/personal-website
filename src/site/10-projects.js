function projectCard(project, index) {
  const slug = normalizeSlug(project, index, "project");
  return `
    <a class="project-card" href="#project-${escapeHtml(slug)}">
      ${projectVisual(project)}
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.tagline || project.summary || "")}</p>
      <div class="pill-list compact">
        ${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <span class="project-detail-link">查看详情 →</span>
    </a>
  `;
}

function projectVisual(project, compact = true) {
  const visual = project.visual || {};
  const items = visual.items || project.modules || [];
  return `
    <div class="project-visual ${compact ? "" : "large"}">
      <div class="visual-top">
        <span>${escapeHtml(visual.label || project.name)}</span>
        <strong>${escapeHtml(visual.status || project.status || "In Progress")}</strong>
      </div>
      <div class="visual-main">
        <b>${escapeHtml(visual.metric || project.tagline || "Project Console")}</b>
        <em>${escapeHtml(project.summary || "")}</em>
      </div>
      <div class="visual-dashboard" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="visual-flow">
        ${items.slice(0, compact ? 3 : 6).map((item) => `<i>${escapeHtml(item)}</i>`).join("")}
      </div>
    </div>
  `;
}

function detailList(title, items) {
  if (!items?.length) return "";
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>
  `;
}

function architectureFlow(items) {
  if (!items?.length) return "";
  return `
    <section class="wide-section">
      <h2>系统架构图</h2>
      <div class="architecture-flow">
        ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </section>
  `;
}

function codeList(title, items) {
  if (!items?.length) return "";
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <pre class="code-block">${escapeHtml(items.join("\n"))}</pre>
    </section>
  `;
}

function renderProjects(content) {
  const projects = content.projects || [];
  const html = projects.length
    ? projects.map(projectCard).join("")
    : `<div class="empty-state"><strong>项目作品整理中</strong><p>后续会补充 C# 工程项目、大模型 Demo、Agent 或 RAG 实践。</p></div>`;

  document.querySelector("[data-projects]").innerHTML = html;
  document.querySelector("[data-featured-projects]").innerHTML = projects.slice(0, 3).map(projectCard).join("");

  const current = projects[0];
  if (current) {
    const consoleTarget = document.querySelector("[data-hero-console]");
    if (consoleTarget) {
      consoleTarget.innerHTML = `
        ${projectVisual(current, false)}
        <div class="hero-project-links">
          <a href="#project-${escapeHtml(normalizeSlug(current, 0, "project"))}">查看工程细节</a>
          <span>${escapeHtml(current.github ? "GitHub available" : "GitHub 待补充")}</span>
        </div>
      `;
    }
  }
}

function renderProjectDetail(content, slug) {
  const projects = content.projects || [];
  const index = projects.findIndex((project, current) => normalizeSlug(project, current, "project") === slug);
  const project = projects[index];
  const list = document.querySelector("[data-projects]");
  const detail = document.querySelector("[data-project-detail]");

  if (!project) {
    list.hidden = false;
    detail.hidden = true;
    return;
  }

  list.hidden = true;
  detail.hidden = false;
  detail.innerHTML = `
    <a class="back-link" href="#projects">返回项目列表</a>
    <div class="detail-head">
      <div>
        <div class="card-meta"><span>${escapeHtml(project.status || "记录中")}</span></div>
        <h1>${escapeHtml(project.name)}</h1>
        <p>${escapeHtml(project.tagline || project.summary || "")}</p>
      </div>
      <div class="pill-list compact">${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <div class="detail-grid">
      <section class="wide-section">${projectVisual(project, false)}</section>
      ${architectureFlow(project.architectureDiagram)}
      ${detailList("核心模块", project.modules)}
      ${codeList("目录结构", project.directoryTree)}
      ${detailList("技术选型", project.techChoices)}
      ${detailList("数据库设计", project.databaseDesign)}
      ${detailList("API", project.apiExamples)}
      ${detailList("部署", project.deployment)}
      ${detailList("性能目标", project.performance)}
      <section>
        <h2>问题背景</h2>
        <p>${escapeHtml(project.problem || "待补充。")}</p>
      </section>
      <section>
        <h2>架构说明</h2>
        <p>${escapeHtml(project.architecture || "待补充。")}</p>
      </section>
      ${detailList("项目要点", project.details)}
      ${detailList("当前证据", project.evidence)}
      ${detailList("踩坑与风险", project.pitfalls || project.challenges)}
      ${detailList("下一步", project.nextSteps)}
    </div>
  `;
}
