# Production Scripts

**Location**: `/scripts`  
**Purpose**: Production-ready utility scripts  
**Status**: Active

---

## 📦 Production Scripts

### Core Integration Scripts

#### 1. **generate-offer-letter.py** ⭐ PRODUCTION
Generates PDF offer letter for hired candidates.

**Usage**: Called automatically when joining date is set  
**Input**: Candidate data from Ciago Spark  
**Output**: PDF offer letter with CTC breakdown  
**Template**: Custom branded template

---

#### 2. **generate-joining-letter.py** ⭐ PRODUCTION
Generates PDF joining letter for new employees.

**Usage**: Called automatically when joining date is set  
**Input**: Employee data, joining date  
**Output**: PDF joining letter with reporting details  
**Template**: Custom branded template

---

#### 3. **configure_workspace_roles.py** ⭐ PRODUCTION
Configures role-based workspace access in Frappe.

**Usage**: Run when setting up new Frappe instance  
**Actions**:
- Maps 33 workspaces to appropriate roles
- Sets visibility rules
- Configures Home workspace

**Command**:
```bash
bench --site your-site execute scripts.configure_workspace_roles.configure_all_workspace_roles
```

---

### Data Management Scripts

#### 4. **frappe-export-all.ts**
Exports all Frappe configuration to JSON files.

**Usage**: Before deployment or backup  
**Exports**:
- Master data (company, departments, designations)
- Custom fields and property setters
- Role permissions (326 rules)
- Print formats and email templates
- Workspaces

**Command**:
```bash
tsx scripts/frappe-export-all.ts
```

---

#### 5. **seed-reference-data.ts**
Seeds initial reference data to Supabase.

**Usage**: First-time setup or after reset  
**Seeds**:
- Departments
- Designations  
- Leave types
- Holiday lists

**Command**:
```bash
tsx scripts/seed-reference-data.ts
```

---

#### 6. **apply-migration.ts**
Applies database migrations.

**Usage**: When schema changes  
**Actions**: Runs Prisma migrations

**Command**:
```bash
tsx scripts/apply-migration.ts
```

---

### Maintenance Scripts

#### 7. **cleanup-except-seed-and-admin.ts**
Cleans database except seed data and admin user.

**Usage**: Reset to clean state while keeping setup  
**Keeps**: Admin user, seed data  
**Removes**: Test data, applications, hired employees

**Command**:
```bash
tsx scripts/cleanup-except-seed-and-admin.ts
```

**⚠️ WARNING**: This removes real data. Use carefully.

---

#### 8. **cleanup-test-frappe-employees.ts**
Removes test employees from Frappe.

**Usage**: Clean up test data  
**Removes**: Employees created during testing

**Command**:
```bash
tsx scripts/cleanup-test-frappe-employees.ts
```

---

#### 9. **clear-frappe-cache.ts**
Clears Frappe Redis cache.

**Usage**: After configuration changes  
**Actions**: Flushes Redis cache

**Command**:
```bash
tsx scripts/clear-frappe-cache.ts
```

---

#### 10. **backfill-roles.ts**
Backfills roles for existing users.

**Usage**: After adding new role system  
**Actions**: Assigns roles based on user type

**Command**:
```bash
tsx scripts/backfill-roles.ts
```

---

### Migration Scripts

#### 11. **migrate-schema.ts**
Migrates database schema.

**Usage**: Schema updates  
**Actions**: Applies Prisma migrations

---

#### 12. **migrate-job-posting-departments.ts**
Migrates job posting departments to new structure.

**Usage**: One-time migration  
**Status**: Completed

---

### Template Management

#### 13. **create-all-frappe-templates.ts**
Creates all Frappe templates (print formats, emails).

**Usage**: Initial setup  
**Creates**:
- Print formats (salary slip, offer letter)
- Email templates (6 automated emails)

**Command**:
```bash
tsx scripts/create-all-frappe-templates.ts
```

