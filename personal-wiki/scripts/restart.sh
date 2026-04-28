#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$APP_DIR/scripts/stop.sh"
"$APP_DIR/scripts/start.sh"
