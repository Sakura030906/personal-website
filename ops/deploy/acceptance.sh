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

# A restart loop can look healthy for the few milliseconds in which the
# process is running. Give scheduled services time to complete their first
# cycle, then verify the same containers are still stable.
sleep 10
for service in api web backup maintenance; do
  container_id="$(compose ps -q "$service")"
  [ -n "$container_id" ] || { echo "FAIL no container found: $service"; exit 1; }
  status="$(docker inspect --format '{{.State.Status}}' "$container_id")"
  restarts="$(docker inspect --format '{{.RestartCount}}' "$container_id")"
  [ "$status" = "running" ] || { echo "FAIL service is not stable: $service ($status)"; exit 1; }
  [ "$restarts" = "0" ] || { echo "FAIL service restarted during rollout: $service ($restarts)"; exit 1; }
  echo "OK   service stable: $service"
done

compose exec -T maintenance test -w /app/maintenance-state \
  || { echo "FAIL maintenance state volume is not writable"; exit 1; }
compose exec -T maintenance python -m scripts.maintenance_healthcheck \
  || { echo "FAIL maintenance cycle is not healthy"; exit 1; }
echo "OK   maintenance state is writable and current"

"$SCRIPT_DIR/verify.sh" "$BASE_URL"
echo "Production acceptance passed"
