# Frappe Enterprise Setup - Quick Command Reference

## Initial Setup Commands

### 1. Start Frappe Stack
```bash
docker compose -f docker-compose.frappe.yml up -d
```

### 2. Create Site (First Time Only)
```bash
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
```

### 3. Run Migration (Triggers Setup Automation)
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

---

## Daily Operations

### Access Frappe Desk
```
URL: http://localhost:8180
Email: anujavengers@gmail.com
Password: QWEbnm2901@
```

### View Logs
```bash
# Real-time logs
docker compose -f docker-compose.frappe.yml logs -f frappe-backend

# Frappe application logs
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  tail -f /home/frappe/frappe-bench/logs/frappe.log
```

### Restart Services
```bash
# Restart all containers
docker compose -f docker-compose.frappe.yml restart

# Restart Frappe only
docker compose -f docker-compose.frappe.yml restart frappe-backend

# Bench restart (inside container)
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench restart
```

---

## Setup Management

### Re-run Setup Automation
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

### Manual Setup Execution
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> from ciago_spark.setup.setup_superuser import setup_superuser
>>> from ciago_spark.setup.setup_permissions import setup_permissions
>>> setup_superuser()
>>> setup_permissions()
```

---

## Fixture Management

### Export All Fixtures
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost export-fixtures
```

### Copy Fixtures to Host (for Git)
```bash
docker cp frappe-backend:/home/frappe/frappe-bench/apps/ciago_spark/ciago_spark/fixtures/ \
  ./ciago_spark_fixtures/
```

### Import Fixtures (Production)
```bash
# Fixtures are automatically imported during migration
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

---

## User Management

### Reset Password
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost set-password <email> <new-password>

# Example:
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost set-password anujavengers@gmail.com NewSecurePass123!
```

### List All Users
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> frappe.get_all("User", filters={"user_type": "System User"}, fields=["name", "full_name", "enabled"])
```

### Check User Roles
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> user = frappe.get_doc("User", "anujavengers@gmail.com")
>>> print([r.role for r in user.roles])
```

---

## Role & Permission Management

### List All Custom Roles
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> frappe.get_all("Role", filters={"is_custom": 1}, pluck="name")
```

### List All Role Profiles
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> frappe.get_all("Role Profile", pluck="name")
```

### Check Workspace Mappings
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> workspace = frappe.get_doc("Workspace", "HR")
>>> print(f"Workspace: {workspace.name}")
>>> print(f"Roles: {[r.role for r in workspace.roles]}")
```

---

## Database Management

### Backup Database
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost backup --with-files

# Backup location: /home/frappe/frappe-bench/sites/ciago.localhost/private/backups/
```

### Restore Database
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost restore /path/to/backup.sql.gz
```

### Database Console
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost mariadb

# Or direct MariaDB access:
docker compose -f docker-compose.frappe.yml exec frappe-db \
  mariadb -u root -p
```

---

## Development Mode

### Enable Developer Mode
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost set-config developer_mode 1

docker compose -f docker-compose.frappe.yml restart frappe-backend
```

### Disable Developer Mode (Production)
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost set-config developer_mode 0

docker compose -f docker-compose.frappe.yml restart frappe-backend
```

### Check Current Config
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  cat /home/frappe/frappe-bench/sites/ciago.localhost/site_config.json
```

---

## Custom App Management

### Edit Setup Files (Inside Container)
```bash
# Access container shell
docker compose -f docker-compose.frappe.yml exec frappe-backend bash

# Navigate to app
cd /home/frappe/frappe-bench/apps/ciago_spark/ciago_spark/setup/

# Edit files
nano setup_permissions.py
nano setup_superuser.py

# Exit and run migration
exit
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

### Copy Files from Host to Container
```bash
# Copy updated setup file
docker cp C:\Ciago Spark\setup_permissions.py \
  frappe-backend:/home/frappe/frappe-bench/apps/ciago_spark/ciago_spark/setup/

# Run migration
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

---

## Troubleshooting

### Clear Cache
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost clear-cache
```

### Rebuild Assets
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench build --app ciago_spark
```

### Check Bench Version
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench version
```

### List Installed Apps
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost list-apps
```

### Console Access (Python)
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console
```

### Error Logs
```bash
# View Error Log DocType via Frappe Desk:
# Navigate to: Tools > Error Log

# Or via console:
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

>>> frappe.get_all("Error Log", limit=10, order_by="creation desc")
```

---

## Maintenance

### Stop All Services
```bash
docker compose -f docker-compose.frappe.yml down
```

### Stop and Remove Volumes (CAUTION: Data Loss)
```bash
docker compose -f docker-compose.frappe.yml down -v
```

### Update Docker Images
```bash
docker compose -f docker-compose.frappe.yml pull
docker compose -f docker-compose.frappe.yml up -d
```

### Clean Docker Resources
```bash
docker system prune -a
```

---

## Production Deployment

### Set Production Config
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash

cat > /home/frappe/frappe-bench/sites/ciago.localhost/site_config.json << 'EOF'
{
    "developer_mode": 0,
    "disable_rate_limiter": 0,
    "db_host": "frappe-db",
    "redis_cache": "redis://frappe-redis-cache:6379",
    "redis_queue": "redis://frappe-redis-queue:6379"
}
EOF

exit

docker compose -f docker-compose.frappe.yml restart
```

### Enable HTTPS (via Reverse Proxy)
```nginx
# Example Nginx config (external to Docker)
server {
    listen 443 ssl http2;
    server_name ciago.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://localhost:8180;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Quick Verification

### Check Setup Status
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console << 'EOF'
import frappe
frappe.init(site="ciago.localhost")
frappe.connect()

# Check super-user
user = frappe.get_doc("User", "anujavengers@gmail.com")
print(f"Super-user roles: {len(user.roles)}")

# Check custom roles
custom_roles = frappe.get_all("Role", filters={"is_custom": 1})
print(f"Custom roles: {len(custom_roles)}")

# Check role profiles
profiles = frappe.get_all("Role Profile")
print(f"Role profiles: {len(profiles)}")

print("\n✅ Setup verification complete!")
frappe.destroy()
EOF
```

---

## Emergency Commands

### Rollback Migration
```bash
# Not directly supported - restore from backup
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost restore /path/to/backup.sql.gz
```

### Force Kill Container
```bash
docker kill frappe-backend
docker compose -f docker-compose.frappe.yml up -d
```

### Access Database Directly
```bash
docker compose -f docker-compose.frappe.yml exec frappe-db \
  mariadb -u root -p -D ciago_localhost
```

---

## Useful Shortcuts

### Complete Restart
```bash
docker compose -f docker-compose.frappe.yml down && \
docker compose -f docker-compose.frappe.yml up -d && \
docker compose -f docker-compose.frappe.yml logs -f frappe-backend
```

### Quick Migrate + Export
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend bash -c \
  "bench --site ciago.localhost migrate && bench --site ciago.localhost export-fixtures"
```

### Full Setup Verification
```bash
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console << 'EOF'
import frappe
frappe.init(site="ciago.localhost")
frappe.connect()

print("=== SETUP VERIFICATION ===")
print(f"Super-user: {frappe.db.exists('User', 'anujavengers@gmail.com')}")
print(f"Custom roles: {len(frappe.get_all('Role', filters={'is_custom': 1}))}")
print(f"Role profiles: {len(frappe.get_all('Role Profile'))}")
print(f"Workspaces: {len(frappe.get_all('Workspace'))}")
print("=== COMPLETE ===")

frappe.destroy()
EOF
```

---

**Last Updated:** August 5, 2026  
**Maintained By:** Anuj (anujavengers@gmail.com)
