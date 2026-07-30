# Ciago Spark Migration Status

## Current Stage: Stage 3 — IN PROGRESS
## Next Stage: Stage 4 (Clerk Authentication Simplified)

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
**Stage 3: Prisma ORM Setup + Schema Definition** — In progress.

---

## Stage 3 Prerequisite: Scripts Directory Cleanup

### Objective
Fix all TypeScript, lint, and code quality issues in `scripts/` directory before beginning Stage 3.

### Status
**COMPLETE** ✓

### Root Cause Analysis
- **Prettier formatting errors**: 34 auto-fixable formatting issues across multiple scripts
- **TypeScript `any` types**: 13 explicit `any` type annotations in error handling blocks (violation of `@typescript-eslint/no-explicit-any` rule)

### Files Modified
- `scripts/neon-debug.ts` — replaced `any` with `Error` type assertion
- `scripts/neon-direct-fetch.ts` — replaced `any` with `Error` type assertion
- `scripts/neon-multi-query-test.ts` — replaced `any` with `Error` type assertion
- `scripts/neon-multi-test.ts` — replaced `any` with `Error & { message?: string }` type assertion
- `scripts/neon-pool-test.ts` — replaced `any` with `Error` type assertion
- `scripts/neon-query-test.ts` — replaced 4 `any` instances with `Error` type assertion
- `scripts/migrate-schema.ts` — auto-fixed formatting, replaced `any` with `Error & { message?: string }` type assertion
- `scripts/neon-validate.ts` — auto-fixed formatting
- `scripts/stage2-validate.ts` — auto-fixed formatting
- `scripts/debug-statements.ts` — auto-fixed formatting

### Changes Made
1. Ran `bunx eslint --fix scripts/*.ts` to auto-fix all prettier/formatting issues
2. Manually replaced all `catch (e: any)` with `catch (e)` + `const error = e as Error` pattern
3. Used `Error & { message?: string }` type for cases where message might be undefined

### Validation Performed
```
bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck scripts/*.ts
# Result: 0 TypeScript errors

bunx eslint scripts/*.ts
# Result: 0 ESLint errors
```

All 16 TypeScript scripts in `scripts/` directory now pass:
- TypeScript type checking (0 errors)
- ESLint linting (0 errors, 0 warnings)
- Prettier formatting (all formatted)

---

## Stage 3: Prisma ORM Setup + Schema Definition

### Objective
Install Prisma, configure Prisma Client, define all 26 database tables in Prisma schema, generate TypeScript types.

### Status
**COMPLETE** ✓

### Root Cause Analysis (adapter compatibility issue)

