# User Roles Creation Fix ✅

**Date:** 2026-08-01  
**Status:** ✅ Fixed and verified

---

## Problem

When users signed up via Clerk OAuth or email/password, the `user_roles` table was **NOT** being populated. This meant:
- New users had no roles assigned
- Admin checks failed (users couldn't access anything)
- Manual SQL was required to assign roles

---

## Root Cause

The application uses **TWO** provision files:

1. **`provision.server.ts`** (OLD) - Contains role creation code (lines 151-159)
2. **`provision-neon.server.ts`** (ACTIVE) - Missing role creation code

The auth middleware (`src/integrations/neon/auth-middleware.ts:99`) imports from **`provision-neon.server.ts`**, which did NOT have the role creation logic!

```typescript
// THIS FILE WAS BEING USED
src/integrations/clerk/provision-neon.server.ts

// BUT THIS FILE HAD THE ROLE CODE
src/integrations/clerk/provision.server.ts
```

---

## The Fix

Added role creation to `provision-neon.server.ts` inside the transaction block:

### Location: `src/integrations/clerk/provision-neon.server.ts:169-179`

```typescript
// Create default user role if none exists
const existingRole = await tx.userRole.findFirst({
  where: { userId: newAuthUserId },
});

if (!existingRole) {
  await tx.userRole.create({
    data: {
      userId: newAuthUserId,
      role: "user" as any,
    },
  });
}
```

**Why inside the transaction?**
- Ensures atomicity - if user creation fails, no orphan role
- Guarantees consistency - user and role created together
- Prevents race conditions

---

## Files Modified

### 1. `src/integrations/clerk/provision-neon.server.ts`
**Lines 169-179:** Added role creation logic inside transaction

### 2. `src/integrations/clerk/__tests__/provision.server.test.ts`
**Lines 10-14:** Added mockUserRole to mock Prisma client  
**Lines 92-140:** Updated test to verify role creation

### 3. `scripts/test-user-creation.ts` (NEW)
Full integration test that verifies:
- User provisioning
- clerk_user_map entry
- **user_roles entry with role='user'**
- auth.users entry
- Idempotency (no duplicates)

---

## Verification

### Unit Tests
```bash
npm test -- provision.server.test.ts
```

**Result:** ✅ 9/9 tests passed

### Integration Test
```bash
npx tsx scripts/test-user-creation.ts
```

**Result:** ✅ All 6 steps passed
- User provisioned successfully
- clerk_user_map entry created
- **user_roles entry created with role='user'** ✓
- auth.users entry created
- Idempotency verified
- No duplicate roles

---

## How User Creation Works Now

### Sign Up Flow:

1. **User signs up** via `/auth` (OAuth or email/password)

2. **Clerk authenticates** and creates session

3. **Auth middleware runs** (`src/integrations/neon/auth-middleware.ts:99`)
   ```typescript
   const { provisionClerkUser } = await import("@/integrations/clerk/provision-neon.server");
   const prov = await provisionClerkUser(adminDb, {
     clerkUserId,
     email,
     emailVerified,
     fullName,
   });
   ```

4. **Provision function** (atomic transaction):
   - Creates `auth.users` row (raw SQL)
   - Creates `clerk_user_map` entry
   - **Creates `user_roles` entry with role='user'** ← THE FIX

5. **User is authenticated** with proper role

---

## OAuth Callback Fix (Bonus)

Also fixed the OAuth callback redirect issue where users had to click OAuth twice.

### File: `src/routes/auth.sso-callback.tsx`

**Changes:**
- Use Clerk's native hooks (`useClerk`, `useUser`) instead of abstracted `useAuth`
- Wait for `isLoaded` before making decisions
- Check `clerk.session` to detect if still processing
- Added 100ms delay after user loads for session to establish
- Increased timeout from 2s to 5s

---

## Database State

After signup, a user should have:

```sql
-- In clerk_user_map
clerk_user_id | auth_user_id        | email           | primary_email_verified
user_abc123   | uuid-here           | user@email.com  | true

-- In user_roles
id       | user_id    | role  | created_at
uuid-123 | uuid-here  | user  | 2026-08-01 ...

-- In auth.users
id        | email           | email_confirmed_at
uuid-here | user@email.com  | 2026-08-01 ...
```

---

## Testing Checklist

### Manual Test:
- [x] Sign up with new email
- [x] Check `SELECT * FROM user_roles;`
- [x] Verify role='user' exists for new user
- [x] Log in and access protected routes
- [x] OAuth sign-in works on first try (no double-click)

### Automated Tests:
- [x] Unit tests pass (provision.server.test.ts)
- [x] Integration test passes (test-user-creation.ts)
- [x] No duplicate roles created
- [x] Idempotency works (provision twice = same result)

---

## Making Users Admin

### After signup, to promote a user to admin:

```sql
UPDATE user_roles
SET role = 'admin'
WHERE user_id = (
  SELECT auth_user_id 
  FROM clerk_user_map 
  WHERE email = 'user@example.com'
);
```

### Or via Admin UI:
1. Log in as existing admin
2. Navigate to `/admin?tab=users`
3. Click user → Edit
4. Change role to "admin"
5. Save

---

## Why This Happened

During the migration from Supabase to Neon:
1. A new provision file was created (`provision-neon.server.ts`)
2. The auth middleware was updated to use the new file
3. The role creation code was in the OLD file but not copied to NEW file
4. Tests existed but mocked the transaction, so they didn't catch the missing code

**The fix:** Added role creation to the ACTIVE provision file and verified with integration test.

---

## Summary

✅ **Fixed:** User roles now created automatically on signup  
✅ **Verified:** Integration test confirms all flows work  
✅ **Tested:** Unit tests updated and passing  
✅ **Bonus:** OAuth callback no longer requires double-click  

**New users will automatically get `role='user'` assigned!** 🎉

---

## Related Files

**Core Logic:**
- `src/integrations/clerk/provision-neon.server.ts` - Main provision function
- `src/integrations/neon/auth-middleware.ts` - Calls provision on each request

**Auth Flow:**
- `src/routes/auth.tsx` - Sign up/sign in UI
- `src/routes/auth.sso-callback.tsx` - OAuth callback handler
- `src/integrations/clerk/forms.tsx` - Clerk form handlers

**Tests:**
- `src/integrations/clerk/__tests__/provision.server.test.ts` - Unit tests
- `scripts/test-user-creation.ts` - Integration test

**Database:**
- `scripts/reset-database.ts` - Clean slate with reference data
- `scripts/seed-reference-data.ts` - Reference data only
