#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="${GITHUB_REPOSITORY:-Sakura030906/personal-website}"
ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"
SERVER_HOST="${SERVER_HOST:-100.110.201.24}"
SERVER_USER="${SERVER_USER:-hongxiang}"
SERVER_DEPLOY_PATH="${SERVER_DEPLOY_PATH:-/home/hongxiang/deploy/personal-website}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://sakura000702.me}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/github_actions_personal_website}"
KNOWN_HOSTS_FILE="${KNOWN_HOSTS_FILE:-$HOME/.ssh/known_hosts}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '缺少命令：%s\n' "$1" >&2
    exit 1
  fi
}

set_repository_secret() {
  local secret_name="$1"
  local secret_value="$2"

  printf '%s' "$secret_value" |
    gh secret set "$secret_name" --repo "$REPOSITORY"
}

set_environment_secret() {
  local secret_name="$1"
  local secret_value="$2"

  printf '%s' "$secret_value" |
    gh secret set "$secret_name" --env "$ENVIRONMENT" --repo "$REPOSITORY"
}

set_environment_variable() {
  local variable_name="$1"
  local variable_value="$2"
  local endpoint="repos/$REPOSITORY/environments/$ENVIRONMENT/variables"

  if gh api "$endpoint/$variable_name" >/dev/null 2>&1; then
    gh api \
      --method PATCH \
      "$endpoint/$variable_name" \
      -f name="$variable_name" \
      -f value="$variable_value" \
      >/dev/null
  else
    gh api \
      --method POST \
      "$endpoint" \
      -f name="$variable_name" \
      -f value="$variable_value" \
      >/dev/null
  fi
}

require_command gh
require_command ssh-keygen

if ! gh auth status >/dev/null 2>&1; then
  cat >&2 <<'EOF'
GitHub CLI 尚未登录。
请先执行：gh auth login --with-token
然后在隐藏输入中粘贴只授予当前仓库管理权限的 GitHub Token。
EOF
  exit 1
fi

if [[ ! -f "$DEPLOY_KEY" ]]; then
  printf '找不到部署私钥：%s\n' "$DEPLOY_KEY" >&2
  exit 1
fi

if [[ ! -f "$KNOWN_HOSTS_FILE" ]]; then
  printf '找不到 known_hosts：%s\n' "$KNOWN_HOSTS_FILE" >&2
  exit 1
fi

known_hosts_entry="$(
  ssh-keygen -F "$SERVER_HOST" -f "$KNOWN_HOSTS_FILE" 2>/dev/null |
    grep -v '^#' |
    head -n 1
)"

if [[ -z "$known_hosts_entry" ]]; then
  printf 'known_hosts 中没有已验证的服务器记录：%s\n' "$SERVER_HOST" >&2
  exit 1
fi

printf '配置仓库：%s\n' "$REPOSITORY"
printf '发布环境：%s\n' "$ENVIRONMENT"

read -r -p 'ACR 登录用户名：' acr_username
read -r -s -p 'ACR 登录密码：' acr_password
printf '\n'

if [[ -z "$acr_username" || -z "$acr_password" ]]; then
  printf 'ACR 用户名和密码不能为空。\n' >&2
  exit 1
fi

gh api \
  --method PUT \
  "repos/$REPOSITORY/environments/$ENVIRONMENT" \
  >/dev/null

set_repository_secret ACR_USERNAME "$acr_username"
set_repository_secret ACR_PASSWORD "$acr_password"
set_environment_secret SERVER_SSH_PRIVATE_KEY "$(cat "$DEPLOY_KEY")"
set_environment_secret SERVER_SSH_KNOWN_HOSTS "$known_hosts_entry"

set_environment_variable SERVER_HOST "$SERVER_HOST"
set_environment_variable SERVER_USER "$SERVER_USER"
set_environment_variable SERVER_DEPLOY_PATH "$SERVER_DEPLOY_PATH"
set_environment_variable PUBLIC_BASE_URL "$PUBLIC_BASE_URL"

read -r -p '现在配置 Tailscale OAuth？[y/N] ' configure_tailscale
if [[ "$configure_tailscale" =~ ^[Yy]$ ]]; then
  read -r -p 'Tailscale OAuth Client ID：' tailscale_client_id
  read -r -s -p 'Tailscale OAuth Secret：' tailscale_secret
  printf '\n'

  if [[ -z "$tailscale_client_id" || -z "$tailscale_secret" ]]; then
    printf 'Tailscale OAuth 信息不能为空。\n' >&2
    exit 1
  fi

  set_environment_secret TAILSCALE_OAUTH_CLIENT_ID "$tailscale_client_id"
  set_environment_secret TAILSCALE_OAUTH_SECRET "$tailscale_secret"
fi

unset acr_password
unset tailscale_secret 2>/dev/null || true

cat <<EOF

GitHub 发布配置已写入：
- Repository secrets: ACR_USERNAME, ACR_PASSWORD
- Environment secrets: SERVER_SSH_PRIVATE_KEY, SERVER_SSH_KNOWN_HOSTS
- Environment variables: SERVER_HOST, SERVER_USER, SERVER_DEPLOY_PATH, PUBLIC_BASE_URL

请在 GitHub 的 $ENVIRONMENT 环境中手动启用 Required reviewers。
只构建模式不依赖 Tailscale；正式部署前必须补齐两个 Tailscale OAuth secrets。
EOF