**Initial blocker**: Prisma v7 requires a driver adapter for serverless/edge runtimes. The `@prisma/adapter-neon` package failed at runtime with "No database host or connection string was set" despite receiving a valid connection string. Multiple approaches failed:
1. `Pool` from `@neondatabase/serverless` + `PrismaNeon` adapter — connection string parsing error
2. `neon()` function + `PrismaNeon` adapter — same error
3. `new PrismaClient({ datasourceUrl })` — invalid parameter (Prisma v7 doesn't support this)

**Root cause**: The `@prisma/adapter-neon` is designed for Neon's HTTP driver API, not the WebSocket-based pooler connection. Neon's pooler URL uses standard PostgreSQL wire protocol.

**Solution**: Use `@prisma/adapter-pg` with the standard `pg` package's `Pool` class. This works correctly with Neon's PostgreSQL-compatible pooler connection string.

### Files Created
- `scripts/prisma-test.ts` — Prisma Client connection validation script

### Files Modified
- `prisma/schema.prisma` — already existed with all 26 tables, no changes needed
- `prisma.config.ts` — fixed `datasources` → `datasource` (singular), removed nested `db` object
- `src/lib/prisma.ts` — replaced invalid `datasourceUrl` parameter with `@prisma/adapter-pg` + `pg.Pool` approach, added HMR-safe pool singleton
- `scripts/migrate-schema.ts` — fixed last remaining `catch (err: any)` → `catch (err)` with Error type assertion
- `.env` — added `DATABASE_URL` pointing to Neon pooler (already existed from earlier stages)

### Folders Affected
- `prisma/` — schema and configuration
- `src/lib/` — Prisma client singleton
- `scripts/` — validation tooling

### Database/Schema Changes
- None (validation only — schema already migrated in Stage 1)

### API Changes
- **Breaking change in `src/lib/prisma.ts`**: Now requires `DATABASE_URL` environment variable (no longer supports `datasourceUrl` parameter)
- Prisma Client exports unchanged (all 26 models available)

### Config/Environment Changes
- `DATABASE_URL` — already configured in `.env` (points to Neon pooler)

### Commands Executed
```bash
bun add @prisma/adapter-pg pg                # Install PostgreSQL adapter
bunx prisma generate                         # Generate Prisma Client with types
bun run scripts/prisma-test.ts               # Validate connection and all 26 models
```

### Dependencies Added
- `@prisma/adapter-pg@^7.9.1`
- `pg@^8.22.0`

### Dependencies Removed
- None (kept `@prisma/adapter-neon` for reference, unused)

### Breaking Changes
- `src/lib/prisma.ts` now requires `pg` package and uses adapter pattern
- Direct `new PrismaClient()` without adapter will fail in serverless environments

### Risks
- None — standard PostgreSQL driver is more stable than Neon-specific adapter

### Validation Performed
All Stage 3 acceptance criteria verified via `scripts/prisma-test.ts`:
- [x] Prisma Client connects to Neon successfully
- [x] All 26 public tables visible (verified via information_schema query)
- [x] All 26 Prisma models available and queryable
- [x] Sample queries execute successfully (user_roles, profiles, departments)
- [x] Prisma schema validates (`bunx prisma validate`)
- [x] Prisma Client generates successfully (`bunx prisma generate`)
- [x] TypeScript compilation passes for `src/lib/prisma.ts`

### Remaining Work (Stage 3)
- None — Stage 3 is complete

### Next Step
**Stage 4: Clerk Authentication Simplified** — Remove GoTrue issuance path, use Neon/Prisma directly.

---

## Stage 4: Clerk Authentication Simplified (Remove GoTrue)

### Objective
Replace Clerk+GoTrue JWT flow with direct Neon/Prisma RLS context, bypassing GoTrue JWT issuance entirely.

### Status
**IN PROGRESS** — Infrastructure complete, awaiting testing and server function migration

### Implementation Summary

Added a third authentication branch to `auth-middleware.ts` controlled by `USE_NEON_DB` flag:
- **Legacy branch** (USE_CLERK_AUTH=false): Supabase-only, unchanged
- **Clerk+GoTrue branch** (USE_CLERK_AUTH=true, USE_NEON_DB=false): Issues GoTrue JWT, existing flow
- **Neon branch** (USE_CLERK_AUTH=true, USE_NEON_DB=true): Direct Prisma with RLS, no GoTrue JWT

### Files Created
- `src/lib/db/neon.ts` — Neon database connection utilities
  - `createUserDb(url, userId)` — Returns `UserPrismaClient` with automatic RLS via `withRLS()` wrapper
  - `createAdminDb(url)` — Returns standard `PrismaClient` (bypasses RLS)
- `src/integrations/clerk/provision-neon.server.ts` — Prisma port of `provision.server.ts`
  - `provisionClerkUser()` — Creates auth.users + clerk_user_map entries via Prisma
  - Uses raw SQL for auth.users (not in Prisma schema)
  - Identical idempotent logic to Supabase version
- `src/integrations/neon/auth-middleware.ts` — Standalone Neon middleware (reference implementation)

### Files Modified
- `src/lib/feature-flags.ts` — Added `USE_NEON_DB` flag (default: false)
- `src/integrations/supabase/auth-middleware.ts` — Added `neonAuthBranch()` alongside existing branches
- `prisma/schema.prisma` — Fixed `ClerkUserMap` model to include missing columns:
  - `email` (String?, unique)
  - `primaryEmailVerified` (Boolean, default false)
  - Added indexes matching database schema

### Neon Branch Flow
1. Extract Bearer token from Authorization header
2. Verify Clerk JWT via `@clerk/backend.verifyToken()`
3. Look up `auth_user_id` from `clerk_user_map` (Neon/Prisma)
4. If not found, provision user:
   - Fetch Clerk user details
   - Create `auth.users` row via raw SQL
   - Create `clerk_user_map` entry via Prisma
5. Create user-scoped Prisma client via `createUserDb(DATABASE_URL, authUserId)`
6. Inject context: `{ db: UserPrismaClient, userId: string, claims: Record<string, unknown> }`

### UserPrismaClient API
Server functions must use the `withRLS()` wrapper for all queries:

```typescript
// CORRECT — enforces RLS
const roles = await context.db.withRLS(tx =>
  tx.userRole.findMany({ where: { userId: context.userId } })
);

// WRONG — bypasses RLS (use context.db.unsafe only for system operations)
const roles = await context.db.userRole.findMany(...);
```

### Dependencies Added
None (reuses existing `@prisma/client`, `@prisma/adapter-pg`, `pg`)

### Breaking Changes
- Context shape changes when USE_NEON_DB=true:
  - `context.supabase` → `context.db` (type: `UserPrismaClient` not `SupabaseClient`)
  - All queries must use `db.withRLS(tx => ...)` pattern for RLS enforcement
  - `SET LOCAL app.current_user_id` happens automatically per query

### Risks
- **Server function migration required**: All 28+ server functions using `context.supabase` must be updated to use `context.db.withRLS()`
- **Type incompatibility**: `UserPrismaClient` is structurally different from `SupabaseClient`, may cause type errors
- **Transaction semantics**: Every query wrapped in transaction (performance impact unknown)

### Validation Performed
- [x] Prisma schema updated with correct `clerk_user_map` columns
- [x] Prisma Client regenerated successfully
- [x] TypeScript compilation passes for new files
- [ ] Auth middleware tested with USE_NEON_DB=true
- [ ] clerk_user_map lookup verified
- [ ] Provision flow tested (new user creation)
- [ ] RLS context verified (`auth.uid()` returns correct value)
- [ ] Server function migration (Stage 5)

### Remaining Work (Stage 4)
1. Test neonAuthBranch with live Clerk token
2. Verify provision flow creates correct auth.users + clerk_user_map entries
3. Validate RLS context is set correctly (`auth.uid()` works)
4. Update documentation with migration guide for server functions
5. Stage 5: Migrate all server functions from `context.supabase` to `context.db.withRLS()`

### Next Step
**Stage 5: Database Client Migration** — Update all server functions to use Prisma instead of Supabase client.

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
