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

RELEASE_FILE="${1:-$SCRIPT_DIR/release-2026.07.31.env}"
BASE_URL="${2:-https://sakura000702.me}"
PREVIOUS_RELEASE="$STATE_DIR/previous-release.env"
CURRENT_RELEASE="$STATE_DIR/current-release.env"
BACKUP_LOG="$STATE_DIR/pre-release-backup.log"
ROLLBACK_ARMED=false

load_release "$RELEASE_FILE"
print_release_plan "Production release" "$BASE_URL"

if [[ "$PLAN_ONLY" == true ]]; then
  exit 0
fi

rollback_on_error() {
  local exit_code=$?
  trap - ERR

  if [[ "$ROLLBACK_ARMED" == true && -f "$PREVIOUS_RELEASE" ]]; then
    echo "Release failed; restoring previous application images" >&2
    load_release "$PREVIOUS_RELEASE"
    compose up -d --no-build api web backup maintenance
    if ! run_acceptance "$BASE_URL"; then
      echo "Automatic image rollback also failed; manual recovery is required" >&2
    fi
  fi

  exit "$exit_code"
}
trap rollback_on_error ERR

python3 "$SCRIPT_DIR/preflight.py" "$ENV_FILE"
compose config --quiet

mkdir -p "$STATE_DIR"
capture_running_release "$PREVIOUS_RELEASE"

echo "Creating the pre-release backup"
compose exec -T backup python backup_once.py | tee "$BACKUP_LOG"

echo "Pulling release images"
compose pull api web backup maintenance

ROLLBACK_ARMED=true
echo "Rolling out release $RELEASE_VERSION"
compose up -d --no-build api web backup maintenance
run_acceptance "$BASE_URL"

capture_running_release "$CURRENT_RELEASE"
cp "$RELEASE_FILE" "$STATE_DIR/last-successful-manifest.env"
ROLLBACK_ARMED=false
echo "Release completed: $RELEASE_VERSION"
