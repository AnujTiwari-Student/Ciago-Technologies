# Frappe Deployment Guide - Development to Production

## Overview

This guide covers:

1. ✅ **Initial Production Deployment** - Deploy your Frappe setup from scratch
2. ✅ **Development Workflow** - Make changes in dev and deploy to prod
3. ✅ **CI/CD Pipeline** - Automate deployments with GitHub Actions
4. ✅ **Rollback Procedures** - Handle issues in production

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT ENVIRONMENT                       │
├─────────────────────────────────────────────────────────────────┤
│ - Docker Compose (localhost:8180)                              │
│ - developer_mode: 1                                             │
│ - Direct code changes                                           │
│ - Custom app: ciago_spark                                       │
│   └── setup/ (roles, permissions, workspaces)                   │
│ - Fixtures exported to Git                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Git Push
                              │ (fixtures + code)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         GIT REPOSITORY                           │
├─────────────────────────────────────────────────────────────────┤
│ apps/ciago_spark/                                               │
│ ├── ciago_spark/                                                │
│ │   ├── setup/ (Python automation)                              │
│ │   ├── fixtures/ (JSON exports)                                │
│ │   └── hooks.py                                                │
│ ├── docker/frappe/Dockerfile                                    │
│ └── docker-compose.frappe.yml                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Git Pull + Deploy
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ENVIRONMENT                        │
├─────────────────────────────────────────────────────────────────┤
│ - Docker/Kubernetes                                             │
│ - developer_mode: 0                                             │
│ - HTTPS/SSL enabled                                             │
│ - Automatic migrations (bench migrate)                          │
│ - Fixtures auto-imported                                        │
│ - Setup automation runs                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Initial Production Deployment

### Prerequisites

**Production Server Requirements:**

