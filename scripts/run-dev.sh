#!/usr/bin/env bash
# run-dev.sh — Install deps if needed and start API + web client (pnpm dev).
# Usage: ./scripts/run-dev.sh
#        pnpm start
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_HOST="${AIGEN_HOST:-127.0.0.1}"
API_PORT="${AIGEN_PORT:-8787}"
WEB_URL="http://127.0.0.1:5173"
API_URL="http://${API_HOST}:${API_PORT}"

die() {
  echo "error: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' not found. $2"
}

need_cmd node "Install Node.js 20+ from https://nodejs.org"
need_cmd pnpm "Install with: npm install -g pnpm"

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  die "Node.js 20+ required (found $(node -v))"
fi

if [[ ! -d node_modules ]] || [[ ! -d apps/server/node_modules && ! -e node_modules/.pnpm ]]; then
  echo "[aigen-studio] Installing dependencies (pnpm install)…"
  pnpm install
fi

echo "[aigen-studio] Starting API + web client…"
echo "[aigen-studio]   Web UI:  ${WEB_URL}"
echo "[aigen-studio]   API:     ${API_URL}"
echo "[aigen-studio]   Health:  ${API_URL}/api/v1/health"
echo "[aigen-studio] App token: pnpm auth:show   (or check server log on first start)"
echo "[aigen-studio] Stop with Ctrl+C"
echo

exec pnpm dev
