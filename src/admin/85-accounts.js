function formatAccountRole(role) {
  return { admin: "管理员", editor: "编辑者", viewer: "只读用户" }[role] || role;
}

function renderCurrentAccount() {
  const target = document.querySelector("[data-current-account]");
  if (!target) return;
  if (!currentCmsUser) {
    target.innerHTML = `<p class="empty">请先在下方登录服务器后台。</p>`;
    return;
  }
  target.innerHTML = `
    <div><span>当前账号</span><strong>${escapeHtml(currentCmsUser.email)}</strong></div>
    <div><span>权限</span><strong>${formatAccountRole(currentCmsUser.role)}</strong></div>
    <div><span>状态</span><strong>${currentCmsUser.is_active ? "正常" : "已停用"}</strong></div>
    <div><span>最近登录</span><strong>${formatDateTime(currentCmsUser.last_login_at) || "首次登录"}</strong></div>
  `;
  document.querySelectorAll(".admin-sidebar-user strong").forEach((node) => { node.textContent = currentCmsUser.email; });
  document.querySelectorAll(".admin-sidebar-user span").forEach((node) => { node.textContent = formatAccountRole(currentCmsUser.role); });
}

function renderAccountUsers() {
  const target = document.querySelector("[data-account-users]");
  const manager = document.querySelector("[data-account-manager]");
  if (!target || !manager) return;
  const canManage = currentCmsUser?.role === "admin";
  manager.hidden = !canManage;
  if (!canManage) {
    target.innerHTML = `<p class="empty">只有管理员可以查看和管理其他账号。</p>`;
    return;
  }
  target.innerHTML = accountUsers.length ? accountUsers.map((user) => `
    <article class="account-row" data-account-id="${user.id}">
      <div><strong>${escapeHtml(user.email)}</strong><span>${formatDateTime(user.last_login_at) || "尚未登录"}</span></div>
      <select data-account-role ${user.id === currentCmsUser?.id ? "disabled" : ""}>
        ${["admin", "editor", "viewer"].map((role) => `<option value="${role}" ${user.role === role ? "selected" : ""}>${formatAccountRole(role)}</option>`).join("")}
      </select>
      <button type="button" data-account-toggle ${user.id === currentCmsUser?.id ? "disabled" : ""}>${user.is_active ? "停用" : "启用"}</button>
      <button type="button" data-account-reset>重置密码</button>
    </article>
  `).join("") : `<p class="empty">还没有其他账号。</p>`;
}

async function loadCurrentAccount() {
  currentCmsUser = await cmsRequest("/auth/me");
  renderCurrentAccount();
  if (currentCmsUser.role === "admin") await loadAccountUsers();
  else renderAccountUsers();
}

async function loadAccountUsers() {
  accountUsers = await cmsRequest("/admin/users");
  renderAccountUsers();
}

async function createAccount() {
  const email = document.querySelector("[data-account-email]").value.trim();
  const password = document.querySelector("[data-account-password]").value;
  const role = document.querySelector("[data-account-role-new]").value;
  await cmsRequest("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  document.querySelector("[data-account-email]").value = "";
  document.querySelector("[data-account-password]").value = "";
  showToast("账号已创建并保存到服务器");
  await loadAccountUsers();
}

async function updateAccount(button, action) {
  const row = button.closest("[data-account-id]");
  const user = accountUsers.find((item) => String(item.id) === row?.dataset.accountId);
  if (!user) return;
  if (action === "role") {
    await cmsRequest(`/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: row.querySelector("[data-account-role]").value }),
    });
  }
  if (action === "toggle") {
    await cmsRequest(`/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !user.is_active }),
    });
  }
  if (action === "reset") {
    const password = window.prompt(`为 ${user.email} 设置新密码（至少 10 位）`);
    if (!password) return;
    await cmsRequest(`/admin/users/${user.id}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  }
  showToast("账号设置已更新");
  await loadAccountUsers();
}

async function changeOwnPassword() {
  const currentPassword = document.querySelector("[data-current-password]").value;
  const newPassword = document.querySelector("[data-new-password]").value;
  await cmsRequest("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  await cmsRequest("/auth/logout", { method: "POST" }).catch(() => null);
  cmsToken = "";
  currentCmsUser = null;
  accountUsers = [];
  renderCurrentAccount();
  renderAccountUsers();
  setCmsStatus("密码已修改，请重新登录");
  showToast("密码已修改，旧登录令牌已经失效");
}
