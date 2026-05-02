#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$APP_DIR/run"
LOG_DIR="$APP_DIR/logs"
DATA_DIR="$APP_DIR/data"
PID_FILE="$RUN_DIR/personal-wiki.pid"
LOG_FILE="$LOG_DIR/personal-wiki.log"

mkdir -p "$RUN_DIR" "$LOG_DIR" "$DATA_DIR"

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE")"
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "personal-wiki already running pid=$old_pid"
    exit 0
  fi
fi

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "missing .env" >&2
  exit 1
fi

env_value() {
  sed -n "s/^$1=//p" "$APP_DIR/.env" |
    head -1 |
    tr -d '\r' |
    sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

export WIKI_API_TOKEN="$(env_value WIKI_API_TOKEN)"
export WIKI_READ_TOKEN="$(env_value WIKI_READ_TOKEN)"
export WIKI_REQUIRE_API_READ_AUTH="${WIKI_REQUIRE_API_READ_AUTH:-$(env_value WIKI_REQUIRE_API_READ_AUTH)}"
export WIKI_REQUIRE_API_READ_AUTH="${WIKI_REQUIRE_API_READ_AUTH:-1}"
export WIKI_REQUIRE_PAGE_READ_AUTH="${WIKI_REQUIRE_PAGE_READ_AUTH:-$(env_value WIKI_REQUIRE_PAGE_READ_AUTH)}"
export WIKI_REQUIRE_PAGE_READ_AUTH="${WIKI_REQUIRE_PAGE_READ_AUTH:-1}"
export WIKI_CORS_ALLOW_ORIGIN="${WIKI_CORS_ALLOW_ORIGIN:-$(env_value WIKI_CORS_ALLOW_ORIGIN)}"
export WIKI_SITE_TITLE="${WIKI_SITE_TITLE:-$(env_value WIKI_SITE_TITLE)}"
export WIKI_SITE_TITLE="${WIKI_SITE_TITLE:-Personal Wiki}"
export WIKI_DATA_DIR="$DATA_DIR"
export WIKI_HOST="${WIKI_HOST:-$(env_value WIKI_HOST)}"
export WIKI_HOST="${WIKI_HOST:-127.0.0.1}"
export WIKI_PORT="${WIKI_PORT:-$(env_value WIKI_PORT)}"
export WIKI_PORT="${WIKI_PORT:-3422}"

if [[ -f "$APP_DIR/scripts/proxy-env.sh" ]]; then
  # shellcheck disable=SC1091
  source "$APP_DIR/scripts/proxy-env.sh"
fi

cd "$APP_DIR"
nohup python3 "$APP_DIR/api/server.py" >> "$LOG_FILE" 2>&1 &
pid="$!"
echo "$pid" > "$PID_FILE"
echo "started personal-wiki pid=$pid port=$WIKI_PORT"
