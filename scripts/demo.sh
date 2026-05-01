#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: sh ./scripts/demo.sh [--no-build]

Starts the local Personal OS + Personal Wiki demo.

Options:
  --no-build    Reuse existing Docker images instead of rebuilding.
EOF
}

NO_BUILD=0
case "${1:-}" in
  "")
    ;;
  --no-build|-n)
    NO_BUILD=1
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but was not found on PATH." >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT"

echo "Starting Personal OS + Personal Wiki demo..."
if [ "$NO_BUILD" -eq 1 ]; then
  docker compose up -d
else
  docker compose up -d --build
fi

cat <<'EOF'

Demo is starting on localhost.
Personal OS:   http://localhost:3000/auth/read
  Read token:  demo-read-token
Personal Wiki: http://localhost:3422/auth/read
  Read token:  demo-wiki-read-token

Stop demo:
  docker compose down

Reset demo data:
  docker compose down -v
EOF
