# 🚀 Enterprise CI/CD Setup Checklist

## ✅ Phase 1: GitHub Repository Setup (15 minutes)

### Secrets Configuration
Add these secrets to: Settings → Secrets and Variables → Actions

**Container Registry** (5 minutes)
- [ ] `REGISTRY_TOKEN` = GitHub token (use GITHUB_TOKEN in workflows)
- [ ] `REGISTRY_USERNAME` = Your GitHub username

**Development Environment** (5 minutes)
- [ ] `DEV_SERVER_IP` = Your Hetzner dev server IP
- [ ] `DEV_SSH_USER` = SSH username (e.g., `deploy`)
- [ ] `DEV_SSH_PRIVATE_KEY` = Base64-encoded SSH private key
- [ ] `DEV_SSH_PORT` = SSH port (default: 22)
- [ ] `DEV_SITE_NAME` = Frappe site (e.g., `dev.erpnext.local`)

**Staging Environment** (5 minutes)
- [ ] `STAGING_SERVER_IP` = Your Hetzner staging server IP
- [ ] `STAGING_SSH_USER` = SSH username
- [ ] `STAGING_SSH_PRIVATE_KEY` = Base64-encoded SSH private key
- [ ] `STAGING_SSH_PORT` = SSH port
- [ ] `STAGING_SITE_NAME` = Frappe site (e.g., `staging.erpnext.local`)

**Production Environment** (10 minutes) ⚠️ CRITICAL
- [ ] `PROD_HETZNER_IP` = Your Hetzner production server IP ***SECURE***
- [ ] `PROD_SSH_USER` = SSH username (DO NOT USE root)
- [ ] `PROD_SSH_PRIVATE_KEY` = Base64-encoded SSH private key ***SECURE***
- [ ] `PROD_SSH_PORT` = SSH port
- [ ] `PROD_SITE_NAME` = Frappe site (e.g., `erpnext.local`)

