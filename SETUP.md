# Engineering Portfolio Planner — Setup Guide

## Prerequisites

| Software       | Version  |
|----------------|----------|
| Java (JDK)     | 21+      |
| Maven          | 3.9+     |
| Node.js        | 18+      |
| npm            | 9+       |
| PostgreSQL     | 15+      |

---

## 1. Database Setup

```bash
# Login to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE portfolio_planner;
CREATE USER planner_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE portfolio_planner TO planner_user;
\c portfolio_planner
GRANT ALL ON SCHEMA public TO planner_user;
\q
```

Flyway will auto-run migrations (V1–V4) on first backend startup — no manual SQL needed.

---

## 2. Backend

```bash
cd backend

# Set environment variables
export JAVA_HOME=/path/to/jdk-21
export DB_USERNAME=planner_user
export DB_PASSWORD=your_secure_password

# Build
mvn clean package -DskipTests

# Run
java -jar target/portfolio-planner-0.0.1-SNAPSHOT.jar
```

The backend starts on **port 8080**.

### Override DB connection (if not localhost)

```bash
java -jar target/portfolio-planner-0.0.1-SNAPSHOT.jar \
  --spring.datasource.url=jdbc:postgresql://DB_HOST:5432/portfolio_planner \
  --spring.datasource.username=planner_user \
  --spring.datasource.password=your_secure_password
```

Or use environment variables:

```bash
export SPRING_DATASOURCE_URL=jdbc:postgresql://DB_HOST:5432/portfolio_planner
export SPRING_DATASOURCE_USERNAME=planner_user
export SPRING_DATASOURCE_PASSWORD=your_secure_password
```

---

## 3. Frontend

```bash
cd frontend

npm install

# Build for production
npm run build
```

This produces a `dist/` folder with static files.

---

## 4. Serving in Production

### Option A: Nginx (recommended)

Nginx serves frontend static files and reverse-proxies `/api` to the backend.

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    root /path/to/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Option B: Backend serves frontend (simpler)

Copy the built frontend into backend static resources before building:

```bash
cp -r frontend/dist/* backend/src/main/resources/static/
cd backend
mvn clean package -DskipTests
java -jar target/portfolio-planner-0.0.1-SNAPSHOT.jar
```

Everything runs on port 8080 — no nginx needed.

---

## 5. Run Backend as a Service (systemd)

Create `/etc/systemd/system/portfolio-planner.service`:

```ini
[Unit]
Description=Engineering Portfolio Planner
After=postgresql.service network.target

[Service]
User=deploy
WorkingDirectory=/opt/portfolio-planner
ExecStart=/usr/bin/java -jar portfolio-planner-0.0.1-SNAPSHOT.jar
Environment=SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/portfolio_planner
Environment=SPRING_DATASOURCE_USERNAME=planner_user
Environment=SPRING_DATASOURCE_PASSWORD=your_secure_password
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable portfolio-planner
sudo systemctl start portfolio-planner

# Check status
sudo systemctl status portfolio-planner
journalctl -u portfolio-planner -f
```

---

## 6. Verification

```bash
# Backend health check
curl http://localhost:8080/api/timeline-config

# Frontend (if using nginx)
curl http://your-domain.com
```

---

## Ports Summary

| Component   | Port |
|-------------|------|
| PostgreSQL  | 5432 |
| Backend API | 8080 |
| Frontend    | 80 (nginx) or 8080 (Option B) |
