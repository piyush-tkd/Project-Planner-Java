# Portfolio Planner — Cloud Deployment Guide

## Stack Overview

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18 + TypeScript + Vite      |
| Backend  | Spring Boot 3.4.1 (Java 21)       |
| Database | PostgreSQL 15+                    |
| Migrations | Flyway (auto-runs on startup)   |
| Auth     | JWT                               |

---

## Option A — Docker Compose (Recommended)

The fastest path to production. All services run as containers.

### 1. Prerequisites on the cloud VM

```bash
# Ubuntu 22.04 LTS recommended
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER   # then log out/in
```

### 2. Project structure expected

```
project-root/
├── backend/        # Spring Boot
├── frontend/       # React
├── docker-compose.yml
├── Dockerfile.backend
└── Dockerfile.frontend
```

### 3. Create `Dockerfile.backend`

Place in project root:

```dockerfile
# ── Build stage ────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app
COPY backend/pom.xml .
COPY backend/src ./src
RUN apt-get update && apt-get install -y maven && mvn -q package -DskipTests

# ── Runtime stage ──────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 4. Create `Dockerfile.frontend`

Place in project root:

```dockerfile
# ── Build stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Serve via Nginx ────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 5. Create `nginx.conf`

Place in project root (used inside the frontend container):

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # React SPA — all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy /api/* → Spring Boot backend
    location /api/ {
        proxy_pass         http://backend:8080/api/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
```

### 6. Create `docker-compose.yml`

Place in project root:

```yaml
version: "3.9"

services:

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB:       portfolio_planner
      POSTGRES_USER:     ${DB_USERNAME}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME}"]
      interval: 10s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      SPRING_DATASOURCE_URL:      jdbc:postgresql://db:5432/portfolio_planner
      SPRING_DATASOURCE_USERNAME: ${DB_USERNAME}
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      DB_USERNAME:                ${DB_USERNAME}
      DB_PASSWORD:                ${DB_PASSWORD}
      JIRA_BASE_URL:              ${JIRA_BASE_URL}
      JIRA_EMAIL:                 ${JIRA_EMAIL}
      JIRA_API_TOKEN:             ${JIRA_API_TOKEN}
    ports:
      - "8080:8080"   # can be removed after adding a reverse proxy

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "80:80"
      - "443:443"   # after SSL setup

volumes:
  pgdata:
```

### 7. Create `.env` file (never commit this)

```env
DB_USERNAME=portfolio_planner
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD

JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-jira-account@company.com
JIRA_API_TOKEN=your-jira-api-token
```

### 8. Deploy

```bash
git clone <repo-url> && cd <repo-dir>

# Copy and fill in the .env file
cp .env.example .env
nano .env

# Build and start everything
docker compose up -d --build

# Watch logs
docker compose logs -f backend
docker compose logs -f frontend
```

The app will be available at `http://<server-ip>`.

---

## Option B — Bare Metal / VM (No Docker)

Use this if Docker is not available or you prefer native process management.

### Prerequisites

```bash
# Java 21
sudo apt install -y openjdk-21-jdk

# Maven
sudo apt install -y maven

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx
```

### Database setup

```bash
sudo -u postgres psql <<EOF
CREATE USER portfolio_planner WITH PASSWORD 'CHANGE_ME';
CREATE DATABASE portfolio_planner OWNER portfolio_planner;
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO portfolio_planner;
EOF
```

### Build frontend

```bash
cd frontend
npm ci
npm run build
# Outputs to frontend/dist/
```

### Build backend

```bash
cd backend
mvn clean package -DskipTests
# Outputs to backend/target/portfolio-planner-*.jar
```

### Environment variables

Create `/etc/portfolio-planner.env`:

```env
DB_USERNAME=portfolio_planner
DB_PASSWORD=CHANGE_ME
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-jira-account@company.com
JIRA_API_TOKEN=your-jira-api-token
```

```bash
sudo chmod 600 /etc/portfolio-planner.env
```

### Systemd service for the backend

Create `/etc/systemd/system/portfolio-planner.service`:

```ini
[Unit]
Description=Portfolio Planner Backend
After=network.target postgresql.service

[Service]
User=ubuntu
EnvironmentFile=/etc/portfolio-planner.env
ExecStart=/usr/bin/java -jar /opt/portfolio-planner/app.jar
SuccessExitStatus=143
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# Deploy the jar
sudo mkdir -p /opt/portfolio-planner
sudo cp backend/target/portfolio-planner-*.jar /opt/portfolio-planner/app.jar

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable portfolio-planner
sudo systemctl start portfolio-planner
sudo systemctl status portfolio-planner
```

### Nginx config (serves frontend + proxies API)

Create `/etc/nginx/sites-available/portfolio-planner`:

```nginx
server {
    listen 80;
    server_name your-domain.com;   # or the server IP

    root /opt/portfolio-planner/frontend;
    index index.html;

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass         http://127.0.0.1:8080/api/;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }

    client_max_body_size 15M;
}
```

```bash
# Copy built frontend
sudo mkdir -p /opt/portfolio-planner/frontend
sudo cp -r frontend/dist/* /opt/portfolio-planner/frontend/

# Enable site
sudo ln -s /etc/nginx/sites-available/portfolio-planner /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## SSL / HTTPS (Required for Production)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Issue certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Auto-renew is set up automatically; verify with:
sudo certbot renew --dry-run
```

---

## Cloud Provider Quick Notes

| Provider         | Recommended VM size                          |
|------------------|----------------------------------------------|
| AWS              | `t3.medium` (2 vCPU, 4 GB) or larger        |
| GCP              | `e2-medium` (2 vCPU, 4 GB)                  |
| Azure            | `Standard_B2s` (2 vCPU, 4 GB)               |
| DigitalOcean     | 4 GB Droplet (Basic)                         |

**Security group / firewall rules needed:**

| Port | Protocol | Source     | Purpose              |
|------|----------|------------|----------------------|
| 22   | TCP      | Your IP    | SSH                  |
| 80   | TCP      | 0.0.0.0/0  | HTTP (redirects to HTTPS) |
| 443  | TCP      | 0.0.0.0/0  | HTTPS                |
| 8080 | TCP      | localhost  | Backend (internal only — do NOT open to internet) |

---

## Re-deploying After Code Changes

### Docker Compose

```bash
git pull
docker compose up -d --build
```

### Bare Metal

```bash
git pull

# Rebuild frontend
cd frontend && npm ci && npm run build
sudo cp -r dist/* /opt/portfolio-planner/frontend/

# Rebuild backend
cd ../backend && mvn clean package -DskipTests
sudo cp target/portfolio-planner-*.jar /opt/portfolio-planner/app.jar
sudo systemctl restart portfolio-planner
```

---

## Health Check

```bash
# Backend alive?
curl http://localhost:8080/api/jira/status

# Frontend reachable?
curl -I http://your-domain.com
```

---

## Flyway / Database Migrations

Flyway runs **automatically on every startup** — no manual step needed. All migration scripts live in `backend/src/main/resources/db/migration/`. Never delete or edit existing `V*.sql` files; only add new ones with the next version number.

---

## Logs

```bash
# Docker
docker compose logs -f backend

# Bare metal
sudo journalctl -u portfolio-planner -f
```
