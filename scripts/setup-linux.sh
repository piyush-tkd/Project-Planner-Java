#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Portfolio Planner — Linux Setup & Deployment Script
#  Tested on: Ubuntu 22.04 LTS / Debian 12
#  Usage:     chmod +x setup-linux.sh && sudo ./setup-linux.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Configuration — EDIT THESE ────────────────────────────────────────────────
APP_DIR="/opt/portfolio-planner"
DEPLOY_USER="deploy"
DB_NAME="portfolio_planner"
DB_USER="pp_user"
DB_PASSWORD=""            # Will prompt if empty
DOMAIN=""                 # Will prompt if empty
BACKEND_PORT=8080
INSTALL_OLLAMA=false      # Will prompt
ENABLE_SSL=false          # Will prompt

# ── Pre-flight ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (sudo)."
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Portfolio Planner — Linux Setup & Deployment         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Interactive prompts ───────────────────────────────────────────────────────
if [[ -z "$DB_PASSWORD" ]]; then
    read -sp "Enter PostgreSQL password for user '$DB_USER': " DB_PASSWORD
    echo ""
fi

if [[ -z "$DOMAIN" ]]; then
    read -rp "Enter your domain name (e.g., planner.example.com): " DOMAIN
fi

read -rp "Install Ollama for local LLM NLP? (y/N): " ollama_answer
[[ "$ollama_answer" =~ ^[Yy] ]] && INSTALL_OLLAMA=true

read -rp "Enable SSL with Let's Encrypt? (y/N): " ssl_answer
[[ "$ssl_answer" =~ ^[Yy] ]] && ENABLE_SSL=true

echo ""
info "Configuration summary:"
echo "  App directory:   $APP_DIR"
echo "  Domain:          $DOMAIN"
echo "  DB user:         $DB_USER"
echo "  Install Ollama:  $INSTALL_OLLAMA"
echo "  Enable SSL:      $ENABLE_SSL"
echo ""
read -rp "Proceed? (Y/n): " proceed
[[ "$proceed" =~ ^[Nn] ]] && { echo "Aborted."; exit 0; }

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Install system dependencies
# ══════════════════════════════════════════════════════════════════════════════
info "Step 1/9 — Installing system dependencies..."

apt update -qq

# Java 21
if ! java -version 2>&1 | grep -q '"21'; then
    info "Installing OpenJDK 21..."
    apt install -y -qq openjdk-21-jdk > /dev/null
fi
ok "Java $(java -version 2>&1 | head -1 | awk -F'"' '{print $2}')"

# Maven
if ! command -v mvn &> /dev/null; then
    info "Installing Maven..."
    apt install -y -qq maven > /dev/null
fi
ok "Maven $(mvn -version 2>&1 | head -1 | awk '{print $3}')"

# Node.js 20.x
if ! command -v node &> /dev/null || ! node -v | grep -q 'v20'; then
    info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt install -y -qq nodejs > /dev/null
fi
ok "Node.js $(node -v)"

# PostgreSQL 16
if ! command -v psql &> /dev/null; then
    info "Installing PostgreSQL 16..."
    sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - > /dev/null 2>&1
    apt update -qq
    apt install -y -qq postgresql-16 > /dev/null
fi
systemctl enable postgresql --now > /dev/null 2>&1
ok "PostgreSQL $(psql --version | awk '{print $3}')"

# Nginx
if ! command -v nginx &> /dev/null; then
    info "Installing Nginx..."
    apt install -y -qq nginx > /dev/null
fi
ok "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}')"

# Git
if ! command -v git &> /dev/null; then
    apt install -y -qq git > /dev/null
fi
ok "Git $(git --version | awk '{print $3}')"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Create deploy user
# ══════════════════════════════════════════════════════════════════════════════
info "Step 2/9 — Creating deploy user..."

if ! id "$DEPLOY_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$DEPLOY_USER"
    ok "Created user '$DEPLOY_USER'"
else
    ok "User '$DEPLOY_USER' already exists"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Configure PostgreSQL
# ══════════════════════════════════════════════════════════════════════════════
info "Step 3/9 — Configuring PostgreSQL..."

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || {
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    ok "Created PostgreSQL user '$DB_USER'"
}

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || {
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    ok "Created database '$DB_NAME'"
}

sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" > /dev/null 2>&1
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" > /dev/null 2>&1
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;" > /dev/null 2>&1
ok "PostgreSQL configured"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Deploy application files
# ══════════════════════════════════════════════════════════════════════════════
info "Step 4/9 — Deploying application files..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

mkdir -p "$APP_DIR"
cp -r "$PROJECT_ROOT/backend" "$APP_DIR/"
cp -r "$PROJECT_ROOT/frontend" "$APP_DIR/"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
ok "Files copied to $APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Build the backend
# ══════════════════════════════════════════════════════════════════════════════
info "Step 5/9 — Building backend JAR..."

