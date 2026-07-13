const contentUrl = "data/site.json";

const fallbackProfile = {
  name: "晏宏翔",
  initials: "晏",
  role: "大模型开发 / Agent、RAG 方向",
  summary:
    "2025 年毕业于江西师范大学计算机专业，目前在上海阅凡自动化科技有限公司担任 C# 工程师。正在转向大模型应用开发，重点关注 Agent、RAG、工具调用和业务系统结合。",
  basicInfo: [
    { label: "城市", value: "上海" },
    { label: "邮箱", value: "Cecilia030906@proton.me" },
    { label: "当前职位", value: "C# 工程师" },
    { label: "发展方向", value: "Agent / RAG / 大模型应用" },
  ],
  education: [
    {
      title: "江西师范大学",
      meta: "计算机专业 · 本科 · 2021 - 2025",
      description: "在校成绩位于年级前 20%，系统学习计算机基础课程，并持续关注软件工程与 AI 应用方向。",
    },
  ],
  experience: [
    {
      title: "上海阅凡自动化科技有限公司",
      meta: "C# 工程师 · 2025 - 至今",
      description: "参与自动化业务相关软件开发与维护，负责业务功能实现、问题定位和系统迭代。",
    },
  ],
  skills: ["C#", ".NET", "业务系统开发", "问题排查", "大模型应用", "Agent", "RAG"],
  projects: [],
  interests: ["阅读", "技术写作", "AI 工具", "开源项目", "跑步"],
  blogPosts: [],
};

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
    .replace(/^-|-$/g, "");
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function renderBasicInfo(profile) {
  document.querySelector("[data-basic-info]").innerHTML = (profile.basicInfo || [])
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

function renderTimeline(selector, items) {
  document.querySelector(selector).innerHTML = (items || [])
    .map(
      (item) => `
        <section class="timeline-item">
          <span class="dot"></span>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="meta">${escapeHtml(item.meta)}</p>
            <p>${escapeHtml(item.description)}</p>
          </div>
        </section>
      `,
    )
    .join("");
}

function renderPills(selector, items) {
  document.querySelector(selector).innerHTML = (items || [])
    .map((item) => `<span>${escapeHtml(item)}</span>`)
    .join("");
}

function renderProjects(profile) {
  const projects = profile.projects || [];
  const target = document.querySelector("[data-projects]");

  if (projects.length === 0) {
    target.innerHTML = `
      <div class="empty-mini">
        <strong>项目作品整理中</strong>
        <p>后续可以补充 C# 工程项目、大模型 Demo、Agent 或 RAG 实践。</p>
      </div>
    `;
    return;
  }

  target.innerHTML = projects
    .map(
      (project) => `
        <article class="project-card">
          <h3>${escapeHtml(project.name)}</h3>
          <p>${escapeHtml(project.description)}</p>
          <div class="pill-list compact">
            ${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderBlogList(profile) {
  const posts = profile.blogPosts || [];
  const list = document.querySelector("[data-blog-list]");
  const article = document.querySelector("[data-blog-article]");

  article.hidden = true;

  if (posts.length === 0) {
    list.innerHTML = `
      <div class="blog-empty">
        <div>📭</div>
        <p>还没有文章，先在本地编辑后台写第一篇吧。</p>
      </div>
    `;
    return;
  }

  list.innerHTML = posts
    .map((post, index) => {
      const slug = post.slug || slugify(post.title) || `post-${index + 1}`;
      return `
        <a class="blog-card" href="#post-${escapeHtml(slug)}" data-post-slug="${escapeHtml(slug)}">
          <time>${escapeHtml(post.date || "未设置日期")}</time>
          <h2>${escapeHtml(post.title)}</h2>
          <p>${escapeHtml(post.summary || "")}</p>
          <div class="pill-list compact">
            ${(post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
          </div>
        </a>
      `;
    })
    .join("");
}

function renderArticle(profile, slug) {
  const posts = profile.blogPosts || [];
  const post = posts.find((item, index) => (item.slug || slugify(item.title) || `post-${index + 1}`) === slug);
  const article = document.querySelector("[data-blog-article]");
  const list = document.querySelector("[data-blog-list]");

  if (!post) {
    article.hidden = true;
    list.hidden = false;
    return;
  }

  list.hidden = true;
  article.hidden = false;
  article.innerHTML = `
    <a class="back-link" href="#blog">← 返回博客</a>
    <time>${escapeHtml(post.date || "未设置日期")}</time>
    <h1>${escapeHtml(post.title)}</h1>
    <div class="pill-list compact">
      ${(post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
    <div class="article-body">
      ${String(post.content || "")
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
        .join("")}
    </div>
  `;
}

function setRoute(profile) {
  const hash = window.location.hash.replace("#", "") || "home";
  const isPost = hash.startsWith("post-");
  const route = isPost ? "blog" : hash;

  document.querySelectorAll("[data-route]").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.route === route);
  });

  document.querySelectorAll("[data-view]").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === route);
  });

  document.querySelector("[data-blog-list]").hidden = false;
  if (isPost) {
    renderArticle(profile, hash.replace("post-", ""));
  } else if (route === "blog") {
    document.querySelector("[data-blog-article]").hidden = true;
    document.querySelector("[data-blog-list]").hidden = false;
  }
}

function renderProfile(profile) {
  document.title = `${profile.name} | 个人网站`;
  setText('[data-field="name"]', profile.name);
  setText('[data-field="initials"]', profile.initials);
  setText('[data-field="role"]', profile.role);
  setText('[data-field="summary"]', profile.summary);
  renderBasicInfo(profile);
  renderTimeline("[data-education]", profile.education);
  renderTimeline("[data-experience]", profile.experience);
  renderPills("[data-skills]", profile.skills);
  renderPills("[data-interests]", profile.interests);
  renderProjects(profile);
  renderBlogList(profile);
  setRoute(profile);
  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  window.addEventListener("hashchange", () => setRoute(profile));
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
