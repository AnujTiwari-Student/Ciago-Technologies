# Frappe Deployment Quick Start Guide
## Oracle Cloud (Free) + Hetzner (Production)

**Quick Reference**: Get Frappe running on Oracle Cloud Free Tier in 30 minutes

---

## 🚀 Quick Deploy to Oracle Cloud (Free Tier)

### Step 1: Create Oracle Cloud Account (5 minutes)

1. Go to: https://www.oracle.com/cloud/free/
2. Sign up (no credit card expiry - permanently free)
3. Verify email and phone

### Step 2: Create VM Instance (5 minutes)

```
Login → Compute → Instances → Create Instance

Name: frappe-oracle
Shape: VM.Standard.A1.Flex
  OCPU: 4
  Memory: 24 GB
Image: Ubuntu 22.04 (ARM64)
Boot Volume: 100 GB
Add Block Volume: 100 GB

Networking: Create new VCN, Public IP: Yes
SSH Keys: Upload or paste your public key

Click: Create
```

**Copy the public IP** - you'll need it!

### Step 3: Configure Firewall (3 minutes)

```
Networking → Security Lists → Add Ingress Rules:

Rule 1: Port 22 (SSH) - Source: 0.0.0.0/0
Rule 2: Port 80 (HTTP) - Source: 0.0.0.0/0
Rule 3: Port 443 (HTTPS) - Source: 0.0.0.0/0
Rule 4: Port 8000 (Frappe) - Source: 0.0.0.0/0
```

### Step 4: SSH and Setup (15 minutes)

```bash
# SSH to your instance
ssh -i ~/.ssh/your-key ubuntu@YOUR_ORACLE_IP

# Update system
sudo apt update && sudo apt upgrade -y

# Configure OS firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp
sudo ufw enable

# Mount block volume
sudo lsblk
sudo mkfs.ext4 /dev/sdb
sudo mkdir -p /opt/frappe-data
sudo mount /dev/sdb /opt/frappe-data

# Make mount persistent
UUID=$(sudo blkid /dev/sdb | awk -F'"' '{print $2}')
echo "UUID=$UUID /opt/frappe-data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

### Step 5: Deploy Frappe (7 minutes)

```bash
# Create directory
sudo mkdir -p /opt/ciago-frappe
sudo chown ubuntu:ubuntu /opt/ciago-frappe
cd /opt/ciago-frappe

# Clone repository (or copy files)
git clone https://github.com/AnujTiwari-Student/Ciago-Technologies.git .

# Create environment file
cp .env.oracle.example .env.oracle

# Edit with your passwords
nano .env.oracle
# Set MARIADB_ROOT_PASSWORD and MARIADB_PASSWORD

# Start Frappe
docker-compose -f docker-compose.oracle.yml up -d

# Monitor startup (takes 5-10 minutes first time)
docker-compose -f docker-compose.oracle.yml logs -f frappe-backend
```

### Step 6: Create Site (3 minutes)

```bash
# Wait for services to be healthy
docker-compose -f docker-compose.oracle.yml ps

# Enter Frappe container
docker-compose -f docker-compose.oracle.yml exec frappe-backend bash

# Inside container - create site
cd /home/frappe/frappe-bench
bench new-site frappe.oracle.ciagotech.com \
  --mariadb-root-password YOUR_MARIADB_ROOT_PASSWORD \
  --admin-password PLMqaz2901@ \
  --install-app erpnext \
  --install-app hrms

# Exit container
exit
```

### Step 7: Access Frappe

```
Open browser: http://YOUR_ORACLE_IP:8000

Login:
  Email: anujavengers@gmail.com
  Password: PLMqaz2901@
```

✅ **Done!** Frappe running on Oracle Cloud Free Tier

---

## 📦 Restore from Backup

If you have a backup from development:

```bash
# Copy backup to Oracle
scp /path/to/backup.sql.gz ubuntu@YOUR_ORACLE_IP:/tmp/

# SSH to Oracle
ssh ubuntu@YOUR_ORACLE_IP

# Restore
cd /opt/ciago-frappe
docker-compose -f docker-compose.oracle.yml exec frappe-backend bash

# Inside container
cd /home/frappe/frappe-bench
bench --site frappe.oracle.ciagotech.com restore /tmp/backup.sql.gz
bench --site frappe.oracle.ciagotech.com migrate
bench --site frappe.oracle.ciagotech.com clear-cache

exit
```

---

## 🔄 When Ready to Move to Hetzner

### Prerequisites
- First hiring batch scheduled
- Need better performance
- Ready to pay ~$20/month

### Quick Migration Steps

**1. Create Hetzner Server** (5 minutes)
```
https://console.hetzner.cloud/
Create Project → Add Server

Name: frappe-production
Location: Falkenstein (Germany)
Type: CPX21 (3 vCPU, 4GB RAM, €5/month)
Image: Ubuntu 22.04
SSH Key: Your public key
```

**2. Setup Hetzner** (10 minutes)
```bash
# SSH to Hetzner
ssh root@YOUR_HETZNER_IP

# Update and create user
apt update && apt upgrade -y
adduser ciago
usermod -aG sudo ciago
rsync --archive --chown=ciago:ciago ~/.ssh /home/ciago/

# Switch user
su - ciago

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ciago
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**3. Deploy Frappe** (5 minutes)
```bash
# Create directory
sudo mkdir -p /opt/ciago-frappe
sudo chown ciago:ciago /opt/ciago-frappe
cd /opt/ciago-frappe

# Clone repository
git clone https://github.com/AnujTiwari-Student/Ciago-Technologies.git .

# Environment file
cp .env.hetzner.example .env.hetzner
nano .env.hetzner
# Set passwords and domain

# Start Frappe
docker-compose -f docker-compose.hetzner.yml up -d
```

