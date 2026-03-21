# Engineering Portfolio Planner

A full-stack capacity planning, portfolio management, and NLP-powered analytics tool for engineering organisations. Manage team structures, project pipelines, Jira integrations, sprint planning, release calendars, and get natural-language insights — all in one place.

![Java](https://img.shields.io/badge/Java-21-orange) ![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.1-green) ![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue) ![Mantine](https://img.shields.io/badge/Mantine-7.15-violet) ![Vite](https://img.shields.io/badge/Vite-6-yellow)

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start (Local Development)](#quick-start-local-development)
5. [Environment Variables](#environment-variables)
6. [NLP Engine Setup](#nlp-engine-setup)
7. [Jira Integration](#jira-integration)
8. [Email Digest](#email-digest)
9. [Database Migrations](#database-migrations)
10. [Production Deployment](#production-deployment)
11. [Project Structure](#project-structure)
12. [API Reference](#api-reference)
13. [Running Tests](#running-tests)
14. [Default Credentials](#default-credentials)
15. [Bruno API Collection](#bruno-api-collection)
16. [Troubleshooting](#troubleshooting)

---

## Features

**Core Planning:**
- POD-based team structure with resource assignments, BAU assumptions, and FTE allocations
- Project portfolio management with T-shirt sizing, effort patterns, and priority tracking
- Monthly capacity vs demand gap analysis per POD and role
- Hiring forecast with cumulative FTE recommendations
- Utilisation heatmap with overload detection
- Project health scoring, deadline risk, concurrency risk, and Gantt view
- Scenario and timeline simulators for what-if capacity modelling
- Budget tracking with cost rates per role/location
- Excel bulk import for bootstrapping all data

**Jira Integration:**
- Sprint actuals pulled from Jira boards
- CapEx hour tracking via custom fields
- Support board monitoring with daily snapshots
- Worklog aggregation by pod and sprint
- Release management tied to Jira versions

**NLP Engine:**
- Natural language search bar on every page — ask questions like "which pods are over capacity?" or "tell me about the SG NIPT project"
- Chain-of-responsibility strategy: Rule-Based → Local LLM (Ollama) → Cloud LLM (Anthropic Claude)
- Self-learning optimizer that runs every 6 hours, mining query logs and user feedback to create learned patterns
- NLP Settings page for configuring strategy chain, models, thresholds
- NLP Optimizer dashboard with low-confidence queries, negative ratings, learned patterns, and run history

**Collaboration:**
- Feedback Widget (floating icon on every page) — submit bugs, suggestions, or drag-and-drop screenshots
- Feedback Hub in settings — triage, prioritise, and resolve submissions
- Global error capture (React ErrorBoundary + Axios interceptor + window.onerror) with Error Log page
- Audit log for all entity changes
- Role-based access control with granular page permissions
- Tour guide system for onboarding new users

**Reports (18 report pages):**
- Capacity Gap, Capacity Demand, Pod Capacity, Hiring Forecast
- Utilisation Heatmap, Resource Allocation, Resource ROI, Slack Buffer
- Project Health, Project Gantt, Deadline Gap, Concurrency Risk
- Pod Project Matrix, Project Pod Matrix, Resource Pod Matrix, Pod Resource Summary
- Pod Splits, Cross-Pod Dependency, Owner Demand, Budget

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────┐
│   React SPA (Vite)  │  /api  │   Spring Boot 3.4.1      │
│   Port 5173 (dev)   │───────→│   Port 8080              │
│   Mantine UI v7     │        │   Java 21                │
│   TanStack Query    │        │   JPA/Hibernate          │
│   React Router v6   │        │   Flyway Migrations      │
└─────────────────────┘        │   Caffeine Cache         │
                               │   JWT Auth (24h expiry)  │
                               └────────┬─────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              ┌─────▼─────┐     ┌──────▼──────┐    ┌──────▼──────┐
              │ PostgreSQL │     │ Ollama (opt)│    │ Jira Cloud  │
              │ Port 5432  │     │ Port 11434  │    │ (optional)  │
              │ 48 Flyway  │     │ llama3:8b   │    │ REST API    │
              │ migrations │     │ Local LLM   │    │             │
              └────────────┘     └─────────────┘    └─────────────┘
```

---

## Prerequisites

Install the following before proceeding. Exact versions that have been tested are listed.

| Tool | Version | Required | Notes |
|---|---|---|---|
| **Java JDK** | 21+ | Yes | OpenJDK or Oracle. Verify: `java -version` |
| **Apache Maven** | 3.9+ | Yes | Or use the included `./mvnw` wrapper. Verify: `mvn -version` |
| **Node.js** | 18+ (LTS recommended: 20.x) | Yes | Verify: `node -version` |
| **npm** | 9+ | Yes | Bundled with Node.js. Verify: `npm -version` |
| **PostgreSQL** | 16.x (tested on 16.13) | Yes | 15.x also works. Verify: `psql --version` |
| **Git** | 2.x | Yes | For cloning the repo |
| **Ollama** | Latest | Optional | Only needed for local LLM NLP. Verify: `ollama --version` |

---

## Quick Start (Local Development)

### Step 1: Clone the Repository

```bash
git clone <repository-url> portfolio-planner
cd portfolio-planner
```

### Step 2: Create the PostgreSQL Database

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Run these SQL commands:
CREATE DATABASE portfolio_planner;
CREATE USER pp_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO pp_user;
\c portfolio_planner
GRANT ALL ON SCHEMA public TO pp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pp_user;
\q
```

### Step 3: Start the Backend

```bash
cd backend

# Set database credentials
export DB_USERNAME=pp_user
export DB_PASSWORD=your_secure_password

# Build and run (Flyway migrations run automatically on first start)
./mvnw spring-boot:run

# Backend is now running at http://localhost:8080
# Flyway will execute all 48 migrations including seed data (V48)
```

Wait until you see `Started PortfolioPlannerApplication` in the console before proceeding.

### Step 4: Start the Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Frontend is now running at http://localhost:5173
```

Vite automatically proxies all `/api` requests to `localhost:8080` — no additional configuration needed.

### Step 5: Open the Application

Navigate to **http://localhost:5173** in your browser. Log in with the default credentials (see [Default Credentials](#default-credentials) section below).

---

## Environment Variables

### Backend (`application.yml` defaults shown — override with env vars)

| Variable | Default | Description |
|---|---|---|
| `DB_USERNAME` | `piyushbaheti` | PostgreSQL username |
| `DB_PASSWORD` | _(empty)_ | PostgreSQL password |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/portfolio_planner` | Full JDBC URL (use this for remote DB) |
| `JIRA_BASE_URL` | _(empty)_ | Jira Cloud instance URL (e.g., `https://yourcompany.atlassian.net`) |
| `JIRA_EMAIL` | _(empty)_ | Jira user email for API authentication |
| `JIRA_API_TOKEN` | _(empty)_ | Jira API token ([generate here](https://id.atlassian.com/manage-profile/security/api-tokens)) |
| `MAIL_HOST` | `smtp.gmail.com` | SMTP host for weekly digest emails |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USERNAME` | _(empty)_ | SMTP username |
| `MAIL_PASSWORD` | _(empty)_ | SMTP password / app password |
| `DIGEST_ENABLED` | `false` | Enable weekly digest emails |
| `DIGEST_RECIPIENTS` | _(empty)_ | Comma-separated recipient emails |
| `DIGEST_FROM` | `noreply@portfolioplanner` | Sender email address |
| `DIGEST_CRON` | `0 0 8 * * MON` | Cron expression for digest schedule |
| `NLP_LEARNER_INTERVAL_MS` | `21600000` | NLP self-learning interval (default: 6 hours) |
| `NLP_LEARNER_INITIAL_DELAY_MS` | `60000` | Delay before first learner run after boot |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS allowed origins (comma-separated, e.g., `https://your-domain.com`) |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | _(not set — uses Vite proxy)_ | Backend API base URL. Set this when building for production (e.g., `https://your-domain.com`). |

---

## NLP Engine Setup

The NLP engine uses a chain-of-responsibility pattern. Queries pass through strategies in order until one provides a confident answer:

**RULE_BASED → LOCAL_LLM → CLOUD_LLM**

### Rule-Based (Always active, no setup needed)

Handles navigation commands, greetings, data queries, resource lookups, project searches, and more. Covers ~80%+ of queries out of the box with zero external dependencies.

### Local LLM via Ollama (Recommended)

For queries the rule-based engine can't handle, a local LLM provides answers without sending data to the cloud.

```bash
# 1. Install Ollama (macOS)
brew install ollama

# For Linux:
curl -fsSL https://ollama.com/install.sh | sh

# 2. Start the Ollama server
ollama serve
# Runs on http://localhost:11434

# 3. Pull the recommended model
ollama pull llama3:8b

# That's it — the app auto-connects to localhost:11434
```

**Server requirements for Ollama:** 8 GB RAM minimum (16 GB recommended). The llama3:8b model uses ~4.7 GB.

To use a different model, update in the app's NLP Settings page or set the `local_model` NLP config in the database.

### Cloud LLM via Anthropic (Optional)

For fallback when Ollama is unavailable or for higher-quality responses.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. In the app, go to **Settings → NLP Settings**
3. Enter your API key, select model (default: `claude-haiku-4-5-20251001`)
4. Add `CLOUD_LLM` to the strategy chain

No environment variable needed — the API key is stored in the `nlp_config` database table and managed through the UI.

### Self-Learning Optimizer

The NLP engine automatically improves over time:
- Runs every 6 hours (configurable via `NLP_LEARNER_INTERVAL_MS`)
- Mines query logs for repeated patterns
- Incorporates user feedback (thumbs up/down ratings)
- Creates learned patterns that get priority in future classifications
- View learner activity at **Settings → NLP Optimizer**

---

## Jira Integration

Jira integration is optional. To enable it:

1. Generate a Jira API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

2. Set environment variables before starting the backend:
   ```bash
   export JIRA_BASE_URL=https://yourcompany.atlassian.net
   export JIRA_EMAIL=your-email@company.com
   export JIRA_API_TOKEN=your-api-token
   ```

3. In the app, go to **Settings → Jira Settings** to:
   - Map Jira pods to boards (project keys)
   - Configure sprint board assignments
   - Set up support board monitoring
   - Map CapEx custom field IDs

4. Configure Jira credentials in **Settings → Jira Credentials** for the custom CapEx field mapping.

---

## Email Digest

Weekly email summaries can be sent to stakeholders. To enable:

```bash
export DIGEST_ENABLED=true
export MAIL_USERNAME=your-gmail@gmail.com
export MAIL_PASSWORD=your-app-password       # Use Gmail App Password, not your login password
export DIGEST_RECIPIENTS=manager@company.com,team-lead@company.com
```

For Gmail, you need to create an [App Password](https://support.google.com/accounts/answer/185833) (requires 2FA enabled on the account).

---

## Database Migrations

Flyway manages all schema changes automatically. Migrations run on application startup.

There are **48 migration scripts** (V1 through V48):
- V1–V3: Core schema creation and initial seed data
- V4–V8: T-shirt sizes, cost rates, skills, actuals
- V9–V18: Users, auth, Jira mappings, releases
- V19–V36: Support boards, audit logs, permissions, sprints, calendars
- V37–V45: NLP engine tables (config, query logs, learned patterns, feedback, learner runs, self-learning)
- V46: User feedback table
- V47: Application error log table
- V48: Full data seed (idempotent — safe to re-run)

**Important:** Hibernate is configured with `ddl-auto: validate` — it will NOT modify the schema. All changes MUST go through Flyway migration scripts.

To check migration status:
```bash
# Connect to DB and check Flyway history
psql -U pp_user -d portfolio_planner -c "SELECT version, description, installed_on FROM flyway_schema_history ORDER BY installed_rank;"
```

---

## Production Deployment

### One-Shot Setup Scripts

Automated scripts are provided in the `scripts/` directory that handle the entire setup end-to-end — installing dependencies, configuring PostgreSQL, building the app, creating services, and configuring the reverse proxy.

**Linux (Ubuntu/Debian):**
```bash
chmod +x scripts/setup-linux.sh
sudo ./scripts/setup-linux.sh
```

**Windows (PowerShell as Administrator):**
```powershell
.\scripts\setup-windows.ps1
```

Both scripts are interactive — they prompt for database password, domain name, and optional components (Ollama, SSL). If you prefer manual setup, follow the detailed steps below.

---

### Linux Server Deployment

#### 1. Server Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB (16 GB if running Ollama) |
| Disk | 20 GB | 50 GB |
| OS | Ubuntu 22.04 LTS / Windows Server 2019+ | Ubuntu 22.04 LTS / Windows Server 2022 |

---

### Linux (Ubuntu/Debian)

#### 2. Install Dependencies

```bash
# Java 21
sudo apt update
sudo apt install -y openjdk-21-jdk

# Verify
java -version
# Expected: openjdk version "21.x.x"

# Maven
sudo apt install -y maven

# Node.js 20.x (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v    # v20.x.x
npm -v     # 10.x.x

# PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16

# Start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verify
psql --version
# Expected: psql (PostgreSQL) 16.x
```

#### 3. Configure PostgreSQL

```bash
sudo -u postgres psql

CREATE DATABASE portfolio_planner;
CREATE USER pp_user WITH PASSWORD 'CHANGE_THIS_TO_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO pp_user;
\c portfolio_planner
GRANT ALL ON SCHEMA public TO pp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pp_user;
\q
```

#### 4. Build the Backend

```bash
cd backend

# Build the JAR (skip tests for faster builds if you've already tested)
./mvnw clean package -DskipTests

# The JAR is at: target/portfolio-planner-0.0.1-SNAPSHOT.jar
```

#### 5. Run the Backend as a Service

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/portfolio-planner.service
```

Paste the following:

```ini
[Unit]
Description=Portfolio Planner Backend
After=postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/opt/portfolio-planner/backend
ExecStart=/usr/bin/java -jar -Xms512m -Xmx2g target/portfolio-planner-0.0.1-SNAPSHOT.jar
Restart=always
RestartSec=10

# Environment variables
Environment=DB_USERNAME=pp_user
Environment=DB_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/portfolio_planner
Environment=ALLOWED_ORIGINS=https://your-domain.com
Environment=JIRA_BASE_URL=
Environment=JIRA_EMAIL=
Environment=JIRA_API_TOKEN=
Environment=DIGEST_ENABLED=false

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable portfolio-planner
sudo systemctl start portfolio-planner

# Check status
sudo systemctl status portfolio-planner

# View logs
sudo journalctl -u portfolio-planner -f
```

#### 6. Build the Frontend

```bash
cd frontend

npm install

# Set the backend URL for production build
export VITE_API_URL=https://your-domain.com

# Build static files
npm run build

# Output is in: dist/
```

#### 7. Configure Nginx as Reverse Proxy

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/portfolio-planner
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    root /opt/portfolio-planner/frontend/dist;
    index index.html;

    # SPA routing — serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to Spring Boot
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        client_max_body_size 10M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/portfolio-planner /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

#### 8. SSL with Let's Encrypt (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow the prompts — certbot auto-configures Nginx for HTTPS
```

#### 9. Install Ollama (Optional — for NLP local LLM)

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Start as a service
sudo systemctl enable ollama
sudo systemctl start ollama

# Pull the model
ollama pull llama3:8b

# Verify
curl http://localhost:11434/api/tags
```

---

### Windows Server

#### 2. Install Dependencies

Download and install the following (use default installation paths):

| Tool | Download Link |
|---|---|
| **Java JDK 21** | [adoptium.net/temurin/releases](https://adoptium.net/temurin/releases/) — select Windows x64 `.msi` |
| **Apache Maven 3.9+** | [maven.apache.org/download.cgi](https://maven.apache.org/download.cgi) — download the `.zip` binary |
| **Node.js 20 LTS** | [nodejs.org](https://nodejs.org/) — download the Windows `.msi` installer |
| **PostgreSQL 16** | [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) — use the EDB installer |
| **Git for Windows** | [git-scm.com/download/win](https://git-scm.com/download/win) |

After installation, add to your system `PATH` (if not done automatically):

```powershell
# Open PowerShell as Administrator and verify:
java -version          # openjdk version "21.x.x"
mvn -version           # Apache Maven 3.9.x
node -v                # v20.x.x
npm -v                 # 10.x.x
psql --version         # psql (PostgreSQL) 16.x
git --version          # git version 2.x.x
```

If Maven isn't in your PATH, add it manually:
```powershell
# Example: Extract Maven to C:\tools\apache-maven-3.9.9
[System.Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\tools\apache-maven-3.9.9\bin", "Machine")
```

#### 3. Configure PostgreSQL

Open pgAdmin (installed with PostgreSQL) or use psql from the command line:

```powershell
# Open psql (it will ask for the postgres superuser password you set during installation)
psql -U postgres
```

```sql
CREATE DATABASE portfolio_planner;
CREATE USER pp_user WITH PASSWORD 'CHANGE_THIS_TO_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO pp_user;
\c portfolio_planner
GRANT ALL ON SCHEMA public TO pp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pp_user;
\q
```

#### 4. Build the Backend

```powershell
cd backend

# Build the JAR
mvnw.cmd clean package -DskipTests

# The JAR is at: target\portfolio-planner-0.0.1-SNAPSHOT.jar
```

#### 5. Run the Backend as a Windows Service

**Option A: Using NSSM (Non-Sucking Service Manager) — Recommended**

Download NSSM from [nssm.cc/download](https://nssm.cc/download) and extract to `C:\tools\nssm\`.

```powershell
# Install the service
C:\tools\nssm\win64\nssm.exe install PortfolioPlanner "C:\Program Files\Eclipse Adoptium\jdk-21\bin\java.exe" "-jar -Xms512m -Xmx2g C:\portfolio-planner\backend\target\portfolio-planner-0.0.1-SNAPSHOT.jar"

# Set environment variables
C:\tools\nssm\win64\nssm.exe set PortfolioPlanner AppEnvironmentExtra ^
  DB_USERNAME=pp_user ^
  DB_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD ^
  SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/portfolio_planner ^
  ALLOWED_ORIGINS=https://your-domain.com

# Set working directory
C:\tools\nssm\win64\nssm.exe set PortfolioPlanner AppDirectory C:\portfolio-planner\backend

# Configure auto-restart
C:\tools\nssm\win64\nssm.exe set PortfolioPlanner AppRestartDelay 10000

# Configure logging
C:\tools\nssm\win64\nssm.exe set PortfolioPlanner AppStdout C:\portfolio-planner\logs\stdout.log
C:\tools\nssm\win64\nssm.exe set PortfolioPlanner AppStderr C:\portfolio-planner\logs\stderr.log

# Start the service
net start PortfolioPlanner
```

**Option B: Quick test (foreground, not a service)**

```powershell
cd backend

$env:DB_USERNAME = "pp_user"
$env:DB_PASSWORD = "CHANGE_THIS_TO_A_STRONG_PASSWORD"

java -jar -Xms512m -Xmx2g target\portfolio-planner-0.0.1-SNAPSHOT.jar
```

#### 6. Build the Frontend

```powershell
cd frontend

npm install

# Set the backend URL for production build
$env:VITE_API_URL = "https://your-domain.com"

# Build static files
npm run build

# Output is in: dist\
```

#### 7. Configure IIS as Reverse Proxy

Install IIS with the following features:
```powershell
# Run in PowerShell as Administrator
Install-WindowsFeature -Name Web-Server, Web-WebServer, Web-Common-Http, Web-Static-Content, Web-Default-Doc, Web-Http-Errors -IncludeManagementTools
```

Install URL Rewrite and ARR (Application Request Routing):
- **URL Rewrite**: Download from [iis.net/downloads/microsoft/url-rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)
- **ARR 3.0**: Download from [iis.net/downloads/microsoft/application-request-routing](https://www.iis.net/downloads/microsoft/application-request-routing)

Create a `web.config` file in the frontend `dist\` folder:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- Proxy /api to Spring Boot backend -->
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://localhost:8080/api/{R:1}" />
                </rule>
                <!-- SPA fallback — serve index.html for client-side routes -->
                <rule name="SPA Routes" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/index.html" />
                </rule>
            </rules>
        </rewrite>
        <staticContent>
            <mimeMap fileExtension=".json" mimeType="application/json" />
            <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
        </staticContent>
    </system.webServer>
</configuration>
```

In IIS Manager:
1. Create a new site pointing to `C:\portfolio-planner\frontend\dist`
2. Bind it to port 80 (or 443 with your SSL certificate)
3. Enable ARR proxy: Server → Application Request Routing → Server Proxy Settings → Enable proxy

**Alternative: Use Nginx on Windows**

Download Nginx for Windows from [nginx.org/en/download.html](https://nginx.org/en/download.html) and use the same `nginx.conf` from the Linux section, adjusting paths:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root C:/portfolio-planner/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        client_max_body_size 10M;
    }
}
```

#### 8. SSL Certificate

For Windows Server, use IIS to bind an SSL certificate:
1. Obtain an SSL certificate (purchase or use [win-acme](https://www.win-acme.com/) for free Let's Encrypt certificates)
2. Import the certificate into the Windows Certificate Store
3. In IIS Manager, edit site bindings → Add → Type: https → select your certificate

For win-acme (Let's Encrypt):
```powershell
# Download win-acme from https://www.win-acme.com/
# Extract and run:
wacs.exe --target iis --siteid 1 --installation iis
```

#### 9. Install Ollama on Windows (Optional — for NLP local LLM)

Download the Windows installer from [ollama.com/download/windows](https://ollama.com/download/windows).

After installation:
```powershell
# Ollama runs automatically as a background service after install

# Pull the model
ollama pull llama3:8b

# Verify
curl http://localhost:11434/api/tags
```

Ollama runs on port 11434 by default. The app auto-connects to it — no additional configuration needed.

---

## Project Structure

```
portfolio-planner/
├── backend/                          Spring Boot API (Java 21)
│   ├── pom.xml                       Maven dependencies
│   ├── mvnw / mvnw.cmd              Maven wrapper (no install needed)
│   └── src/main/
│       ├── java/com/portfolioplanner/
│       │   ├── config/               Security, CORS, Cache, NLP warmup
│       │   ├── controller/           31 REST controllers
│       │   ├── domain/
│       │   │   ├── model/            JPA entities (16 entities)
│       │   │   └── repository/       Spring Data JPA repositories
│       │   ├── dto/
│       │   │   ├── request/          Inbound DTOs
│       │   │   └── response/         Outbound DTOs
│       │   ├── exception/            Global exception handler
│       │   ├── mapper/               MapStruct entity ↔ DTO mappers
│       │   └── service/
│       │       ├── nlp/              NLP strategy engine (7 classes)
│       │       └── *.java            Business services
│       └── resources/
│           ├── application.yml       App configuration
│           └── db/migration/         48 Flyway SQL migrations (V1–V48)
│
├── frontend/                         React 18 + TypeScript SPA
│   ├── package.json                  npm dependencies
│   ├── vite.config.ts                Vite config with API proxy
│   ├── tsconfig.json                 TypeScript configuration
│   └── src/
│       ├── api/                      Axios client + TanStack Query hooks
│       ├── auth/                     ProtectedRoute, JWT handling
│       ├── components/
│       │   ├── charts/               SummaryCard, ChartCard
│       │   ├── common/               FeedbackWidget, ErrorBoundary, GlobalSearch,
│       │   │                         TourGuide, TablePagination, BulkActions, etc.
│       │   └── layout/               AppShell (sidebar navigation)
│       ├── hooks/                    usePagination, useRowSelection
│       ├── pages/                    57 page components
│       │   ├── reports/              18 report pages
│       │   ├── settings/             12 settings pages
│       │   └── simulators/           2 simulator pages
│       ├── types/                    TypeScript interfaces
│       ├── utils/                    Formatting and conditional formatting
│       ├── brandTokens.ts            Design tokens (DEEP_BLUE, AQUA, FONT_FAMILY)
│       ├── App.tsx                   Route definitions
│       └── main.tsx                  Entry point + global error handlers
│
├── bruno/                            Bruno API collection
│   └── Portfolio Planner/            104+ endpoint definitions
│       ├── bruno.json                Collection metadata
│       ├── collection.bru            Shared auth & headers
│       ├── environments/             Local + Production environments
│       └── [31 folders]/             Endpoint categories
│
├── scripts/
│   ├── setup-linux.sh                One-shot Linux setup & deployment
│   └── setup-windows.ps1             One-shot Windows setup & deployment
│
├── start-backend.sh                  Backend startup script
├── start-frontend.sh                 Frontend startup script
└── README.md                         This file
```

---

## API Reference

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (returns JWT token) |

All other endpoints require a valid JWT in the `Authorization: Bearer <token>` header. Tokens expire after 24 hours. The token is stored in localStorage as `pp_token`.

### Core Resources

| Method | Path | Description |
|---|---|---|
| GET | `/api/resources` | List all resources |
| POST | `/api/resources` | Create resource |
| PUT | `/api/resources/{id}` | Update resource |
| DELETE | `/api/resources/{id}` | Delete resource |
| PUT | `/api/resources/{id}/assignment` | Assign resource to POD |
| GET | `/api/pods` | List all PODs |
| POST | `/api/pods` | Create POD |
| PUT | `/api/pods/{id}` | Update POD |
| GET | `/api/projects` | List projects (optional `?status=ACTIVE`) |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| PUT | `/api/projects/{id}/pod-planning` | Set POD planning entries |

### Reports

| Method | Path | Description |
|---|---|---|
| GET | `/api/reports/capacity-gap` | Monthly capacity vs demand gap |
| GET | `/api/reports/hiring-forecast` | Incremental FTE hiring plan |
| GET | `/api/reports/utilisation` | Utilisation heatmap data |
| GET | `/api/reports/pod-capacity` | POD capacity breakdown |
| GET | `/api/reports/project-health` | Project health scores |
| GET | `/api/reports/budget` | Budget and cost analysis |
| GET | `/api/reports/concurrency-risk` | Resource concurrency risk |

### NLP

| Method | Path | Description |
|---|---|---|
| POST | `/api/nlp/query` | Submit a natural language query |
| GET | `/api/nlp/catalog` | Get full NLP capability catalog |
| GET | `/api/nlp/config` | Get NLP configuration |
| PUT | `/api/nlp/config` | Update NLP configuration |
| GET | `/api/nlp/logs` | Get NLP query logs |
| GET | `/api/nlp/learned-patterns` | Get learned patterns |
| POST | `/api/nlp/feedback` | Submit feedback on a query result |
| POST | `/api/nlp/learner/run` | Trigger manual learner run |
| GET | `/api/nlp/learner/runs` | Get learner run history |

### Jira

| Method | Path | Description |
|---|---|---|
| GET | `/api/jira/pods` | List Jira pod configurations |
| POST | `/api/jira/pods` | Create Jira pod mapping |
| GET | `/api/jira/sprints/{podId}` | Get sprints for a pod |
| GET | `/api/jira/actuals/{podId}` | Get sprint actuals |
| GET | `/api/jira/capex` | Get CapEx hours |
| GET | `/api/jira/support` | Get support board snapshots |
| GET | `/api/jira/worklogs` | Get aggregated worklogs |

### Settings & Admin

| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/{id}` | Update user (role, permissions) |
| GET | `/api/feedback` | List all user feedback |
| POST | `/api/feedback` | Submit feedback |
| PUT | `/api/feedback/{id}` | Update feedback status/priority |
| GET | `/api/error-logs` | List application errors |
| GET | `/api/error-logs/summary` | Error log summary counts |
| POST | `/api/error-logs` | Log an error |
| GET | `/api/audit-logs` | Get audit trail |
| POST | `/api/import` | Upload Excel file |

---

## Running Tests

### Backend

```bash
cd backend

# Run all tests
./mvnw test

# Run specific test classes
./mvnw test -Dtest="*CalculatorTest"     # Unit tests
./mvnw test -Dtest="*ControllerTest"     # Integration tests (MockMvc + H2)
```

### Frontend

```bash
cd frontend

npm install     # First time only
npm test        # Run all Vitest tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

---

## Default Credentials

The V48 seed migration creates a default admin user:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin` |
| Role | `ADMIN` |
| Display Name | `Piyush Baheti` |

**Important:** Change the admin password immediately after first login in a production environment. You can create additional users via **Settings → User Management**.

---

## Bruno API Collection

A complete [Bruno](https://www.usebruno.com/) API collection is included in the `bruno/` directory with all 104+ backend endpoints organised by category.

### Setup

1. Download and install Bruno from [usebruno.com](https://www.usebruno.com/)
2. Open Bruno → **Open Collection** → select the `bruno/Portfolio Planner` folder
3. Select the **Local** environment (pre-configured for `http://localhost:8080`)
4. Run the **Auth → Login** request first — it automatically saves the JWT token for all subsequent requests

### Collection Structure

| Folder | Endpoints | Description |
|---|---|---|
| Auth | 3 | Login, logout, current user |
| User Management | 6 | CRUD users, role permissions (ADMIN only) |
| Resources | 10 | CRUD resources, availability, assignments, rates |
| Pods | 4 | CRUD pods |
| Projects | 10 | CRUD projects, copy, pod matrix, pod planning |
| Sprints | 4 | CRUD sprints |
| Timeline | 2 | Get/update timeline config |
| Ref Data | 11 | T-shirt sizes, effort patterns, role mix |
| BAU Assumptions | 2 | Get/update BAU assumptions |
| Cost Rates | 4 | CRUD cost rates |
| Temporary Overrides | 4 | CRUD temporary overrides |
| Reports | 9 | Executive summary, capacity gap, heatmap, hiring, etc. |
| NLP | 7 | Query, config, feedback, test connection |
| NLP Learner | 7 | Trigger runs, patterns, history |
| Jira | 13 | Status, mappings, credentials, cache, debug |
| Jira Pods | 6 | Pod configs, velocity, sprint issues |
| Jira Releases | 7 | Release config, search, fix versions |
| Jira Support | 10 | Snapshots, boards, throughput, tickets |
| Jira Worklog | 2 | Worklogs, user history |
| Jira CapEx | 4 | CapEx hours, fields, settings |
| Jira Sprint Issues | 1 | Sprint issues by date range |
| Release Calendar | 4 | CRUD release calendar entries |
| Feedback | 4 | Submit/manage user feedback |
| Error Logs | 6 | Log/resolve/clear errors |
| Audit Log | 3 | Recent logs, entity history |
| Tour | 4 | Tour status, config |
| Widget Preferences | 2 | Get/update widget layout |
| Digest | 1 | Trigger email digest |
| Simulator | 1 | Run timeline simulation |
| Data Import | 1 | Upload Excel file |
| Actuals | 2 | Project actuals |
| Admin DB | 3 | Database browser (ADMIN only) |

### Environments

- **Local** — `http://localhost:8080` (development)
- **Production** — `https://your-domain.com` (update with your actual domain)

---

## Troubleshooting

**Backend won't start — "relation does not exist"**
Flyway migrations haven't run. Check that the database exists and the user has CREATE permissions on the public schema. Look for Flyway errors in the startup logs.

**Frontend shows blank page or 404 on refresh**
In production, ensure Nginx (or your web server) is configured with `try_files $uri $uri/ /index.html` for SPA routing.

**NLP returns "UNKNOWN" for most queries**
The rule-based engine handles common patterns. For better coverage, install Ollama with llama3:8b and ensure it's running on port 11434. Check NLP Settings to confirm `LOCAL_LLM` is in the strategy chain.

**Jira integration returns 401**
Verify your Jira API token is valid and the email matches. Tokens expire — regenerate at [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).

**"CORS error" in browser console**
Set the `ALLOWED_ORIGINS` environment variable to match your frontend URL exactly (including protocol and port). For local dev, this defaults to `http://localhost:5173`.

**Ollama model download is slow or fails**
The llama3:8b model is ~4.7 GB. Ensure sufficient disk space and a stable connection. Alternatively, use a smaller model like `llama3.2:3b` and update in NLP Settings.

**Email digest not sending**
Verify `DIGEST_ENABLED=true` and that SMTP credentials are correct. For Gmail, you must use an App Password (not your regular password) with 2FA enabled.

**Out of memory with Ollama**
The llama3:8b model requires ~8 GB RAM. If the server has limited memory, either use a smaller model or disable LOCAL_LLM in the strategy chain and rely on RULE_BASED + CLOUD_LLM.

---

## License

MIT
