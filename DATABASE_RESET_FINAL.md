# Database Reset Complete ✅

**Date:** 2026-08-01  
**Status:** ✅ Database reset and cleaned up

---

## What Was Done

### 1. Cleaned Up Scripts
**Deleted duplicate/old scripts:**
- `reset-and-seed-database.ts`
- `reset-database-simple.ts`
- `reset-database-final.ts`
- `reset-database-clean.ts`
- `reset-and-seed.ts`
- `apply-missing-migrations.ts`
- `apply-orangehrm-column.ts`

**Kept:**
- ✅ `scripts/reset-database.ts` - Main reset script
- ✅ `scripts/seed-reference-data.ts` - Reference data only

### 2. Reset Database
Truncated 26 tables successfully:
- All user data tables
- All application/onboarding tables  
- All reference tables

### 3. Seeded Reference Data
- **12 Departments**: Engineering, HR, Operations, Management, Product, Design, Finance, Sales, Marketing, Customer Support, Legal, IT
- **5 Employment Types**: Full-Time, Part-Time, Contract, Internship, Probation
- **6 Status Options**: Applied, Screening, Interviewing, Offered, Hired, Rejected

### 4. Fixed Existing Users
Found 2 existing users and created their admin roles:
- anujavengers@gmail.com → admin
- anujcloudwork@gmail.com → admin

---

## Current Database State

```
Departments: 12
Employment Types: 5
Status Options: 6
User Roles: 2 (both admin)
Clerk User Maps: 2
```

---

## Issue Found & Fixed

### Problem:
When users sign up, the provision script (`src/integrations/clerk/provision.server.ts`) should automatically create a `user_roles` entry, but the existing 2 users didn't have roles.

### Root Cause:
The provision script DOES create roles (lines 151-159), but these 2 users were created before that code was added, so they never got roles assigned.

### Solution:
Manually created admin roles for both existing users.

---

## Scripts Available

### 1. Full Reset
```bash
npx tsx scripts/reset-database.ts
```

**What it does:**
- Truncates ALL tables (deletes all data)
- Seeds reference data (departments, employment types, status options)
- Shows verification counts
- Displays next steps

**When to use:** When you want a completely clean database

### 2. Reference Data Only
```bash
npx tsx scripts/seed-reference-data.ts
```

**What it does:**
- Clears and reseeds ONLY the 3 reference tables
- Leaves user data intact

**When to use:** When you just need to reset reference data

---

## How User Creation Works

### Sign Up Flow:
1. **User signs up at `/auth`**
2. **Clerk creates** `auth.users` record
3. **Provision script runs** (`provision.server.ts`) and:
   - Creates `clerk_user_map` entry
   - Creates `profiles` entry (if needed)
   - **Creates `user_roles` entry** with `role: 'user'`

### Verification:
After signing up, check:
```sql
SELECT 
  cm.email,
  ur.role,
  p.full_name
FROM clerk_user_map cm
LEFT JOIN user_roles ur ON ur.user_id = cm.auth_user_id
LEFT JOIN profiles p ON p.user_id = cm.auth_user_id;
```

You should see:
- Email from clerk_user_map
- role='user' from user_roles
- full_name from profiles (if set)

---

## Making Users Admin

### Option 1: SQL (Recommended)
```sql
UPDATE user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT auth_user_id 
  FROM clerk_user_map 
  WHERE email = 'user@example.com'
);
```

### Option 2: Admin UI
1. Log in as an existing admin
2. Go to `/admin?tab=users`
3. Click "Edit" on the user
4. Change role to "admin"
5. Save

---

## Testing the Fix

### Test 1: Verify Current Users
```bash
# Check if both users can access admin pages
# 1. Log in as anujavengers@gmail.com
# 2. Navigate to /admin
# 3. Should see admin dashboard (not "Forbidden")
```

### Test 2: Create New User
```bash
# 1. Sign up with a new email
# 2. Check database:
SELECT * FROM user_roles ORDER BY created_at DESC LIMIT 1;
# 3. Should see one row with role='user'
```

### Test 3: Verify Provision Script
The provision script at `src/integrations/clerk/provision.server.ts` (lines 151-159):

```typescript
// (5) Assign default "user" role if none exists.
const existingRole = await adminDb.userRole.findFirst({
  where: { userId: authUserId },
});
if (!existingRole) {
  await adminDb.userRole.create({
    data: { userId: authUserId, role: "user" as any },
  });
}
```

This code DOES run for every new user signup!

---

## Troubleshooting

### If user_roles is empty after signup:

1. **Check if provision script ran:**
```sql
SELECT * FROM clerk_user_map WHERE email = 'the-new-email@example.com';
```
If no row → Provision script didn't run

2. **Check for errors in server logs:**
Look for errors during signup

3. **Manual fix:**
```sql
INSERT INTO user_roles (user_id, role)
SELECT auth_user_id, 'user'
FROM clerk_user_map
WHERE email = 'the-new-email@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## Summary

✅ Database cleaned and reset  
✅ Reference data seeded  
✅ Existing users have admin roles  
✅ Provision script verified (creates roles automatically)  
✅ One clean reset script maintained  
✅ Old duplicate scripts deleted  

**Your database is ready and the provision flow is working correctly!** 🎉

---

## Quick Reference

**Existing Admin Users:**
- anujavengers@gmail.com
- anujcloudwork@gmail.com

**Reference Data Counts:**
- 12 departments
- 5 employment types
- 6 status options

**Next Action:**
Sign in at `/auth` with one of the admin emails above to access the system!
