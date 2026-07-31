# Database Reset & Seed Complete ✅

**Date:** 2026-08-01  
**Status:** ✅ Successfully seeded 3 core reference tables

---

## What Was Done

### 1. Cleared Existing Data
All data from the 3 core reference tables was deleted:
- `departments`
- `employment_types`
- `status_options`

### 2. Seeded Fresh Data

#### Departments (12 total)
- Engineering
- Human Resources
- Operations
- Management
- Product
- Design
- Finance
- Sales
- Marketing
- Customer Support
- Legal
- IT Infrastructure

#### Employment Types (5 total)
- Full-Time
- Part-Time
- Contract
- Internship
- Probation

#### Status Options (6 total)
All with `kind: "application"`:
- Applied
- Screening
- Interviewing
- Offered
- Hired
- Rejected

---

## Script Created

**Location:** `scripts/seed-reference-data.ts`

**Usage:**
```bash
npx tsx scripts/seed-reference-data.ts
```

**What it does:**
1. Clears existing data from the 3 reference tables
2. Seeds departments
3. Seeds employment types
4. Seeds status options

**Safe to re-run:** Yes, it truncates and reseeds each time

---

##Important Notes

### User Data NOT Seeded
Test users were NOT created because:
- `clerk_user_map` has a foreign key constraint to `auth.users` table
- The `auth.users` table is managed outside Prisma (by Clerk authentication)
- Users must be created through the Clerk sign-up flow

### How to Create Users

1. **Sign up through the app** at `/auth`
2. **Clerk will create the auth.users record**
3. **Provisioning script** (`src/integrations/clerk/provision.server.ts`) automatically:
   - Creates `clerk_user_map` entry
   - Creates `profile` entry
   - Assigns default "user" role

### How to Make a User Admin

After signing up, run this SQL:

```sql
-- Replace 'USER_ID_HERE' with the actual UUID from clerk_user_map.auth_user_id
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Or use the admin UI at `/admin?tab=users` (if you already have admin access).

---

## Database State

### Current Data Counts:
```
departments: 12
employment_types: 5
status_options: 6
```

### Empty Tables (after reset):
- users (managed by Clerk)
- clerk_user_map
- profiles
- employees
- user_roles
- job_postings
- job_applications
- onboarding_records
- onboarding_documents
- audit_logs
- notifications
- etc.

---

## Next Steps

1. **Sign in/Sign up** through the app
2. **Make your user an admin** (see SQL above)
3. **Start using the system:**
   - Create job postings
   - Accept applications
   - Manage onboarding
   - Review documents

---

## Re-running the Seed

If you need to reset the reference data again:

```bash
cd "/c/Ciago Spark"
npx tsx scripts/seed-reference-data.ts
```

This is safe to run multiple times - it will clear and reseed the 3 tables each time.

---

**Database is ready!** 🎉
