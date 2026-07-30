# Ciago Spark Migration Status

## Current Stage: Stage 2 — COMPLETE
## Next Stage: Stage 3 (Prisma ORM Setup + Schema Definition)

---

## Stage 1: Neon Project Setup + Schema Migration

### Objective
Create Neon project, migrate schema, verify all 26 tables, 8 stored functions, 4 enums, 83 RLS policies (public schema).

### Status
**COMPLETE** ✓

### Root Cause Analysis (prior failure)

The migration script v4 failed due to two distinct root causes:

1. **Batch execution per file**: The script concatenated all filtered SQL statements from each migration file into a single query. When any statement in the batch failed (e.g., a duplicate policy or constraint error), PostgreSQL rejected the entire batch — including critical `CREATE TABLE`, `CREATE TYPE`, and `CREATE FUNCTION` DDL that subsequent files depended on. This caused a cascading failure where 25 out of 37 files failed.

2. **Comment fragment parsing**: SQL line comments (e.g., `-- only service_role writes via server fn`) were not stripped before statement splitting. When a comment appeared after a semicolon mid-line, the splitter treated the comment text as a new SQL statement, producing syntax errors like `syntax error at or near "only"` / `"one"` / `"the"`.

**Fix applied (v5)**:
- Added `stripLineComments()` function that removes line comments outside dollar-quoted blocks before splitting
- Changed execution from per-file batch (`pool.query(allStmtsJoined)`) to per-statement individual execution (`pool.query(singleStmt)`) so failures are isolated and non-blocking

### Files Created
- `scripts/migrate-schema.ts` — schema migration script (v5, working)
- `scripts/neon-validate.ts` — Stage 1 acceptance validation script
- `supabase/migrations-neon.sql` — generated combined SQL (65.7 KB)
- `scripts/neon-check.ts` — debug script (prior attempts)
- `scripts/neon-debug.ts` — debug script (prior attempts)
- `scripts/neon-direct-fetch.ts` — debug script (prior attempts)
- `scripts/neon-multi-query-test.ts` — debug script (prior attempts)
- `scripts/neon-multi-test.ts` — debug script (prior attempts)
- `scripts/neon-pool-test.ts` — debug script (prior attempts)
- `scripts/neon-query-test.ts` — debug script (prior attempts)
- `scripts/neon-tagged-test.ts` — debug script (prior attempts)
- `scripts/debug-split.ts` — debug script (prior attempts)
- `scripts/debug-statements.ts` — debug script (prior attempts)
- `scripts/debug-do.ts` — debug script (prior attempts)

### Files Modified
- `scripts/migrate-schema.ts` — rewritten execution logic (v4 → v5)
- `scripts/neon-validate.ts` — fixed transaction syntax for `@neondatabase/serverless`, corrected RLS count threshold
- `package.json` — added `@neondatabase/serverless` dependency

### Folders Affected
- `scripts/` — migration and validation tooling
- `supabase/` — generated migration output

### Database/Schema Changes (applied to Neon)
- `auth` schema created with `auth.users` table and `auth.uid()` function
- All 26 `public.*` tables created from Supabase migrations
- All 4 enums created (`app_role`, `dept_type`, `job_posting_status`, `job_track_type`)
- All stored functions created (15 total, including 8 documented in plans.md + helpers)
- 83 RLS policies applied (public schema; excludes ~20 `storage.objects` policies migrating to R2)
- Roles created: `anon`, `authenticated`, `service_role` (for policy validation)

### API Changes
- None (infrastructure only)

### Config/Environment Changes
- `NEON_DATABASE_URL` — configured in `.env` (points to Neon serverless endpoint)

### Commands Executed
```
bun run scripts/migrate-schema.ts   # v5 — 279 stmts applied, 0 failed
bun run scripts/neon-validate.ts    # all checks passed
```

### Dependencies Added
- `@neondatabase/serverless@^1.1.0`

### Breaking Changes
- None

### Risks
- The "104+ policies" figure in `plans.md` includes `storage.objects` policies. Actual public-schema net count after DROP/re-CREATE sequences is 83. This is correct and expected since storage moves to R2.

### Validation Performed
All Stage 1 acceptance criteria verified:
- [x] All 26 tables present in Neon
- [x] All 8+ stored functions present (15 total including helpers)
- [x] All 4 enums present
- [x] 83 public RLS policies present (excludes storage.objects → R2)
- [x] `auth.uid()` returns NULL when `app.current_user_id` is unset
- [x] `auth.uid()` returns correct UUID when set via `SET LOCAL` / `set_config`
- [x] `has_role(auth.uid(), 'admin')` executes correctly

### Remaining Work (Stage 1)
- None — Stage 1 is complete

### Next Step
**Stage 2: auth.uid() RLS Compatibility Layer** — Completed.

---

## Stage 2: auth.uid() RLS Compatibility Layer

### Objective
Verify that `auth.uid()` custom function works correctly with RLS policies and `has_role()` integration.

### Status
**COMPLETE** ✓

### Implementation Note
The `auth.uid()` function and `auth.users` table were already created during Stage 1 schema migration. Stage 2 focused on validating the RLS compatibility layer.

### Files Created
- `scripts/stage2-validate.ts` — comprehensive RLS compatibility validation script

### Files Modified
- None (validation only)

### Folders Affected
- `scripts/` — validation tooling

### Database/Schema Changes
- None (validation only — schema already migrated in Stage 1)

### API Changes
- None

### Config/Environment Changes
- None

### Commands Executed
```
bun run scripts/stage2-validate.ts    # all checks passed
```

### Dependencies Added
- None

### Breaking Changes
- None

### Risks
- **RLS enforcement testing limitation**: The `neondb_owner` role (used by `NEON_DATABASE_URL`) bypasses RLS by design. Full RLS enforcement will be verified in Stage 5 when the application uses a limited-privilege connection.

### Validation Performed
All Stage 2 acceptance criteria verified:
- [x] `auth.uid()` returns NULL when `app.current_user_id` is unset
- [x] `auth.uid()` returns correct UUID when set via `set_config(..., true)` (transaction-scoped)
- [x] `has_role(auth.uid(), 'admin')` evaluates correctly for admin users
- [x] `has_role(auth.uid(), 'admin')` evaluates correctly for non-admin users
- [x] User can query own data using `auth.uid()` in WHERE clause
- [x] RLS policies are defined for all 26 public tables
- [x] 78 policies reference `auth.uid()` in USING/WITH CHECK clauses
- [x] 55 policies use `has_role()` for role-based access
- [x] All 26 public tables have RLS enabled (`rowsecurity = true`)
- [x] Multiple `set_config` calls within transaction use the last value
- [x] Owner/service connection bypasses RLS (expected behavior)

### Remaining Work (Stage 2)
- None — Stage 2 is complete

### Next Step
**Stage 3: Prisma ORM Setup + Schema Definition** — Add Prisma ORM, define schema in TypeScript, generate types.

---

## Notes

### Policy Count Discrepancy
`plans.md` states "104+ RLS policies" but this includes:
- ~20 policies on `storage.objects` (Supabase Storage) — these are intentionally excluded because storage migrates to Cloudflare R2
- Net public-schema policies = 83 after accounting for `DROP POLICY IF EXISTS` + re-create patterns in migration history

### Filtered Statements (124 total)
The migration correctly filters out:
- `storage.objects` policies (moving to R2)
- `storage.foldername`/`storage.extension` function references
- `pg_cron` extension and `cron.schedule`/`cron.unschedule` calls
- `GRANT`/`REVOKE` statements to `anon`/`authenticated`/`service_role` (these roles exist in Neon as no-op roles for policy validation only)
