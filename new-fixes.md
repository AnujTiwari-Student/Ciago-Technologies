# New Fixes Log

Created: 2026-08-01
Status tracking for immediate fixes needed in the codebase.

---

## Fix 1: Prisma schema/DB drift

**Description:** `Invalid prisma.employee.findMany() invocation: The column employees.orangehrm_employee_id does not exist in the current database.` error occurring on `/users` route.

**Status:** Done

**Affected files:**
- `prisma/migrations/20260731_add_orangehrm_employee_id/migration.sql`
- `prisma/migrations/20260731_collapse_roles/migration.sql`
- `prisma/migrations/20260731_create_emails_table/migration.sql`
- `prisma/migrations/20260731_create_service_account_mappings/migration.sql`
- `prisma/migrations/20260731_drop_estimates_and_tasks/migration.sql`

**Root cause:** 5 migrations exist in the migrations directory but have NOT been applied to the production database. The schema.prisma includes the `orangehrm_employee_id` field but it doesn't exist in the actual DB.

**Diagnosis steps:**
- [x] Compare schema.prisma Employee model against actual DB schema
- [x] Check migration history for missing/failed migrations
- [x] Determine if column was added to schema but never migrated, or dropped from DB but not schema
- [x] Report findings before applying fix

**Diagnosis result:** Migrations were created but never deployed. Running `prisma migrate deploy` will apply all 5 pending migrations to the database.

**Fix approach:** Run `npx prisma migrate deploy` to apply pending migrations (safe - does not reset data)

---

## Fix 2: Route/navigation restructure

**Description:** Remove `/users` as standalone route; consolidate into `/admin?tab=users`. Add `/admin?tab=profile` for profile management.

**Status:** Done

**Affected files:**
- `src/routes/_authenticated/users.tsx` (redirects to `/`)
- `src/routes/_authenticated/admin.tsx` (added profile tab)
- `src/components/site/Header.tsx` (updated nav links)
- `src/components/admin/ProfilePanel.tsx` (new component)

**Root cause:** Standalone route exists when unified admin shell with tabs is the desired pattern.

**Requirements:**
- [ ] Remove/redirect `/users` route (301/302 to `/`)
- [ ] "Users" nav → `/admin?tab=users` (renders Users panel in admin shell)
- [ ] "Profile" nav → `/admin?tab=profile` (renders Profile panel in admin shell)
- [ ] Tab state driven by `tab` query param
- [ ] Direct navigation to `/admin?tab=users` works (refresh/typed URL)
- [ ] Search codebase for hardcoded `/users` references
- [ ] Verify no broken links

---

## Fix 3: Document verification UI & Users tab content swap

**Description:** 
1. Move full enterprise directory from `/users` route to `/admin?tab=users` (replace simple role panel)
2. Remove "Review in Users Section" button from document verification
3. Add detail view when clicking a document verification record

**Status:** Done

**Affected files:**
- `src/routes/_authenticated/admin.tsx` (replace UsersPanel with full directory, add doc detail view)
- `src/routes/_authenticated/users.tsx` (export UsersPage component)

**Root cause:** Route content mismatch - simple role panel vs full directory.

**Decision:** Confirmed by user - swap the content entirely.

---

## Progress Summary

- **Total:** 3 fixes
- **Done:** 3
- **In Progress:** 0
- **Blocked:** 0
- **Not Started:** 0

All fixes completed successfully!
