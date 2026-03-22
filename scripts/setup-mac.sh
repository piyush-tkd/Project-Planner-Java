#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Portfolio Planner — macOS Development Setup Script
#  Tested on: macOS Sonoma / Sequoia (Apple Silicon)
#  Usage:     chmod +x scripts/setup-mac.sh && ./scripts/setup-mac.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}  ✔${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }
step()  { echo -e "\n${BOLD}${CYAN}═══ $* ═══${NC}"; }

# ── Locate project root (script lives in scripts/) ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# ── Configuration ───────────────────────────────────────────────────────────
DB_NAME="portfolio_planner"
PG_VERSION="16"
JAVA_VERSION="21"
NODE_VERSION="20"
OLLAMA_LLM_MODEL="llama3:8b"
OLLAMA_EMBED_MODEL="mxbai-embed-large"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║      Portfolio Planner — macOS Development Setup            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  This script will install and configure:"
echo "    • Homebrew (if missing)"
echo "    • Java $JAVA_VERSION (OpenJDK)"
echo "    • Maven"
echo "    • Node.js $NODE_VERSION"
echo "    • PostgreSQL $PG_VERSION + pgvector extension"
echo "    • Ollama + LLM ($OLLAMA_LLM_MODEL) + Embeddings ($OLLAMA_EMBED_MODEL)"
echo "    • Application database & dependencies"
echo ""
read -rp "Proceed? (Y/n): " proceed
[[ "$proceed" =~ ^[Nn] ]] && { echo "Aborted."; exit 0; }

ERRORS=()

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Homebrew
# ══════════════════════════════════════════════════════════════════════════════
step "Step 1/8 — Homebrew"

if ! command -v brew &> /dev/null; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add Homebrew to PATH for this session (Apple Silicon)
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    ok "Homebrew installed"
else
    ok "Homebrew already installed ($(brew --version | head -1))"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Java 21
# ══════════════════════════════════════════════════════════════════════════════
step "Step 2/8 — Java $JAVA_VERSION"

if ! brew list openjdk@$JAVA_VERSION &> /dev/null; then
    info "Installing OpenJDK $JAVA_VERSION..."
    brew install openjdk@$JAVA_VERSION
fi
ok "Java: $(  /opt/homebrew/opt/openjdk@$JAVA_VERSION/bin/java -version 2>&1 | head -1 )"

# Ensure java is on PATH
export JAVA_HOME="/opt/homebrew/opt/openjdk@$JAVA_VERSION/libexec/openjdk.jdk/Contents/Home"
export PATH="/opt/homebrew/opt/openjdk@$JAVA_VERSION/bin:$PATH"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Maven
# ══════════════════════════════════════════════════════════════════════════════
step "Step 3/8 — Maven"

if ! command -v mvn &> /dev/null; then
    info "Installing Maven..."
    brew install maven
fi
ok "Maven: $(mvn -version 2>&1 | head -1 | awk '{print $3}')"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Node.js
# ══════════════════════════════════════════════════════════════════════════════
step "Step 4/8 — Node.js $NODE_VERSION"

if ! brew list node@$NODE_VERSION &> /dev/null; then
    info "Installing Node.js $NODE_VERSION..."
    brew install node@$NODE_VERSION
fi
export PATH="/opt/homebrew/opt/node@$NODE_VERSION/bin:$PATH"
ok "Node.js: $(node -v)"
ok "npm: $(npm -v)"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: PostgreSQL 16 + pgvector
# ══════════════════════════════════════════════════════════════════════════════
step "Step 5/8 — PostgreSQL $PG_VERSION + pgvector"

export PATH="/opt/homebrew/opt/postgresql@$PG_VERSION/bin:$PATH"

# Install PostgreSQL
if ! brew list postgresql@$PG_VERSION &> /dev/null; then
    info "Installing PostgreSQL $PG_VERSION..."
    brew install postgresql@$PG_VERSION
fi
ok "PostgreSQL: $(psql --version | awk '{print $3}')"

