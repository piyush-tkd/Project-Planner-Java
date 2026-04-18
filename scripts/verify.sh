#!/usr/bin/env bash
# =============================================================================
# verify.sh — Portfolio Planner local verification pipeline
#
# Usage:
#   ./scripts/verify.sh           → backend compile+test + frontend lint/typecheck/test/build (default)
#   ./scripts/verify.sh --fast    → lint + compile only  (<30s, used by pre-commit)
#   ./scripts/verify.sh --full    → everything including Playwright e2e
#
# Exit codes: 0 = pass, 1 = fail
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
BACKEND="$REPO_ROOT/backend"
AI_MODULE="$REPO_ROOT/portfolio-planner-ai"
RESULT_FILE="$REPO_ROOT/.verify-last-run.json"

# ── Parse flags ───────────────────────────────────────────────────────────────
MODE="default"
for arg in "$@"; do
  case $arg in
    --fast) MODE="fast" ;;
    --full) MODE="full" ;;
  esac
done

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
header()  { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; echo -e "${CYAN}  Step $1: $2${NC}"; echo -e "${CYAN}══════════════════════════════════════${NC}"; }
success() { echo -e "${GREEN}  ✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail()    { echo -e "${RED}  ✗ $1${NC}"; }

# ── Timer ─────────────────────────────────────────────────────────────────────
START_TIME=$(date +%s)

# ── Maven detection ───────────────────────────────────────────────────────────
# Prefer mvnw at repo root, then backend mvnw, then system mvn
if   [[ -x "$REPO_ROOT/mvnw" ]];    then MVN="$REPO_ROOT/mvnw"
elif [[ -x "$BACKEND/mvnw" ]];      then MVN="$BACKEND/mvnw"
elif command -v mvn &>/dev/null;    then MVN="mvn"
else
  warn "Maven not found (mvnw or mvn). Backend steps will be skipped."
  MVN=""
fi

# ── Track failures ────────────────────────────────────────────────────────────
FAILED_STEP=""
STEP=0

run_step() {
  local name="$1"; shift
  STEP=$((STEP + 1))
  header "$STEP" "$name"
  local tmp_out; tmp_out=$(mktemp /tmp/verify-XXXXXX)
  if "$@" >"$tmp_out" 2>&1; then
    success "$name passed"
    rm -f "$tmp_out"
    return 0
  else
    fail "$name FAILED"
    echo ""
    echo "  Last 20 lines of output:"
    echo "  ─────────────────────────"
    tail -20 "$tmp_out" | sed 's/^/  /'
    echo ""
    rm -f "$tmp_out"
    FAILED_STEP="$name"
    return 1
  fi
}

# ── Write result JSON ─────────────────────────────────────────────────────────
write_result() {
  local result="$1"; local failed_step="${2:-null}"
  local end_time; end_time=$(date +%s)
  local duration=$((end_time - START_TIME))
  if [[ "$failed_step" != "null" ]]; then
    failed_step="\"$failed_step\""
  fi
  cat > "$RESULT_FILE" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "result": "$result",
  "failed_step": $failed_step,
  "mode": "$MODE",
  "duration_seconds": $duration
}
EOF
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
  local end_time; end_time=$(date +%s)
  local duration=$((end_time - START_TIME))
  local mins=$((duration / 60)); local secs=$((duration % 60))
  echo ""
  echo -e "${CYAN}══════════════════════════════════════${NC}"
  if [[ -z "$FAILED_STEP" ]]; then
    echo -e "${GREEN}  ✓ PASS  (duration: ${mins}m ${secs}s | mode: ${MODE})${NC}"
    write_result "pass"
  else
    echo -e "${RED}  ✗ FAIL at step $STEP: $FAILED_STEP  (duration: ${mins}m ${secs}s)${NC}"
    write_result "fail" "$FAILED_STEP"
  fi
  echo -e "${CYAN}══════════════════════════════════════${NC}"
}

# =============================================================================
# STEPS
# =============================================================================

echo ""
echo -e "${CYAN}Portfolio Planner — verify.sh (mode: ${MODE})${NC}"
echo -e "${CYAN}Repo: ${REPO_ROOT}${NC}"

# ── Step: Backend compile ─────────────────────────────────────────────────────
if [[ -n "$MVN" ]]; then
  if ! run_step "Backend compile" bash -c "cd '$BACKEND' && '$MVN' compile -q"; then
    print_summary; exit 1
  fi
else
  warn "Skipping backend compile (no Maven found)"
fi

# ── Step: Frontend lint ───────────────────────────────────────────────────────
if ! run_step "Frontend lint" bash -c "cd '$FRONTEND' && npm run lint"; then
  print_summary; exit 1
fi

# ── Step: Frontend typecheck ──────────────────────────────────────────────────
if ! run_step "Frontend typecheck" bash -c "cd '$FRONTEND' && npm run typecheck"; then
  print_summary; exit 1
fi

# ── Steps below skipped in --fast mode ───────────────────────────────────────
if [[ "$MODE" == "fast" ]]; then
  warn "Fast mode: skipping tests and build"
  print_summary; exit 0
fi

# ── Step: Backend tests ───────────────────────────────────────────────────────
if [[ -n "$MVN" ]]; then
  if ! run_step "Backend tests" bash -c "cd '$BACKEND' && '$MVN' test -q"; then
    print_summary; exit 1
  fi
else
  warn "Skipping backend tests (no Maven found)"
fi

# ── Step: Frontend unit tests ─────────────────────────────────────────────────
if ! run_step "Frontend unit tests" bash -c "cd '$FRONTEND' && TMPDIR=/tmp npm test -- --run"; then
  print_summary; exit 1
fi

# ── Step: Frontend build ──────────────────────────────────────────────────────
# Use a temp outDir so we don't require write perms on the committed dist folder
if ! run_step "Frontend build" bash -c "cd '$FRONTEND' && TMPDIR=/tmp npx vite build --outDir /tmp/pp-verify-dist --emptyOutDir"; then
  print_summary; exit 1
fi

# ── Step: Playwright e2e (--full only) ────────────────────────────────────────
if [[ "$MODE" == "full" ]]; then
  if ! run_step "Playwright e2e" bash -c "cd '$FRONTEND' && npm run test:e2e"; then
    print_summary; exit 1
  fi
fi

print_summary
exit 0
