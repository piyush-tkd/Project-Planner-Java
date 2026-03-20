#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# sync-to-ado.sh
#
# Copies all source files from this personal Git repo into the Azure DevOps
# repo folder, ready to commit and push.
#
# Usage:
#   ./sync-to-ado.sh                      # sync only
#   ./sync-to-ado.sh --commit             # sync + git add + commit
#   ./sync-to-ado.sh --commit --push      # sync + commit + push to ADO
#   ./sync-to-ado.sh --dry-run            # preview what would be copied
#
# Setup (first time only):
#   1. Clone your ADO repo somewhere on your machine.
#   2. Set ADO_DIR below to point to that cloned folder.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── CONFIGURE THESE TWO PATHS ─────────────────────────────────────────────────

# Where your personal Git repo lives (source — this folder)
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Where your Azure DevOps repo is cloned (destination)
# Edit this to point to your ADO clone location, e.g.:
#   ADO_DIR="$HOME/repos/portfolio-planner-ado"
ADO_DIR="${ADO_DIR:-/Users/piyushbaheti/repos/ado-repo}"

# ── COLOURS ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[sync]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

# ── PARSE ARGS ────────────────────────────────────────────────────────────────
DO_COMMIT=false
DO_PUSH=false
DRY_RUN=false
COMMIT_MSG=""

for arg in "$@"; do
  case "$arg" in
    --commit)  DO_COMMIT=true ;;
    --push)    DO_PUSH=true ;;
    --dry-run) DRY_RUN=true ;;
    --message=*) COMMIT_MSG="${arg#--message=}" ;;
    --help|-h)
      echo "Usage: $0 [--commit] [--push] [--dry-run] [--message=\"your message\"]"
      exit 0 ;;
  esac
done

# ── VALIDATE ADO_DIR ──────────────────────────────────────────────────────────
if [[ -z "$ADO_DIR" ]]; then
  error "ADO_DIR is not set.\n\n  Either edit sync-to-ado.sh and set ADO_DIR=... near the top,\n  or run:  ADO_DIR=/path/to/your/ado-repo ./sync-to-ado.sh"
fi

if [[ ! -d "$ADO_DIR" ]]; then
  error "ADO_DIR does not exist: $ADO_DIR\n  Clone your ADO repo there first:\n    git clone https://your-org@dev.azure.com/your-org/your-repo/_git/your-repo \"$ADO_DIR\""
fi

if [[ ! -d "$ADO_DIR/.git" ]]; then
  error "$ADO_DIR is not a git repository. Make sure you cloned the ADO repo there."
fi

# ── FILES / FOLDERS TO EXCLUDE FROM THE COPY ─────────────────────────────────
# These are intentionally left out — build artefacts, local config, secrets.
EXCLUDES=(
  ".git"
  ".gitignore"
  "node_modules"
  "frontend/dist"
  "frontend/.vite"
  "frontend/node_modules"
  "backend/target"
  "backend/.mvn/wrapper/*.jar"
  "*.class"
  "*.jar"
  "*.war"
  ".env"
  ".env.local"
  ".env.*.local"
  "*.local"
  "application-local.yml"
  "application-local.yaml"
  "application-local.properties"
  "application-*.local.yml"
  "application-*.local.yaml"
  ".DS_Store"
  "Thumbs.db"
  "*.log"
  "*.tmp"
  "sync-to-ado.sh"       # don't copy this script itself
  "DEPLOYMENT.md"        # optional: remove if you want these in ADO too
  "DEPLOYMENT_NO_DOCKER.md"
  "sample files"
  "generate_test_excels.py"
  ".env.example"         # handled separately below — first-time only
)

# Build rsync --exclude flags
EXCLUDE_FLAGS=()
for ex in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+=("--exclude=$ex")
done