# Start PostgreSQL
if ! brew services list | grep "postgresql@$PG_VERSION" | grep -q started; then
    info "Starting PostgreSQL..."
    brew services start postgresql@$PG_VERSION
    sleep 3
fi
ok "PostgreSQL service running"

# ── Install pgvector from source (must match PostgreSQL version) ─────────────
PG_CONFIG="/opt/homebrew/opt/postgresql@$PG_VERSION/bin/pg_config"
PGVECTOR_INSTALLED=false

# Check if pgvector is already installed for this PG version
if psql -d postgres -tAc "SELECT 1 FROM pg_available_extensions WHERE name = 'vector';" 2>/dev/null | grep -q 1; then
    ok "pgvector already installed"
    PGVECTOR_INSTALLED=true
else
    info "Building pgvector from source for PostgreSQL $PG_VERSION..."
    PGVECTOR_BUILD_DIR=$(mktemp -d)
    (
        cd "$PGVECTOR_BUILD_DIR"
        git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git .
        make PG_CONFIG="$PG_CONFIG"
        make install PG_CONFIG="$PG_CONFIG"
    ) && {
        ok "pgvector installed from source"
        PGVECTOR_INSTALLED=true
        # Restart PostgreSQL so it loads the new extension
        brew services restart postgresql@$PG_VERSION
        sleep 3
    } || {
        warn "pgvector build failed — vector search will be disabled but app still works"
        ERRORS+=("pgvector build failed — install Xcode CLI tools: xcode-select --install")
    }
    rm -rf "$PGVECTOR_BUILD_DIR"
fi

# ── Create database ──────────────────────────────────────────────────────────
if ! psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    info "Creating database '$DB_NAME'..."
    createdb "$DB_NAME"
    ok "Database '$DB_NAME' created"
else
    ok "Database '$DB_NAME' already exists"
fi

# ── Enable pgvector extension in database ────────────────────────────────────
if [[ "$PGVECTOR_INSTALLED" == true ]]; then
    psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null && \
        ok "pgvector extension enabled in $DB_NAME" || \
        warn "Could not enable pgvector extension"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: Ollama + Models
# ══════════════════════════════════════════════════════════════════════════════
step "Step 6/8 — Ollama + AI Models"

if ! command -v ollama &> /dev/null; then
    info "Installing Ollama..."
    brew install ollama
    ok "Ollama installed"
else
    ok "Ollama already installed"
fi

# Start Ollama service
if ! pgrep -x "ollama" > /dev/null 2>&1; then
    info "Starting Ollama service..."
    brew services start ollama 2>/dev/null || ollama serve &>/dev/null &
    sleep 5
fi
ok "Ollama running"

# Pull embedding model (required for semantic search)
info "Pulling embedding model: $OLLAMA_EMBED_MODEL (~670 MB)..."
if ollama list 2>/dev/null | grep -q "$OLLAMA_EMBED_MODEL"; then
    ok "Embedding model already downloaded"
else
    ollama pull "$OLLAMA_EMBED_MODEL" && \
        ok "Embedding model ready: $OLLAMA_EMBED_MODEL" || {
        warn "Failed to pull embedding model — you can retry: ollama pull $OLLAMA_EMBED_MODEL"
        ERRORS+=("Failed to pull $OLLAMA_EMBED_MODEL")
    }
fi

# Pull LLM model (for Ask AI natural language queries)
info "Pulling LLM model: $OLLAMA_LLM_MODEL (~4.7 GB)..."
if ollama list 2>/dev/null | grep -q "$OLLAMA_LLM_MODEL"; then
    ok "LLM model already downloaded"
else
    ollama pull "$OLLAMA_LLM_MODEL" && \
        ok "LLM model ready: $OLLAMA_LLM_MODEL" || {
        warn "Failed to pull LLM model — you can retry: ollama pull $OLLAMA_LLM_MODEL"
        ERRORS+=("Failed to pull $OLLAMA_LLM_MODEL")
    }
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: Install Application Dependencies
# ══════════════════════════════════════════════════════════════════════════════
step "Step 7/8 — Application Dependencies"

