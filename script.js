const profile = {
  capabilities: [
    {
      title: "系统架构",
      body: "从业务边界、数据模型、接口契约到部署拓扑，设计能演进的服务结构。",
      points: ["领域建模", "服务拆分", "容量规划"],
    },
    {
      title: "全栈交付",
      body: "把前端体验、后端接口、数据库和运维链路串起来，缩短从想法到上线的距离。",
      points: ["产品闭环", "API 设计", "交互实现"],
    },
    {
      title: "稳定性工程",
      body: "用日志、指标、告警、重试和降级机制，让系统在异常情况下仍然可控。",
      points: ["可观测性", "故障恢复", "发布治理"],
    },
    {
      title: "工程效率",
      body: "通过自动化、代码规范、测试策略和工具链建设，让团队交付更快也更稳。",
      points: ["CI/CD", "测试体系", "代码审查"],
    },
  ],
  projects: [
    {
      label: "01",
      title: "高可用业务中台",
      result: "把核心流程拆成可观测服务，发布故障率下降，跨团队联调周期缩短。",
      stack: ["Node.js", "PostgreSQL", "Redis", "Docker"],
    },
    {
      label: "02",
      title: "生产数据可视化平台",
      result: "统一采集、清洗和展示关键指标，让运营和工程团队能实时定位问题。",
      stack: ["React", "TypeScript", "WebSocket", "Charts"],
    },
    {
      label: "03",
      title: "自动化交付流水线",
      result: "建立测试、构建、灰度和回滚流程，把人工发布变成可追踪的标准动作。",
      stack: ["GitHub Actions", "Linux", "Nginx", "Playwright"],
    },
  ],
  stack: [
    "TypeScript",
    "React",
    "Vue",
    "Node.js",
    "Python",
    "C#",
    "PostgreSQL",
    "MySQL",
    "Redis",
    "Docker",
    "Nginx",
    "Linux",
    "CI/CD",
    "Observability",
    "System Design",
  ],
  timeline: [
    {
      period: "2024 - Now",
      role: "Senior Software Engineer",
      detail: "负责核心业务系统架构、性能优化、稳定性治理和关键项目落地。",
    },
    {
      period: "2021 - 2024",
      role: "Full-stack Engineer",
      detail: "独立交付多个 Web 产品，覆盖需求分析、前后端开发、上线和监控。",
    },
    {
      period: "2018 - 2021",
      role: "Backend Engineer",
      detail: "建设业务接口、数据模型和内部工具，积累复杂系统排查与维护经验。",
    },
  ],
};

function renderCapabilities() {
  const target = document.querySelector("[data-capabilities]");
  target.innerHTML = profile.capabilities
    .map(
      (item) => `
        <article class="capability-card">
          <h3>${item.title}</h3>
          <p>${item.body}</p>
          <ul>
            ${item.points.map((point) => `<li>${point}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function renderProjects() {
  const target = document.querySelector("[data-projects]");
  target.innerHTML = profile.projects
    .map(
      (project) => `
        <article class="project-row">
          <span class="project-index">${project.label}</span>
          <div>
            <h3>${project.title}</h3>
            <p>${project.result}</p>
          </div>
          <div class="project-stack">
            ${project.stack.map((tech) => `<span>${tech}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderStack() {
  const target = document.querySelector("[data-stack]");
  target.innerHTML = profile.stack.map((tech) => `<span>${tech}</span>`).join("");
}

function renderTimeline() {
  const target = document.querySelector("[data-timeline]");
  target.innerHTML = profile.timeline
    .map(
      (item) => `
        <article class="timeline-item">
          <time>${item.period}</time>
          <div>
            <h3>${item.role}</h3>
            <p>${item.detail}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function syncHeaderState() {
  const header = document.querySelector("[data-header]");
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

renderCapabilities();
renderProjects();
renderStack();
renderTimeline();
document.querySelector("[data-year]").textContent = new Date().getFullYear();
syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });
