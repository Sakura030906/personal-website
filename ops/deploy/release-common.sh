#!/usr/bin/env bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
COMPOSE_OVERRIDE_FILE="${COMPOSE_OVERRIDE_FILE:-$PROJECT_DIR/docker-compose.acr.yml}"
STATE_DIR="${STATE_DIR:-$PROJECT_DIR/.deploy-state}"
RELEASE_IMAGE_PREFIX="${RELEASE_IMAGE_PREFIX:-crpi-sul1qi73t2e5rqq7.cn-hongkong.personal.cr.aliyuncs.com/hongxiang000702}"

compose() {
  docker compose \
    -f "$COMPOSE_FILE" \
    -f "$COMPOSE_OVERRIDE_FILE" \
    --env-file "$ENV_FILE" \
    "$@"
}

release_value() {
  local key="$1"
  local file="$2"
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

validate_release_version() {
  local value="$1"
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || {
    echo "Release manifest contains an invalid RELEASE_VERSION" >&2
    return 1
  }
}

validate_release_image() {
  local key="$1"
  local value="$2"
  local repository="$3"
  local prefix="$RELEASE_IMAGE_PREFIX/$repository"
  local reference

  [[ "$value" != *[[:space:]]* ]] || {
    echo "Release manifest contains whitespace in $key" >&2
    return 1
  }

  if [[ "$value" == "$prefix@"* ]]; then
    reference="${value#"$prefix@"}"
    [[ "$reference" =~ ^sha256:[a-f0-9]{64}$ ]] || {
      echo "Release manifest contains an invalid digest for $key" >&2
      return 1
    }
    return 0
  fi

  if [[ "$value" == "$prefix:"* ]]; then
    reference="${value#"$prefix:"}"
    [[ "$reference" =~ ^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$ ]] || {
      echo "Release manifest contains an invalid tag for $key" >&2
      return 1
    }
    return 0
  fi

  echo "Release manifest $key must use $prefix" >&2
  return 1
}

load_release() {
  local file="$1"
  local key value

  [[ -f "$file" ]] || {
    echo "Release manifest not found: $file" >&2
    return 1
  }

  for key in RELEASE_VERSION FRONTEND_IMAGE BACKEND_IMAGE BACKUP_IMAGE; do
    value="$(release_value "$key" "$file")"
    [[ -n "$value" ]] || {
      echo "Release manifest is missing $key: $file" >&2
      return 1
    }
    [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || {
      echo "Release manifest contains an invalid $key value" >&2
      return 1
    }
    printf -v "$key" "%s" "$value"
    export "$key"
  done

  validate_release_version "$RELEASE_VERSION"
  validate_release_image FRONTEND_IMAGE "$FRONTEND_IMAGE" frontend
  validate_release_image BACKEND_IMAGE "$BACKEND_IMAGE" backend
  validate_release_image BACKUP_IMAGE "$BACKUP_IMAGE" backup
}

container_image() {
  local service="$1"
  local container_id
  container_id="$(compose ps -q "$service")"
  [[ -n "$container_id" ]] || {
    echo "No running container found for service: $service" >&2
    return 1
  }
  docker inspect --format '{{.Config.Image}}' "$container_id"
}

capture_running_release() {
  local destination="$1"
  local frontend backend backup temp_file

  mkdir -p "$STATE_DIR"
  frontend="$(container_image web)"
  backend="$(container_image api)"
  backup="$(container_image backup)"
  temp_file="$(mktemp "$STATE_DIR/.release.XXXXXX")"

  {
    printf 'RELEASE_VERSION=captured-%s\n' "$(date -u +%Y%m%dT%H%M%SZ)"
    printf 'FRONTEND_IMAGE=%s\n' "$frontend"
    printf 'BACKEND_IMAGE=%s\n' "$backend"
    printf 'BACKUP_IMAGE=%s\n' "$backup"
  } >"$temp_file"

  mv "$temp_file" "$destination"
}

print_release_plan() {
  local action="$1"
  local base_url="$2"

  cat <<EOF
$action plan
  release:  $RELEASE_VERSION
  frontend: $FRONTEND_IMAGE
  backend:  $BACKEND_IMAGE
  backup:   $BACKUP_IMAGE
  target:   $base_url
EOF
}

run_acceptance() {
  local base_url="$1"
  ENV_FILE="$ENV_FILE" \
    COMPOSE_FILE="$COMPOSE_FILE" \
    COMPOSE_OVERRIDE_FILE="$COMPOSE_OVERRIDE_FILE" \
    "$SCRIPT_DIR/acceptance.sh" "$base_url"
}