- Ubuntu 22.04+ / Debian 11+ (recommended)
- 4 GB RAM minimum (8 GB recommended)
- 2 CPU cores minimum (4 cores recommended)
- 40 GB disk space minimum
- Docker & Docker Compose installed
- Domain name configured (e.g., `frappe.yourdomain.com`)
- SSL certificate (Let's Encrypt recommended)

---

### Step 1: Prepare Production Server

```bash
# SSH into production server
ssh user@your-production-server.com

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

### Step 2: Clone Repository to Production

```bash
# Create production directory
mkdir -p /opt/frappe-production
cd /opt/frappe-production

# Clone your repository
git clone https://github.com/yourusername/ciago-spark.git .

# Or if using private repo:
git clone git@github.com:yourusername/ciago-spark.git .
```

---

### Step 3: Build Custom Frappe Image

**Option A: Build on Production Server**

```bash
cd /opt/frappe-production

# Build image with HRMS and ciago_spark
docker build -t frappe-erpnext-hrms:v15-prod -f docker/frappe/Dockerfile docker/frappe/

# This creates an image with:
# - Frappe v15
# - ERPNext v15
# - HRMS v15
# - ciago_spark custom app
```

**Option B: Build in Development, Push to Registry**

```bash
# In development environment
docker build -t yourregistry.com/frappe-erpnext-hrms:v15-prod -f docker/frappe/Dockerfile docker/frappe/
docker push yourregistry.com/frappe-erpnext-hrms:v15-prod

# On production server
docker pull yourregistry.com/frappe-erpnext-hrms:v15-prod
docker tag yourregistry.com/frappe-erpnext-hrms:v15-prod frappe-erpnext-hrms:v15-prod
```

---

### Step 4: Configure Production Environment

Create `.env.production` file:

```bash
cd /opt/frappe-production

cat > .env.production << 'EOF'
# Database Configuration
FRAPPE_DB_PASSWORD=YOUR_SECURE_DB_PASSWORD_HERE_CHANGE_ME

# Site Configuration
FRAPPE_SITE_NAME=frappe.yourdomain.com

# Security
ADMIN_PASSWORD=YOUR_SECURE_ADMIN_PASSWORD_HERE_CHANGE_ME

# Environment
ENVIRONMENT=production
EOF

chmod 600 .env.production
```

---

### Step 5: Create Production Docker Compose

Create `docker-compose.production.yml`:

```yaml
# docker-compose.production.yml
services:
  frappe-db:
    image: mariadb:11.8
    container_name: frappe-db-prod
    restart: always
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --skip-character-set-client-handshake
      - --skip-innodb-read-only-compressed
      - --max-connections=500
    environment:
      MYSQL_ROOT_PASSWORD: ${FRAPPE_DB_PASSWORD}
      MARIADB_AUTO_UPGRADE: "1"
    volumes:
      - frappe-db-data:/var/lib/mysql
    networks:
      - frappe-net
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      timeout: 5s
      retries: 10

  frappe-redis-cache:
    image: redis:8.6-alpine
    container_name: frappe-redis-cache-prod
    restart: always
    networks:
      - frappe-net
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

  frappe-redis-queue:
    image: redis:8.6-alpine
    container_name: frappe-redis-queue-prod
    restart: always
    command: redis-server --appendonly yes --appendfsync everysec
    volumes:
      - frappe-redis-queue-data:/data
    networks:
      - frappe-net

  frappe-configurator:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-configurator-prod
    restart: "no"
    command: >
      bash -c "bench set-config -g db_host $$DB_HOST &&
               bench set-config -gp db_port $$DB_PORT &&
               bench set-config -g redis_cache $$REDIS_CACHE &&
               bench set-config -g redis_queue $$REDIS_QUEUE &&
               bench set-config -gp socketio_port $$SOCKETIO_PORT &&
               bench set-config -g developer_mode 0 &&
               bench set-config -g disable_rate_limiter 0 &&
               bench set-config -g server_script_enabled 0"
    environment:
      DB_HOST: frappe-db-prod
      DB_PORT: "3306"
      REDIS_CACHE: redis://frappe-redis-cache-prod:6379
      REDIS_QUEUE: redis://frappe-redis-queue-prod:6379
      SOCKETIO_PORT: "9000"
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
    networks:
      - frappe-net
    depends_on:
      frappe-db:
        condition: service_healthy

  frappe-backend:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-backend-prod
    restart: always
    environment:
      GUNICORN_WORKERS: "4"
      GUNICORN_THREADS: "8"
      GUNICORN_TIMEOUT: "300"
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
      - frappe-logs:/home/frappe/frappe-bench/logs
    networks:
      - frappe-net
    depends_on:
      frappe-configurator:
        condition: service_completed_successfully

  frappe-websocket:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-websocket-prod
    restart: always
    command: node /home/frappe/frappe-bench/apps/frappe/socketio.js
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
    networks:
      - frappe-net
    depends_on:
      frappe-configurator:
        condition: service_completed_successfully

  frappe-scheduler:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-scheduler-prod
    restart: always
    command: bench schedule
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
      - frappe-logs:/home/frappe/frappe-bench/logs
    networks:
      - frappe-net
    depends_on:
      frappe-configurator:
        condition: service_completed_successfully

  frappe-queue-short:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-queue-short-prod
    restart: always
    command: bench worker --queue short
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
      - frappe-logs:/home/frappe/frappe-bench/logs
    networks:
      - frappe-net
    depends_on:
      frappe-configurator:
        condition: service_completed_successfully

  frappe-queue-long:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-queue-long-prod
    restart: always
    command: bench worker --queue long
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
      - frappe-logs:/home/frappe/frappe-bench/logs
    networks:
      - frappe-net
    depends_on:
      frappe-configurator:
        condition: service_completed_successfully

  frappe-frontend:
    image: frappe-erpnext-hrms:v15-prod
    container_name: frappe-frontend-prod
    restart: always
    command: nginx-entrypoint.sh
    environment:
      BACKEND: frappe-backend-prod:8000
      SOCKETIO: frappe-websocket-prod:9000
      FRAPPE_SITE_NAME_HEADER: ${FRAPPE_SITE_NAME}
    ports:
      - "127.0.0.1:8180:8080" # Only localhost access (Nginx proxy will handle external)
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
    networks:
      - frappe-net
    depends_on:
      - frappe-backend
      - frappe-websocket

volumes:
  frappe-db-data:
  frappe-sites:
  frappe-redis-queue-data:
  frappe-logs:

networks:
  frappe-net:
    driver: bridge
```

---

### Step 6: Initialize Production Site

```bash
cd /opt/frappe-production

# Load environment variables
source .env.production

# Start services
docker compose -f docker-compose.production.yml up -d

# Wait for services to start (30-60 seconds)
sleep 60

# Create new site
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench new-site ${FRAPPE_SITE_NAME} \
    --mariadb-user-host-login-scope='%' \
    --db-root-password="${FRAPPE_DB_PASSWORD}" \
    --admin-password="${ADMIN_PASSWORD}" \
    --install-app erpnext

# Install HRMS
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site ${FRAPPE_SITE_NAME} install-app hrms

# Install custom app
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site ${FRAPPE_SITE_NAME} install-app ciago_spark

# Set as default site
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench use ${FRAPPE_SITE_NAME}

# Run migrations (triggers setup automation)
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site ${FRAPPE_SITE_NAME} migrate
```

**This will automatically:**

- ✅ Create all 68 enterprise roles
- ✅ Provision super-user account
- ✅ Configure role profiles
- ✅ Set up database permissions
- ✅ Map workspace visibility
- ✅ Import all fixtures from Git

---

### Step 7: Configure Nginx Reverse Proxy (HTTPS)

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/frappe

# Paste this configuration:
```

```nginx
# /etc/nginx/sites-available/frappe

upstream frappe_backend {
    server 127.0.0.1:8180;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name frappe.yourdomain.com;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name frappe.yourdomain.com;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/frappe.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/frappe.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client upload limits
    client_max_body_size 50M;
    client_body_timeout 300s;

    # Proxy settings
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;

    # Main application
    location / {
        proxy_pass http://frappe_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Frappe-Site-Name frappe.yourdomain.com;
        proxy_redirect off;
    }

    # WebSocket for real-time updates
    location /socket.io {
        proxy_pass http://frappe_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Assets (optional caching)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://frappe_backend;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/frappe /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d frappe.yourdomain.com

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx autostart
sudo systemctl enable nginx
```

---

### Step 8: Configure Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

### Step 9: Setup Automated Backups

```bash
# Create backup script
sudo nano /opt/frappe-production/backup.sh
```

```bash
#!/bin/bash
# /opt/frappe-production/backup.sh

set -e

# Configuration
SITE_NAME="frappe.yourdomain.com"
BACKUP_DIR="/opt/frappe-backups"
RETENTION_DAYS=30
COMPOSE_FILE="/opt/frappe-production/docker-compose.production.yml"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Create backup
docker compose -f ${COMPOSE_FILE} exec -T frappe-backend \
  bench --site ${SITE_NAME} backup --with-files

# Copy backup to backup directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker cp frappe-backend-prod:/home/frappe/frappe-bench/sites/${SITE_NAME}/private/backups/ \
  ${BACKUP_DIR}/${TIMESTAMP}/

# Remove old backups
find ${BACKUP_DIR} -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} +

echo "✓ Backup completed: ${BACKUP_DIR}/${TIMESTAMP}"
```

```bash
# Make executable
chmod +x /opt/frappe-production/backup.sh

# Create cron job (daily at 2 AM)
sudo crontab -e

# Add line:
0 2 * * * /opt/frappe-production/backup.sh >> /var/log/frappe-backup.log 2>&1
```

---

## Part 2: Development to Production Workflow

### Workflow Overview

```
Developer Machine (Dev)
    ↓
1. Make changes (code, fixtures, custom fields)
    ↓
2. Test locally (bench migrate)
    ↓
3. Export fixtures (bench export-fixtures)
    ↓
4. Commit to Git (git commit + push)
    ↓
GitHub Repository
    ↓
5. Pull on production (git pull)
    ↓
6. Build new image (if code changed)
    ↓
7. Run migration (bench migrate)
    ↓
Production Server (Prod)
```

---

### Scenario 1: Changed Custom Fields or Workspace Settings

**Development:**

```bash
# 1. Make changes via Frappe Desk UI
#    - Add custom field to Job Opening
#    - Modify workspace visibility
#    - Update role permissions

# 2. Export fixtures
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost export-fixtures

# 3. Copy fixtures to host (if needed)
docker cp frappe-backend:/home/frappe/frappe-bench/apps/ciago_spark/ciago_spark/fixtures/ \
  ./apps/ciago_spark/ciago_spark/

# 4. Commit and push
git add apps/ciago_spark/ciago_spark/fixtures/
git commit -m "feat: add custom field to Job Opening"
git push origin main
```

**Production:**

```bash
# SSH to production
ssh user@your-production-server.com
cd /opt/frappe-production

# 1. Pull latest changes
git pull origin main

# 2. Run migration (fixtures auto-import)
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com migrate

# 3. Clear cache
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com clear-cache

# 4. Restart services
docker compose -f docker-compose.production.yml restart frappe-backend frappe-websocket
```

**No downtime required!** Fixtures import automatically during migration.

---

### Scenario 2: Changed Python Code (setup modules, hooks, custom logic)

**Development:**

```bash
# 1. Modify Python files
# Example: apps/ciago_spark/ciago_spark/setup/setup_permissions.py

# 2. Test changes
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate

# 3. Export fixtures (if applicable)
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost export-fixtures

# 4. Commit and push
git add apps/ciago_spark/
git commit -m "feat: add new enterprise role (CISO)"
git push origin main
```

**Production:**

```bash
# SSH to production
ssh user@your-production-server.com
cd /opt/frappe-production

# 1. Pull latest changes
git pull origin main

# 2. Rebuild Docker image (contains Python code)
docker build -t frappe-erpnext-hrms:v15-prod -f docker/frappe/Dockerfile docker/frappe/

# 3. Recreate containers
docker compose -f docker-compose.production.yml up -d --force-recreate

# 4. Run migration
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com migrate

# 5. Restart services
docker compose -f docker-compose.production.yml restart
```

**Downtime:** ~30-60 seconds during container recreation.

---

### Scenario 3: Changed DocType / Database Schema

**Development:**

```bash
# 1. Create or modify DocType via Frappe Desk
#    - Create new DocType: "Job Application Tracking"
#    - Add fields, configure permissions

# 2. Export fixtures
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost export-fixtures

# 3. Commit and push
git add apps/ciago_spark/ciago_spark/fixtures/
git commit -m "feat: add Job Application Tracking DocType"
git push origin main
```

**Production:**

```bash
# SSH to production
ssh user@your-production-server.com
cd /opt/frappe-production

# 1. Pull latest changes
git pull origin main

# 2. Run migration (creates database tables)
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com migrate

# 3. Clear cache
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com clear-cache

# 4. Rebuild assets (if JS/CSS changes)
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench build --app ciago_spark

# 5. Restart
docker compose -f docker-compose.production.yml restart frappe-backend
```

**No downtime required!** Schema migrations run safely.

---

### Scenario 4: Added New Custom App

**Development:**

```bash
# 1. Create new app
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench new-app my_new_app

# 2. Install app to site
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost install-app my_new_app

# 3. Make changes, export fixtures

# 4. Commit and push
git add apps/my_new_app/
git commit -m "feat: add new custom app for inventory tracking"
git push origin main
```

**Production:**

```bash
# SSH to production
ssh user@your-production-server.com
cd /opt/frappe-production

# 1. Pull latest changes
git pull origin main

# 2. Update Dockerfile to include new app
nano docker/frappe/Dockerfile

# Add line:
# RUN bench get-app my_new_app /path/to/app

# 3. Rebuild image
docker build -t frappe-erpnext-hrms:v15-prod -f docker/frappe/Dockerfile docker/frappe/

# 4. Recreate containers
docker compose -f docker-compose.production.yml up -d --force-recreate

# 5. Install app
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com install-app my_new_app

# 6. Run migration
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com migrate
```

---

## Part 3: CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy Frappe to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.8.0
        with:
          ssh-private-key: ${{ secrets.PRODUCTION_SSH_KEY }}

      - name: Add production server to known hosts
        run: |
          ssh-keyscan -H ${{ secrets.PRODUCTION_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy to production
        env:
          PROD_HOST: ${{ secrets.PRODUCTION_HOST }}
          PROD_USER: ${{ secrets.PRODUCTION_USER }}
          SITE_NAME: ${{ secrets.FRAPPE_SITE_NAME }}
        run: |
          ssh ${PROD_USER}@${PROD_HOST} << 'ENDSSH'
            set -e
            
            echo "=== Starting deployment ==="
            cd /opt/frappe-production
            
            # Pull latest code
            git pull origin main
            
            # Check if Dockerfile changed
            if git diff HEAD@{1} HEAD --name-only | grep -q "docker/frappe/Dockerfile"; then
              echo "Dockerfile changed, rebuilding image..."
              docker build -t frappe-erpnext-hrms:v15-prod -f docker/frappe/Dockerfile docker/frappe/
              docker compose -f docker-compose.production.yml up -d --force-recreate
            else
              echo "No Dockerfile changes, skipping rebuild"
            fi
            
            # Run migrations
            echo "Running migrations..."
            docker compose -f docker-compose.production.yml exec -T frappe-backend \
              bench --site ${SITE_NAME} migrate
            
            # Clear cache
            docker compose -f docker-compose.production.yml exec -T frappe-backend \
              bench --site ${SITE_NAME} clear-cache
            
            # Restart services
            docker compose -f docker-compose.production.yml restart frappe-backend frappe-websocket
            
            echo "=== Deployment complete ==="
          ENDSSH

      - name: Health check
        env:
          PROD_URL: ${{ secrets.FRAPPE_PRODUCTION_URL }}
        run: |
          sleep 10
          curl -f ${PROD_URL}/api/method/ping || exit 1
          echo "✓ Production site is healthy"

      - name: Notify deployment
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: "Frappe production deployment: ${{ job.status }}"
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

**Setup GitHub Secrets:**

```
Settings > Secrets and variables > Actions > New repository secret

Add:
- PRODUCTION_SSH_KEY (your private SSH key)
- PRODUCTION_HOST (your-server.com)
- PRODUCTION_USER (ubuntu or your user)
- FRAPPE_SITE_NAME (frappe.yourdomain.com)
- FRAPPE_PRODUCTION_URL (https://frappe.yourdomain.com)
- SLACK_WEBHOOK (optional, for notifications)
```

---

## Part 4: Rollback Procedures

### Quick Rollback (Git)

```bash
# SSH to production
ssh user@your-production-server.com
cd /opt/frappe-production

# 1. Rollback to previous commit
git log --oneline -5  # Find previous commit hash
git reset --hard <previous-commit-hash>

# 2. Rebuild if necessary
docker build -t frappe-erpnext-hrms:v15-prod -f docker/frappe/Dockerfile docker/frappe/

# 3. Recreate containers
docker compose -f docker-compose.production.yml up -d --force-recreate

# 4. Run migration
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com migrate

# 5. Clear cache
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com clear-cache
```

### Full Database Restore

```bash
# SSH to production
ssh user@your-production-server.com
cd /opt/frappe-production

# 1. Stop services
docker compose -f docker-compose.production.yml stop frappe-backend frappe-websocket frappe-queue-short frappe-queue-long

# 2. Restore database
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com restore /path/to/backup.sql.gz

# 3. Start services
docker compose -f docker-compose.production.yml start

# 4. Clear cache
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com clear-cache
```

---

## Part 5: Monitoring & Maintenance

### Setup Monitoring

```bash
# Install monitoring tools
docker compose -f docker-compose.production.yml exec frappe-backend bash

# Inside container
pip install prometheus-client
```

### Check Logs

```bash
# Application logs
docker compose -f docker-compose.production.yml logs -f frappe-backend

# Database logs
docker compose -f docker-compose.production.yml logs -f frappe-db

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Performance Tuning

```bash
# Check site status
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com doctor

# Database optimization
docker compose -f docker-compose.production.yml exec frappe-db \
  mysql_upgrade -u root -p

# Clear old logs
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com clear-log
```

---

## Troubleshooting Common Issues

### Issue: Migration Failed

```bash
# Check error logs
docker compose -f docker-compose.production.yml logs frappe-backend | tail -100

# Retry migration with force
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com migrate --skip-failing

# If still failing, rollback and investigate
```

### Issue: Site Not Accessible

```bash
# Check if containers are running
docker compose -f docker-compose.production.yml ps

# Check Nginx status
sudo systemctl status nginx

# Test backend directly
curl -v http://localhost:8180/api/method/ping

# Check Nginx logs
sudo tail -100 /var/log/nginx/error.log
```

### Issue: Database Connection Failed

```bash
# Check database health
docker compose -f docker-compose.production.yml exec frappe-db \
  mariadb -u root -p -e "SELECT 1;"

# Restart database
docker compose -f docker-compose.production.yml restart frappe-db

# Check connection from backend
docker compose -f docker-compose.production.yml exec frappe-backend \
  bench --site frappe.yourdomain.com mariadb
```

---

## Summary Checklist

### Initial Deployment ✅

- [ ] Production server provisioned
- [ ] Docker & Docker Compose installed
- [ ] Repository cloned
- [ ] Docker image built
- [ ] Environment variables configured
- [ ] Site created and initialized
- [ ] Nginx configured with HTTPS
- [ ] Firewall configured
- [ ] Automated backups setup

### Regular Deployment ✅

- [ ] Changes tested in development
- [ ] Fixtures exported (if applicable)
- [ ] Code committed and pushed to Git
- [ ] Pulled latest changes on production
- [ ] Docker image rebuilt (if needed)
- [ ] Migrations run successfully
- [ ] Cache cleared
- [ ] Services restarted
- [ ] Health check passed

### Monitoring ✅

- [ ] Daily backups verified
- [ ] Disk space monitored
- [ ] Error logs checked weekly
- [ ] Performance metrics reviewed
- [ ] Security updates applied monthly

---

**Status:** Production-Ready Deployment Guide Complete  
**Last Updated:** August 5, 2026  
**Maintained By:** Anuj (anujavengers@gmail.com)
