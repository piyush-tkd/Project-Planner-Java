#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Portfolio Planner — Start Both Backend + Frontend for Development
#  Usage:  ./scripts/start-dev.sh
#  Stop:   Ctrl+C (kills both)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Set PATH for Homebrew tools (Apple Silicon) ─────────────────────────────
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export PATH="/opt/homebrew/opt/openjdk@21/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:$PATH"

# ── Pre-flight checks ──────────────────────────────────────────────────────
echo -e "${CYAN}Checking prerequisites...${NC}"

check() {
    if ! "$@" &>/dev/null; then
        echo -e "${RED}✘ $1 not found. Run: ./scripts/setup-mac.sh${NC}"
        exit 1
    fi
}
check java -version
check mvn -version
check node -v
check pg_isready

# Ensure PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    echo -e "${CYAN}Starting PostgreSQL...${NC}"
    brew services start postgresql@16
    sleep 2
fi

# Ensure Ollama is running (optional — app works without it)
if command -v ollama &>/dev/null; then
    if ! curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${CYAN}Starting Ollama...${NC}"
        brew services start ollama 2>/dev/null || ollama serve &>/dev/null &
        sleep 3
    fi
    echo -e "${GREEN}✔ Ollama running${NC}"
else
    echo -e "${CYAN}ℹ Ollama not installed — Ask AI will use rule engine only${NC}"
fi

echo ""
echo -e "${GREEN}Starting Portfolio Planner...${NC}"
echo -e "  Backend:  http://localhost:8080/api"
echo -e "  Frontend: http://localhost:5173"
echo -e "  Login:    admin / admin"
echo -e "  Stop:     Ctrl+C"
echo ""

# ── Trap to kill both on Ctrl+C ────────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${CYAN}Shutting down...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# ── Start backend ───────────────────────────────────────────────────────────
echo -e "${CYAN}[Backend]${NC} Starting Spring Boot..."
mvn -f backend/pom.xml spring-boot:run \
    -Dspring-boot.run.jvmArguments="-Dspring.profiles.active=local" \
    2>&1 | sed "s/^/[backend] /" &
BACKEND_PID=$!

# ── Start frontend ──────────────────────────────────────────────────────────
echo -e "${CYAN}[Frontend]${NC} Starting Vite dev server..."
npm --prefix frontend run dev 2>&1 | sed "s/^/[frontend] /" &
FRONTEND_PID=$!

# Wait for either to exit
wait -n $BACKEND_PID $FRONTEND_PID 2>/dev/null
