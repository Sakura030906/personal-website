#!/bin/sh
set -eu

BASE_URL="${1:-https://sakura000702.me}"
ENV_FILE="${ENV_FILE:-.env.production}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

METRICS_TOKEN="${METRICS_TOKEN:-}"
if [ -z "$METRICS_TOKEN" ] && [ -f "$ENV_FILE" ]; then
  METRICS_TOKEN="$(awk -F= '$1 == "METRICS_TOKEN" { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE")"
fi
[ -n "$METRICS_TOKEN" ] || {
  echo "FAIL metrics: set METRICS_TOKEN or provide ENV_FILE"
  exit 1
}

check() {
  path="$1"
  expected="$2"
  code="$(curl -L -sS -o /dev/null -w '%{http_code}' "$BASE_URL$path")"
  [ "$code" = "$expected" ] || { echo "FAIL $path: HTTP $code"; exit 1; }
  echo "OK   $path: HTTP $code"
}

check "/" "200"
check "/healthz" "200"
check "/api/health" "200"
check "/api/ready" "200"
check "/admin/" "200"
check "/data/site.json" "200"

metrics_public_code="$(curl -L -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/metrics")"
[ "$metrics_public_code" = "404" ] || {
  echo "FAIL metrics: unauthenticated endpoint returned HTTP $metrics_public_code"
  exit 1
}
echo "OK   /api/metrics: anonymous access denied"

metrics_code="$(curl -L -sS -o "$WORK_DIR/metrics.txt" -w '%{http_code}' \
  -H "X-Metrics-Token: $METRICS_TOKEN" "$BASE_URL/api/metrics")"
[ "$metrics_code" = "200" ] || {
  echo "FAIL metrics: authenticated endpoint returned HTTP $metrics_code"
  exit 1
}
echo "OK   /api/metrics: authenticated access allowed"
grep -Eq '^portfolio_backup_last_success_age_seconds [0-9]' "$WORK_DIR/metrics.txt" \
  || { echo "FAIL metrics: no successful backup marker"; exit 1; }
grep -Eq '^portfolio_maintenance_last_success_age_seconds [0-9]' "$WORK_DIR/metrics.txt" \
  || { echo "FAIL metrics: no successful maintenance marker"; exit 1; }
echo "OK   backup and maintenance success markers"

curl -L -sS "$BASE_URL/" -o "$WORK_DIR/index.html"
stylesheet="$(sed -n 's/.*href="\([^\"]*\.css\)".*/\1/p' "$WORK_DIR/index.html" | head -n 1)"
script="$(sed -n 's/.*src="\([^\"]*\.js\)".*/\1/p' "$WORK_DIR/index.html" | head -n 1)"
[ -n "$stylesheet" ] || { echo "FAIL index: stylesheet reference missing"; exit 1; }
[ -n "$script" ] || { echo "FAIL index: script reference missing"; exit 1; }

asset_check() {
  asset="$1"
  minimum="$2"
  label="$3"
  case "$asset" in /*) url="$BASE_URL$asset" ;; *) url="$BASE_URL/$asset" ;; esac
  code="$(curl -L -sS -o "$WORK_DIR/$label" -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || { echo "FAIL $asset: HTTP $code"; exit 1; }
  size="$(wc -c < "$WORK_DIR/$label" | tr -d ' ')"
  [ "$size" -ge "$minimum" ] || { echo "FAIL $asset: only $size bytes"; exit 1; }
  echo "OK   $asset: HTTP 200, $size bytes"
}

asset_check "$stylesheet" 10000 "site.css"
asset_check "$script" 10000 "site.js"
grep -q ':root' "$WORK_DIR/site.css" || { echo "FAIL stylesheet content is invalid"; exit 1; }
grep -q 'data-route' "$WORK_DIR/index.html" || { echo "FAIL homepage content is incomplete"; exit 1; }
echo "OK   static asset integrity"

case "$BASE_URL" in
  https://*)
    host="${BASE_URL#https://}"
    host="${host%%/*}"
    echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
      | openssl x509 -noout -subject -issuer -dates
    ;;
esac
