# ──────────────────────────────────────────────────────────────────────────────
#  Portfolio Planner — Windows Setup & Deployment Script
#  Tested on: Windows Server 2019/2022, Windows 10/11
#  Usage:     Run PowerShell as Administrator, then: .\setup-windows.ps1
# ──────────────────────────────────────────────────────────────────────────────

#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

# ── Colours ───────────────────────────────────────────────────────────────────
function Write-Info   { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-OK     { param($msg) Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn   { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Err    { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ── Configuration — EDIT THESE ────────────────────────────────────────────────
$APP_DIR        = "C:\portfolio-planner"
$DB_NAME        = "portfolio_planner"
$DB_USER        = "pp_user"
$BACKEND_PORT   = 8080
$NSSM_DIR       = "C:\tools\nssm"

# ══════════════════════════════════════════════════════════════════════════════
# Banner
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "       Portfolio Planner — Windows Setup & Deployment           " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ── Interactive prompts ───────────────────────────────────────────────────────
$DB_PASSWORD = Read-Host "Enter PostgreSQL password for user '$DB_USER'" -AsSecureString
$DB_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD)
)

$DOMAIN = Read-Host "Enter your domain name (e.g., planner.example.com)"

$installOllama = Read-Host "Install Ollama for local LLM NLP? (y/N)"
$INSTALL_OLLAMA = $installOllama -match '^[Yy]'

Write-Host ""
Write-Info "Configuration summary:"
Write-Host "  App directory:   $APP_DIR"
Write-Host "  Domain:          $DOMAIN"
Write-Host "  DB user:         $DB_USER"
Write-Host "  Install Ollama:  $INSTALL_OLLAMA"
Write-Host ""

$proceed = Read-Host "Proceed? (Y/n)"
if ($proceed -match '^[Nn]') { Write-Host "Aborted."; exit 0 }

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: Verify prerequisites
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 1/8 — Verifying prerequisites..."

$missing = @()

# Java
try {
    $javaVer = & java -version 2>&1 | Select-String "version" | ForEach-Object { $_.ToString() }
    if ($javaVer -notmatch '"21') {
        $missing += "Java JDK 21 — https://adoptium.net/temurin/releases/"
    } else {
        Write-OK "Java 21 found"
    }
} catch {
    $missing += "Java JDK 21 — https://adoptium.net/temurin/releases/"
}

# Maven
try {
    $null = & mvn -version 2>&1
    Write-OK "Maven found"
} catch {
    # Check for mvnw.cmd in project
    Write-Warn "Maven not in PATH — will use mvnw.cmd wrapper"
}

# Node.js
try {
    $nodeVer = & node -v 2>&1
    if ($nodeVer -notmatch 'v2[0-9]') {
        $missing += "Node.js 20+ LTS — https://nodejs.org/"
    } else {
        Write-OK "Node.js $nodeVer found"
    }
} catch {
    $missing += "Node.js 20+ LTS — https://nodejs.org/"
}

# PostgreSQL
try {
    $null = & psql --version 2>&1
    Write-OK "PostgreSQL found"
} catch {
    $missing += "PostgreSQL 16 — https://www.postgresql.org/download/windows/"
}

# Git
try {
    $null = & git --version 2>&1
    Write-OK "Git found"
} catch {
    $missing += "Git — https://git-scm.com/download/win"
}

if ($missing.Count -gt 0) {
    Write-Err "Missing prerequisites. Please install the following and re-run:"
    foreach ($m in $missing) {
        Write-Host "  - $m" -ForegroundColor Red
    }
    exit 1
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: Configure PostgreSQL
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 2/8 — Configuring PostgreSQL..."

$pgCheck = & psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>&1
if ($pgCheck -notmatch '1') {
    & psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD_PLAIN';"
    Write-OK "Created PostgreSQL user '$DB_USER'"
} else {
    Write-OK "PostgreSQL user '$DB_USER' already exists"
}

$dbCheck = & psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>&1
if ($dbCheck -notmatch '1') {
    & psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    Write-OK "Created database '$DB_NAME'"
} else {
    Write-OK "Database '$DB_NAME' already exists"
}

& psql -U postgres -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>$null
& psql -U postgres -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" 2>$null
& psql -U postgres -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;" 2>$null
Write-OK "PostgreSQL configured"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: Deploy application files
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 3/8 — Deploying application files..."

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = Split-Path -Parent $ScriptDir

if (-not (Test-Path $APP_DIR)) {
    New-Item -ItemType Directory -Path $APP_DIR -Force | Out-Null
}

Copy-Item -Path "$ProjectRoot\backend" -Destination $APP_DIR -Recurse -Force
Copy-Item -Path "$ProjectRoot\frontend" -Destination $APP_DIR -Recurse -Force
Write-OK "Files copied to $APP_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4: Build the backend
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 4/8 — Building backend JAR..."

Push-Location "$APP_DIR\backend"
& .\mvnw.cmd clean package -DskipTests -q
Pop-Location
Write-OK "Backend JAR built"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5: Build the frontend
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 5/8 — Building frontend..."

Push-Location "$APP_DIR\frontend"
$env:VITE_API_URL = "https://$DOMAIN"
& npm install --silent 2>$null
& npm run build
Pop-Location
Write-OK "Frontend built"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6: Install NSSM and create Windows service
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 6/8 — Setting up Windows service..."

# Create logs directory
$logsDir = "$APP_DIR\logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Check for NSSM
$nssmExe = "$NSSM_DIR\win64\nssm.exe"
if (-not (Test-Path $nssmExe)) {
    Write-Info "Downloading NSSM..."
    $nssmZip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
    Expand-Archive -Path $nssmZip -DestinationPath "C:\tools" -Force
    Rename-Item "C:\tools\nssm-2.24" $NSSM_DIR -ErrorAction SilentlyContinue
    Remove-Item $nssmZip -Force
    Write-OK "NSSM installed to $NSSM_DIR"
}

# Find java.exe
$javaHome = [System.Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if (-not $javaHome) {
    $javaPath = (Get-Command java).Source
    $javaHome = Split-Path (Split-Path $javaPath)
}
$javaExe = Join-Path $javaHome "bin\java.exe"

# Remove existing service if present
$existingService = Get-Service -Name "PortfolioPlanner" -ErrorAction SilentlyContinue
if ($existingService) {
    & $nssmExe stop PortfolioPlanner 2>$null
    & $nssmExe remove PortfolioPlanner confirm 2>$null
    Start-Sleep -Seconds 2
}

# Install the service
& $nssmExe install PortfolioPlanner $javaExe "-jar -Xms512m -Xmx2g $APP_DIR\backend\target\portfolio-planner-0.0.1-SNAPSHOT.jar"

# Configure service
& $nssmExe set PortfolioPlanner AppDirectory "$APP_DIR\backend"
& $nssmExe set PortfolioPlanner AppEnvironmentExtra `
    "DB_USERNAME=$DB_USER" `
    "DB_PASSWORD=$DB_PASSWORD_PLAIN" `
    "SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/$DB_NAME" `
    "ALLOWED_ORIGINS=https://$DOMAIN"
& $nssmExe set PortfolioPlanner AppRestartDelay 10000
& $nssmExe set PortfolioPlanner AppStdout "$logsDir\stdout.log"
& $nssmExe set PortfolioPlanner AppStderr "$logsDir\stderr.log"
& $nssmExe set PortfolioPlanner AppRotateFiles 1
& $nssmExe set PortfolioPlanner AppRotateBytes 10485760

# Start the service
& $nssmExe start PortfolioPlanner
Write-OK "Windows service 'PortfolioPlanner' created and started"

# Wait for backend
Write-Info "Waiting for backend to start..."
$maxWait = 60
for ($i = 0; $i -lt $maxWait; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$BACKEND_PORT/api/auth/me" -UseBasicParsing -ErrorAction SilentlyContinue
        Write-OK "Backend is running on port $BACKEND_PORT"
        break
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-OK "Backend is running on port $BACKEND_PORT"
            break
        }
    }
    Start-Sleep -Seconds 2
    if ($i -eq ($maxWait - 1)) {
        Write-Warn "Backend may still be starting. Check logs: $logsDir\stdout.log"
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7: Configure Nginx (or IIS)
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 7/8 — Configuring reverse proxy..."

# Try Nginx for Windows first
$nginxDir = "C:\tools\nginx"
if (-not (Test-Path $nginxDir)) {
    Write-Info "Downloading Nginx for Windows..."
    $nginxZip = "$env:TEMP\nginx.zip"
    try {
        Invoke-WebRequest -Uri "https://nginx.org/download/nginx-1.26.2.zip" -OutFile $nginxZip
        Expand-Archive -Path $nginxZip -DestinationPath "C:\tools" -Force
        Rename-Item "C:\tools\nginx-1.26.2" $nginxDir -ErrorAction SilentlyContinue
        Remove-Item $nginxZip -Force
        Write-OK "Nginx installed to $nginxDir"
    } catch {
        Write-Warn "Nginx download failed. Configure IIS manually (see README)."
    }
}

if (Test-Path $nginxDir) {
    # Write Nginx config
    $nginxConf = @"
worker_processes  1;

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;
    client_max_body_size 10M;

    server {
        listen       80;
        server_name  $DOMAIN;

        root $($APP_DIR -replace '\\','/')/frontend/dist;
        index index.html;

        location / {
            try_files `$uri `$uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://localhost:$BACKEND_PORT;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_read_timeout 90s;
        }
    }
}
"@
    Set-Content -Path "$nginxDir\conf\nginx.conf" -Value $nginxConf

    # Install Nginx as a service via NSSM
    $existingNginx = Get-Service -Name "Nginx" -ErrorAction SilentlyContinue
    if ($existingNginx) {
        & $nssmExe stop Nginx 2>$null
        & $nssmExe remove Nginx confirm 2>$null
        Start-Sleep -Seconds 2
    }
    & $nssmExe install Nginx "$nginxDir\nginx.exe"
    & $nssmExe set Nginx AppDirectory $nginxDir
    & $nssmExe start Nginx
    Write-OK "Nginx configured and running as a service"
}

# Also create IIS web.config in frontend dist for users who prefer IIS
$webConfigPath = "$APP_DIR\frontend\dist\web.config"
if (-not (Test-Path $webConfigPath)) {
    $webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://localhost:$BACKEND_PORT/api/{R:1}" />
                </rule>
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
            <remove fileExtension=".json" />
            <mimeMap fileExtension=".json" mimeType="application/json" />
            <remove fileExtension=".woff2" />
            <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
        </staticContent>
    </system.webServer>
</configuration>
"@
    Set-Content -Path $webConfigPath -Value $webConfig
    Write-OK "IIS web.config created (in case you switch to IIS later)"
}

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8: Optional — Ollama
# ══════════════════════════════════════════════════════════════════════════════
Write-Info "Step 8/8 — Optional components..."

if ($INSTALL_OLLAMA) {
    Write-Info "Downloading Ollama installer..."
    $ollamaInstaller = "$env:TEMP\OllamaSetup.exe"
    try {
        Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $ollamaInstaller
        Start-Process -FilePath $ollamaInstaller -ArgumentList "/S" -Wait
        Remove-Item $ollamaInstaller -Force
        Start-Sleep -Seconds 5

        Write-Info "Pulling llama3:8b model (this may take a while — ~4.7 GB)..."
        & ollama pull llama3:8b
        Write-OK "Ollama installed with llama3:8b"
    } catch {
        Write-Warn "Ollama install failed. Download manually: https://ollama.com/download/windows"
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# Done
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "                    Setup Complete!                              " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Application URL:  http://$DOMAIN"
Write-Host "  Backend API:      http://localhost:$BACKEND_PORT/api"
Write-Host "  Default login:    admin / admin"
Write-Host ""
Write-Host "  Manage service:"
Write-Host "    sc query PortfolioPlanner"
Write-Host "    net stop PortfolioPlanner"
Write-Host "    net start PortfolioPlanner"
Write-Host ""
Write-Host "  Logs: $APP_DIR\logs\"
Write-Host ""
Write-Host "  IMPORTANT: Change the admin password after first login!" -ForegroundColor Yellow
Write-Host ""
Write-Host "  To configure optional features, update service env vars:"
Write-Host "    $NSSM_DIR\win64\nssm.exe edit PortfolioPlanner"
Write-Host ""
Write-Host "  Jira Integration:"
Write-Host "    JIRA_BASE_URL=https://yourcompany.atlassian.net"
Write-Host "    JIRA_EMAIL=your-email@company.com"
Write-Host "    JIRA_API_TOKEN=your-api-token"
Write-Host ""
Write-Host "  Email Digest:"
Write-Host "    DIGEST_ENABLED=true"
Write-Host "    MAIL_USERNAME=your-email@gmail.com"
Write-Host "    MAIL_PASSWORD=your-app-password"
Write-Host "    DIGEST_RECIPIENTS=manager@company.com"
Write-Host ""