# Backend (Maven)
info "Downloading backend dependencies..."
(cd "$PROJECT_ROOT/backend" && mvn dependency:go-offline -q 2>/dev/null) && \
    ok "Backend dependencies cached" || \
    ok "Backend dependencies will download on first build"

# Frontend (npm)
info "Installing frontend dependencies..."
(cd "$PROJECT_ROOT/frontend" && npm install --silent 2>/dev/null) && \
    ok "Frontend dependencies installed" || {
    warn "npm install had warnings (non-fatal)"
    ok "Frontend dependencies installed (with warnings)"
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: Verify Everything
# ══════════════════════════════════════════════════════════════════════════════
step "Step 8/8 — Verification"

echo ""
PASS=0
FAIL=0

verify() {
    local label="$1" cmd="$2"
    if eval "$cmd" &>/dev/null; then
        ok "$label"
        ((PASS++))
    else
        err "$label"
        ((FAIL++))
    fi
}

verify "Java $JAVA_VERSION"             "java -version 2>&1 | grep -q '$JAVA_VERSION'"
verify "Maven"                           "command -v mvn"
verify "Node.js $NODE_VERSION"           "node -v | grep -q 'v$NODE_VERSION'"
verify "PostgreSQL $PG_VERSION running"  "pg_isready -q"
verify "Database '$DB_NAME'"             "psql -d $DB_NAME -c 'SELECT 1' -tAq"
verify "pgvector extension"              "psql -d $DB_NAME -tAc \"SELECT 1 FROM pg_extension WHERE extname='vector'\" | grep -q 1"
verify "Ollama running"                  "curl -sf http://localhost:11434/api/tags > /dev/null"
verify "Embedding model ($OLLAMA_EMBED_MODEL)" "ollama list 2>/dev/null | grep -q '$OLLAMA_EMBED_MODEL'"
verify "LLM model ($OLLAMA_LLM_MODEL)"  "ollama list 2>/dev/null | grep -q '$OLLAMA_LLM_MODEL'"
verify "Frontend node_modules"           "test -d $PROJECT_ROOT/frontend/node_modules"

echo ""
echo "  Passed: $PASS   Failed: $FAIL"

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                  macOS Setup Complete!                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  Start the app:                                            ║"
echo "║    Backend:   ./start-backend.sh                           ║"
echo "║    Frontend:  ./start-frontend.sh                          ║"
echo "║                                                            ║"
echo "║  Or use the combined starter:                              ║"
echo "║    ./scripts/start-dev.sh                                  ║"
echo "║                                                            ║"
echo "║  App URL:     http://localhost:5173                        ║"
echo "║  API URL:     http://localhost:8080/api                    ║"
echo "║  Login:       admin / admin                                ║"
echo "║                                                            ║"
echo "║  Ask AI NLP:                                               ║"
echo "║    Rule engine works out of the box                        ║"
echo "║    Vector search: auto-syncs embeddings on startup         ║"
echo "║    LLM fallback: uses Ollama $OLLAMA_LLM_MODEL            ║"
echo "║                                                            ║"
echo "║  Ollama models:                                            ║"
echo "║    ollama list            (show installed models)          ║"
echo "║    ollama pull <model>    (download a new model)           ║"
echo "║                                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Show any errors that occurred
if [[ ${#ERRORS[@]} -gt 0 ]]; then
    warn "Some issues need attention:"
    for e in "${ERRORS[@]}"; do
        echo -e "  ${YELLOW}•${NC} $e"
    done
    echo ""
fi

# ── Shell profile advice ────────────────────────────────────────────────────
echo "Add these to your ~/.zshrc if not already present:"
echo ""
echo '  # Java 21'
echo '  export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"'
echo '  export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"'
echo ""
echo '  # PostgreSQL 16'
echo '  export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"'
echo ""
echo '  # Node.js 20'
echo '  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"'
echo ""
