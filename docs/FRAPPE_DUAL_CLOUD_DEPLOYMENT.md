# Frappe Dual-Cloud Deployment Strategy
## Oracle Cloud (Free Tier/Testing) + Hetzner (Production)

**Created**: 2026-08-05  
**Purpose**: Deploy Frappe on Oracle Cloud Free Tier initially, then migrate to Hetzner when scaling  
**Cost Optimization**: $0/month (Oracle) → $23/month (Hetzner) only when needed

---

## 📋 Table of Contents

1. [Strategy Overview](#strategy-overview)
2. [Oracle Cloud Setup (Free Tier)](#oracle-cloud-setup-free-tier)
3. [Hetzner Setup (Production)](#hetzner-setup-production)
4. [Migration Between Clouds](#migration-between-clouds)
5. [CI/CD Configuration](#cicd-configuration)
6. [Backup Strategy](#backup-strategy)
7. [Cost Comparison](#cost-comparison)

---

## 🎯 Strategy Overview

### Deployment Phases

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Initial Setup (Oracle Cloud Free Tier)            │
│  Cost: $0/month                                             │
│  Duration: Until first hiring batch                         │
│  ├─ Frappe ERPNext v15 + HRMS                              │
│  ├─ All 68 roles + 326 permissions                         │
│  ├─ 10 custom workspaces                                   │
│  ├─ Testing & validation                                   │
│  └─ Automated backups to OCI Object Storage (Free)         │
└─────────────────────────────────────────────────────────────┘
                          ↓ WHEN HIRING STARTS
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Production Scale (Hetzner)                        │
│  Cost: ~$23/month (CPX21 or CX31)                          │
│  Duration: Active hiring & operations                       │
│  ├─ Migrate data from Oracle to Hetzner                    │
│  ├─ Higher performance (NVMe SSD)                          │
│  ├─ Better network (Hetzner Germany)                       │
│  ├─ Automated backups to Hetzner Storage Box               │
│  └─ Keep Oracle as warm backup (free)                      │
└─────────────────────────────────────────────────────────────┘
```

### Why This Strategy?

**Oracle Cloud Free Tier Benefits**:
- ✅ **Always Free**: 2 AMD VMs with 1GB RAM each OR 1 ARM VM with 4 OCPU + 24GB RAM
- ✅ **Free Block Storage**: 200GB total across all volumes
- ✅ **Free Object Storage**: 20GB for backups
- ✅ **Free Load Balancer**: 1 flexible load balancer
- ✅ **Free Outbound**: 10TB egress per month
- ✅ **No Credit Card Expiry**: Permanently free (not trial)

**When to Move to Hetzner**:
- First hiring batch scheduled
- Need better performance (NVMe vs network storage)
- Need EU data residency
- Active daily usage starts
- Cost justified by business operations

---

## 🆓 Oracle Cloud Setup (Free Tier)

### Server Specifications (Always Free)

**Option 1: ARM Ampere A1 (Recommended)**
```yaml
Shape: VM.Standard.A1.Flex
CPUs: 4 OCPU (ARM64 - Ampere)
RAM: 24 GB
Storage: 200 GB Block Volume (network)
OS: Ubuntu 22.04 LTS (ARM64)
Network: 1 Gbps
Cost: FREE (Always Free tier)
```

**Option 2: AMD E2.1.Micro (Limited)**
```yaml
Shape: VM.Standard.E2.1.Micro
CPUs: 1 OCPU (AMD EPYC)
RAM: 1 GB (NOT enough for Frappe)
Storage: 50 GB Boot Volume
OS: Ubuntu 22.04 LTS
Cost: FREE (Always Free tier)
Note: ⚠️ Too limited for Frappe - use Option 1
```

### Prerequisites

1. **Oracle Cloud Account**
   - Sign up: https://www.oracle.com/cloud/free/
   - No credit card expiry
   - Verify email and phone

2. **Required Information**
   - SSH public key
   - Domain name (optional: use IP initially)
   - SMTP credentials (for Frappe emails)

### Step-by-Step Setup

#### 1. Create Compute Instance (10 minutes)

```bash
# Login to Oracle Cloud Console
https://cloud.oracle.com/

# Navigate to: Compute > Instances > Create Instance

Instance Name: frappe-oracle-free
Availability Domain: (any)
Shape: VM.Standard.A1.Flex
  OCPU: 4
  Memory: 24 GB
Image: Ubuntu 22.04 (ARM64)

Boot Volume: 100 GB
Add Block Volume: 100 GB (for Frappe data)

Networking:
  VCN: Create new VCN
  Subnet: Public subnet
  Assign public IP: Yes

SSH Keys: Paste your public key or generate new

Click: Create
```

#### 2. Configure Firewall (Security Lists)

```bash
# In OCI Console: Networking > Virtual Cloud Networks > Security Lists

# Add Ingress Rules:
Rule 1 - SSH:
  Source: 0.0.0.0/0
  Protocol: TCP
  Port: 22

Rule 2 - HTTP:
  Source: 0.0.0.0/0
  Protocol: TCP
  Port: 80

Rule 3 - HTTPS:
  Source: 0.0.0.0/0
  Protocol: TCP
  Port: 443

Rule 4 - Frappe (optional, for testing):
  Source: 0.0.0.0/0
  Protocol: TCP
  Port: 8000
```

#### 3. Configure OS Firewall

```bash
# SSH into instance
ssh -i ~/.ssh/your-key ubuntu@<ORACLE_PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Configure Ubuntu firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp  # Frappe dev (remove in production)
sudo ufw enable
```

#### 4. Mount Block Volume

```bash
# List available block devices
lsblk

# Format the block volume (usually /dev/sdb)
sudo mkfs.ext4 /dev/sdb

# Create mount point
sudo mkdir -p /opt/frappe-data

# Mount the volume
sudo mount /dev/sdb /opt/frappe-data

# Get UUID for persistent mount
sudo blkid /dev/sdb
# Output: /dev/sdb: UUID="xxx-yyy-zzz" TYPE="ext4"

# Add to /etc/fstab for auto-mount
sudo nano /etc/fstab
# Add line:
UUID=xxx-yyy-zzz /opt/frappe-data ext4 defaults,nofail 0 2

# Verify mount persists
sudo mount -a
df -h  # Should show /opt/frappe-data
```

#### 5. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add user to docker group
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

#### 6. Clone Repository & Setup

```bash
# Create directory structure
sudo mkdir -p /opt/ciago-frappe
sudo chown ubuntu:ubuntu /opt/ciago-frappe
cd /opt/ciago-frappe

# Clone repository (if using Git deployment)
git clone https://github.com/AnujTiwari-Student/Ciago-Technologies.git .
git checkout main

# Or manually copy files if deploying manually
```

#### 7. Configure Docker Compose for Oracle

```bash
# Create oracle-specific compose file
cd /opt/ciago-frappe

# Copy and modify docker-compose.frappe.yml
cp docker-compose.frappe.yml docker-compose.oracle.yml

# Edit for Oracle Cloud specifics
nano docker-compose.oracle.yml
```

See [Oracle Docker Compose Configuration](#oracle-docker-compose-configuration) section below.

#### 8. Deploy Frappe

```bash
cd /opt/ciago-frappe

# Pull images
docker-compose -f docker-compose.oracle.yml pull

# Start services
docker-compose -f docker-compose.oracle.yml up -d

# Monitor logs
docker-compose -f docker-compose.oracle.yml logs -f frappe-backend

# Wait for initialization (5-10 minutes first time)
```

#### 9. Create Frappe Site

```bash
# Enter Frappe container
docker-compose -f docker-compose.oracle.yml exec frappe-backend bash

# Inside container
cd /home/frappe/frappe-bench

# Create site (replace with your domain or use IP)
bench new-site frappe.oracle.ciagotech.com \
  --mariadb-root-password <STRONG_PASSWORD> \
  --admin-password PLMqaz2901@ \
  --install-app erpnext \
  --install-app hrms

# Exit container
exit
```

#### 10. Configure Domain (Optional)

```bash
# If using custom domain:
# 1. Add A record: frappe.oracle.ciagotech.com -> <ORACLE_PUBLIC_IP>
# 2. Wait for DNS propagation (5-30 minutes)

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (after DNS propagation)
sudo certbot --nginx -d frappe.oracle.ciagotech.com
```

#### 11. Restore Development Database

```bash
# Copy backup from local to Oracle
scp -i ~/.ssh/your-key /path/to/backup.sql.gz ubuntu@<ORACLE_IP>:/tmp/

# SSH to Oracle
ssh -i ~/.ssh/your-key ubuntu@<ORACLE_IP>

# Restore database
cd /opt/ciago-frappe
docker-compose -f docker-compose.oracle.yml exec frappe-backend bash

# Inside container
cd /home/frappe/frappe-bench
bench --site frappe.oracle.ciagotech.com restore /tmp/backup.sql.gz
bench --site frappe.oracle.ciagotech.com migrate

exit
```

---

## 🚀 Hetzner Setup (Production)

### Server Specifications (Paid)

**Recommended: CPX21 (AMD)**
```yaml
Type: CPX21 (Cloud AMD)
CPUs: 3 vCPU (AMD EPYC)
RAM: 4 GB
Storage: 80 GB NVMe SSD
Network: 20 TB traffic
Datacenter: Falkenstein, Germany (fsn1)
Cost: €5.04/month (~$5.50 USD)
```

**Alternative: CX31 (Intel)**
```yaml
Type: CX31 (Cloud Intel)
CPUs: 2 vCPU (Intel Xeon)
RAM: 8 GB
Storage: 80 GB NVMe SSD
Network: 20 TB traffic
Cost: €8.97/month (~$9.80 USD)
```

**Storage: CX31 + Volume**
```yaml
Server: CX31 (€8.97/month)
Volume: 100 GB SSD (€4.80/month)
Storage Box: 100 GB for backups (€3.81/month)
Total: ~€17.58/month (~$19.20 USD)
```

### Prerequisites

1. **Hetzner Account**
   - Sign up: https://www.hetzner.com/cloud
   - Add payment method
   - Verify email

2. **DNS Configuration**
   - Domain: api.ciagotech.com
   - A record ready to point to Hetzner IP

### Step-by-Step Setup

#### 1. Create Cloud Server

```bash
# Login to Hetzner Cloud Console
https://console.hetzner.cloud/

# Create Project: "Ciago Frappe Production"

# Add Server:
Name: frappe-production
Location: Falkenstein (fsn1-dc14)
Image: Ubuntu 22.04
Type: CPX21 (or CX31)
Volume: Create 100 GB volume (optional)
SSH Key: Add your public key
Backups: Enable (€1/month, optional)

Click: Create & Buy
```

#### 2. Configure Firewall

```bash
# In Hetzner Console: Firewalls > Create Firewall

Name: frappe-firewall

Inbound Rules:
  - SSH: Port 22, Source: 0.0.0.0/0, ::/0
  - HTTP: Port 80, Source: 0.0.0.0/0, ::/0
  - HTTPS: Port 443, Source: 0.0.0.0/0, ::/0

Outbound Rules:
  - All traffic allowed

Apply to Server: frappe-production
```

#### 3. Initial Server Setup

```bash
# SSH to Hetzner server
ssh root@<HETZNER_IP>

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser ciago
usermod -aG sudo ciago
rsync --archive --chown=ciago:ciago ~/.ssh /home/ciago/

# Switch to new user
su - ciago

# Configure UFW firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

#### 4. Mount Volume (if using separate volume)

```bash
# List volumes
lsblk

# Format volume
sudo mkfs.ext4 /dev/sdb

# Mount
sudo mkdir -p /mnt/frappe-data
sudo mount /dev/sdb /mnt/frappe-data

# Add to fstab
echo "/dev/sdb /mnt/frappe-data ext4 defaults 0 2" | sudo tee -a /etc/fstab
sudo mount -a
```

#### 5. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ciago
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 6. Setup Application

```bash
# Create directory
sudo mkdir -p /opt/ciago-frappe
sudo chown ciago:ciago /opt/ciago-frappe
cd /opt/ciago-frappe

# Clone or copy files
git clone https://github.com/AnujTiwari-Student/Ciago-Technologies.git .

# Use Hetzner-specific compose file
cp docker-compose.frappe.yml docker-compose.hetzner.yml
```

See [Hetzner Docker Compose Configuration](#hetzner-docker-compose-configuration) section below.

#### 7. Deploy Frappe

```bash
cd /opt/ciago-frappe
docker-compose -f docker-compose.hetzner.yml up -d
docker-compose -f docker-compose.hetzner.yml logs -f
```

#### 8. Create Site or Restore

**Option A: Fresh Install**
```bash
docker-compose -f docker-compose.hetzner.yml exec frappe-backend bash
cd /home/frappe/frappe-bench
bench new-site api.ciagotech.com \
  --mariadb-root-password <STRONG_PASSWORD> \
  --admin-password PLMqaz2901@ \
  --install-app erpnext \
  --install-app hrms
```

**Option B: Restore from Oracle/Backup**
```bash
# Copy backup from Oracle
scp ubuntu@<ORACLE_IP>:/path/to/backup.sql.gz /tmp/

# Restore
docker-compose -f docker-compose.hetzner.yml exec frappe-backend bash
cd /home/frappe/frappe-bench
bench --site api.ciagotech.com restore /tmp/backup.sql.gz
bench --site api.ciagotech.com migrate
```

#### 9. Configure SSL

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Update DNS first: api.ciagotech.com -> <HETZNER_IP>

# Get certificate
sudo certbot --nginx -d api.ciagotech.com

# Auto-renewal is configured automatically
```

---

## 🔄 Migration Between Clouds

### Oracle → Hetzner Migration

**Prerequisites**:
- Hetzner server setup complete
- DNS updated to point to Hetzner
- Downtime window scheduled (estimate: 30-60 minutes)

**Migration Steps**:

```bash
# ============================================
# STEP 1: Backup from Oracle (5 minutes)
# ============================================
ssh ubuntu@<ORACLE_IP>

cd /opt/ciago-frappe
docker-compose -f docker-compose.oracle.yml exec frappe-backend bash

# Inside container
cd /home/frappe/frappe-bench
bench --site frappe.oracle.ciagotech.com backup --with-files
exit

# Backup is at: sites/frappe.oracle.ciagotech.com/private/backups/

# Find latest backup
docker-compose -f docker-compose.oracle.yml exec frappe-backend bash
ls -lh /home/frappe/frappe-bench/sites/frappe.oracle.ciagotech.com/private/backups/

# Copy files out of container
docker cp ciago-frappe-frappe-backend-1:/home/frappe/frappe-bench/sites/frappe.oracle.ciagotech.com/private/backups/ ./backups/

# ============================================
# STEP 2: Transfer to Hetzner (10-15 minutes)
# ============================================
# On Oracle server
cd /opt/ciago-frappe/backups
tar czf frappe-backup-$(date +%Y%m%d-%H%M%S).tar.gz *

# Transfer to Hetzner
scp frappe-backup-*.tar.gz ciago@<HETZNER_IP>:/tmp/

# ============================================
# STEP 3: Restore on Hetzner (10-15 minutes)
# ============================================
ssh ciago@<HETZNER_IP>

cd /tmp
tar xzf frappe-backup-*.tar.gz

# Enter Hetzner Frappe container
cd /opt/ciago-frappe
docker-compose -f docker-compose.hetzner.yml exec frappe-backend bash

# Inside container
cd /home/frappe/frappe-bench

# Restore database
bench --site api.ciagotech.com restore /tmp/<backup-database>.sql.gz

# Restore files
bench --site api.ciagotech.com restore /tmp/<backup-files>.tar

# Migrate
bench --site api.ciagotech.com migrate

# Clear cache
bench --site api.ciagotech.com clear-cache

exit

# ============================================
# STEP 4: Update DNS (5-30 minutes propagation)
# ============================================
# Update DNS A record:
# api.ciagotech.com: <ORACLE_IP> -> <HETZNER_IP>

# Wait for propagation
dig api.ciagotech.com

# ============================================
# STEP 5: Verify & Test (10 minutes)
# ============================================
# Test Frappe access
curl https://api.ciagotech.com/api/method/version

# Login and verify:
# - All roles present
# - All workspaces accessible
# - All permissions correct
# - Admin user can login

# ============================================
# STEP 6: Keep Oracle as Backup
# ============================================
# Do NOT delete Oracle instance
# Keep it running as warm backup (still FREE)
# Schedule periodic backups from Hetzner to Oracle
```

### Hetzner → Oracle Rollback

```bash
# If Hetzner has issues, rollback to Oracle:

# 1. Update DNS back to Oracle IP
# 2. Oracle instance still running (no changes needed)
# 3. Traffic automatically routes back to Oracle
# 4. Total rollback time: DNS propagation (5-30 minutes)
```

---

## Oracle Docker Compose Configuration

Create `docker-compose.oracle.yml`:

```yaml
version: '3.8'

services:
  frappe-mariadb:
    image: mariadb:10.11
    container_name: frappe-oracle-mariadb
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD}
      MYSQL_DATABASE: frappe
      MYSQL_USER: frappe
      MYSQL_PASSWORD: ${MARIADB_PASSWORD}
    volumes:
      - /opt/frappe-data/mariadb:/var/lib/mysql
    networks:
      - frappe-network
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --max-connections=500
      - --innodb-buffer-pool-size=2G

  frappe-redis-cache:
    image: redis:alpine
    container_name: frappe-oracle-redis-cache
    restart: unless-stopped
    volumes:
      - /opt/frappe-data/redis-cache:/data
    networks:
      - frappe-network

  frappe-redis-queue:
    image: redis:alpine
    container_name: frappe-oracle-redis-queue
    restart: unless-stopped
    volumes:
      - /opt/frappe-data/redis-queue:/data
    networks:
      - frappe-network

  frappe-backend:
    image: frappe/erpnext:v15
    container_name: frappe-oracle-backend
    restart: unless-stopped
    depends_on:
      - frappe-mariadb
      - frappe-redis-cache
      - frappe-redis-queue
    environment:
      DB_HOST: frappe-mariadb
      DB_PORT: 3306
      REDIS_CACHE: redis://frappe-redis-cache:6379
      REDIS_QUEUE: redis://frappe-redis-queue:6379
      SOCKETIO_PORT: 9000
    volumes:
      - /opt/frappe-data/sites:/home/frappe/frappe-bench/sites
      - /opt/frappe-data/logs:/home/frappe/frappe-bench/logs
    ports:
      - "8000:8000"
      - "9000:9000"
    networks:
      - frappe-network

  frappe-nginx:
    image: nginx:alpine
    container_name: frappe-oracle-nginx
    restart: unless-stopped
    depends_on:
      - frappe-backend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /opt/frappe-data/sites:/var/www/html:ro
      - /opt/frappe-data/nginx/conf.d:/etc/nginx/conf.d
      - /opt/frappe-data/nginx/ssl:/etc/nginx/ssl
    networks:
      - frappe-network

networks:
  frappe-network:
    driver: bridge

volumes:
  mariadb-data:
  redis-cache-data:
  redis-queue-data:
  frappe-sites:
  frappe-logs:
```

---

## Hetzner Docker Compose Configuration

Create `docker-compose.hetzner.yml`:

```yaml
version: '3.8'

services:
  frappe-mariadb:
    image: mariadb:10.11
    container_name: frappe-hetzner-mariadb
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD}
      MYSQL_DATABASE: frappe
      MYSQL_USER: frappe
      MYSQL_PASSWORD: ${MARIADB_PASSWORD}
    volumes:
      - mariadb-data:/var/lib/mysql
    networks:
      - frappe-network
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --max-connections=1000
      - --innodb-buffer-pool-size=3G
      - --innodb-log-file-size=512M

  frappe-redis-cache:
    image: redis:alpine
    container_name: frappe-hetzner-redis-cache
    restart: unless-stopped
    volumes:
      - redis-cache-data:/data
    networks:
      - frappe-network

  frappe-redis-queue:
    image: redis:alpine
    container_name: frappe-hetzner-redis-queue
    restart: unless-stopped
    volumes:
      - redis-queue-data:/data
    networks:
      - frappe-network

  frappe-backend:
    image: frappe/erpnext:v15
    container_name: frappe-hetzner-backend
    restart: unless-stopped
    depends_on:
      - frappe-mariadb
      - frappe-redis-cache
      - frappe-redis-queue
    environment:
      DB_HOST: frappe-mariadb
      DB_PORT: 3306
      REDIS_CACHE: redis://frappe-redis-cache:6379
      REDIS_QUEUE: redis://frappe-redis-queue:6379
      SOCKETIO_PORT: 9000
    volumes:
      - frappe-sites:/home/frappe/frappe-bench/sites
      - frappe-logs:/home/frappe/frappe-bench/logs
    ports:
      - "8000:8000"
      - "9000:9000"
    networks:
      - frappe-network

  frappe-nginx:
    image: nginx:alpine
    container_name: frappe-hetzner-nginx
    restart: unless-stopped
    depends_on:
      - frappe-backend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - frappe-sites:/var/www/html:ro
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./nginx/ssl:/etc/nginx/ssl
    networks:
      - frappe-network

networks:
  frappe-network:
    driver: bridge

volumes:
  mariadb-data:
    driver: local
  redis-cache-data:
    driver: local
  redis-queue-data:
    driver: local
  frappe-sites:
    driver: local
  frappe-logs:
    driver: local
```

---

## 📦 Backup Strategy

### Oracle Cloud Backups

**Daily Automated Backup Script** (`/opt/ciago-frappe/backup-oracle.sh`):

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/frappe-data/backups"
SITE_NAME="frappe.oracle.ciagotech.com"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="frappe-oracle-${DATE}"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Backup Frappe site
docker-compose -f /opt/ciago-frappe/docker-compose.oracle.yml exec -T frappe-backend \
  bench --site ${SITE_NAME} backup --with-files

# Copy backup out
docker cp ciago-frappe-frappe-oracle-backend-1:/home/frappe/frappe-bench/sites/${SITE_NAME}/private/backups/ ${BACKUP_DIR}/${BACKUP_FILE}/

# Compress
cd ${BACKUP_DIR}
tar czf ${BACKUP_FILE}.tar.gz ${BACKUP_FILE}/
rm -rf ${BACKUP_FILE}/

# Upload to OCI Object Storage (optional)
# oci os object put --bucket-name frappe-backups --file ${BACKUP_FILE}.tar.gz

# Keep last 7 days
find ${BACKUP_DIR} -name "frappe-oracle-*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: ${BACKUP_FILE}.tar.gz"
```

**Setup Cron** (runs daily at 2 AM):
```bash
chmod +x /opt/ciago-frappe/backup-oracle.sh

crontab -e
# Add:
0 2 * * * /opt/ciago-frappe/backup-oracle.sh >> /var/log/frappe-backup.log 2>&1
```

### Hetzner Backups

**Daily Automated Backup Script** (`/opt/ciago-frappe/backup-hetzner.sh`):

```bash
#!/bin/bash
set -e

BACKUP_DIR="/mnt/frappe-data/backups"
SITE_NAME="api.ciagotech.com"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="frappe-hetzner-${DATE}"
STORAGE_BOX_USER="u123456"
STORAGE_BOX_HOST="u123456.your-storagebox.de"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Backup Frappe site
docker-compose -f /opt/ciago-frappe/docker-compose.hetzner.yml exec -T frappe-backend \
  bench --site ${SITE_NAME} backup --with-files

# Copy backup out
docker cp frappe-hetzner-backend:/home/frappe/frappe-bench/sites/${SITE_NAME}/private/backups/ ${BACKUP_DIR}/${BACKUP_FILE}/

# Compress
cd ${BACKUP_DIR}
tar czf ${BACKUP_FILE}.tar.gz ${BACKUP_FILE}/
rm -rf ${BACKUP_FILE}/

# Upload to Hetzner Storage Box
scp -i ~/.ssh/storagebox ${BACKUP_FILE}.tar.gz ${STORAGE_BOX_USER}@${STORAGE_BOX_HOST}:./backups/

# Keep last 7 days locally
find ${BACKUP_DIR} -name "frappe-hetzner-*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: ${BACKUP_FILE}.tar.gz"
```

**Setup Cron**:
```bash
chmod +x /opt/ciago-frappe/backup-hetzner.sh

crontab -e
# Add:
0 2 * * * /opt/ciago-frappe/backup-hetzner.sh >> /var/log/frappe-backup.log 2>&1
```

---

## 💰 Cost Comparison

### Monthly Costs

| Provider | Configuration | Cost/Month | Annual Cost |
|----------|--------------|------------|-------------|
| **Oracle Cloud (Free)** | 4 OCPU ARM + 24GB RAM + 200GB Storage | **$0** | **$0** |
| **Hetzner CPX21** | 3 vCPU AMD + 4GB RAM + 80GB NVMe | $5.50 | $66 |
| **Hetzner CX31** | 2 vCPU Intel + 8GB RAM + 80GB NVMe | $9.80 | $117.60 |
| **Hetzner CX31 + Volume** | CX31 + 100GB Volume + Storage Box | $19.20 | $230.40 |
| **DigitalOcean** | 2 vCPU + 4GB RAM + 80GB SSD | $24 | $288 |
| **AWS t3.medium** | 2 vCPU + 4GB RAM + 80GB EBS | ~$40 | ~$480 |

### Savings Calculation

**Scenario: Use Oracle for 6 months, then Hetzner**

```
Oracle Phase (Month 1-6): $0 × 6 = $0
Hetzner Phase (Month 7-12): $19.20 × 6 = $115.20
Total Year 1: $115.20

vs.

Hetzner Full Year: $19.20 × 12 = $230.40

Savings: $115.20 (50% saved)
```

---

## 🔄 CI/CD Configuration

See: `.github/workflows/ci-cd-frappe-dual.yml` (created separately)

**Key Features**:
- Deploy to Oracle with `oracle` branch push
- Deploy to Hetzner with `production` branch push
- Manual approval for production deployments
- Automated health checks post-deployment
- Slack notifications

---

## 📊 Decision Matrix

### When to Use Oracle Cloud

✅ **Use Oracle When**:
- Just starting / testing Frappe
- No active hiring yet
- Budget constraints
- Learning / development phase
- Backup/DR server
- Cost is primary concern

❌ **Don't Use Oracle When**:
- Active daily operations (performance matters)
- EU data residency required
- Need >200GB storage
- Need predictable low-latency (ARM performance varies)

### When to Use Hetzner

✅ **Use Hetzner When**:
- Active hiring operations start
- Daily usage by team
- Need consistent performance
- EU data residency preferred
- Ready to pay $19-23/month
- NVMe SSD performance needed

❌ **Don't Use Hetzner When**:
- Zero budget / testing phase
- Uncertain usage timeline
- Free tier sufficient for needs

---

## ✅ Quick Start Checklist

### Oracle Cloud Setup
- [ ] Create Oracle Cloud account (free)
- [ ] Create VM.Standard.A1.Flex instance (4 OCPU, 24GB RAM)
- [ ] Configure security lists (ports 22, 80, 443)
- [ ] Mount 200GB block volume
- [ ] Install Docker & Docker Compose
- [ ] Deploy Frappe with `docker-compose.oracle.yml`
- [ ] Create site or restore backup
- [ ] Configure automated backups
- [ ] Test access and functionality

### Hetzner Setup (When Ready)
- [ ] Create Hetzner Cloud account
- [ ] Create CPX21 or CX31 server
- [ ] Configure firewall rules
- [ ] Setup storage volume (optional)
- [ ] Install Docker & Docker Compose
- [ ] Deploy Frappe with `docker-compose.hetzner.yml`
- [ ] Migrate data from Oracle
- [ ] Update DNS to Hetzner IP
- [ ] Configure SSL with Let's Encrypt
- [ ] Setup Storage Box backups
- [ ] Keep Oracle as warm backup

---

## 📚 Additional Resources

**Oracle Cloud**:
- Free Tier: https://www.oracle.com/cloud/free/
- Documentation: https://docs.oracle.com/en-us/iaas/
- ARM Shapes: https://docs.oracle.com/en-us/iaas/Content/Compute/References/arm.htm

**Hetzner Cloud**:
- Pricing: https://www.hetzner.com/cloud
- Documentation: https://docs.hetzner.com/cloud/
- Storage Box: https://www.hetzner.com/storage/storage-box

**Frappe**:
- Documentation: https://frappeframework.com/docs
- ERPNext: https://docs.erpnext.com/
- Docker: https://github.com/frappe/frappe_docker

---

**Last Updated**: 2026-08-05  
**Status**: Ready for implementation  
**Next**: Setup Oracle Cloud instance and deploy
