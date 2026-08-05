# Frappe Enterprise Setup Automation - Complete Guide

## Overview

This guide documents the complete automation of Frappe/ERPNext enterprise setup including:

- ✅ 68 Enterprise Roles (automatically created)
- ✅ Role Profiles (bundled permissions)
- ✅ Database Permissions (Custom DocPerm)
- ✅ Workspace Visibility (Backend UI access control)
- ✅ Super-User/Developer Account (full unrestricted access)
- ✅ Git-tracked Fixtures (100% reproducible across environments)

## Architecture

```
apps/ciago_spark/
└── ciago_spark/
    ├── hooks.py                           # Fixtures + after_migrate binding
    └── setup/
        ├── __init__.py                    # after_migrate coordinator
        ├── setup_superuser.py             # Developer account provisioning
        └── setup_permissions.py           # Roles, profiles, perms, workspaces
```

## Setup Modules

### 1. `setup_superuser.py`

**Purpose:** Provision the mandatory developer account with full unrestricted access.

**Executes:**

- Creates/updates user: `anujavengers@gmail.com`
- Assigns all 68 enterprise roles + 6 core admin roles
- Forces password: `QWEbnm2901@`
- Saves with `ignore_permissions=True`

**Roles Assigned:**

- **Core Admin:** Administrator, System Manager, Script Manager, Report Manager, Workspace Manager, Dashboard Manager
- **All 68 Enterprise Roles** (see matrix file for complete list)

### 2. `setup_permissions.py`

**Purpose:** Automate creation and configuration of all enterprise permissions.

**Executes:**

1. **Role Creation (`create_roles`)**
   - Reads 68 roles from `ALL_ENTERPRISE_ROLES` dictionary
   - Creates missing roles with proper `desk_access` flags
   - Marks custom roles with `is_custom = 1`

2. **Role Profile Bundling (`create_role_profiles`)**
   - Creates 14 standard role profiles:
     - Engineering Profile
     - DevOps Profile
     - SRE Profile
     - HR Profile / HR Manager Profile
     - Finance Profile / Finance Manager Profile
     - Sales Profile / Sales Manager Profile
     - Procurement Profile / Procurement Manager Profile
     - Operations Profile
     - Projects Profile
     - Executive Profile

3. **Database Security (`setup_docperms`)**
   - Inserts `Custom DocPerm` records for key DocTypes
   - Example: Job Opening permissions for HR Manager, HR User, Interviewer
   - Enforces strict CRUD and submission rules

4. **Backend UI Visibility (`map_roles_to_workspaces`)**
   - Updates Workspace documents based on `WORKSPACE_MAPPINGS`
   - Maps 68 roles across 20 Workspaces (Home, HR, Accounting, Projects, etc.)
   - Respects `developer_mode` flag (hides "Build" workspace in production)

### 3. `setup/__init__.py`

**Purpose:** Coordinate all setup modules in sequence.

**Execution Flow:**

```python
after_migrate():
    1. setup_superuser()      # Provision developer account
    2. setup_permissions()    # Configure roles, profiles, perms, workspaces
```

## Fixtures Configuration (`hooks.py`)

**Git-tracked exports:**

```python
fixtures = [
    "Custom Field",           # Custom fields (e.g., Job Posting additions)
    "Property Setter",        # Mandatory changes, label changes, hidden fields
    "Custom DocPerm",         # DB permission overrides
    {
        "doctype": "Role",
        "filters": [["is_custom", "=", 1]]
    },
    "Role Profile",           # Bundled role assignments
    "Workspace",              # CRITICAL: Backend UI visibility rules
    "Workflow",               # Custom workflows
    "Workflow State",
    "Workflow Action Master",
    "Client Script",          # Custom client-side scripts
    "Server Script"           # Custom server-side scripts
]
```

**Export Command:**

```bash
bench --site ciago.localhost export-fixtures
```

**Result:** All configurations are exported to `apps/ciago_spark/ciago_spark/fixtures/*.json` and tracked in Git.

## Usage

### Initial Setup (First-Time)

