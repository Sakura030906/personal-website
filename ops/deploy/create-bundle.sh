#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
CHECK_ONLY=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' EXIT
  OUTPUT="$temp_dir/deploy-bundle.tar.gz"
else
  OUTPUT="${1:?Usage: create-bundle.sh OUTPUT | --check}"
fi

mkdir -p "$(dirname -- "$OUTPUT")"
cd "$PROJECT_DIR"

files=(
  docker-compose.prod.yml
  docker-compose.acr.yml
  ops/deploy
  ops/nginx/cloudflare-http.conf
  ops/nginx/proxy_params
  ops/nginx/runtime/http.conf
  ops/nginx/tls.conf.template
)

for file in "${files[@]}"; do
  [[ -e "$file" ]] || {
    echo "Deployment bundle input is missing: $file" >&2
    exit 1
  }
done

tar \
  --exclude='.DS_Store' \
  --exclude='*.env' \
  --exclude='incoming-*' \
  -czf "$OUTPUT" \
  "${files[@]}"

entries="$(tar -tzf "$OUTPUT")"
for required in \
  docker-compose.prod.yml \
  docker-compose.acr.yml \
  ops/deploy/release.sh \
  ops/deploy/acceptance.sh; do
  grep -Fxq "$required" <<<"$entries" || {
    echo "Deployment bundle is missing required entry: $required" >&2
    exit 1
  }
done

if grep -Eq '(^|/)\.env($|\.)|(^|/)\.git/|\.DS_Store$' <<<"$entries"; then
  echo "Deployment bundle contains a forbidden file" >&2
  exit 1
fi

if [[ "$CHECK_ONLY" == true ]]; then
  echo "Deployment bundle check passed"
else
  echo "Created deployment bundle: $OUTPUT"
fi
