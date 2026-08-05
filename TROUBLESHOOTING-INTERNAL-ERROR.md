# Troubleshooting: Internal Server Error (500)

## Issue: "Internal Server Error" on Frappe (localhost:8180)

### Root Cause
The custom app `ciago_spark` was installed but not properly registered with the Python environment, causing a `ModuleNotFoundError`.

---

## Solution

### Quick Fix (Apply this whenever you see Internal Server Error)

```bash
# Step 1: Reinstall the custom app
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "cd /home/frappe/frappe-bench && uv pip install -e ./apps/ciago_spark --python ./env/bin/python"

# Step 2: Restart all services
docker compose -f docker-compose.frappe.yml restart

# Step 3: Wait 15 seconds and test
sleep 15
curl -I http://localhost:8180
```

**Expected Output:** `HTTP/1.1 200 OK`

---

## Detailed Troubleshooting Steps

### 1. Check Logs for Errors

```bash
# View recent errors
docker compose -f docker-compose.frappe.yml logs frappe-backend --tail=100 | grep -i "error\|exception"

# Common errors:
# - "ModuleNotFoundError: No module named 'ciago_spark'"
# - "Could not find app 'ciago_spark'"
# - "Import Error"
```

### 2. Verify App Installation

```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "bench --site ciago.localhost list-apps"

# Expected output:
# frappe  15.x.x
# erpnext 15.x.x
# hrms    15.x.x
# ciago_spark 0.0.1
```

### 3. Check Python Module Import

```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "python -c 'import ciago_spark; print(ciago_spark.__file__)'"

# Expected: /home/frappe/frappe-bench/apps/ciago_spark/ciago_spark/__init__.py
# Error: ModuleNotFoundError → App needs reinstall
```

### 4. Reinstall Custom App

```bash
# Method 1: Using uv pip (recommended)
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "cd /home/frappe/frappe-bench && uv pip install -e ./apps/ciago_spark --python ./env/bin/python"

# Method 2: Using bench install
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "cd /home/frappe/frappe-bench && bench reinstall-app ciago_spark"
```

### 5. Full Restart

```bash
# Stop all services
docker compose -f docker-compose.frappe.yml down

# Start all services
docker compose -f docker-compose.frappe.yml up -d

# Wait for services to initialize
sleep 30

# Check status
docker compose -f docker-compose.frappe.yml ps
```

### 6. Clear Cache

```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "bench --site ciago.localhost clear-cache"

docker compose -f docker-compose.frappe.yml restart frappe-backend
```

---

## Verification Checklist

### ✅ Backend Service Running
```bash
docker compose -f docker-compose.frappe.yml ps frappe-backend

# Status should be "Up" (not "Restarting")
```

### ✅ No Errors in Logs
```bash
docker compose -f docker-compose.frappe.yml logs frappe-backend --tail=50 | grep -i error

# Should return empty or no critical errors
```

### ✅ HTTP 200 Response
```bash
curl -I http://localhost:8180

# Expected: HTTP/1.1 200 OK
```

### ✅ Login Page Accessible
```
Open browser: http://localhost:8180
You should see the Frappe login page
```

---

## Common Errors & Solutions

### Error 1: "ModuleNotFoundError: No module named 'ciago_spark'"

**Cause:** App not installed in Python environment

**Solution:**
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "uv pip install -e /home/frappe/frappe-bench/apps/ciago_spark --python /home/frappe/frappe-bench/env/bin/python"

docker compose -f docker-compose.frappe.yml restart
```

---

### Error 2: "Could not find app 'ciago_spark'"

**Cause:** App installed in site but not in bench

**Solution:**
```bash
# Check apps.txt
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "cat /home/frappe/frappe-bench/sites/apps.txt"

# If ciago_spark is missing, add it:
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "echo 'ciago_spark' >> /home/frappe/frappe-bench/sites/apps.txt"

docker compose -f docker-compose.frappe.yml restart
```

---

### Error 3: "Gunicorn workers keep restarting"

**Cause:** Syntax error in Python code or module import failure

**Solution:**
```bash
# Check for syntax errors
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "python -m py_compile /home/frappe/frappe-bench/apps/ciago_spark/ciago_spark/setup/*.py"