---

#### 14. **export-additional-master-data.ts**
Exports additional master data from Frappe.

**Usage**: Backup or migration  
**Exports**: Holiday lists, leave types, salary components

---

### Utility Scripts

#### 15. **make-admin.ts**
Grants admin privileges to a user.

**Usage**: Make user a system admin  
**Command**:
```bash
tsx scripts/make-admin.ts <user-email>
```

---

#### 16. **count-records.ts**
Counts records in database tables.

**Usage**: Database health check  
**Output**: Record counts per table

---

#### 17. **offboarding-poll.ts**
Polls for offboarding employees.

**Usage**: Background worker  
**Actions**: Checks for employees to offboard

---

#### 18. **create-test-job.ts**
Creates a test job posting.

**Usage**: Testing recruitment flow  
**Actions**: Seeds test job data

---

### Deprecated/Archive

Scripts moved to `scripts/archive/`:
- Workspace debugging scripts
- Temporary fix scripts
- Investigation scripts

**Location**: `scripts/archive/`  
**Status**: Not for production use

---

## 🚀 Common Commands

### Setup New Frappe Instance
```bash
# 1. Export configuration
tsx scripts/frappe-export-all.ts

# 2. Deploy to server
scp -r frappe-exports/ server:/path/

# 3. Import on server
bench --site production-site execute frappe.setup.import_all

# 4. Configure workspaces
bench --site production-site execute scripts.configure_workspace_roles.configure_all_workspace_roles

# 5. Clear cache
tsx scripts/clear-frappe-cache.ts
```

### Reset to Clean State
```bash
# Clean database (keeps seed data)
tsx scripts/cleanup-except-seed-and-admin.ts

# Re-seed reference data
tsx scripts/seed-reference-data.ts

# Clear Frappe test data
tsx scripts/cleanup-test-frappe-employees.ts
```

### Generate PDF Documents
```bash
# Offer letter (called automatically on hire)
python scripts/generate-offer-letter.py

# Joining letter (called automatically on joining date)
python scripts/generate-joining-letter.py
```

---

## ⚠️ Important Notes

### Production Scripts (DO NOT DELETE)
- `generate-offer-letter.py` ⭐
- `generate-joining-letter.py` ⭐
- `configure_workspace_roles.py` ⭐
- `frappe-export-all.ts`
- `seed-reference-data.ts`

These are actively used in production workflows.

### Safe to Delete
- Files in `scripts/archive/` directory
- Temporary debugging scripts
- One-time migration scripts (after running)

### Requires Caution
- `cleanup-except-seed-and-admin.ts` - Deletes data
- `reset-database.ts` - Complete reset
- `wipe-all-data.ts` - Nuclear option

**Always backup before running destructive scripts!**

---

## 📂 Directory Structure

```
scripts/
├── README.md (this file)
├── archive/ (debugging/temporary scripts)
├── generate-offer-letter.py ⭐
├── generate-joining-letter.py ⭐
├── configure_workspace_roles.py ⭐
├── frappe-export-all.ts
├── seed-reference-data.ts
├── apply-migration.ts
├── cleanup-except-seed-and-admin.ts
├── clear-frappe-cache.ts
├── backfill-roles.ts
├── make-admin.ts
├── count-records.ts
└── ... (other utilities)
```

---

## 🆘 Support

**Documentation**: See `.docs/` directory  
**Tests**: See `.tests/` directory  
**Exports**: See `frappe-exports/` directory

For script usage questions, refer to:
- `.docs/COMPLETE_FRAPPE_FLOW.md` - System flow
- `.docs/FRAPPE_EXPORT_GUIDE.md` - Deployment guide
- `.docs/FRAPPE_TEMPLATES_CHECKLIST.md` - Template setup

---

**Last Updated**: 2026-08-07  
**Production Scripts**: 18  
**Archived Scripts**: ~40  
**Status**: Clean & Organized
