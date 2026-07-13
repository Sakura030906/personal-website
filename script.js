const contentUrl = "data/site.json";

const fallbackProfile = {
  name: "你的名字",
  initials: "SE",
  role: "C# 工程师 / 大模型应用开发方向",
  headline: "计算机专业背景，当前从 C# 工程开发转向 Agent 与 RAG 应用。",
  summary:
    "2025 年毕业于江西师范大学计算机相关专业，目前在上海阅凡自动化科技有限公司担任 C# 工程师。正在系统学习并实践大模型应用开发，重点关注 Agent、RAG、业务系统与 AI 能力结合。",
  contactNote: "如果你想了解我的学习方向、项目进展或合作机会，可以通过下面的方式联系我。",
  links: [
    { label: "Email", value: "hello@example.com", href: "mailto:hello@example.com" },
    { label: "GitHub", value: "github.com/yourname", href: "https://github.com/" },
  ],
  highlights: [
    { label: "Current", value: "C# Engineer" },
    { label: "Direction", value: "Agent / RAG" },
    { label: "Education", value: "JXNU · CS · 2025" },
  ],
  about: [
    "我本科就读于江西师范大学计算机专业，2021 级，2025 年毕业。在校成绩处于年级前 20%，具备扎实的计算机基础和持续学习能力。",
    "毕业后加入上海阅凡自动化科技有限公司，担任 C# 工程师，参与自动化业务相关软件开发。当前重点转向大模型应用开发，关注 Agent、RAG、工具调用和企业业务系统结合。",
    "我希望个人网站保持真实、克制和可持续更新：不夸大经历，不把方向包装成已经完成的成果，而是清楚展示当前阶段、技术积累和正在推进的方向。",
  ],
  projects: [],
  skills: [
    { title: "工程开发", items: ["C#", ".NET", "业务系统开发", "问题排查"] },
    { title: "计算机基础", items: ["数据结构", "数据库", "操作系统", "软件工程"] },
    { title: "AI 应用方向", items: ["Large Language Models", "Agent", "RAG", "Prompt Engineering"] },
  ],
  experience: [
    {
      period: "2025 - Now",
      title: "C# 工程师 · 上海阅凡自动化科技有限公司",
      description: "负责自动化业务相关软件开发与维护，使用 C# 参与业务功能实现、问题定位和系统迭代。",
    },
    {
      period: "2021 - 2025",
      title: "江西师范大学 · 计算机专业",
      description: "本科阶段系统学习计算机专业课程，在校成绩位于年级前 20%，毕业后进入软件开发岗位。",
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
  const projects = profile.projects || [];
  if (projects.length === 0) {
    document.querySelector("[data-projects]").innerHTML = `
      <article class="project-item empty-state">
        <div>
          <h3>项目经历整理中</h3>
          <p>这里先保留为空。后续可以补充 C# 工程项目、大模型应用 Demo、Agent 或 RAG 相关实践。</p>
          <p class="impact">保持真实，比过度包装更重要。</p>
        </div>
      </article>
    `;
    return;
  }

  document.querySelector("[data-projects]").innerHTML = projects
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