**Cloudflare Workers Deployment** (5 minutes)
- [ ] `CLOUDFLARE_API_TOKEN` = Cloudflare API token (create at https://dash.cloudflare.com/profile/api-tokens)
- [ ] `CLOUDFLARE_ACCOUNT_ID` = Your Cloudflare Account ID
- [ ] `WRANGLER_AUTH_TOKEN` = Wrangler authentication token

**Notifications** (5 minutes)
- [ ] `SLACK_WEBHOOK` = Slack webhook URL for deployment notifications

---

## ✅ Phase 2: GitHub Environments Setup (10 minutes)

### Development Environment
1. Go to: Settings → Environments → Create "development"
2. No protection rules needed
3. Add all DEV_* secrets

### Staging Environment
1. Go to: Settings → Environments → Create "staging"
2. No protection rules needed
3. Add all STAGING_* secrets

### Production Environment (CRITICAL)
1. Go to: Settings → Environments → Create "production-hetzner"
   - [ ] Enable protection rules
   - [ ] Require reviewers: 1
   - [ ] Restrict who can deploy: [Add your team]
   - Add all PROD_* secrets

2. Go to: Settings → Environments → Create "production-cloudflare"
   - [ ] Enable protection rules
   - [ ] Require reviewers: 1
   - [ ] Restrict who can deploy: [Add your team]
   - Add CLOUDFLARE_* secrets

---

## ✅ Phase 3: Hetzner Server Setup (30 minutes)

### SSH Key Setup
```bash
# 1. Generate SSH key on your machine
ssh-keygen -t ed25519 -f ~/.ssh/hetzner_prod_key -N ""

# 2. Copy public key to Hetzner
ssh-copy-id -i ~/.ssh/hetzner_prod_key.pub deploy@PROD_IP

# 3. Encode private key for GitHub
cat ~/.ssh/hetzner_prod_key | base64 -w 0
# Copy output to PROD_SSH_PRIVATE_KEY secret
```

### Hetzner Server Configuration
```bash
# 1. SSH into server
ssh -i ~/.ssh/hetzner_prod_key deploy@PROD_IP

# 2. Create directory for Frappe
sudo mkdir -p /opt/ciago-frappe
sudo chown deploy:deploy /opt/ciago-frappe

# 3. Create backup directory
sudo mkdir -p /opt/frappe-backups
sudo chown deploy:deploy /opt/frappe-backups

# 4. Clone repository
cd /opt/ciago-frappe
git clone https://github.com/Ciago-Technologies/website.git .

# 5. Make deploy script executable
chmod +x ./deploy.sh

# 6. Create docker-compose.yml with your configuration
# (Example template provided in repo)

# 7. Test Docker access
docker ps
docker-compose --version
```

### Docker Compose Configuration Template
Create `/opt/ciago-frappe/docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/ciago-technologies/frappe:latest
    container_name: frappe-backend
    environment:
      FRAPPE_SITE: erpnext.local
      MARIADB_HOST: mariadb
      MARIADB_USER: frappe
      MARIADB_PASSWORD: your-secure-password
    ports:
      - "8000:8000"
    depends_on:
      - mariadb
    volumes:
      - frappe-data:/home/frappe/frappe-bench/sites
    networks:
      - frappe-net

  mariadb:
    image: mariadb:10.11
    container_name: frappe-db
    environment:
      MYSQL_ROOT_PASSWORD: root-password
      MYSQL_USER: frappe
      MYSQL_PASSWORD: frappe-password
      MYSQL_DATABASE: erpnext
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - frappe-net

  nginx:
    image: frappe/erpnext:v15.118.3
    container_name: frappe-nginx
    environment:
      FRAPPE_SITE: erpnext.local
      MARIADB_HOST: mariadb
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - frappe-net

volumes:
  frappe-data:
  db-data:

networks:
  frappe-net:
    driver: bridge
```

---

## ✅ Phase 4: Test Deployment (20 minutes)

### Test Development Deployment
```bash
# 1. Push to development branch
git checkout -b test/deployment development
git commit --allow-empty -m "test: trigger deployment"
git push origin test/deployment

# 2. Watch GitHub Actions
# Repository → Actions → ci-cd-dev.yml

# 3. Verify deployment
# - Check dev.ciagotech.com is live
# - Check Slack notification
# - Check server logs
```

### Test Staging Deployment
```bash
# 1. After dev testing passes
git checkout staging
git merge development
git push origin staging

# 2. Watch GitHub Actions
# Should auto-deploy to staging.ciagotech.com
```

### Test Production Deployment (CAREFUL!)
```bash
# 1. After staging verification
git checkout production
git merge staging
git push origin production

# 2. GitHub Actions runs all CI/CD checks

# 3. Deployment waits for approval
# - Go to Actions → ci-cd-prod.yml
# - Click "Review deployments"
# - Approve each deployment

# 4. Verify:
# - api.ciagotech.com responds
# - ciagotech.com loads
# - Slack notification sent
# - No errors in server logs
```

---

## ✅ Phase 5: Monitoring & Security (Ongoing)

### Weekly Tasks
- [ ] Review GitHub Security alerts
- [ ] Check for new container vulnerabilities
- [ ] Review deployment logs
- [ ] Test rollback procedure (on staging)

### Monthly Tasks
- [ ] Rotate SSH keys (PROD_SSH_PRIVATE_KEY)
- [ ] Rotate Cloudflare API tokens
- [ ] Review & update security policy
- [ ] Test full rollback recovery (full restore from backup)

### Quarterly Tasks
- [ ] Security audit of docker images
- [ ] SBOM review for compliance
- [ ] Disaster recovery drill
- [ ] Update deployment documentation

---

## 🚨 Emergency Procedures

### If Production Deployment Fails

```bash
# 1. Immediately stop further deployments
# GitHub → Settings → Environments → production-hetzner
# Disable deployments temporarily

# 2. SSH to production server
ssh -i ~/.ssh/hetzner_prod_key deploy@PROD_IP

# 3. Check latest logs
tail -100 /var/log/frappe-deploy-*.log

# 4. List available backups
ls -lh /opt/frappe-backups/

# 5. Restore from latest backup
cd /opt/ciago-frappe
./deploy.sh [backup_image_tag] erpnext.local production

# 6. Verify health
docker-compose exec backend bench doctor

# 7. Post incident
# - Slack channel #ciago-deployments
# - Create GitHub issue with "critical" label
# - Schedule post-mortem within 24 hours
```

### If Secrets Are Exposed

```bash
# 1. IMMEDIATELY rotate secret
# GitHub Settings → Secrets → Delete exposed secret

# 2. Generate new credentials
# For SSH: Generate new key pair, update Hetzner
# For Cloudflare: Revoke old token, create new one

# 3. Add new secret to GitHub
# Settings → Secrets → New repository secret

# 4. Force re-deploy with new credentials
# Push empty commit to production (triggers new deployment)
git commit --allow-empty -m "chore: security rotation"
git push origin production

# 5. Audit access logs
ssh deploy@PROD_IP
# Check docker logs for any unauthorized access
```

---

## 📞 Support & Documentation

### Quick Links
- 📖 [Full Deployment Guide](./DEPLOYMENT-GUIDE-ENTERPRISE.md)
- 🔧 [Deploy Script Documentation](./deploy.sh) - Read comments
- 🐳 [Docker Documentation](./docker/frappe/Dockerfile.prod)
- 🔐 [GitHub Actions Workflows](./.github/workflows/)

### Common Commands

```bash
# Check deployment status
ssh deploy@PROD_IP "docker-compose ps && tail -20 /var/log/frappe-deploy-*.log"

# View live logs
ssh deploy@PROD_IP "docker-compose logs -f backend"

# Manual backup
ssh deploy@PROD_IP "/opt/ciago-frappe/deploy.sh [image] [site] backup"

# Run migrations manually
ssh deploy@PROD_IP "docker-compose exec backend bench --site erpnext.local migrate"

# Clear cache
ssh deploy@PROD_IP "docker-compose exec backend bench --site erpnext.local clear-cache"
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `Connection refused` | Check Hetzner IP, SSH key permissions, firewall rules |
| `Docker image not found` | Check GitHub Container Registry auth, image tag |
| `Migration failed` | SSH to server, run `bench doctor`, check database |
| `Health check timeout` | Check server resources, docker logs, restart containers |
| `Trivy vulnerability` | Update base image, rebuild, rescan |

---

## ✅ Final Verification Checklist

- [ ] All GitHub Secrets configured
- [ ] All GitHub Environments created with protection rules
- [ ] SSH keys generated and deployed to Hetzner
- [ ] Docker and docker-compose installed on Hetzner
- [ ] Frappe repository cloned to `/opt/ciago-frappe`
- [ ] `deploy.sh` is executable and tested
- [ ] Development deployment successful
- [ ] Staging deployment successful
- [ ] Production deployment tested (with approval)
- [ ] Slack notifications working
- [ ] Rollback procedure tested on staging
- [ ] Team trained on deployment procedures
- [ ] Incident response playbook created
- [ ] Monitoring configured (optional: DataDog, New Relic, etc.)

---

**Status**: Ready for Production Deployment ✅  
**Last Updated**: August 2024  
**Next Review**: Quarterly security audit

