#!/bin/sh
set -eu

BASE_URL="${1:-https://sakura000702.me}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
COMPOSE_OVERRIDE_FILE="${COMPOSE_OVERRIDE_FILE:-}"

python3 "$SCRIPT_DIR/preflight.py" "$ENV_FILE"

compose() {
  if [ -n "$COMPOSE_OVERRIDE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_OVERRIDE_FILE" --env-file "$ENV_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
  fi
}

compose config --quiet

running="$(compose ps --status running --services)"
for service in postgres etcd minio milvus api web backup maintenance; do
  echo "$running" | grep -qx "$service" || { echo "FAIL service is not running: $service"; exit 1; }
  echo "OK   service running: $service"
done

"$SCRIPT_DIR/verify.sh" "$BASE_URL"
echo "Production acceptance passed"
