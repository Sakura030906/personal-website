const contentUrl = "data/site.json";

const fallbackProfile = {
  name: "你的名字",
  initials: "SE",
  role: "Senior Software Engineer",
  headline: "构建稳定、清晰、长期可维护的软件系统。",
  summary:
    "专注后端系统、全栈产品交付、工程效率和可观测性。习惯从问题边界、系统设计、实现质量到上线维护完整负责。",
  contactNote: "如果你想了解我的项目、简历或合作方式，可以通过下面的方式联系我。",
  links: [
    { label: "Email", value: "hello@example.com", href: "mailto:hello@example.com" },
    { label: "GitHub", value: "github.com/yourname", href: "https://github.com/" },
  ],
  highlights: [
    { label: "Focus", value: "Backend / Full-stack" },
    { label: "Experience", value: "8+ years" },
    { label: "Location", value: "Remote / China" },
  ],
  about: [
    "我倾向于把复杂问题拆成清楚的边界，用简单、可验证的方式交付系统。",
    "关注代码质量、接口契约、可观测性和发布流程。比起炫技，更重视系统在真实环境里的稳定表现。",
  ],
  projects: [
    {
      name: "高可用业务系统",
      description: "重构核心链路，补齐日志、指标、告警和异常恢复策略，提升上线后的可维护性。",
      impact: "降低排障时间，减少重复人工处理。",
      stack: ["Node.js", "PostgreSQL", "Redis", "Docker"],
    },
    {
      name: "生产数据可视化平台",
      description: "整合多来源数据，提供实时看板和异常追踪，让业务与工程团队共享同一套事实。",
      impact: "提升问题定位效率和跨团队沟通质量。",
      stack: ["React", "TypeScript", "WebSocket"],
    },
  ],
  skills: [
    { title: "系统设计", items: ["领域建模", "接口设计", "服务边界", "容量规划"] },
    { title: "工程质量", items: ["代码审查", "自动化测试", "CI/CD", "发布回滚"] },
    { title: "稳定性", items: ["日志指标", "告警", "降级", "故障复盘"] },
  ],
  experience: [
    {
      period: "2024 - Now",
      title: "Senior Software Engineer",
      description: "负责核心系统设计、性能优化、工程效率和稳定性建设。",
    },
    {
      period: "2021 - 2024",
      title: "Full-stack Engineer",
      description: "独立交付多个 Web 产品，覆盖前端、后端、数据库和部署。",
    },
  ],
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function renderLinks(profile) {
  const links = profile.links || [];
  const compact = links
    .map(
      (link) => `
        <a href="${escapeHtml(link.href)}" target="${link.href?.startsWith("http") ? "_blank" : "_self"}" rel="noreferrer">
          <span>${escapeHtml(link.label)}</span>
          <strong>${escapeHtml(link.value)}</strong>
        </a>
      `,
    )
    .join("");

  document.querySelector("[data-links]").innerHTML = compact;
  document.querySelector("[data-contact-actions]").innerHTML = compact;
}

function renderHighlights(profile) {
  document.querySelector("[data-highlights]").innerHTML = (profile.highlights || [])
    .map(
      (item) => `
        <div>
          <dt>${escapeHtml(item.label)}</dt>
          <dd>${escapeHtml(item.value)}</dd>
        </div>
      `,
    )
    .join("");
}

function renderAbout(profile) {
  document.querySelector("[data-about]").innerHTML = (profile.about || [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function renderProjects(profile) {
  document.querySelector("[data-projects]").innerHTML = (profile.projects || [])
    .map(
      (project) => `
        <article class="project-item">
          <div>
            <h3>${escapeHtml(project.name)}</h3>
            <p>${escapeHtml(project.description)}</p>
            <p class="impact">${escapeHtml(project.impact)}</p>
          </div>
          <ul>
            ${(project.stack || []).map((tech) => `<li>${escapeHtml(tech)}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function renderSkills(profile) {
  document.querySelector("[data-skills]").innerHTML = (profile.skills || [])
    .map(
      (group) => `
        <article class="skill-card">
          <h3>${escapeHtml(group.title)}</h3>
          <ul>
            ${(group.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function renderExperience(profile) {
  document.querySelector("[data-experience]").innerHTML = (profile.experience || [])
    .map(
      (item) => `
        <article class="timeline-item">
          <time>${escapeHtml(item.period)}</time>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.description)}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderProfile(profile) {
  document.title = `${profile.name} | ${profile.role}`;
  setText('[data-field="name"]', profile.name);
  setText('[data-field="initials"]', profile.initials);
  setText('[data-field="role"]', profile.role);
  setText('[data-field="headline"]', profile.headline);
  setText('[data-field="summary"]', profile.summary);
  setText('[data-field="contactNote"]', profile.contactNote);
  renderLinks(profile);
  renderHighlights(profile);
  renderAbout(profile);
  renderProjects(profile);
  renderSkills(profile);
  renderExperience(profile);
  document.querySelector("[data-year]").textContent = new Date().getFullYear();
}

async function loadProfile() {
  try {
    const response = await fetch(contentUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Content request failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(error);
    return fallbackProfile;
  }
}

loadProfile().then(renderProfile);
