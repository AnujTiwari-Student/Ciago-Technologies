# Project Resume Point
**Last worked on: 2026-09-01**  
**Last session: Oracle VM staging deployment**

---

## WHERE YOU LEFT OFF

**Phase 1, Step 1.2.1 — Import Frappe Configuration into Oracle VM**

You have the Oracle staging VM running with all Docker containers up.
The Frappe site is created but the configuration (roles, departments, 
custom fields, permissions, etc.) hasn't been imported yet.

**To continue:** Open `.production/DEPLOYMENT_START_GUIDE.md` and search for 
`Step 1.2.1: Import Frappe Configuration` — follow from there.

---

## QUICK CONTEXT

### What This Project Is
- **CiagoTech** — HR/hiring platform
- **Frontend**: TanStack Start (SSR) on Cloudflare Workers
- **Database**: Neon PostgreSQL (WebSocket connection via @neondatabase/serverless)
- **HR Backend**: Frappe HR/ERPNext v15 (Docker on Oracle Cloud)
- **Auth**: Clerk (test instance: musical-stinkbug-64)
- **Secrets**: Doppler (dev/stg/prd configs)

### Infrastructure
| Component | Location | Status |
|-----------|----------|--------|
| Dev frontend | localhost:8080 | Working (npm run dev) |
| Dev database | Neon (WebSocket) | Working |
| Dev Frappe | localhost:8180 (Docker Desktop) | Working (when Docker is on) |
| Staging VM | Oracle Cloud 140.238.245.236 | Running, containers up |
| Staging Frappe | Oracle VM port 8000 | Site created, needs config import |
| Production | Not deployed yet | Phase 2 |

### Oracle VM Access
```bash
ssh -i "C:\Keys\OracleARMPub.key" ubuntu@140.238.245.236
cd /opt/ciago-frappe
```

### Key Credentials
- All secrets in **Doppler** (project: ciago-technologies)
- `doppler secrets --config dev` / `stg` / `prd`
- Oracle VM MariaDB passwords: in Doppler `stg` config
- Frappe admin password: `admin`

---

## DEPLOYMENT PROGRESS

### Phase 0: Security & Config
- [x] SQL injection fixed
- [x] Error boundaries added
- [x] Doppler configured (dev/stg/prd)
- [x] GitHub secrets added
- [x] Cloudflare account_id set
- [x] MariaDB passwords added to Doppler (all envs)

### Phase 1: Staging Deployment
- [x] Oracle Cloud VM created (ARM, 4 OCPU, 24GB RAM)
- [x] Docker Compose v2 installed
- [x] Containers running (MariaDB, Redis x2, Backend, Workers x3, Scheduler, Nginx)
- [x] Frappe site created (frappe.oracle.ciagotech.com)
- [x] ERPNext + HRMS installed
- [x] frappe-exports/ copied to VM
- [ ] **Import Frappe config** <-- YOU ARE HERE
- [ ] Clear cache and restart
- [ ] Set up staging idle prevention cron
- [ ] Deploy frontend to Cloudflare staging
- [ ] Configure DNS (staging.ciagotech.com)
- [ ] Test full hiring workflow on staging

### Phase 2: Production Deployment
- [ ] Create production Oracle VM (or Hetzner)
- [ ] Deploy Frappe to production
- [ ] Deploy frontend to Cloudflare production
- [ ] Configure production DNS
- [ ] Monitor 24 hours

---

## RECENT FIXES (Aug 2026)

### Connection Timeout Fix
- **Problem**: Port 5432 blocked on local network
- **Fix**: Switched to `@neondatabase/serverless` (WebSocket over port 443)
- **Files**: `src/lib/db/admin.ts`, `src/lib/db/neon.ts`
- **Details**: `.docs/CONNECTION_TIMEOUT_FIX.md`

### RLS Query Fix
- **Problem**: `SET LOCAL` failed with parameterized query on Neon adapter
- **Fix**: Changed to `$executeRawUnsafe` with UUID validation
- **File**: `src/lib/db/neon.ts` line 45

### Dynamic Imports Fix
- **Problem**: Static `getAdminDb` imports broke TanStack Start code-splitting
- **Fix**: All 25+ server function files converted to dynamic `await import()`

---

## KEY FILES

| Purpose | File |
|---------|------|
| Deployment guide | `.production/DEPLOYMENT_START_GUIDE.md` |
| Full deployment index | `.production/INDEX.md` |
| Progress update | `.production/PROGRESS_UPDATE.md` |
| DB connection docs | `.docs/CONNECTION_TIMEOUT_FIX.md` |
| Auth fixes docs | `.docs/TODAY_FIXES_SUMMARY.md` |
| Frappe export data | `frappe-exports/` |
| Oracle compose | `docker-compose.oracle.yml` |
| Local compose | `docker-compose.frappe.yml` |
| CI/CD workflows | `.github/workflows/` |
| Test scripts | `.tests/` |

---

## HOW TO START LOCAL DEV

```bash
cd "C:\Ciago Spark"
npm run dev
# Opens on http://localhost:8080

# Run tests
bash .tests/verify-auth-config.sh
bash .tests/verify-db-connection.sh
```

## HOW TO RESUME STAGING DEPLOYMENT

```bash
# SSH into Oracle VM
ssh -i "C:\Keys\OracleARMPub.key" ubuntu@140.238.245.236

# Check containers
docker ps

# If containers are down:
cd /opt/ciago-frappe
doppler run -- docker compose -f docker-compose.oracle.yml up -d

# Continue from Step 1.2.1 in DEPLOYMENT_START_GUIDE.md
```

---

**Next action: Import Frappe config on Oracle VM**  
**Guide: `.production/DEPLOYMENT_START_GUIDE.md` -> Step 1.2.1**
