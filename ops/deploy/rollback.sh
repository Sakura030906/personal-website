#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=release-common.sh
source "$SCRIPT_DIR/release-common.sh"

PLAN_ONLY=false
if [[ "${1:-}" == "--plan" ]]; then
  PLAN_ONLY=true
  shift
fi

RELEASE_FILE="${1:-$STATE_DIR/previous-release.env}"
BASE_URL="${2:-https://sakura000702.me}"
BEFORE_ROLLBACK="$STATE_DIR/before-rollback.env"
RESTORE_ARMED=false

load_release "$RELEASE_FILE"
print_release_plan "Application rollback" "$BASE_URL"

if [[ "$PLAN_ONLY" == true ]]; then
  exit 0
fi

restore_on_error() {
  local exit_code=$?
  trap - ERR

  if [[ "$RESTORE_ARMED" == true && -f "$BEFORE_ROLLBACK" ]]; then
    echo "Rollback failed; restoring the images that were running before rollback" >&2
    load_release "$BEFORE_ROLLBACK"
    compose up -d --no-build api web backup maintenance
    run_acceptance "$BASE_URL" || true
  fi

  exit "$exit_code"
}
trap restore_on_error ERR

python3 "$SCRIPT_DIR/preflight.py" "$ENV_FILE"
compose config --quiet

mkdir -p "$STATE_DIR"
capture_running_release "$BEFORE_ROLLBACK"

compose pull api web backup maintenance
RESTORE_ARMED=true
compose up -d --no-build api web backup maintenance
run_acceptance "$BASE_URL"
capture_running_release "$STATE_DIR/current-release.env"
RESTORE_ARMED=false

echo "Application images rolled back successfully"
echo "Database migrations were not downgraded; restore a backup only when a migration is not backward compatible"