```bash
# 1. Build and start containers
docker compose -f docker-compose.frappe.yml up -d

# 2. Create site (if not already created)
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench new-site ciago.localhost \
    --mariadb-user-host-login-scope='%' \
    --db-root-password='YOUR_SECURE_PASSWORD' \
    --admin-password=admin \
    --install-app erpnext

# 3. Install HRMS
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost install-app hrms

# 4. Install ciago_spark custom app
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost install-app ciago_spark

# 5. Run migration (triggers after_migrate hook)
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate
```

### Subsequent Updates

```bash
# After modifying setup modules or adding custom fields:
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost migrate

# Export fixtures to Git
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost export-fixtures
```

### Production Deployment

**Environment Configuration:**

```python
# site_config.json (Production)
{
    "developer_mode": 0,      # CRITICAL: Hides "Build" workspace
    "disable_rate_limiter": 0,
    "db_host": "frappe-db",
    "redis_cache": "redis://frappe-redis-cache:6379",
    "redis_queue": "redis://frappe-redis-queue:6379"
}
```

**Deployment Workflow:**

1. Commit fixtures to Git (`bench export-fixtures`)
2. Push changes to repository
3. Pull on production server
4. Run `bench --site <site-name> migrate`
5. All roles, permissions, and workspaces are automatically provisioned

## Role Matrix Reference

### Core System & Technical Administration

- Administrator
- System Manager
- Script Manager, Report Manager, Workspace Manager, Dashboard Manager
- Software Engineer (SWE/SDE)
- DevOps / System Engineer
- Site Reliability Engineer (SRE)
- Cloud / Systems Architect
- Security Engineer (IAM/CISO)

### Human Resources

- Employee, Employee Self Service
- HR User, HR Manager
- Leave Approver, Expense Approver, Interviewer
- Chief Human Resources Officer (CHRO)

### Finance & Accounting

- Accounts User, Accounts Manager, Auditor
- FP&A Manager / Financial Controller
- Chief Financial Officer (CFO)

### Sales, CRM & Content

- Sales User, Sales Manager, Sales Master Manager
- Website Manager, Blogger, Newsletter Manager
- Knowledge Base Contributor, Knowledge Base Editor
- Translator, Inbox User

### Procurement & Inventory

- Purchase User, Purchase Manager, Purchase Master Manager
- Stock User, Stock Manager, Item Manager
- Fulfillment User, Delivery User, Delivery Manager, Fleet Manager
- Procurement / Sourcing Director

### Operations & Manufacturing

- Manufacturing User, Manufacturing Manager
- Quality Manager
- Maintenance User, Maintenance Manager
- Projects User, Projects Manager
- Support Team
- Technical Program Manager (TPM)
- Product Manager (PM)

### Domain Specific

- Agriculture User, Agriculture Manager
- Academics User
- Analytics, Prepared Report User

### Executive

- Chief Executive Officer (CEO)
- Chief Technology Officer (CTO)
- Legal & Compliance Counsel

### External Access (No Desk Access)

- Guest
- Customer
- Supplier

## Workspace Mappings

**20 Available Workspaces:**

1. Home
2. Accounting
3. Buying
4. Selling
5. Stock
6. Assets
7. HR
8. Manufacturing
9. Quality
10. Projects
11. Support
12. Users
13. Website
14. Payroll
15. CRM
16. Tools
17. ERPNext Settings
18. Integrations
19. ERPNext Integrations
20. Build (Dev only)

**Mapping Logic:**

- Roles are mapped to workspaces via `WORKSPACE_MAPPINGS` dictionary in `setup_permissions.py`
- Users only see workspaces for which they have assigned roles
- "Build" workspace is automatically hidden when `developer_mode = 0`

## Security Policies

### ZERO SEED DATA POLICY

- ✅ **NO** dummy jobs, candidates, applications, or test employees
- ✅ **ONLY** structural setup:
  - Roles
  - Permissions
  - Workspace visibility
  - Developer account
  - Base organizational departments (if required)

### Password Security

- Developer account password: `QWEbnm2901@` (hardcoded for initial setup)
- **IMPORTANT:** Change password immediately after first login via Frappe Desk