**4. Backup from Oracle** (5 minutes)
```bash
# On Oracle Cloud
ssh ubuntu@YOUR_ORACLE_IP
cd /opt/ciago-frappe

docker-compose -f docker-compose.oracle.yml exec frappe-backend bash
cd /home/frappe/frappe-bench
bench --site frappe.oracle.ciagotech.com backup --with-files
exit

# Copy backups out
docker cp frappe-oracle-backend:/home/frappe/frappe-bench/sites/frappe.oracle.ciagotech.com/private/backups/ ./backups/

# Compress
tar czf frappe-backup.tar.gz backups/
```

**5. Transfer to Hetzner** (5 minutes)
```bash
# On Oracle
scp frappe-backup.tar.gz ciago@YOUR_HETZNER_IP:/tmp/

# On Hetzner
cd /tmp
tar xzf frappe-backup.tar.gz

cd /opt/ciago-frappe
docker-compose -f docker-compose.hetzner.yml exec frappe-backend bash

cd /home/frappe/frappe-bench
bench --site api.ciagotech.com restore /tmp/backups/*.sql.gz
bench --site api.ciagotech.com migrate
exit
```

**6. Update DNS** (30 minutes)
```
Update DNS A record:
api.ciagotech.com → YOUR_HETZNER_IP

Wait for propagation (5-30 minutes)
```

**7. Configure SSL** (3 minutes)
```bash
# On Hetzner
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.ciagotech.com
```

✅ **Done!** Production running on Hetzner

---

## 🔐 GitHub Secrets for CI/CD

Add these secrets in GitHub repository settings:

### Oracle Cloud Secrets
```
ORACLE_PUBLIC_IP: Your Oracle instance public IP
ORACLE_SSH_USER: ubuntu
ORACLE_SSH_PRIVATE_KEY: Your SSH private key (full content)
ORACLE_SSH_PORT: 22
ORACLE_DOMAIN: frappe.oracle.ciagotech.com (optional)
```

### Hetzner Secrets
```
HETZNER_PUBLIC_IP: Your Hetzner server IP
HETZNER_SSH_USER: ciago
HETZNER_SSH_PRIVATE_KEY: Your SSH private key (full content)
HETZNER_SSH_PORT: 22
HETZNER_DOMAIN: api.ciagotech.com
HETZNER_SITE_NAME: api.ciagotech.com
```

### Optional Secrets
```
SLACK_WEBHOOK: Your Slack webhook URL (for notifications)
```

---

## 🚦 Deploy via GitHub Actions

### Deploy to Oracle Cloud (Free)
```bash
# Push to oracle branch
git checkout oracle
git merge main
git push origin oracle
```

### Deploy to Hetzner (Production)
```bash
# Push to production branch
git checkout production
git merge main
git push origin production
# Manual approval required in GitHub Actions
```

### Manual Deployment Trigger
```
GitHub → Actions → CI/CD Frappe Dual Cloud → Run workflow
Select: oracle, hetzner, or both
```

---

## 📋 Useful Commands

### Check Status
```bash
# Oracle
cd /opt/ciago-frappe
docker-compose -f docker-compose.oracle.yml ps
docker-compose -f docker-compose.oracle.yml logs -f

# Hetzner
cd /opt/ciago-frappe
docker-compose -f docker-compose.hetzner.yml ps
docker-compose -f docker-compose.hetzner.yml logs -f
```

### Restart Services
```bash
# Oracle
docker-compose -f docker-compose.oracle.yml restart

# Hetzner
docker-compose -f docker-compose.hetzner.yml restart
```

### Backup
```bash
# Oracle
./backup-oracle.sh

# Hetzner
./backup-hetzner.sh
```

### View Logs
```bash
# Oracle
docker-compose -f docker-compose.oracle.yml logs -f frappe-backend

# Hetzner
docker-compose -f docker-compose.hetzner.yml logs -f frappe-backend
```

---

## 💰 Cost Tracking

| Phase | Duration | Oracle | Hetzner | Total/Month |
|-------|----------|--------|---------|-------------|
| Testing | Month 1-3 | $0 | - | $0 |
| Pre-Hiring | Month 4-6 | $0 | - | $0 |
| Production | Month 7+ | $0 (backup) | $19-23 | $19-23 |

**Total Year 1 Savings**: ~$115 (vs running Hetzner full year)

---

## 🆘 Troubleshooting

### Oracle: "Cannot connect to 8000"
```bash
# Check security list allows port 8000
# Check UFW firewall: sudo ufw status
# Check Docker: docker-compose -f docker-compose.oracle.yml ps
```

### Hetzner: "SSL certificate error"
```bash
# Verify DNS propagation: dig api.ciagotech.com
# Wait 5-30 minutes for DNS
# Re-run certbot: sudo certbot --nginx -d api.ciagotech.com
```

### "Site not found"
```bash
# Check site exists
docker-compose exec frappe-backend bash
cd /home/frappe/frappe-bench
bench --site [site-name] list-apps
```

---

## 📚 Full Documentation

- **Detailed Guide**: `docs/FRAPPE_DUAL_CLOUD_DEPLOYMENT.md`
- **CI/CD Workflow**: `.github/workflows/ci-cd-frappe-dual.yml`
- **Docker Compose**: `docker-compose.oracle.yml`, `docker-compose.hetzner.yml`
- **Environment Examples**: `.env.oracle.example`, `.env.hetzner.example`

---

**Last Updated**: 2026-08-05  
**Status**: Ready to deploy  
**Support**: Check GitHub issues or Frappe documentation