# ── DRY RUN PREVIEW ───────────────────────────────────────────────────────────
if $DRY_RUN; then
  warn "DRY RUN — no files will be changed"
  echo ""
  info "Would copy from:"
  echo "  Source : $SOURCE_DIR"
  echo "  Dest   : $ADO_DIR"
  echo ""
  info "Files that would be synced (new/changed):"
  rsync -avhn --delete \
    "${EXCLUDE_FLAGS[@]}" \
    "$SOURCE_DIR/" "$ADO_DIR/" \
    | grep -v "^sending\|^sent\|^total\|^\.$" || true
  # Show .env.example status
  if [[ -f "$ADO_DIR/.env.example" ]]; then
    echo "  [skip]  .env.example — already exists in ADO repo, will not overwrite"
  else
    echo "  [new]   .env.example — will be created (first time)"
  fi
  exit 0
fi

# ── SYNC ──────────────────────────────────────────────────────────────────────
echo ""
info "Syncing to ADO repo..."
echo "  Source : $SOURCE_DIR"
echo "  Dest   : $ADO_DIR"
echo ""

rsync -ah --delete \
  --stats \
  "${EXCLUDE_FLAGS[@]}" \
  "$SOURCE_DIR/" "$ADO_DIR/" \
  | grep -E "^(Number of|Total|Literal|Matched|File list)" || true

echo ""
success "Files synced to $ADO_DIR"

# ── .env.example — first time only ───────────────────────────────────────────
if [[ -f "$ADO_DIR/.env.example" ]]; then
  info ".env.example already exists in ADO repo — skipping (won't overwrite)"
else
  cp "$SOURCE_DIR/.env.example" "$ADO_DIR/.env.example"
  success ".env.example copied (first time — fill in real values on the server)"
fi

# ── SHOW GIT DIFF SUMMARY ─────────────────────────────────────────────────────
echo ""
info "Changes in ADO repo:"
cd "$ADO_DIR"

CHANGED=$(git status --short)
if [[ -z "$CHANGED" ]]; then
  success "No changes — ADO repo is already up to date."
  exit 0
fi

# Show a clean summary
ADDED=$(git status --short | grep -c "^?" || true)
MODIFIED=$(git status --short | grep -c "^ M\|^M" || true)
DELETED=$(git status --short | grep -c "^ D\|^D" || true)

echo ""
echo "  Modified : $MODIFIED file(s)"
echo "  New      : $ADDED file(s)"
echo "  Deleted  : $DELETED file(s)"
echo ""
git status --short | head -40
TOTAL=$(echo "$CHANGED" | wc -l | tr -d ' ')
if (( TOTAL > 40 )); then
  warn "...and $((TOTAL - 40)) more. Run 'git status' in $ADO_DIR to see all."
fi

# ── COMMIT ────────────────────────────────────────────────────────────────────
if $DO_COMMIT; then
  echo ""
  info "Staging all changes..."
  git add -A

  # Auto-generate commit message if not provided
  if [[ -z "$COMMIT_MSG" ]]; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
    COMMIT_MSG="sync: update from personal repo ($TIMESTAMP)"
  fi

  git commit -m "$COMMIT_MSG"
  success "Committed: \"$COMMIT_MSG\""
fi

# ── PUSH ──────────────────────────────────────────────────────────────────────
if $DO_PUSH; then
  if ! $DO_COMMIT; then
    warn "--push requires --commit. Skipping push."
  else
    echo ""
    info "Pushing to Azure DevOps..."
    git push
    success "Pushed to ADO."
  fi
fi

# ── NEXT STEPS REMINDER ───────────────────────────────────────────────────────
if ! $DO_COMMIT; then
  echo ""
  echo -e "${YELLOW}Next steps (run in $ADO_DIR):${NC}"
  echo "  git add -A"
  echo "  git commit -m \"your message\""
  echo "  git push"
  echo ""
  echo "  Or re-run this script with:  ./sync-to-ado.sh --commit --push"
fi

##  cd "/Users/piyushbaheti/Project Planner"
## ./sync-to-ado.sh --commit --push --message="your message"

echo ""
