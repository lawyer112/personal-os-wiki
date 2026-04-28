#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$APP_DIR/run/personal-wiki.pid"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "running pid=$pid"
  else
    echo "stale pid file"
  fi
else
  echo "not running"
fi

curl -fsS "http://127.0.0.1:${WIKI_PORT:-3422}/api/health" || true
echo
