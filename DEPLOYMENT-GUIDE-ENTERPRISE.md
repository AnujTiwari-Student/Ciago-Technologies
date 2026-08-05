# Enterprise-Grade CI/CD & Deployment Guide
## Ciago Technologies - Frappe + React + Cloudflare Workers

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [GitHub Secrets Configuration](#github-secrets-configuration)
3. [GitHub Environments Setup](#github-environments-setup)
4. [CI/CD Pipeline Workflows](#cicd-pipeline-workflows)
5. [Deployment Process](#deployment-process)
6. [Security & Vulnerability Management](#security--vulnerability-management)
7. [Rollback & Recovery Procedures](#rollback--recovery-procedures)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Architecture Overview

### High-Level Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Repository                           │
│  (AnujTiwari-Student/Ciago-Technologies)                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    ┌───────────────────────────────────────────────────┐
    │          GitHub Actions CI/CD Pipeline            │
    ├───────────────────────────────────────────────────┤
    │ • Code Quality & Secrets Scanning                │
    │ • Testing & SAST                                 │
    │ • Docker Build & Vulnerability Scan (Trivy)      │
    │ • Deploy to Environment                          │
    └───────────────────────────────────────────────────┘
                            ↓
    ┌──────────────────────────────────────────────────────────┐
    │           Three Parallel Deployment Paths                 │
    ├──────────────────────────────┬──────────────────────────┤
    │      DEVELOPMENT             │      STAGING             │
    │  (dev branch)                │  (staging branch)        │
    │  • Automatic deploy          │  • Automatic deploy      │
    │  • No approval               │  • No approval           │
    │  • dev.ciagotech.com         │  • staging.ciagotech.com │
    └──────────────────────────────┴──────────────────────────┘
                            ↓
    ┌─────────────────────────────────────────────────────────────┐
    │              PRODUCTION (manual approval)                    │
    │   (main trigger + production-hetzner/cloudflare branches)    │
    ├──────────────────────────┬─────────────────────────────────┤
    │  Frappe on Hetzner       │  Frontend on Cloudflare Workers │
    │  • Docker containers     │  • Vite + React               │
    │  • Database              │  • Workers + Pages             │
    │  • API: api.ciagotech.com│  • UI: ciagotech.com           │
    └──────────────────────────┴─────────────────────────────────┘
```

### Environment Details

| Environment | Branch | Approval | Frappe | Frontend | DNS |
|---|---|---|---|---|---|
| **Development** | `development` | ❌ Auto | Hetzner | Cloudflare | dev.ciagotech.com |
| **Staging** | `staging` | ❌ Auto | Hetzner | Cloudflare | staging.ciagotech.com |
| **Production** | `main` trigger, releases via `production-hetzner` / `production-cloudflare` | ✅ Manual | Hetzner | Cloudflare | ciagotech.com |

---

## GitHub Secrets Configuration

### Required Secrets for All Environments

Add these secrets to your GitHub Repository Settings → Secrets and Variables → Actions:

> Reuse values already present in your local `.env` only when they belong to app/runtime configuration.
> Keep CI/CD and server credentials in GitHub Secrets.

#### Container Registry Secrets
```
REGISTRY_TOKEN          # GitHub Container Registry token (use GITHUB_TOKEN)
REGISTRY_USERNAME       # GitHub username or org name
```

#### Development Environment Secrets
```
DEV_SERVER_IP           # 195.x.x.x (Hetzner IP for development)
DEV_SSH_USER            # SSH username (e.g., root, deploy)
DEV_SSH_PRIVATE_KEY     # SSH private key for Hetzner (base64 encoded)
DEV_SSH_PORT            # SSH port (default: 22)
DEV_SITE_NAME           # Frappe site name (e.g., dev.erpnext.local)
```

#### Staging Environment Secrets
```
STAGING_SERVER_IP       # 195.x.x.x (Hetzner IP for staging)
STAGING_SSH_USER        # SSH username
STAGING_SSH_PRIVATE_KEY # SSH private key
STAGING_SSH_PORT        # SSH port
STAGING_SITE_NAME       # Frappe site name (e.g., staging.erpnext.local)
```

#### Production Environment Secrets (CRITICAL)
```
PROD_HETZNER_IP         # 195.x.x.x (Production Hetzner IP) ***CRITICAL***
PROD_SSH_USER           # SSH user (suggest: deploy user, NOT root)
PROD_SSH_PRIVATE_KEY    # SSH private key ***CRITICAL - ROTATE QUARTERLY***
PROD_SSH_PORT           # SSH port
PROD_SITE_NAME          # Frappe site name (e.g., erpnext.local)

# Cloudflare Workers Deployment
CLOUDFLARE_API_TOKEN    # Cloudflare API token with Workers permissions
CLOUDFLARE_ACCOUNT_ID   # Cloudflare Account ID
WRANGLER_AUTH_TOKEN     # Wrangler CLI authentication token

# Notifications
SLACK_WEBHOOK           # Slack webhook URL for deployment notifications
```

### How to Generate SSH Keys for Hetzner

```bash
# 1. Generate SSH key pair (on your local machine)
ssh-keygen -t ed25519 -f ~/.ssh/hetzner_deploy_key -N ""

# 2. Copy public key to Hetzner server
ssh-copy-id -i ~/.ssh/hetzner_deploy_key.pub deploy@195.x.x.x

# 3. Encode private key for GitHub Secret
cat ~/.ssh/hetzner_deploy_key | base64 -w 0 | pbcopy  # macOS
cat ~/.ssh/hetzner_deploy_key | base64 -w 0           # Linux

# 4. Paste into GitHub Secrets as PROD_SSH_PRIVATE_KEY
```

### How to Generate Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Select "Edit Cloudflare Workers" template
4. Grant permissions:
   - `Account.Worker Scripts - Edit`
   - `Zone.Zone - Read`
5. Restrict to your domain (ciagotech.com)
6. Create and copy token to GitHub Secrets

---

## GitHub Environments Setup

### Production Environment Protection Rules

Navigate to: Repository Settings → Environments → `production-hetzner` and `production-cloudflare`

1. **Enable Protection Rules**:
   - ✅ Require reviewers: `1` minimum
   - ✅ Restrict who can deploy: Add team members/approvers
   - ✅ Deployment branches: Allow only `main` plus the matching release branch

2. **Reviewers**:
   - Tech Lead (approval for Frappe)
   - DevOps Lead (approval for Cloudflare)

3. **Secrets**:
   - `production-hetzner` should contain all `PROD_*` secrets
   - `production-cloudflare` should contain `CLOUDFLARE_*` secrets

### Development & Staging Environments

1. No approval required
2. Deploy immediately on push
3. Same secret structure with DEV_/STAGING_ prefixes
4. Reuse `.env` values only for app/runtime config, not deployment secrets

### Environment URLs

- **Development**: https://dev.ciagotech.com
- **Staging**: https://staging.ciagotech.com
- **Production**: https://ciagotech.com

---

## CI/CD Pipeline Workflows

### Workflow Files

```
.github/workflows/
├── ci-cd-dev.yml       # Development pipeline (auto-deploy on push to 'dev')
├── ci-cd-staging.yml   # Staging pipeline (auto-deploy on push to 'staging')
└── ci-cd-prod.yml      # Production pipeline (manual approval required, triggers on main)
```

### Pipeline Stages (All Environments)

#### Stage 1: Code Quality & Secret Scanning ✅
**Duration**: ~5 minutes  
**Tools**:
- `Trivy` - Secret detection
- `Gitleaks` - Git secret scanning
- `ESLint` - JavaScript/TypeScript linting
- `Black` - Python formatting check
- `Flake8` - Python linting

**Failure Actions**:
- ❌ Blocks all downstream jobs
- ❌ Prevents merge to branch
- ❌ Requires fixes before retry

#### Stage 2: Testing & SAST 🔍
**Duration**: ~10 minutes  
**Tools**:
- `npm test` - Frontend unit tests
- `Bandit` - Python security scanning (SAST)
- `npm audit` - JavaScript dependency audit
- `Safety` - Python dependency audit

**Failure Actions**:
- ❌ Blocks docker build
- ❌ Reports security issues to GitHub Security tab
- ⚠️ Development: Warnings allowed
- 🛑 Staging/Production: Must pass

#### Stage 3: Docker Build & Vulnerability Scan 🐳
**Duration**: ~15 minutes  
**Tools**:
- `Docker buildx` - Multi-platform builds
- `Trivy` - Container image scanning
- `Anchore` - SBOM generation

**Failure Actions**:
- ⚠️ Development: CRITICAL/HIGH allowed
- 🛑 Staging: CRITICAL/HIGH fail build
- 🛑 Production: CRITICAL/HIGH fail build

#### Stage 4: Deploy to Environment 🚀
**Duration**: ~10 minutes  
**Actions**:
- Pull docker image from registry
- Execute `deploy.sh` on server
- Run database migrations
- Clear cache & rebuild assets
- Health checks

**Failure Actions**:
- 🔄 Automatic rollback to previous version
- 📧 Slack notification
- 🐛 GitHub issue creation (production)

---

## Deployment Process

### Development Deployment (Automatic)

**Trigger**: Push to `development` branch

```bash
# On your local machine
git checkout -b feature/new-feature main
# Make changes
git commit -m "feat: add new feature"
git push origin feature/new-feature

# Create PR to development
# Get review approval
# Merge to development branch
# GitHub Actions automatically:
# 1. Runs all CI checks
# 2. Builds docker image
# 3. Deploys to dev.ciagotech.com
# 4. Sends Slack notification
```

### Staging Deployment (Automatic)

**Trigger**: Push to `staging` branch

```bash
# After testing in development
git checkout staging
git merge development
git push origin staging
# Automatic deployment to staging.ciagotech.com
```

### Production Deployment (Manual Approval)

**Trigger**: Push to `main` branch + reviewer approval

```bash
# 1. Merge release branch changes into main
git checkout main
git merge staging
git push origin main

# 2. GitHub Actions runs full CI/CD pipeline
# (All checks must pass)

# 3. Pipeline waits at deployment step
# Two separate approval gates:
#    - Frappe deployment (Hetzner)
#    - Cloudflare Workers deployment

# 4. Reviewer goes to GitHub → Actions → ci-cd-prod.yml workflow
# 5. Clicks "Review deployments"
# 6. Approves each deployment
# 7. Deployment proceeds with full safety checks

# 8. Post-deployment:
#    - Health checks run
#    - Slack notification sent
#    - Deployment recorded in GitHub
```

### Deploy Script Execution (`deploy.sh`)

The `deploy.sh` script handles all server-side operations:

```bash
./deploy.sh <image-tag> <site-name> <environment>

# Example:
./deploy.sh ghcr.io/ciago/frappe:sha-abc123 erpnext.local production
```

**Script Steps**:
1. ✅ Acquire deployment lock (prevents concurrent deploys)
2. ✅ Create database backup
3. ✅ Pull new docker image from registry
4. ✅ Update docker-compose with new image
5. ✅ Restart containers
6. ✅ Wait for backend to be healthy
7. ✅ Run database migrations (`bench migrate`)
8. ✅ Clear Frappe cache
9. ✅ Rebuild frontend assets
10. ✅ Run comprehensive health checks
11. ✅ Create backup record for rollback

**Logs**: `/var/log/frappe-deploy-TIMESTAMP.log`

---

## Security & Vulnerability Management

### Secret Scanning (Trivy + Gitleaks)

**What's Detected**:
- AWS credentials, API keys
- Private SSH keys
- GitHub tokens
- Database passwords
- Payment card information (PCI)

**If Secrets Found**:
1. ❌ Pipeline fails immediately
2. 📋 Review detected secrets in GitHub Security tab
3. 🔄 Remove or rotate secrets
4. 🏷️ Tag commit as `@sensitive` (internal tracking)
5. ♻️ Force push updated code (if public repo)

### Container Vulnerability Scanning (Trivy)

**Severity Levels**:
- 🔴 **CRITICAL**: Blocks all deployments
- 🔴 **HIGH**: Blocks staging/production (dev allows)
- 🟡 **MEDIUM**: Warning only
- 🟢 **LOW**: Informational

**If Vulnerabilities Found**:

1. **Check SBOM** (Software Bill of Materials)
   - Location: GitHub Actions → Artifacts → `sbom-*.json`
   - Shows all dependencies and versions

2. **Identify Source Package**
   ```bash
   # From SBOM or Trivy output
   # Example: python-requests==2.28.0 has CVE-2023-32681
   ```

3. **Update Package**
   ```bash
   # Update base image
   # In docker/frappe/Dockerfile.prod:
   FROM frappe/erpnext:v15.125.0  # Upgrade to patched version
   
   # Rebuild and push
   git push origin main
   ```

4. **Accept Risk (if necessary)**
   ```bash
   # Add to .trivyignore file (for false positives only)
   # Format: <CVE-ID>
   CVE-2023-12345
   ```

### SAST (Bandit for Python)

**Detects**:
- SQL injection vulnerabilities
- Hardcoded credentials
- Use of weak cryptography
- Unsafe deserialization

**If Issues Found**:
1. Review Bandit report in GitHub Security tab
2. Fix security issues in code
3. Commit and push
4. Re-run pipeline

---

## Rollback & Recovery Procedures

### Automatic Rollback on Deployment Failure

If deployment fails during any step:

1. **Backup Restoration**:
   ```bash
   # The deploy.sh script automatically:
   - Stops on any error (set -e)
   - Restores database from backup
   - Restores sites directory
   - Exits with error code
   ```

2. **Container Revert**:
   ```bash
   # Restore previous docker image
   ssh deploy@PROD_IP
   cd /opt/ciago-frappe
   
   # Check docker-compose.yml for previous image tag
   git log -1 --pretty=format:"%H" docker-compose.yml
   
   # Revert to previous version
   git checkout <previous-commit> docker-compose.yml
   
   # Restart with old image
   docker-compose down
   docker-compose up -d
   ```

### Manual Rollback to Previous Version

**Step 1: Identify Previous Working Version**
```bash
ssh deploy@PROD_IP
cd /opt/ciago-frappe

# List recent backups
ls -lh /opt/frappe-backups/

# Example:
# backup-20240115-143022-erpnext.local-db.sql.gz
# backup-20240115-143022-erpnext.local-sites.tar.gz
```

**Step 2: Restore from Backup**
```bash
# Stop containers
docker-compose down

# Restore database
gunzip -c /opt/frappe-backups/backup-20240115-143022-erpnext.local-db.sql.gz | \
  docker-compose exec -T mariadb mysql -u frappe -p frappe_db

# Restore sites
docker-compose exec -T backend bash -c "cd / && tar xzf -" < \
  /opt/frappe-backups/backup-20240115-143022-erpnext.local-sites.tar.gz

# Restart with old image
git checkout <working-commit>
docker-compose up -d

# Verify
docker-compose exec backend bench doctor
```

**Step 3: Communication**
1. Post in Slack: `🔄 Rollback initiated to <timestamp>`
2. Create GitHub issue: Document reason for rollback
3. Schedule post-mortem meeting

### Zero-Downtime Deployment Strategy

To minimize impact during updates:

```bash
# 1. Pre-warm new container
docker-compose up -d --no-start new-backend

# 2. Wait for health check
docker-compose exec new-backend curl -f http://localhost:8000/api/method/...

# 3. Blue-Green switch (using nginx upstream)
# Edit nginx config to route traffic to new container

# 4. Monitor for errors
tail -f /var/log/frappe-deployment.log

# 5. Remove old container only if new one stable (30 min)
docker-compose rm old-backend
```

---

## Monitoring & Troubleshooting

### Checking Deployment Status

**Via GitHub Actions**:
```
Repository → Actions → ci-cd-prod.yml
```

**Via SSH**:
```bash
ssh deploy@PROD_IP
cd /opt/ciago-frappe

# Check container status
docker-compose ps

# Check logs
docker-compose logs -f backend
docker-compose logs -f mariadb

# Check deployment log
tail -100 /var/log/frappe-deploy-*.log
```

### Common Issues & Solutions

#### Issue 1: "Trivy scan found CRITICAL vulnerabilities"

**Symptoms**:
```
❌ Build failed: Container image contains CRITICAL CVEs
```

**Solution**:
1. Check vulnerability details in GitHub Security tab
2. Identify affected package
3. Update base image or dependencies
4. Rebuild and retry

Example:
```dockerfile
# Old
FROM frappe/erpnext:v15.118.3

# New (patched)
FROM frappe/erpnext:v15.125.0
```

#### Issue 2: "Database migration failed"

**Symptoms**:
```
ERROR: Migration failed, initiating rollback...
```

**Solution**:
1. Check migration logs:
   ```bash
   tail -100 /var/log/frappe-deploy-*.log | grep -i migration
   ```

2. Run migration manually in failed container:
   ```bash
   docker-compose exec backend bench --site erpnext.local migrate
   ```

3. Check for data conflicts:
   ```bash
   docker-compose exec backend bench doctor
   ```

4. If unfixable, trigger rollback

#### Issue 3: "Health check timeout"

**Symptoms**:
```
ERROR: Backend container failed to become healthy within timeout
```

**Solution**:
1. Check if container is running:
   ```bash
   docker-compose ps backend
   ```

2. Check container logs:
   ```bash
   docker-compose logs backend --tail 50
   ```

3. Check resource usage:
   ```bash
   docker stats
   ```

4. Restart containers:
   ```bash
   docker-compose restart backend
   ```

#### Issue 4: "Secret detected in repository"

**Symptoms**:
```
❌ Secret scanning failed: API key detected in code
```

**Solution**:
1. Remove secret from code
2. Use environment variables instead:
   ```python
   # Bad
   API_KEY = "sk_live_abc123xyz"
   
   # Good
   API_KEY = os.environ.get('FRAPPE_API_KEY')
   ```

3. Rotate exposed secret
4. Commit fix and push
5. Re-run pipeline

### Performance Monitoring

**Hetzner Server Resources**:
```bash
# CPU/Memory
docker stats

# Disk usage
du -sh /opt/ciago-frappe /opt/frappe-backups

# Network
iftop -i eth0
```

**Frappe Performance**:
```bash
# Bench doctor
docker-compose exec backend bench doctor

# Site info
docker-compose exec backend bench --site erpnext.local get-site-config
```

### Log Locations

| Log | Location | Command |
|---|---|---|
| Deployment | `/var/log/frappe-deploy-*.log` | `tail -f /var/log/frappe-deploy-*.log` |
| Frappe | Docker container | `docker-compose logs backend` |
| Database | Docker container | `docker-compose logs mariadb` |
| Nginx | Docker container | `docker-compose logs nginx` |
| Cloudflare | Dashboard | https://dash.cloudflare.com/logs |
| GitHub Actions | GitHub Actions tab | Repository → Actions → Workflow run |

---

## Appendix: Quick Reference

### Essential Commands

```bash
# SSH into production
ssh -i ~/.ssh/hetzner_deploy_key deploy@PROD_IP

# Check deployment status
docker-compose ps

# View logs
docker-compose logs -f backend

# Run manual deployment
./deploy.sh ghcr.io/ciago/frappe:latest erpnext.local production

# Rollback to previous version
git checkout HEAD~1
docker-compose up -d

# Clear cache
docker-compose exec backend bench --site erpnext.local clear-cache

# Run migrations
docker-compose exec backend bench --site erpnext.local migrate

# Get site config
docker-compose exec backend bench --site erpnext.local get-site-config
```

### Emergency Contacts

- **Tech Lead**: [Contact]
- **DevOps Lead**: [Contact]
- **Slack Channel**: #ciago-deployments
- **PagerDuty**: [On-call schedule]

### Documentation Links

- [Frappe Official Docs](https://frappeframework.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**Last Updated**: August 2024  
**Version**: 1.0  
**Status**: Production Ready ✅
