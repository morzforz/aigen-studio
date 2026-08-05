#!/usr/bin/env bash
# check-docs-scope.sh — Assert Aigen Studio docs reflect rename + text/lore scope.
# Purpose: structural verification of shipped product docs (no app code yet).
# Exit 0 on success; print FAIL and exit 1 on any missing invariant.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONCEPT="$ROOT/docs/CONCEPT.md"
INDEX="$ROOT/INDEX.md"
RESEARCH="$ROOT/docs/RESEARCH.md"
fail=0

assert_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "FAIL: missing file $f"
    fail=1
  fi
}

assert_grep() {
  local desc="$1"
  local pattern="$2"
  local file="$3"
  if ! grep -qE "$pattern" "$file"; then
    echo "FAIL: $desc — expected /$pattern/ in $file"
    fail=1
  else
    echo "OK: $desc"
  fi
}

assert_no_grep() {
  local desc="$1"
  local pattern="$2"
  local file="$3"
  # Only fail if product is still titled/framed as ImageGen Studio as active name
  if grep -qE "$pattern" "$file"; then
    echo "FAIL: $desc — found /$pattern/ in $file"
    fail=1
  else
    echo "OK: $desc"
  fi
}

assert_file "$CONCEPT"
assert_file "$INDEX"
assert_file "$RESEARCH"

echo "=== Product rename ==="
assert_grep "CONCEPT title is Aigen Studio" '^# Aigen Studio' "$CONCEPT"
assert_grep "INDEX names Aigen Studio" 'Aigen Studio' "$INDEX"
assert_grep "INDEX names aigen-studio" 'aigen-studio' "$INDEX"
assert_grep "RESEARCH title is Aigen Studio" '^# Aigen Studio' "$RESEARCH"
assert_no_grep "INDEX not titled ImageGen Studio" 'ImageGen Studio' "$INDEX"
assert_no_grep "RESEARCH body not using ImageGen Studio product name" 'ImageGen Studio' "$RESEARCH"

echo "=== Text generation + local LLMs in scope ==="
assert_grep "CONCEPT text generation assistance" 'text generation' "$CONCEPT"
assert_grep "CONCEPT local LLMs" 'local LLMs' "$CONCEPT"
assert_grep "INDEX text assistance" 'text' "$INDEX"

echo "=== Lore repository + story scaffolding ==="
assert_grep "CONCEPT lore repository" 'lore repository' "$CONCEPT"
assert_grep "CONCEPT lorebook" 'lorebook' "$CONCEPT"
assert_grep "CONCEPT memory text / memory" 'memory' "$CONCEPT"
assert_grep "CONCEPT system prompts" 'system prompts' "$CONCEPT"
assert_grep "CONCEPT story scaffolding" 'story scaffolding|Story scaffolding' "$CONCEPT"
assert_grep "INDEX lore repository" 'lore repository' "$INDEX"
assert_grep "INDEX story scaffolding" 'story scaffolding' "$INDEX"

echo "=== NovelAI text-UI deferred ==="
assert_grep "CONCEPT defers text-UI" 'deferred|open / deferred|UI integration deferred' "$CONCEPT"
assert_grep "INDEX notes deferred text-UI" 'text-UI path deferred|deferred' "$INDEX"

echo "=== Image hard rules preserved ==="
assert_grep "CONCEPT HARD LIMITATION" 'HARD LIMITATION' "$CONCEPT"
assert_grep "CONCEPT human-initiated image" 'human-initiated' "$CONCEPT"
assert_grep "CONCEPT auto-save / vault goal" 'auto-save|vault' "$CONCEPT"
assert_grep "RESEARCH human-initiated image policy" 'human-initiated only' "$RESEARCH"

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "check-docs-scope: FAILED"
  exit 1
fi
echo
echo "check-docs-scope: PASSED"
exit 0
