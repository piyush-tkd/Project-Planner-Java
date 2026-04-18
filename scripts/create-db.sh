#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Portfolio Planner — Create Database (if not exists)
#
#  Creates the application database and enables required extensions.
#  Safe to run multiple times — exits cleanly if the DB already exists.
#
#  Usage:
#    ./scripts/create-db.sh
#
#  Override defaults via environment variables:
#    DB_NAME=portfolio_planner_1  DB_USER=piyushbaheti  ./scripts/create-db.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}  ✔${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Config (matches application.yml defaults) ─────────────────────────────────
DB_NAME="${DB_NAME:-portfolio_planner_1}"
DB_USER="${DB_USER:-$(whoami)}"   # psql defaults to current OS user

# ── Require psql ─────────────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
    err "psql not found — install PostgreSQL first (brew install postgresql@16 or apt install postgresql)"
fi

# ── Check PostgreSQL is running ───────────────────────────────────────────────
if ! pg_isready -q 2>/dev/null; then
    err "PostgreSQL is not running. Start it first:
  macOS:  brew services start postgresql@16
  Linux:  sudo systemctl start postgresql"
fi

info "PostgreSQL is running"

# ── Create database if it does not exist ─────────────────────────────────────
#  pg_database check is the portable way — works across all PG versions.
DB_EXISTS=$(psql -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null || echo "")

if [[ "$DB_EXISTS" == "1" ]]; then
    ok "Database '$DB_NAME' already exists — skipping creation"
else
    info "Creating database '$DB_NAME'..."
    psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" \
        || err "Failed to create database '$DB_NAME'. Check that user '$DB_USER' has CREATEDB privilege."
    ok "Database '$DB_NAME' created"
fi

# ── Enable pgvector extension (required for AI semantic search) ───────────────
#  CREATE EXTENSION IF NOT EXISTS is idempotent — safe to run every time.
VECTOR_OK=$(psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'" 2>/dev/null || echo "")

if [[ "$VECTOR_OK" == "1" ]]; then
    psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" &>/dev/null
    ok "pgvector extension enabled in '$DB_NAME'"
else
    warn "pgvector not available — AI semantic search will be disabled (app still works without it)"
    warn "To install pgvector: https://github.com/pgvector/pgvector#installation"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Database ready.${NC} Start the backend and Flyway will run migrations automatically."
echo "  Backend: ./start-backend.sh"
echo ""
