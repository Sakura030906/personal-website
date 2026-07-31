#!/bin/sh
set -eu

CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-/usr/bin/cloudflared}"
CLOUDFLARED_CONFIG="${CLOUDFLARED_CONFIG:-/etc/cloudflared/config.yml}"
CLOUDFLARED_LOG="${CLOUDFLARED_LOG:-$HOME/cloudflared-http2.log}"

if pgrep -u "$(id -u)" -x cloudflared >/dev/null 2>&1; then
  exit 0
fi

nohup "$CLOUDFLARED_BIN" \
  --no-autoupdate \
  --protocol http2 \
  --config "$CLOUDFLARED_CONFIG" \
  tunnel run >>"$CLOUDFLARED_LOG" 2>&1 </dev/null &