cd "$APP_DIR/backend"
sudo -u "$DEPLOY_USER" bash -c "cd $APP_DIR/backend && ./mvnw clean package -DskipTests -q"
ok "Backend JAR built: target/portfolio-planner-0.0.1-SNAPSHOT.jar"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: Build the frontend
# ══════════════════════════════════════════════════════════════════════════════
info "Step 6/9 — Building frontend..."

cd "$APP_DIR/frontend"
sudo -u "$DEPLOY_USER" bash -c "cd $APP_DIR/frontend && npm install --silent && VITE_API_URL=https://$DOMAIN npm run build"
ok "Frontend built: dist/"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: Create systemd service
# ══════════════════════════════════════════════════════════════════════════════
info "Step 7/9 — Creating systemd service..."

mkdir -p "$APP_DIR/logs"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/logs"

cat > /etc/systemd/system/portfolio-planner.service << SERVICEEOF
[Unit]
Description=Portfolio Planner Backend
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$DEPLOY_USER
Group=$DEPLOY_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/java -jar -Xms512m -Xmx2g target/portfolio-planner-0.0.1-SNAPSHOT.jar
Restart=always
RestartSec=10
StandardOutput=append:$APP_DIR/logs/backend-stdout.log
StandardError=append:$APP_DIR/logs/backend-stderr.log

# Environment variables
Environment=DB_USERNAME=$DB_USER
Environment=DB_PASSWORD=$DB_PASSWORD
Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/$DB_NAME
Environment=ALLOWED_ORIGINS=https://$DOMAIN

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable portfolio-planner --now
ok "Service 'portfolio-planner' created and started"

# Wait for backend to start
info "Waiting for backend to start..."
for i in {1..60}; do
    if curl -sf http://localhost:$BACKEND_PORT/api/auth/me > /dev/null 2>&1 || curl -sf -o /dev/null -w "%{http_code}" http://localhost:$BACKEND_PORT/api/auth/me 2>/dev/null | grep -q "401"; then
        ok "Backend is running on port $BACKEND_PORT"
        break
    fi
    sleep 2
    if [[ $i -eq 60 ]]; then
        warn "Backend may still be starting. Check: journalctl -u portfolio-planner -f"
    fi
done

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: Configure Nginx
# ══════════════════════════════════════════════════════════════════════════════
info "Step 8/9 — Configuring Nginx..."

cat > /etc/nginx/sites-available/portfolio-planner << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend static files
    root $APP_DIR/frontend/dist;
    index index.html;

    # SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API to Spring Boot
    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
        client_max_body_size 10M;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/portfolio-planner /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
ok "Nginx configured for $DOMAIN"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9: Optional components
# ══════════════════════════════════════════════════════════════════════════════
info "Step 9/9 — Optional components..."

# SSL
if [[ "$ENABLE_SSL" == true ]]; then
    info "Installing Certbot and requesting SSL certificate..."
    apt install -y -qq certbot python3-certbot-nginx > /dev/null
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
        warn "Certbot failed. Run manually: sudo certbot --nginx -d $DOMAIN"
    }
    ok "SSL certificate configured"
fi

# Ollama
if [[ "$INSTALL_OLLAMA" == true ]]; then
    info "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh > /dev/null 2>&1
    systemctl enable ollama --now > /dev/null 2>&1
    info "Pulling llama3:8b model (this may take a while — ~4.7 GB)..."
    ollama pull llama3:8b || warn "Model pull failed. Run manually: ollama pull llama3:8b"
    ok "Ollama installed with llama3:8b"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  Application URL:  http://$DOMAIN"
echo "║  Backend API:      http://localhost:$BACKEND_PORT/api"
echo "║  Default login:    admin / admin                           ║"
echo "║                                                            ║"
echo "║  Manage service:                                           ║"
echo "║    sudo systemctl status portfolio-planner                 ║"
echo "║    sudo journalctl -u portfolio-planner -f                 ║"
echo "║                                                            ║"
echo "║  Logs:  $APP_DIR/logs/"
echo "║                                                            ║"
echo "║  IMPORTANT: Change the admin password after first login!   ║"
echo "║                                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Optional env vars reminder ────────────────────────────────────────────────
echo "To configure optional features, edit the systemd service:"
echo "  sudo systemctl edit portfolio-planner"
echo ""
echo "Add under [Service]:"
echo "  # Jira Integration"
echo "  Environment=JIRA_BASE_URL=https://yourcompany.atlassian.net"
echo "  Environment=JIRA_EMAIL=your-email@company.com"
echo "  Environment=JIRA_API_TOKEN=your-api-token"
echo ""
echo "  # Email Digest"
echo "  Environment=DIGEST_ENABLED=true"
echo "  Environment=MAIL_USERNAME=your-email@gmail.com"
echo "  Environment=MAIL_PASSWORD=your-app-password"
echo "  Environment=DIGEST_RECIPIENTS=manager@company.com"
echo ""
echo "Then reload: sudo systemctl daemon-reload && sudo systemctl restart portfolio-planner"
