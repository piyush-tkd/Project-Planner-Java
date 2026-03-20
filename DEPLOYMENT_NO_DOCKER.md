# Portfolio Planner — Cloud Deployment Guide (No Docker)

## Stack

| Layer      | Technology                      |
|------------|---------------------------------|
| Frontend   | React 18 + TypeScript (Vite)    |
| Backend    | Spring Boot 3.4.1, Java 21      |
| Database   | PostgreSQL 15+                  |
| Web Server | Nginx (reverse proxy + static)  |
| Process    | systemd                         |
| Migrations | Flyway (runs automatically)     |

**Recommended OS:** Ubuntu 22.04 LTS
**Minimum VM size:** 2 vCPU, 4 GB RAM (AWS `t3.medium`, GCP `e2-medium`, Azure `Standard_B2s`, DigitalOcean 4 GB Droplet)

---

## Firewall / Security Group Rules

Configure these on your cloud provider before starting:

| Port | Protocol | Source        | Purpose                          |
|------|----------|---------------|----------------------------------|
| 22   | TCP      | Your IP only  | SSH access                       |
| 80   | TCP      | 0.0.0.0/0     | HTTP (auto-redirects to HTTPS)   |
| 443  | TCP      | 0.0.0.0/0     | HTTPS                            |
| 8080 | —        | **BLOCK**     | Backend — must not be public     |
| 5432 | —        | **BLOCK**     | Postgres — must not be public    |

---

## Step 1 — System Dependencies

SSH into the server and run:

```bash
sudo apt update && sudo apt upgrade -y

# Java 21
sudo apt install -y openjdk-21-jdk
java -version   # should show openjdk 21

# Maven
sudo apt install -y maven
mvn -version

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should show v20.x

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
```

---

## Step 2 — PostgreSQL Setup

```bash
sudo -u postgres psql <<EOF
CREATE USER portfolio_planner WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE portfolio_planner OWNER portfolio_planner;
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO portfolio_planner;
EOF
```

Verify the connection works:

```bash
psql -h localhost -U portfolio_planner -d portfolio_planner -c "SELECT 1;"
# Enter the password you set above — should return "1"
```

---

## Step 3 — Clone the Repository

```bash
sudo mkdir -p /opt/portfolio-planner
sudo chown $USER:$USER /opt/portfolio-planner

git clone <YOUR_REPO_URL> /opt/portfolio-planner/source
cd /opt/portfolio-planner/source
```

---

## Step 4 — Environment Variables (Secrets)

Create the secrets file — **this file must never be committed to git**:

```bash
sudo nano /etc/portfolio-planner.env
```

Paste and fill in:

```env
DB_USERNAME=portfolio_planner
DB_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-service-account@yourcompany.com
JIRA_API_TOKEN=your-jira-api-token-here
```

Lock down the file permissions:

```bash
sudo chmod 600 /etc/portfolio-planner.env
sudo chown root:root /etc/portfolio-planner.env
```

---

## Step 5 — Build the Frontend

```bash
cd /opt/portfolio-planner/source/frontend

npm ci                 # clean install from package-lock.json
npm run build          # outputs to frontend/dist/

# Deploy to web root
sudo mkdir -p /var/www/portfolio-planner
sudo cp -r dist/* /var/www/portfolio-planner/
sudo chown -R www-data:www-data /var/www/portfolio-planner
```

---

## Step 6 — Build the Backend

```bash
cd /opt/portfolio-planner/source/backend

mvn clean package -DskipTests
# Produces: target/portfolio-planner-*.jar

sudo cp target/portfolio-planner-*.jar /opt/portfolio-planner/app.jar
```

---

## Step 7 — systemd Service (Backend)

Create the service file:

```bash
sudo nano /etc/systemd/system/portfolio-planner.service
```

Paste:

```ini
[Unit]
Description=Portfolio Planner Backend
After=network.target postgresql.service

[Service]
User=ubuntu
EnvironmentFile=/etc/portfolio-planner.env
ExecStart=/usr/bin/java \
  -Xms256m -Xmx1024m \
  -jar /opt/portfolio-planner/app.jar \
  --spring.profiles.active=prod
SuccessExitStatus=143
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=portfolio-planner

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable portfolio-planner
sudo systemctl start portfolio-planner

# Check it started correctly
sudo systemctl status portfolio-planner

# Watch live logs
sudo journalctl -u portfolio-planner -f
```

The backend will start on port 8080. Flyway will automatically run all database migrations on first start — **no manual DB setup needed beyond Step 2**.

---

## Step 8 — Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/portfolio-planner
```

Paste (replace `your-domain.com` with your actual domain or server IP):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend — React SPA
    root /var/www/portfolio-planner;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — proxied to Spring Boot on localhost:8080
    location /api/ {
        proxy_pass         http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    client_max_body_size 15M;

    # Security headers
    add_header X-Frame-Options       "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy       "strict-origin-when-cross-origin";
}
```

Enable the site and reload Nginx:

```bash
# Disable default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable portfolio planner
sudo ln -s /etc/nginx/sites-available/portfolio-planner /etc/nginx/sites-enabled/

# Test config syntax
sudo nginx -t

# Apply
sudo systemctl reload nginx
```

The app should now be accessible at `http://your-domain.com`.

---

## Step 9 — SSL / HTTPS

**Required before sharing with users.** Point your domain's DNS A record to the server IP first, then:

```bash
sudo apt install -y certbot python3-certbot-nginx

# Issue certificate and auto-configure Nginx
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot sets up a cron job to auto-renew — no manual renewal needed.

---

## Health Check

Once everything is running:

```bash
# Is the backend up?
curl http://localhost:8080/api/jira/status

# Is Nginx serving the frontend?
curl -I https://your-domain.com
```

---

## Re-deploying After Code Changes

Run these steps whenever new code is pushed:

```bash
cd /opt/portfolio-planner/source
git pull

# Rebuild and redeploy frontend
cd frontend
npm ci
npm run build
sudo cp -r dist/* /var/www/portfolio-planner/

# Rebuild and redeploy backend
cd ../backend
mvn clean package -DskipTests
sudo cp target/portfolio-planner-*.jar /opt/portfolio-planner/app.jar
sudo systemctl restart portfolio-planner

# Confirm restart succeeded
sudo systemctl status portfolio-planner
```

---

## Logs

```bash
# Live backend logs
sudo journalctl -u portfolio-planner -f

# Last 200 lines
sudo journalctl -u portfolio-planner -n 200

# Nginx access/error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Postgres Backup (Recommended)

Set up a daily backup cron:

```bash
sudo -u postgres crontab -e
```

Add:

```cron
0 2 * * * pg_dump portfolio_planner | gzip > /var/backups/portfolio_planner_$(date +\%Y\%m\%d).sql.gz
```

Clean up backups older than 30 days:

```cron
0 3 * * * find /var/backups -name "portfolio_planner_*.sql.gz" -mtime +30 -delete
```

---

## Notes for DevOps

- **Flyway migrations run automatically** on every backend start. Never edit or delete existing `V*.sql` files in `backend/src/main/resources/db/migration/` — only add new ones.
- **The backend listens only on localhost:8080** — Nginx is the only public entry point.
- **The `.env` file at `/etc/portfolio-planner.env`** holds all secrets. Rotate the Jira API token there and restart the service (`sudo systemctl restart portfolio-planner`).
- **Memory:** The JVM is configured with `-Xms256m -Xmx1024m`. Increase `-Xmx` in the systemd service file if the server has more RAM and the app is slow under load.