# Check imports
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "python -c 'from ciago_spark.setup import after_migrate'"

# If errors found, fix the Python files and restart
```

---

### Error 4: "Permission denied" on fixtures

**Cause:** File permissions issue in container

**Solution:**
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "chown -R frappe:frappe /home/frappe/frappe-bench/apps/ciago_spark"

docker compose -f docker-compose.frappe.yml restart
```

---

### Error 5: "Database connection failed"

**Cause:** MariaDB not ready or wrong credentials

**Solution:**
```bash
# Check database health
docker compose -f docker-compose.frappe.yml exec frappe-db bash -c \
  "healthcheck.sh --connect --innodb_initialized"

# If unhealthy, restart database
docker compose -f docker-compose.frappe.yml restart frappe-db

# Wait 30 seconds
sleep 30

# Restart backend
docker compose -f docker-compose.frappe.yml restart frappe-backend
```

---

## Nuclear Option: Complete Reset

⚠️ **WARNING: This will delete ALL data!** Only use for development.

```bash
# Stop and remove all containers and volumes
docker compose -f docker-compose.frappe.yml down -v

# Remove images
docker rmi frappe-erpnext-hrms:v15

# Rebuild from scratch
docker build -t frappe-erpnext-hrms:v15 docker/frappe/

# Start services
docker compose -f docker-compose.frappe.yml up -d

# Wait 60 seconds
sleep 60

# Recreate site
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench new-site ciago.localhost \
    --mariadb-user-host-login-scope='%' \
    --db-root-password='REPLACE_WITH_SECURE_PASSWORD_123' \
    --admin-password=admin \
    --install-app erpnext

docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost install-app hrms

docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost install-app ciago_spark

docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

---

## Prevention Tips

### 1. Always Reinstall After Code Changes

```bash
# After modifying Python files in apps/ciago_spark/
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "uv pip install -e /home/frappe/frappe-bench/apps/ciago_spark --python /home/frappe/frappe-bench/env/bin/python"

docker compose -f docker-compose.frappe.yml restart frappe-backend
```

### 2. Use Health Checks

```bash
# Add to docker-compose.frappe.yml
services:
  frappe-backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/method/ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### 3. Monitor Logs Continuously

```bash
# Keep logs open in separate terminal
docker compose -f docker-compose.frappe.yml logs -f frappe-backend
```

### 4. Validate Before Deployment

```bash
# In development, always test these before committing:

# 1. Check app installs
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost list-apps

# 2. Check migration runs
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate

# 3. Check HTTP response
curl -I http://localhost:8180

# 4. Check for Python errors
docker compose -f docker-compose.frappe.yml logs frappe-backend | grep -i "error\|exception"
```

---

## Quick Reference Commands

### Check Status
```bash
docker compose -f docker-compose.frappe.yml ps
docker compose -f docker-compose.frappe.yml logs frappe-backend --tail=50
curl -I http://localhost:8180
```

### Fix Common Issues
```bash
# Reinstall app
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "uv pip install -e /home/frappe/frappe-bench/apps/ciago_spark --python /home/frappe/frappe-bench/env/bin/python"

# Restart services
docker compose -f docker-compose.frappe.yml restart

# Clear cache
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost clear-cache
```

### Full Restart
```bash
docker compose -f docker-compose.frappe.yml down && \
docker compose -f docker-compose.frappe.yml up -d && \
sleep 30 && \
curl -I http://localhost:8180
```

---

## Support

If issue persists after all troubleshooting steps:

1. Check Error Log DocType in Frappe Desk (if accessible)
2. Review full logs: `docker compose -f docker-compose.frappe.yml logs > frappe-logs.txt`
3. Check Frappe forum: https://discuss.frappe.io
4. Check GitHub issues: https://github.com/frappe/frappe/issues

---

**Last Updated:** August 5, 2026  
**Issue Fixed:** Internal Server Error (ModuleNotFoundError)  
**Status:** ✅ Resolved