### Permission Enforcement

- All setup operations use `ignore_permissions=True`
- Custom DocPerms enforce strict CRUD rules per role
- Workspace visibility restricts backend UI access
- Portal users (Customer, Supplier, Guest) have ZERO Desk access

## Troubleshooting

### Check Setup Execution

```bash
# View migration logs
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  tail -f /home/frappe/frappe-bench/logs/frappe.log

# Check if roles were created
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console
>>> frappe.get_all("Role", filters={"is_custom": 1}, pluck="name")
```

### Verify Super-User

```bash
# Check user roles
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console
>>> user = frappe.get_doc("User", "anujavengers@gmail.com")
>>> print([r.role for r in user.roles])
```

### Verify Workspace Visibility

```bash
# Check workspace role mappings
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console
>>> workspace = frappe.get_doc("Workspace", "HR")
>>> print([r.role for r in workspace.roles])
```

### Re-run Setup Manually

```python
# Connect to site console
docker compose -f docker-compose.frappe.yml exec frappe-backend \
  bench --site ciago.localhost console

# Execute setup modules
>>> from ciago_spark.setup.setup_superuser import setup_superuser
>>> from ciago_spark.setup.setup_permissions import setup_permissions
>>> setup_superuser()
>>> setup_permissions()
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Frappe Setup

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Frappe image
        run: docker build -t frappe-erpnext-hrms:v15 docker/frappe/

      - name: Run migrations
        run: |
          docker compose -f docker-compose.frappe.yml up -d
          docker compose -f docker-compose.frappe.yml exec -T frappe-backend \
            bench --site ciago.localhost migrate

      - name: Export fixtures
        run: |
          docker compose -f docker-compose.frappe.yml exec -T frappe-backend \
            bench --site ciago.localhost export-fixtures

      - name: Commit fixtures
        run: |
          git config --global user.name "GitHub Actions"
          git config --global user.email "actions@github.com"
          git add apps/ciago_spark/ciago_spark/fixtures/
          git commit -m "chore: update Frappe fixtures" || true
          git push
```

## State Tracking

**Fixtures tracked in Git:**

- `apps/ciago_spark/ciago_spark/fixtures/role.json`
- `apps/ciago_spark/ciago_spark/fixtures/role_profile.json`
- `apps/ciago_spark/ciago_spark/fixtures/custom_doc_perm.json`
- `apps/ciago_spark/ciago_spark/fixtures/workspace.json`
- `apps/ciago_spark/ciago_spark/fixtures/custom_field.json`
- `apps/ciago_spark/ciago_spark/fixtures/property_setter.json`

**Migration tracking:**

- Frappe's migration system automatically tracks executed patches
- `tabPatch Log` DocType records all applied migrations
- `after_migrate` hook executes on every `bench migrate` (idempotent operations)

## Next Steps

1. ✅ **Verify Setup:**
   - Login as `anujavengers@gmail.com` with password `QWEbnm2901@`
   - Navigate to User List and verify all roles are assigned
   - Check Workspace visibility (Home, Tools, Users, etc.)

2. ✅ **Export Fixtures:**
   - Run `bench --site ciago.localhost export-fixtures`
   - Commit `apps/ciago_spark/ciago_spark/fixtures/` to Git

3. ✅ **Add Custom Fields:**
   - Use Frappe Desk to add custom fields to Job Opening, Employee, etc.
   - Re-export fixtures to capture changes

4. ✅ **Configure DocEvents:**
   - Uncomment `doc_events` section in `hooks.py`
   - Create custom logic for Job Posting workflows, etc.

5. ✅ **Production Deployment:**
   - Set `developer_mode = 0` in `site_config.json`
   - Deploy fixtures via Git + CI/CD
   - Run `bench migrate` on production

## Support

For issues or questions:

- Check Frappe logs: `/home/frappe/frappe-bench/logs/frappe.log`
- Review Error Log DocType in Frappe Desk
- Consult matrix file: `frappe_complete_enterprise_role_matrix.md`
- GitHub Issues: https://github.com/frappe/frappe/issues
