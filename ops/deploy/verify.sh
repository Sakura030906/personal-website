#!/bin/sh
set -eu

BASE_URL="${1:-https://sakura000702.me}"

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

case "$BASE_URL" in
  https://*)
    host="${BASE_URL#https://}"
    host="${host%%/*}"
    echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
      | openssl x509 -noout -subject -issuer -dates
    ;;
esac
