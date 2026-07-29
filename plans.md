# Ciago Technologies — Migration Planning

> **PHASE 2 DELIVERABLE — DO NOT IMPLEMENT**
>
> This is an exhaustive planning document only. No code changes should be made
> based on this document without explicit approval and a dedicated implementation
> session. The goal is that any engineer or AI can execute the migration
> correctly using only this document, without re-discovering the codebase.

---

## Document Status

| Section                   | Status      | Last Updated |
| ------------------------- | ----------- | ------------ |
| Executive Summary         | ✅ Complete | 2026-07-29   |
| Existing Architecture     | ✅ Complete | 2026-07-29   |
| Proposed Architecture     | ✅ Complete | 2026-07-29   |
| Database Schema Audit     | ✅ Complete | 2026-07-29   |
| Storage Audit             | ✅ Complete | 2026-07-29   |
| RLS Strategy              | ✅ Complete | 2026-07-29   |
| Clerk Changes             | ✅ Complete | 2026-07-29   |
| Migration Stages          | ✅ Complete | 2026-07-29   |
| File-by-File Plan         | ✅ Complete | 2026-07-29   |
| Environment Variables     | ✅ Complete | 2026-07-29   |
| Testing Strategy          | ✅ Complete | 2026-07-29   |
| Security Checklist        | ✅ Complete | 2026-07-29   |
| Rollback Strategy         | ✅ Complete | 2026-07-29   |
| Cost Analysis             | ✅ Complete | 2026-07-29   |
| Observability             | ✅ Complete | 2026-07-29   |
| Final Readiness Checklist | ✅ Complete | 2026-07-29   |

---

## Executive Summary

### What Is Being Migrated

Ciago Spark currently runs on **Lovable Cloud Supabase** which provides three
integrated services:

1. **Database**: PostgreSQL 15 with GoTrue auth, PostgREST API, Row Level Security
2. **Auth**: Supabase GoTrue — manages `auth.users`, JWTs, sessions, OAuth
3. **Storage**: Supabase Storage — object storage for resumes, avatars, documents

The migration moves to:

1. **Database**: **Neon** — serverless PostgreSQL with branching and scale-to-zero
2. **Storage**: **Cloudflare R2** — S3-compatible object storage at Cloudflare edge
3. **ORM/Query Layer**: **Prisma ORM** — type-safe SQL query builder for Neon
4. **Auth**: Continue using **Clerk** (already implemented) + **Neon** as user identity store

### Why This Migration

| Concern             | Supabase Cloud                | Neon + R2                                       |
| ------------------- | ----------------------------- | ----------------------------------------------- |
| Database branching  | No                            | Yes — instant schema previews                   |
| Scale to zero       | No                            | Yes — cost-efficient dev/staging                |
| Edge runtime        | HTTP only (PostgREST)         | Native serverless driver for Cloudflare Workers |
| Storage costs       | Supabase tier pricing         | R2 has no egress fees                           |
| Vendor lock-in      | High (GoTrue, PostgREST, RLS) | Low (standard Postgres + S3 API)                |
| Deployment platform | Lovable Cloud only            | Self-hosted or any cloud                        |
| Performance         | PostgREST HTTP roundtrip      | Direct connection pool (10x lower latency)      |
| SQL flexibility     | Limited via PostgREST         | Full SQL via Prisma                             |

### Migration Complexity

**HIGH**. This is a structural migration that touches:

- Every server function (`*.functions.ts`) — queries rewritten from PostgREST to Prisma SQL
- Authentication middleware — GoTrue JWT replaced with Clerk JWT + Neon app-level JWT claims
- Storage layer — 4 buckets, all upload/download/signed URL logic
- RLS policies — 104+ policies preserved verbatim but with custom `auth.uid()` function
- Environment variables — all Supabase variables replaced with Neon + R2 variables

---

## Existing Architecture

### Technology Stack (Current)

| Component     | Technology                          | Version       |
| ------------- | ----------------------------------- | ------------- |
| Framework     | TanStack Start + React              | 19.x          |
| Runtime       | Bun                                 | Latest        |
| Build         | Vite                                | 8.x           |
| Deployment    | Cloudflare Workers (Nitro preset)   | -             |
| Database      | Supabase PostgreSQL (Lovable Cloud) | PostgreSQL 15 |
| DB Client     | `@supabase/supabase-js`             | 2.110.x       |
| Auth          | Supabase GoTrue + Clerk (gated)     | -             |
| Storage       | Supabase Storage (S3-like)          | -             |
| Feature Flags | ConfigCat                           | 1.x           |
| Routing       | TanStack Router                     | 1.170.x       |

### Current Database Architecture

```
Lovable Cloud Supabase
  ├── auth.users              (GoTrue managed — UUIDs for all user FKs)
  ├── auth.sessions           (GoTrue managed)
  ├── public schema (26 tables)
  │   ├── clerk_user_map      (Clerk ID → auth.users UUID mapping)
  │   ├── user_roles          (app_role enum: admin|hr|manager|employee|...)
  │   ├── employees           (core HR record per user)
  │   ├── profiles            (public profile data)
  │   ├── departments         (department reference)
  │   ├── employment_types    (employment type reference)
  │   ├── status_options      (status option reference)
  │   ├── job_postings        (public + internal job listings)
  │   ├── job_applications    (candidate applications)
  │   ├── onboarding_records  (onboarding workflow state)
  │   ├── onboarding_documents (document uploads during onboarding)
  │   ├── interview_slots     (interview scheduling)
  │   ├── leave_requests      (leave management)
  │   ├── attendance_records  (daily attendance)
  │   ├── timesheets          (time tracking)
  │   ├── referrals           (employee referrals)
  │   ├── salary_structures   (compensation structures)
  │   ├── salary_slips        (monthly payslips)
  │   ├── resignations        (resignation management)
  │   ├── employee_tasks      (task management)
  │   ├── identity_documents  (ID verification records)
  │   ├── audit_logs          (audit trail)
  │   ├── in_app_notifications (notification system)
  │   ├── rate_limits         (API rate limiting)
  │   ├── project_estimates   (service inquiry leads)
  │   └── resource_downloads  (marketing resource tracking)
  ├── Stored Functions (8)
  │   ├── has_role(user_id, role)
  │   ├── is_admin_user(uid)
  │   ├── admin_set_user_role(...)
  │   ├── apply_for_role(...)
  │   ├── complete_onboarding(id)
  │   ├── finalize_onboarding_role(id)
  │   ├── list_directory()
  │   └── prune_rate_limits()
  ├── Enums (4)
  │   ├── app_role: admin|moderator|user|employee|hr|manager
  │   ├── dept_type: engineering|operations|human_resource|...
  │   ├── job_posting_status: draft|published|internal_only|closed|archived
  │   └── job_track_type: standard|manager_track|hr_track
  └── RLS (104+ policies — all route through auth.uid())
```

### Current Storage Architecture

| Bucket            | Usage                          | Access Pattern                               | File Types     |
| ----------------- | ------------------------------ | -------------------------------------------- | -------------- |
| `resumes`         | Job application PDFs           | Private, user-scoped RLS                     | PDF            |
| `avatars`         | Profile photos                 | Read: authenticated users, Write: owner only | JPG, PNG, WEBP |
| `onboarding-docs` | Onboarding document uploads    | Private, user-scoped + staff read            | PDF, JPG, PNG  |
| `identity-docs`   | Employee identity verification | Private, user + admin/HR read                | PDF, JPG, PNG  |

Storage is accessed via:

- `supabase.storage.from('bucket').upload(path, file)` — direct uploads
- `supabase.storage.from('bucket').createSignedUrl(path, expiry)` — time-limited reads
- `supabase.storage.from('bucket').getPublicUrl(path)` — public reads (avatars)
- `supabaseAdmin.storage.from('bucket').remove([path])` — admin deletions

### Current Authentication Architecture

```
Request arrives at Cloudflare Worker
  ↓
TanStack Start middleware (auth-middleware.ts)
  ↓
┌─────────────────────────────────────────┐
│ IF FLAGS.USE_CLERK_AUTH = false (legacy) │
│   1. Extract Bearer token from request  │
│   2. supabase.auth.getClaims(token)     │
│   3. Build per-user Supabase client     │
│   4. Inject { supabase, userId, claims }│
└─────────────────────────────────────────┘
         OR
┌─────────────────────────────────────────┐
│ IF FLAGS.USE_CLERK_AUTH = true (Clerk)  │
│   1. Extract Clerk session token        │
│   2. Clerk verifyToken()                │
│   3. Provision user in clerk_user_map   │
│   4. Issue GoTrue JWT via generateLink  │
│   5. Build per-user Supabase client     │
│      with GoTrue JWT as Bearer          │
│   6. Inject { supabase, userId, claims }│
└─────────────────────────────────────────┘
  ↓
Server function accesses context.supabase
— RLS applies via auth.uid() from JWT sub
```

### Current Application Structure

```
src/
├── routes/
│   ├── __root.tsx                    # App shell, providers
│   ├── _authenticated/               # Protected route group
│   │   ├── -guard.ts                 # Auth guard helpers
│   │   ├── admin.tsx                 # Admin portal
│   │   ├── hr.tsx                    # HR portal
│   │   ├── manager.tsx               # Manager portal
│   │   ├── employee.tsx              # Employee portal
│   │   ├── onboarding.tsx            # Onboarding flow
│   │   ├── users.tsx                 # User management
│   │   ├── profile.tsx               # User profile
│   │   └── my-applications.tsx       # Job application tracking
│   ├── auth.tsx                      # Auth forms
│   ├── careers.tsx                   # Public careers page
│   └── index.tsx                     # Landing page
├── integrations/
│   ├── supabase/
│   │   ├── client.ts                 # Public Supabase client (browser)
│   │   ├── client.server.ts          # Admin Supabase client (service role)
│   │   ├── auth-middleware.ts        # Auth extraction + Supabase client factory
│   │   ├── auth-attacher.ts          # Client-side token attacher
│   │   └── types.ts                  # Auto-generated Supabase TypeScript types
│   └── clerk/
│       ├── client.tsx                # ClerkProviderBoundary
│       ├── forms.tsx                 # Auth forms
│       ├── provision.server.ts       # User provisioning
│       ├── issue-token.server.ts     # GoTrue JWT issuance (Neon migration removes this)
│       └── ensure-mapping.server.ts  # First-login mapping
└── lib/
    ├── feature-flags.ts              # Flag constants, types, defaults
    ├── feature-flags.server.ts       # ConfigCat server integration
    ├── feature-flags.client.tsx      # ConfigCat client hooks
    ├── feature-flags.functions.ts    # Server functions for flag fetch
    ├── roles.functions.ts            # Role resolution server functions
    ├── admin.functions.ts            # Admin portal server functions
    ├── hr.functions.ts               # HR portal server functions
    ├── employee.functions.ts         # Employee portal server functions
    ├── onboarding.functions.ts       # Onboarding server functions
    ├── applications.functions.ts     # Job application server functions
    ├── profile.functions.ts          # Profile server functions
    ├── users.functions.ts            # User management server functions
    └── portal.functions.ts           # Portal resolution server function
```

---

## Proposed Architecture

### Target Technology Stack

| Component     | Technology                                      | Version            |
| ------------- | ----------------------------------------------- | ------------------ |
| Framework     | TanStack Start + React                          | 19.x (unchanged)   |
| Runtime       | Bun                                             | Latest (unchanged) |
| Build         | Vite                                            | 8.x (unchanged)    |
| Deployment    | Cloudflare Workers (Nitro)                      | (unchanged)        |
| Database      | **Neon** serverless PostgreSQL                  | PostgreSQL 16      |
| DB Client     | **`@neondatabase/serverless`** + **Prisma ORM** | Latest             |
| Auth          | **Clerk** (only — GoTrue removed)               | 5.x                |
| Storage       | **Cloudflare R2**                               | S3-compatible      |
| Feature Flags | ConfigCat                                       | 1.x (unchanged)    |

### Target Database Architecture

```
Neon Serverless PostgreSQL
  ├── auth schema (custom — replaces Supabase GoTrue auth schema)
  │   ├── auth.users              (migrated from Supabase — same UUID primary keys)
  │   └── auth.uid()              (custom function — reads from tx-level JWT claim)
  ├── public schema (26 tables — UNCHANGED from Supabase)
  │   ├── clerk_user_map          (UNCHANGED — Clerk ID → auth.users UUID)
  │   ├── user_roles              (UNCHANGED)
  │   ├── employees               (UNCHANGED)
  │   ├── profiles                (UNCHANGED)
  │   └── ... (all 26 tables preserved verbatim)
  ├── Stored Functions (UNCHANGED — all 8 preserved)
  ├── Enums (UNCHANGED — all 4 preserved)
  └── RLS (UNCHANGED — all 104+ policies preserved verbatim via custom auth.uid())
```

### Target Storage Architecture

```
Cloudflare R2 Account
  ├── ciago-resumes         (migrated from Supabase resumes bucket)
  ├── ciago-avatars         (migrated from Supabase avatars bucket)
  ├── ciago-onboarding-docs (migrated from Supabase onboarding-docs bucket)
  └── ciago-identity-docs   (migrated from Supabase identity-docs bucket)
```

All R2 buckets:

- Private by default
- Accessed via Workers R2 binding or AWS S3-compatible API
- Signed URL generation via Cloudflare R2 Presigned URLs (S3 compatible)
- CDN via Cloudflare cache layer (no egress fees)

### Target Authentication Architecture

```
Request arrives at Cloudflare Worker
  ↓
TanStack Start middleware (auth-middleware.ts — REWRITTEN)
  ↓
┌──────────────────────────────────────────────┐
│ Clerk JWT verification only (GoTrue removed)  │
│   1. Extract Clerk session token from request │
│   2. Clerk verifyToken()                      │
│   3. Look up auth_user_id in clerk_user_map   │
│   4. Build Neon connection with SET LOCAL     │
│      app.current_user_id = '<uuid>'           │
│   5. Inject { db, userId, claims }            │
└──────────────────────────────────────────────┘
  ↓
Server function accesses context.db (Prisma)
— RLS applies via auth.uid() custom function
  reading current_setting('app.current_user_id')
```

---

## Why Migrate

### Pros of Migrating to Neon + R2

| Benefit                      | Detail                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No HTTP overhead**         | Supabase PostgREST adds an HTTP layer for every query. Neon's serverless driver connects directly to Postgres. Expected latency reduction: 50–200ms per request. |
| **Branching**                | Neon's instant schema branching enables preview environments per PR — impossible on Supabase Cloud.                                                              |
| **Scale to zero**            | Neon auto-suspends after inactivity. Eliminates Supabase's base compute cost for dev/staging branches.                                                           |
| **No R2 egress fees**        | Supabase Storage charges egress. Cloudflare R2 has zero egress fees for objects served via Workers or public CDN.                                                |
| **Cloudflare-native**        | The entire stack runs on Cloudflare: Workers (compute) + R2 (storage) + Neon (via Cloudflare partnership). Co-location reduces latency further.                  |
| **Full SQL**                 | Prisma gives full SQL access (CTEs, window functions, complex JOINs) without PostgREST limitations.                                                              |
| **Remove GoTrue dependency** | GoTrue JWT issuance (`issue-token.server.ts`) is complex, fragile, and slow. With Neon, we use Clerk JWTs directly — removing ~150 lines of auth scaffolding.    |
| **Type safety**              | Prisma's inferred types eliminate the need for manually maintaining `src/integrations/supabase/types.ts` (1200+ lines).                                          |

### Cons and Trade-offs

| Risk                           | Mitigation                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Large migration scope**      | Use feature flags (`neonMigrationEnabled`) to switch incrementally                                  |
| **PostgREST API loss**         | Replaced by Prisma — all query logic must be rewritten                                              |
| **Supabase Realtime loss**     | Not currently used — not a blocker                                                                  |
| **Supabase Dashboard loss**    | Neon console + pgAdmin available as alternatives                                                    |
| **Lovable Cloud dependencies** | Lovable uses Supabase for project infrastructure — self-hosted Supabase client code is already ours |

---

## Risks

| Risk                                       | Severity     | Probability | Mitigation                                                           |
| ------------------------------------------ | ------------ | ----------- | -------------------------------------------------------------------- |
| auth.uid() RLS incompatibility             | **Critical** | High        | Pre-migrate RLS with custom function tested on Neon fork             |
| Data loss during migration                 | **Critical** | Low         | Use Neon branching for zero-risk dry runs                            |
| GoTrue JWT issuance failure during cutover | **Critical** | Medium      | Switch to direct Clerk JWT first (Step 4)                            |
| Storage URL breakage                       | **High**     | High        | Pre-migrate using redirect rules; update all storage_path references |
| TypeScript type mismatch after Prisma      | **High**     | Medium      | Auto-generate Prisma types from schema; verify each function         |
| Clerk user map sync loss                   | **High**     | Low         | Verify all clerk_user_map rows before cutover                        |
| RLS policy gaps                            | **High**     | Low         | Run existing RLS audit test suite against Neon                       |
| Downtime during cutover                    | **Medium**   | Medium      | Use zero-downtime dual-write pattern (described in Stage 7)          |

---

## Migration Strategy

### Overall Approach: Parallel Run with Feature Flag Cutover

The migration will use the **existing `neonMigrationEnabled` feature flag** (defined in
`src/lib/feature-flags.ts`) to progressively switch the application from Supabase to Neon.
This enables:

1. **Zero-downtime cutover**: Old and new code paths coexist behind the flag
2. **Instant rollback**: Disable flag → immediate revert to Supabase
3. **Progressive validation**: Enable flag for admins first, then all users

### Stage Map

```
Stage 1: Neon Project Setup + Schema Migration
Stage 2: auth.uid() RLS Compatibility Layer
Stage 3: Prisma ORM Setup + Schema Definition
Stage 4: Clerk Authentication Simplified (remove GoTrue)
Stage 5: Database Client Migration (function by function)
Stage 6: Storage Migration (Supabase → Cloudflare R2)
Stage 7: Dual-Write Period + Validation
Stage 8: Cutover + Decommission Supabase
```

---

## Rollback Strategy

### Per-Stage Rollback

Each stage can be individually rolled back:

- **Stages 1–3**: Infrastructure only — no application code changed. Rollback = delete Neon project.
- **Stage 4**: Clerk simplification — rollback = re-enable GoTrue issuance path (preserved in git).
- **Stage 5**: All new queries are behind `neonMigrationEnabled` flag. Rollback = disable flag.
- **Stage 6**: Storage migration uses new R2 paths. Old Supabase paths remain live. Rollback = disable r2StorageEnabled flag.
- **Stage 7**: Dual-write — both Supabase and Neon remain live. Rollback = switch writes back to Supabase.
- **Stage 8**: Full cutover — keep Supabase credentials in Doppler for 30 days. Rollback = re-enable Supabase path.

### Emergency Rollback (All Stages)

```bash
# Disable both migration flags in ConfigCat
# - neonMigrationEnabled → OFF
# - r2StorageEnabled → OFF
# All traffic routes to Supabase immediately
# No deployment required
```

---

## Zero Downtime Strategy

1. **Dual-write**: During Stage 7, all writes go to both Supabase and Neon simultaneously.
2. **Read migration**: Gradually shift reads to Neon under feature flag.
3. **Validation**: Run diff tool to verify Supabase and Neon data match.
4. **Cut reads**: Disable Supabase reads once Neon validates 100%.
5. **Cut writes**: Stop Supabase writes. Neon is now primary.
6. **Decommission**: Remove Supabase after 30-day retention period.

---

## Backward Compatibility

### What Does NOT Change

- All 26 `public.*` table names
- All column names and types
- All primary key formats (UUIDs)
- All foreign key relationships
- All enum values
- All 104+ RLS policy logic
- All 8 stored functions
- Clerk user IDs (opaque strings)
- `clerk_user_map` schema and data
- `auth.users` table schema (custom clone, same UUID PKs)
- Application-level `user_id` everywhere references the same auth.users UUIDs

### What Changes

- `context.supabase` → `context.db` (Prisma instance) in all server functions
- `supabase.from('table')` → `db.select().from(schema.table)` (Prisma queries)
- `supabase.storage.from('bucket')` → `env.R2_BUCKET.put/get/createSignedUrl`
- `supabase.auth.*` → removed (Clerk only)
- GoTrue JWT issuance → removed (Clerk JWT passed directly)
- `src/integrations/supabase/types.ts` → replaced by Prisma schema types

---

## Security Review

### Authentication

| Concern          | Current                         | Post-Migration           | Status        |
| ---------------- | ------------------------------- | ------------------------ | ------------- |
| JWT verification | Supabase GoTrue or Clerk        | Clerk only               | ✅ Improved   |
| JWT expiry       | GoTrue 1hr / Clerk configurable | Clerk configurable       | ✅ Maintained |
| Token rotation   | GoTrue refresh tokens           | Clerk session tokens     | ✅ Maintained |
| MITM protection  | HTTPS + SameSite cookies        | HTTPS + SameSite cookies | ✅ Unchanged  |

### RLS Security

All 104 RLS policies continue to enforce the same rules. The only change is the
implementation of `auth.uid()` — from GoTrue's built-in function to a custom
PostgreSQL function reading `current_setting('app.current_user_id', true)`.

**Critical**: The `app.current_user_id` setting MUST be set within a transaction and
must NEVER be set to a hard-coded value. The Neon middleware must:

1. Verify the Clerk JWT first
2. Look up the mapped `auth_user_id` from `clerk_user_map`
3. Only THEN execute `SET LOCAL app.current_user_id = '<verified_uuid>'`

Any path that sets this value without prior JWT verification is a critical vulnerability.

### Service Role Access

The service role (`supabaseAdmin`) bypasses RLS. Post-migration, the equivalent is
a Neon connection using the admin/owner credentials — NOT the connection-pool connection
used for user queries. These MUST remain separate clients.

### Storage Security

R2 access must be exclusively via Workers bindings or signed URLs. The R2 bucket
must NEVER be set to public access. All client downloads must go through
a Worker that validates authentication before generating a signed URL.

---

## Performance Review

### Expected Improvements

| Metric                | Supabase PostgREST         | Neon Direct                 | Improvement |
| --------------------- | -------------------------- | --------------------------- | ----------- |
| Simple SELECT latency | ~50–200ms (HTTP roundtrip) | ~5–20ms (direct connection) | 5–10x       |
| Complex JOIN query    | ~150–500ms                 | ~20–80ms                    | 5–8x        |
| Storage upload (10MB) | ~500ms–2s                  | ~200ms–800ms                | 2–3x        |
| Storage signed URL    | ~100ms                     | ~10ms                       | 10x         |
| Cold start (Workers)  | N/A                        | Neon HTTP driver            | Sub-100ms   |

### Potential Regressions

- **Connection pooling overhead**: Neon uses PgBouncer pooling. Deep query parallelism
  may cause connection contention. Mitigate: configure pool size and use `REPEATABLE READ`
  isolation level where needed.
- **Transaction RLS overhead**: Setting `app.current_user_id` per transaction adds ~1ms.
  Accept this cost — it's still faster than GoTrue JWT issuance.

---

## Scalability Review

### Neon

- **Serverless compute**: Scale to zero, scale to thousands of CUs automatically
- **Branching**: Each PR/staging branch = isolated database snapshot
- **Connection pooling**: PgBouncer handles burst connections; Workers don't maintain
  persistent connections so pooling is critical

### Cloudflare R2

- **Global distribution**: R2 serves from Cloudflare edge globally
- **No egress fees**: Cost scales linearly with storage, not reads
- **5GB/month free tier**: Sufficient for development/staging
- **Workers native binding**: Zero-latency access from Cloudflare Workers

---

## Cost Analysis

### Current (Supabase Cloud)

| Service                | Plan           | Monthly Cost                     |
| ---------------------- | -------------- | -------------------------------- |
| Supabase Lovable Cloud | Pro (managed)  | Included in Lovable subscription |
| Supabase Storage       | 100GB included | ~$0–25/mo                        |
| Database compute       | Always-on      | Included in Lovable              |

### Target (Neon + R2)

| Service            | Plan                             | Monthly Cost |
| ------------------ | -------------------------------- | ------------ |
| Neon               | Free (dev) / Scale ($69/mo prod) | $0–69/mo     |
| Neon branching     | Included                         | $0           |
| Cloudflare R2      | $0.015/GB storage + $0 egress    | ~$2–10/mo    |
| Cloudflare Workers | First 100K req/day free          | $0–5/mo      |

**Estimated savings**: $15–50/month for production; development branches cost $0.

---

## Database Architecture

### Schema Review

All 26 tables are compatible with standard PostgreSQL and Neon. No Supabase-specific
extensions are used beyond what Neon supports.

#### Tables Requiring No Changes

The following tables have no Supabase-specific dependencies and migrate verbatim:

| Table                  | Action        | Notes                              |
| ---------------------- | ------------- | ---------------------------------- |
| `departments`          | Migrate as-is | No auth dependency                 |
| `employment_types`     | Migrate as-is | Reference table                    |
| `status_options`       | Migrate as-is | Reference table                    |
| `job_postings`         | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `job_applications`     | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `project_estimates`    | Migrate as-is | No RLS (anon access)               |
| `resource_downloads`   | Migrate as-is | No RLS (anon access)               |
| `rate_limits`          | Migrate as-is | No auth dependency                 |
| `audit_logs`           | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `in_app_notifications` | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `profiles`             | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `user_roles`           | Migrate as-is | Uses `auth.uid()` via `has_role()` |
| `employees`            | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `employee_tasks`       | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `timesheets`           | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `leave_requests`       | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `attendance_records`   | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `salary_structures`    | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `salary_slips`         | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `resignations`         | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `referrals`            | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `interview_slots`      | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `onboarding_records`   | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `onboarding_documents` | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `identity_documents`   | Migrate as-is | Uses `auth.uid()` in RLS only      |
| `clerk_user_map`       | Migrate as-is | Critical for Clerk auth            |

#### Tables Requiring Special Handling

| Table        | Issue                                    | Resolution                                                                                                                                       |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.users` | Managed by Supabase GoTrue, not our code | **Create `auth.users` table in Neon** with the same UUID primary key and minimal columns (id, email, created_at). Populate from Supabase export. |

#### The `auth.users` Problem

Every `user_id` column in all 26 application tables references `auth.users(id)` via
`REFERENCES auth.users(id) ON DELETE CASCADE`. This is a GoTrue-managed table that we
must recreate in Neon.

**Resolution**: Create a custom `auth.users` table in Neon that is owned by our
application (not GoTrue). This table stores the same UUIDs as Supabase `auth.users`,
ensuring all existing FK relationships remain valid.

```sql
-- Migration to create in Neon BEFORE importing application data
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Minimal fields — GoTrue's full schema not needed
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
  $$;
```

---

## Clerk Changes

### What Changes Because Authentication Backs to Neon

Currently, when `FLAGS.USE_CLERK_AUTH = true`:

1. Clerk JWT verified via `verifyToken()`
2. User provisioned/looked up in `clerk_user_map` (Supabase)
3. **GoTrue JWT minted** via `generateLink` + `verifyOtp` (Supabase)
4. Per-user Supabase client built with GoTrue JWT
5. RLS uses GoTrue JWT `sub` claim for `auth.uid()`

After migration:

1. Clerk JWT verified via `verifyToken()`
2. User provisioned/looked up in `clerk_user_map` (Neon — same table)
3. ~~GoTrue JWT minted~~ → **SET LOCAL app.current_user_id = '<uuid>'**
4. Per-user Neon connection built with Prisma
5. RLS uses `auth.uid()` which reads `current_setting('app.current_user_id')`

**Files Deleted Post-Migration:**

- `src/integrations/clerk/issue-token.server.ts` — entire file removed
- GoTrue imports in `auth-middleware.ts` — removed

**Files Rewritten Post-Migration:**

- `src/integrations/supabase/auth-middleware.ts` → Neon connection factory with RLS context setting
- `src/integrations/supabase/client.ts` → replaced with Prisma + Neon client
- `src/integrations/supabase/client.server.ts` → replaced with Prisma admin client

### Clerk + Neon: User Identity Flow

```
User logs in via Clerk
  → Clerk session token issued
  → clerk_user_map: clerk_user_id → auth_user_id (uuid)
  → Server function: SET LOCAL app.current_user_id = '<auth_user_id>'
  → auth.uid() returns current_setting('app.current_user_id')
  → RLS policies evaluate auth.uid() = user_id identically to before
```

The `clerk_user_map` table is migrated to Neon with all existing rows intact.
User mappings are preserved exactly.

### Organisations, Metadata, Foreign Keys

| Clerk Concept | Current Mapping                       | Post-Migration Mapping |
| ------------- | ------------------------------------- | ---------------------- |
| Clerk User ID | `clerk_user_map.clerk_user_id` (TEXT) | Same — no change       |
| App User UUID | `clerk_user_map.auth_user_id` (UUID)  | Same — no change       |
| Email         | `clerk_user_map.email`                | Same — no change       |
| Roles         | `user_roles.role` (app_role enum)     | Same — no change       |
| User metadata | `profiles.full_name`, `employees.*`   | Same — no change       |

---

## RLS Strategy

### Current RLS Implementation

All 104+ RLS policies use one of these patterns:

```sql
-- Pattern 1: Owner check
USING (auth.uid() = user_id)

-- Pattern 2: Role check via has_role()
USING (public.has_role(auth.uid(), 'admin'::app_role))

-- Pattern 3: Combined
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
```

The `has_role` function is:

```sql
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role) $$;
```

### RLS in Neon

Neon supports full PostgreSQL RLS. The only difference is `auth.uid()` needs a
custom implementation.

**Step 1**: Create the `auth` schema in Neon.

**Step 2**: Create `auth.uid()` as:

```sql
CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
  $$;
```

**Step 3**: All existing RLS policies migrate verbatim with no changes.
The `has_role()` function migrates verbatim.

**Step 4**: The middleware sets `app.current_user_id` per transaction:

```typescript
// In Neon connection factory (auth-middleware rewrite)
await db.execute(sql`SET LOCAL app.current_user_id = ${verifiedUserId}`);
// All subsequent queries in this transaction use the correct auth.uid()
```

### Neon RLS Compatibility Assessment

| Policy Type                       | Compatible | Notes                                             |
| --------------------------------- | ---------- | ------------------------------------------------- |
| `auth.uid() = user_id`            | ✅ Yes     | Via custom function                               |
| `has_role(auth.uid(), 'admin')`   | ✅ Yes     | `has_role` migrates verbatim                      |
| `has_role(auth.uid(), 'hr')`      | ✅ Yes     | Same                                              |
| `has_role(auth.uid(), 'manager')` | ✅ Yes     | Same                                              |
| `service_role` bypass policies    | ✅ Yes     | Via admin connection (no RLS)                     |
| `storage.objects` policies        | ❌ N/A     | Storage moves to R2; no Postgres storage policies |

---

## Storage Migration

### Supabase Storage → Cloudflare R2

#### Bucket Mapping

| Supabase Bucket   | R2 Bucket               | Notes                               |
| ----------------- | ----------------------- | ----------------------------------- |
| `resumes`         | `ciago-resumes`         | PDF files, user-private             |
| `avatars`         | `ciago-avatars`         | Images, authenticated read          |
| `onboarding-docs` | `ciago-onboarding-docs` | PDFs + images, user + staff read    |
| `identity-docs`   | `ciago-identity-docs`   | PDFs + images, user + admin/HR read |

#### Storage Path Convention

Current Supabase storage paths follow:

```
resumes/{user_id}/{filename}
avatars/{user_id}/{filename}
onboarding-docs/{user_id}/{doc_key}/{version}/{filename}
identity-docs/{user_id}/{doc_type}/{filename}
```

R2 preserves the SAME path structure. The `storage_path` column in each table stores
the path without the bucket prefix. No database updates needed for paths.

#### Upload Flow Changes

**Current (Supabase):**

```typescript
const { error } = await supabase.storage.from("resumes").upload(`${userId}/${filename}`, file);
```

**Target (R2 via Worker):**

```typescript
// Upload via Worker binding
await env.R2_CIAGO_RESUMES.put(`${userId}/${filename}`, file);

// OR via AWS S3-compatible API (presigned upload)
const presignedUrl = await getR2PresignedUploadUrl(bucket, key, expiry);
// Client uploads directly to R2 using presigned URL
```

#### Signed URL Changes

**Current (Supabase):**

```typescript
const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
```

**Target (R2):**

```typescript
// Using @aws-sdk/client-s3 with R2 credentials
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const url = await getSignedUrl(
  r2Client,
  new GetObjectCommand({
    Bucket: "ciago-avatars",
    Key: path,
  }),
  { expiresIn: 60 * 60 * 24 * 7 },
);
```

#### Files Modified for Storage Migration

| File                                            | Change                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/profile.functions.ts`                  | Replace `supabase.storage.from('avatars').createSignedUrl` with R2 signed URL |
| `src/lib/admin.functions.ts`                    | Replace `supabaseAdmin.storage.from('resumes').remove` with R2 delete         |
| `src/lib/hr-decisions.ts`                       | Replace `supabase.storage.from('onboarding-docs')` with R2                    |
| `src/lib/hr.functions.ts`                       | Replace both `supabase.storage.from('onboarding-docs')` calls with R2         |
| `src/lib/onboarding.functions.ts`               | Replace `supabase.storage.from('onboarding-docs').remove` with R2             |
| `src/lib/applications.functions.ts`             | Replace `supabase.storage.from('resumes')` with R2                            |
| `src/lib/users.functions.ts`                    | Replace `supabase.storage.from('identity-docs')` with R2                      |
| `src/lib/profile.functions.ts`                  | Replace `supabaseAdmin.storage.from('resumes').remove` with R2                |
| `src/routes/careers.tsx`                        | Replace direct `supabase.storage.from('resumes').upload` with R2              |
| `src/routes/_authenticated/profile.tsx`         | Replace `supabase.storage.from('avatars')` with R2                            |
| `src/routes/_authenticated/users.tsx`           | Replace `supabase.storage.from('identity-docs')` with R2                      |
| `src/components/site/OnboardingDocUploader.tsx` | Replace `supabase.storage.from('onboarding-docs')` with R2                    |

#### Data Migration (Supabase → R2)

Use the following migration script (to be created in `scripts/migrate-storage.ts`):

```typescript
// Pseudocode — do not implement without creating the actual script
// 1. List all objects in each Supabase bucket
// 2. Download each object using supabase.storage.from(bucket).download(path)
// 3. Upload to R2 using the same path: r2Client.put(path, data)
// 4. Verify: compare checksums
// 5. Log all migrated objects
// 6. Do NOT delete from Supabase until R2 is verified and app is reading from R2
```

---

## Migration Stages — Detailed

---

### Stage 1: Neon Project Setup + Schema Migration

**Objective**: Create Neon project, migrate schema, verify all tables exist.

**Prerequisites**: Neon account, `neonctl` CLI installed, Supabase service role key.

**Files Created:**

- `scripts/migrate-schema.ts` — exports Supabase schema + imports to Neon
- `scripts/seed-neon.ts` — exports Supabase data + imports to Neon

**Commands:**

```bash
# Install Neon CLI
bun add -D neonctl

# Create Neon project
neonctl projects create --name ciago-spark --region-id aws-ap-southeast-1

# Note the connection string from output:
# postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb

# Export Supabase schema
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --schema=auth \
  "$SUPABASE_DB_URL" \
  -f schema.sql

# Manual step: Edit schema.sql to add custom auth.uid() and auth.users table
# (see SQL in RLS Strategy section above)

# Import schema to Neon
psql "$NEON_DB_URL" -f schema.sql
```

**Validation:**

```sql
-- Run against Neon to verify all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: 26 tables matching Supabase

-- Verify auth.uid() function
SELECT auth.uid(); -- Should return null (no current_user_id set)

-- Verify RLS policies exist
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
ORDER BY tablename;
-- Expected: 104+ policies
```

**Rollback**: Delete Neon project. No application code changed.

**Acceptance Criteria:**

- [ ] All 26 tables present in Neon
- [ ] All 8 stored functions present
- [ ] All 4 enums present
- [ ] All 104+ RLS policies present
- [ ] `auth.uid()` function returns null when `app.current_user_id` is unset
- [ ] `auth.uid()` function returns correct UUID when `app.current_user_id` is set via SET LOCAL

**Risks:**

- Supabase uses extensions (e.g., `uuid-ossp`) — verify Neon has them enabled
- Some Supabase-specific syntax may not export cleanly — review schema.sql manually

---

### Stage 2: auth.uid() RLS Compatibility Layer

**Objective**: Implement and verify the custom `auth.uid()` function in Neon that
makes all existing RLS policies work without modification.

**SQL to Add:**

```sql
-- Create auth schema (if not done in Stage 1)
CREATE SCHEMA IF NOT EXISTS auth;

-- auth.users table (minimal — full GoTrue schema not needed)
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);

-- auth.uid() — reads from transaction-level setting
CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
  $$;

-- Verify that has_role uses auth.uid() correctly
-- has_role is called as: has_role(auth.uid(), 'admin')
-- So auth.uid() must return uuid — which it does
```

**Test Query:**

```sql
BEGIN;
-- Simulate authenticated user
SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000001';

-- Verify auth.uid() returns the expected UUID
SELECT auth.uid();
-- Expected: 00000000-0000-0000-0000-000000000001

-- Test RLS context
SELECT * FROM public.user_roles WHERE user_id = auth.uid();
-- Should only return rows for the simulated user

ROLLBACK; -- Don't commit test data
```

**Rollback**: No application code changed. Drop the custom functions if needed.

**Acceptance Criteria:**

- [ ] `auth.uid()` returns `null` when `app.current_user_id` is not set
- [ ] `auth.uid()` returns the correct UUID when set via `SET LOCAL`
- [ ] RLS policies evaluated correctly with simulated user context
- [ ] `has_role(auth.uid(), 'admin')` returns correct boolean

---

### Stage 3: Prisma ORM Setup + Schema Definition

**Objective**: Add Prisma ORM, define the complete schema in TypeScript, generate types.

**Packages to Install:**

```bash
bun add @prisma/client @neondatabase/serverless
bun add -D prisma
```

**Files Created:**

```
src/
├── db/
│   ├── index.ts          # Database connection factory
│   ├── index.server.ts   # Admin connection factory (no RLS)
│   ├── schema.ts         # Complete Prisma schema definition
│   └── types.ts          # Exported Prisma inferred types (replaces supabase/types.ts)
prisma.config.ts         # Prisma Kit configuration
```

**`src/db/schema.ts` structure (do not copy verbatim — derive from actual types.ts):**

```typescript
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "@prisma/client/pg-core";

// Enums
export const appRoleEnum = pgEnum("app_role", [
  "admin",
  "moderator",
  "user",
  "employee",
  "hr",
  "manager",
]);
export const deptTypeEnum = pgEnum("dept_type", [
  "engineering",
  "operations",
  "human_resource",
  "management",
  "product",
  "design",
  "finance",
  "sales",
  "marketing",
  "customer_support",
  "legal",
  "it_infrastructure",
]);
export const jobPostingStatusEnum = pgEnum("job_posting_status", [
  "draft",
  "published",
  "internal_only",
  "closed",
  "archived",
]);
export const jobTrackTypeEnum = pgEnum("job_track_type", ["standard", "manager_track", "hr_track"]);

// auth schema
export const authUsers = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    rawUserMetaData: jsonb("raw_user_meta_data").default({}),
  },
  (t) => ({ schema: "auth" }),
);

// All 26 public tables follow the same pattern...
// (Define each from the types.ts Row definitions)
```

**`src/db/index.ts` structure:**

```typescript
import { neon } from "@neondatabase/serverless";
import { Prisma } from "@prisma/client/neon-http";
import * as schema from "./schema";

export function createUserDb(connectionString: string, userId: string) {
  const sql = neon(connectionString);
  const db = Prisma(sql, { schema });
  // SET LOCAL called in auth-middleware before returning context
  return db;
}

export function createAdminDb(connectionString: string) {
  // Admin connection — bypasses RLS via admin role
  const sql = neon(connectionString);
  return Prisma(sql, { schema });
}
```

**`prisma.config.ts`:**

```typescript
import type { Config } from "prisma";
export default {
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations-neon",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL!,
  },
} satisfies Config;
```

**Validation:**

```bash
# Generate Prisma migration from schema
bunx prisma generate

# Verify generated migration matches Supabase schema
diff supabase/migrations-neon/0000_initial.sql schema.sql
```

**Acceptance Criteria:**

- [ ] Prisma installed and configured
- [ ] All 26 tables defined in `schema.ts`
- [ ] All 4 enums defined
- [ ] TypeScript types generated and correct
- [ ] Build succeeds: `bun run build`
- [ ] No TypeScript errors in schema definition

---

### Stage 4: Clerk Authentication Simplified (Remove GoTrue)

**Objective**: Update auth middleware to use Neon directly, removing the GoTrue JWT
issuance step. This is the most impactful change.

**Files Modified:**

#### `src/integrations/supabase/auth-middleware.ts` (REWRITE)

Current behavior:

1. Verify Clerk JWT
2. Provision user in `clerk_user_map` (Supabase)
3. Issue GoTrue JWT via `generateLink` + `verifyOtp`
4. Build Supabase per-user client with GoTrue JWT

New behavior:

1. Verify Clerk JWT
2. Look up `auth_user_id` from `clerk_user_map` (Neon)
3. Execute `SET LOCAL app.current_user_id = '<auth_user_id>'` on the connection
4. Inject `{ db, userId, claims }` into context (no Supabase client)

```typescript
// NEW middleware pseudocode — actual implementation requires Stage 3 complete
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@clerk/backend";
import { createUserDb } from "@/db";
import { sql } from "@prisma/client";
import { FLAGS } from "@/lib/feature-flags";
import { clerkUserMap } from "@/db/schema";
import { eq } from "@prisma/client";

export const requireNeonAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const token = extractBearerToken(request);

  // Verify Clerk JWT
  const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const { sub: clerkUserId, ...claims } = await clerkClient.verifyToken(token);

  // Look up auth_user_id from clerk_user_map
  const adminDb = createAdminDb(process.env.NEON_DATABASE_URL!);
  const [mapping] = await adminDb
    .select({ authUserId: clerkUserMap.authUserId })
    .from(clerkUserMap)
    .where(eq(clerkUserMap.clerkUserId, clerkUserId));

  if (!mapping) throw new Error("User not provisioned");

  // Build user-scoped Neon connection with RLS context
  const userDb = createUserDb(process.env.NEON_DATABASE_URL!, mapping.authUserId);
  await userDb.execute(sql`SET LOCAL app.current_user_id = ${mapping.authUserId}`);

  return next({
    context: {
      db: userDb,
      userId: mapping.authUserId,
      claims,
    },
  });
});
```

**Files Deleted:**

- `src/integrations/clerk/issue-token.server.ts` — entire file

**Files Modified:**

- `src/integrations/supabase/auth-middleware.ts` — rewrite (keep file path for backward compat)
- All `*.functions.ts` files — replace `requireSupabaseAuth` with `requireNeonAuth`, `context.supabase` with `context.db`

**Acceptance Criteria:**

- [ ] Middleware verifies Clerk JWT without GoTrue
- [ ] `app.current_user_id` set correctly in every authenticated request
- [ ] `auth.uid()` returns correct UUID in all RLS contexts
- [ ] All server functions receive `context.db` instead of `context.supabase`
- [ ] Build passes
- [ ] All 64 existing tests pass

---

### Stage 5: Database Client Migration (Function by Function)

**Objective**: Rewrite all server functions from PostgREST (`supabase.from()`)
to Prisma SQL (`db.select().from()`). Use `neonMigrationEnabled` flag to
switch between implementations.

**Pattern for each function:**

```typescript
// BEFORE (PostgREST)
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role, department_id")
      .eq("user_id", context.userId);
    // ...
  });

// AFTER (Prisma — add AFTER existing, behind flag)
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireNeonAuth])
  .handler(async ({ context }) => {
    const rows = await context.db
      .select({ role: userRoles.role, departmentId: userRoles.departmentId })
      .from(userRoles)
      .where(eq(userRoles.userId, context.userId));
    // ...
  });
```

**Files to Migrate (in order of priority):**

| File                                    | Functions                                              | Priority                     |
| --------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `src/lib/roles.functions.ts`            | `getMyRoles`, `getMyAuthUserId`, `getMyEmployeeAccess` | **P0** (used by auth guard)  |
| `src/lib/portal.functions.ts`           | `resolveMyPortal`                                      | **P0** (used by all portals) |
| `src/lib/feature-flags.functions.ts`    | `getMyFeatureFlags`                                    | **P1**                       |
| `src/lib/profile.functions.ts`          | All                                                    | **P1**                       |
| `src/lib/applications.functions.ts`     | All                                                    | **P1**                       |
| `src/lib/onboarding.functions.ts`       | All                                                    | **P2**                       |
| `src/lib/hr.functions.ts`               | All                                                    | **P2**                       |
| `src/lib/admin.functions.ts`            | All                                                    | **P2**                       |
| `src/lib/employee.functions.ts`         | All                                                    | **P2**                       |
| `src/lib/users.functions.ts`            | All                                                    | **P3**                       |
| `src/lib/adminTasks.functions.ts`       | All                                                    | **P3**                       |
| `src/lib/hrTasks.functions.ts`          | All                                                    | **P3**                       |
| `src/lib/orgHierarchy.functions.ts`     | All                                                    | **P3**                       |
| `src/lib/payroll.functions.ts`          | All (if exists)                                        | **P3**                       |
| `src/routes/careers.tsx`                | Inline DB calls                                        | **P2**                       |
| `src/routes/_authenticated/profile.tsx` | Inline DB calls                                        | **P2**                       |
| `src/routes/_authenticated/users.tsx`   | Inline DB calls                                        | **P2**                       |

**Stage 5 Acceptance Criteria:**

- [ ] All server functions rewritten to Prisma
- [ ] `neonMigrationEnabled` flag routes to Prisma functions
- [ ] `neonMigrationEnabled = false` still routes to Supabase functions (unchanged)
- [ ] All 64 tests pass
- [ ] Build passes
- [ ] Manual QA of each portal (admin, hr, manager, employee, onboarding)

---

### Stage 6: Storage Migration (Supabase → Cloudflare R2)

**Objective**: Create R2 buckets, migrate existing objects, update all upload/download
code to use R2.

**Step 6a: Create R2 Buckets**

```bash
# Using Wrangler CLI
wrangler r2 bucket create ciago-resumes
wrangler r2 bucket create ciago-avatars
wrangler r2 bucket create ciago-onboarding-docs
wrangler r2 bucket create ciago-identity-docs

# Configure CORS for direct browser uploads
wrangler r2 bucket cors put ciago-resumes --rules '[{"AllowedOrigins": ["https://yourdomain.com"], "AllowedMethods": ["PUT", "POST"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]'
# Repeat for all 4 buckets
```

**Step 6b: Add R2 Bindings to `wrangler.toml`**

```toml
[[r2_buckets]]
binding = "R2_RESUMES"
bucket_name = "ciago-resumes"

[[r2_buckets]]
binding = "R2_AVATARS"
bucket_name = "ciago-avatars"

[[r2_buckets]]
binding = "R2_ONBOARDING_DOCS"
bucket_name = "ciago-onboarding-docs"

[[r2_buckets]]
binding = "R2_IDENTITY_DOCS"
bucket_name = "ciago-identity-docs"
```

**Step 6c: Create Storage Utility Module**

**File Created:** `src/lib/storage.server.ts`

```typescript
// Pseudocode — implement based on Cloudflare Workers R2 API

// Upload object to R2
export async function uploadToR2(
  bucket: R2Bucket,
  key: string,
  file: File | ArrayBuffer,
  options?: { contentType?: string },
): Promise<{ key: string }>;

// Generate signed URL for download
export async function getSignedUrl(
  bucket: R2Bucket,
  key: string,
  expiresInSeconds: number,
): Promise<string>;

// Delete object from R2
export async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void>;
```

**Step 6d: Run Storage Migration Script**

```bash
# Run once to copy all objects from Supabase to R2
# Uses r2StorageEnabled = false (still serving from Supabase)
bun run scripts/migrate-storage.ts --dry-run
bun run scripts/migrate-storage.ts --execute
```

**Step 6e: Enable R2 Storage via Flag**

After migration script completes and is verified:

1. Set `r2StorageEnabled = true` in ConfigCat for admins only
2. Verify uploads and downloads work
3. Gradually roll out to all users

**Stage 6 Acceptance Criteria:**

- [ ] All 4 R2 buckets created
- [ ] All existing objects migrated from Supabase to R2
- [ ] Object counts match between Supabase and R2
- [ ] Checksums verified for all objects
- [ ] Upload flow works with R2
- [ ] Signed URL generation works with R2
- [ ] Delete flow works with R2
- [ ] Storage paths in database remain unchanged
- [ ] `r2StorageEnabled` flag correctly routes to R2 when ON

---

### Stage 7: Dual-Write Period + Validation

**Objective**: Run Supabase and Neon in parallel. Write to both. Read from Neon.
Validate data consistency.

**Duration**: Minimum 2 weeks of active use before Stage 8.

**Dual-Write Pattern:**

```typescript
// In each write function during Stage 7
if (FLAGS.neonMigrationEnabled) {
  // Write to Neon
  await context.db.insert(table).values(data);
  // Also write to Supabase as fallback
  await supabaseAdmin.from("table").insert(data);
} else {
  // Write to Supabase only
  await context.supabase.from("table").insert(data);
}
```

**Validation Queries:**

```bash
# Run daily to verify consistency
bun run scripts/validate-migration.ts
# Compares row counts and checksums between Supabase and Neon
# Alerts on any discrepancy
```

**Stage 7 Acceptance Criteria:**

- [ ] Zero data discrepancies over 2-week period
- [ ] Performance benchmarks: Neon reads < 50ms for all common queries
- [ ] No errors in Neon logs
- [ ] All RLS policies enforced correctly (verified via existing test suite)
- [ ] All storage operations working via R2

---

### Stage 8: Cutover + Decommission

**Objective**: Disable Supabase writes, set Neon as sole database. Decommission
Supabase after retention period.

**Cutover Checklist:**

```
Before cutover:
  [ ] Stage 7 validation passed (zero discrepancies)
  [ ] All team members notified
  [ ] Rollback plan confirmed and tested
  [ ] Monitoring alerts configured for Neon

Cutover sequence (maintenance window — 5 minutes):
  [ ] Set neonMigrationEnabled = true (reads already from Neon)
  [ ] Disable dual-write (writes now go to Neon only)
  [ ] Verify health checks pass
  [ ] Monitor error rates for 30 minutes

Post-cutover (30-day retention):
  [ ] Keep Supabase credentials in Doppler
  [ ] Supabase database read-only (if possible)
  [ ] Monitor for any missed migration paths

Decommission (Day 30):
  [ ] Remove Supabase client files
  [ ] Remove GoTrue-related code
  [ ] Remove supabase/* integration files
  [ ] Update all imports
  [ ] Run bun run build and bun run test
```

---

## File-by-File Planning

### Files to CREATE

| Path                            | Purpose                           | Stage | Dependencies    |
| ------------------------------- | --------------------------------- | ----- | --------------- |
| `src/db/schema.ts`              | Prisma schema definition          | 3     | Neon project    |
| `src/db/index.ts`               | User-scoped DB connection factory | 3     | schema.ts       |
| `src/db/index.server.ts`        | Admin DB connection factory       | 3     | schema.ts       |
| `src/db/types.ts`               | Exported Prisma inferred types    | 3     | schema.ts       |
| `src/lib/storage.server.ts`     | R2 storage utilities              | 6     | R2 buckets      |
| `scripts/migrate-schema.ts`     | Schema export/import script       | 1     | pg_dump         |
| `scripts/migrate-data.ts`       | Data export/import script         | 1     | pg_dump         |
| `scripts/migrate-storage.ts`    | Object migration script           | 6     | R2 buckets      |
| `scripts/validate-migration.ts` | Data consistency validator        | 7     | Both DBs        |
| `prisma.config.ts`              | Prisma Kit config                 | 3     | Neon connection |
| `wrangler.toml`                 | Cloudflare Workers + R2 bindings  | 6     | R2 buckets      |

### Files to MODIFY

| Path                                              | Change                                                     | Stage |
| ------------------------------------------------- | ---------------------------------------------------------- | ----- |
| `src/integrations/supabase/auth-middleware.ts`    | Rewrite Clerk branch to use Neon + SET LOCAL               | 4     |
| `src/integrations/clerk/provision.server.ts`      | Point to Neon instead of Supabase                          | 4     |
| `src/integrations/clerk/ensure-mapping.server.ts` | Point to Neon instead of Supabase                          | 4     |
| `src/lib/roles.functions.ts`                      | Add Prisma implementation                                  | 5     |
| `src/lib/portal.functions.ts`                     | Add Prisma implementation                                  | 5     |
| `src/lib/feature-flags.functions.ts`              | Add Prisma implementation                                  | 5     |
| `src/lib/profile.functions.ts`                    | Add Prisma + R2 implementation                             | 5+6   |
| `src/lib/applications.functions.ts`               | Add Prisma + R2 implementation                             | 5+6   |
| `src/lib/admin.functions.ts`                      | Add Prisma + R2 implementation                             | 5+6   |
| `src/lib/hr.functions.ts`                         | Add Prisma + R2 implementation                             | 5+6   |
| `src/lib/employee.functions.ts`                   | Add Prisma implementation                                  | 5     |
| `src/lib/onboarding.functions.ts`                 | Add Prisma + R2 implementation                             | 5+6   |
| `src/lib/users.functions.ts`                      | Add Prisma + R2 implementation                             | 5+6   |
| `src/lib/adminTasks.functions.ts`                 | Add Prisma implementation                                  | 5     |
| `src/lib/hrTasks.functions.ts`                    | Add Prisma implementation                                  | 5     |
| `src/lib/orgHierarchy.functions.ts`               | Add Prisma implementation                                  | 5     |
| `src/routes/careers.tsx`                          | Replace inline storage calls with R2                       | 6     |
| `src/routes/_authenticated/profile.tsx`           | Replace inline storage calls with R2                       | 6     |
| `src/routes/_authenticated/users.tsx`             | Replace inline storage calls with R2                       | 6     |
| `src/components/site/OnboardingDocUploader.tsx`   | Replace inline storage calls with R2                       | 6     |
| `package.json`                                    | Add @prisma/client, @neondatabase/serverless, @aws-sdk     | 3     |
| `src/lib/feature-flags.ts`                        | Enable `neonMigrationEnabled` and `r2StorageEnabled` flags | 3     |

### Files to DELETE (after Stage 8 — not before)

| Path                                           | Reason                        | Replacement                           |
| ---------------------------------------------- | ----------------------------- | ------------------------------------- |
| `src/integrations/clerk/issue-token.server.ts` | GoTrue JWT issuance removed   | None needed — Clerk JWT used directly |
| `src/integrations/supabase/client.ts`          | Supabase client removed       | `src/db/index.ts`                     |
| `src/integrations/supabase/client.server.ts`   | Supabase admin client removed | `src/db/index.server.ts`              |
| `src/integrations/supabase/types.ts`           | PostgREST types replaced      | `src/db/types.ts` (Prisma inferred)   |

### Folder Changes

| Change                             | Reason                                         |
| ---------------------------------- | ---------------------------------------------- |
| New: `src/db/`                     | Prisma schema + connection factories           |
| Keep: `src/integrations/supabase/` | Until Stage 8 complete                         |
| Keep: `src/integrations/clerk/`    | Unchanged (provision + ensure-mapping updated) |

---

## Environment Variables

### Current Variables (Supabase)

| Variable                        | Scope       | Required | Purpose                              |
| ------------------------------- | ----------- | -------- | ------------------------------------ |
| `SUPABASE_URL`                  | Server      | Required | Supabase project URL                 |
| `SUPABASE_PUBLISHABLE_KEY`      | Server      | Required | Supabase anon key                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only | Required | Supabase service role (bypasses RLS) |
| `VITE_SUPABASE_URL`             | Client      | Required | Same as SUPABASE_URL                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client      | Required | Same as SUPABASE_PUBLISHABLE_KEY     |
| `SUPABASE_PROJECT_ID`           | Server      | Required | For migrations and admin             |

### New Variables (Neon + R2)

| Variable                    | Scope       | Environment | Required | Purpose                                       |
| --------------------------- | ----------- | ----------- | -------- | --------------------------------------------- |
| `NEON_DATABASE_URL`         | Server-only | All         | Required | Neon connection string with PgBouncer pooling |
| `NEON_DIRECT_URL`           | Server-only | All         | Optional | Direct Neon connection (for migrations)       |
| `R2_ACCOUNT_ID`             | Server-only | All         | Required | Cloudflare account ID for R2                  |
| `R2_ACCESS_KEY_ID`          | Server-only | All         | Required | R2 S3-compatible access key                   |
| `R2_SECRET_ACCESS_KEY`      | Server-only | All         | Required | R2 S3-compatible secret key                   |
| `R2_BUCKET_RESUMES`         | Server-only | All         | Required | R2 bucket name for resumes                    |
| `R2_BUCKET_AVATARS`         | Server-only | All         | Required | R2 bucket name for avatars                    |
| `R2_BUCKET_ONBOARDING_DOCS` | Server-only | All         | Required | R2 bucket name for onboarding docs            |
| `R2_BUCKET_IDENTITY_DOCS`   | Server-only | All         | Required | R2 bucket name for identity docs              |

### Variables to DEPRECATE after Stage 8

| Variable                        | When to Remove                            |
| ------------------------------- | ----------------------------------------- |
| `SUPABASE_URL`                  | After Stage 8 complete + 30-day retention |
| `SUPABASE_PUBLISHABLE_KEY`      | After Stage 8 complete                    |
| `SUPABASE_SERVICE_ROLE_KEY`     | After Stage 8 complete                    |
| `VITE_SUPABASE_URL`             | After Stage 8 complete                    |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | After Stage 8 complete                    |
| `SUPABASE_PROJECT_ID`           | After Stage 8 complete                    |

### Doppler Configuration

All variables above must be configured in Doppler under three configs:

- `dev`: Local development values
- `stg`: Staging values (separate Neon branch, separate R2 buckets with `-staging` suffix)
- `prd`: Production values

Variable naming in Doppler:

```
# Database
NEON_DATABASE_URL          → postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
NEON_DIRECT_URL            → postgresql://user:pass@ep-xxx.neon.tech:5432/neondb

# Storage
R2_ACCOUNT_ID              → abc123def456
R2_ACCESS_KEY_ID           → your_access_key
R2_SECRET_ACCESS_KEY       → your_secret_key
R2_BUCKET_RESUMES          → ciago-resumes
R2_BUCKET_AVATARS          → ciago-avatars
R2_BUCKET_ONBOARDING_DOCS  → ciago-onboarding-docs
R2_BUCKET_IDENTITY_DOCS    → ciago-identity-docs
```

---

## Testing Strategy

### Unit Tests

**New tests to add in Stage 3:**

| Test File                             | What to Test                                     |
| ------------------------------------- | ------------------------------------------------ |
| `src/db/__tests__/schema.test.ts`     | Schema types match expected shapes               |
| `src/db/__tests__/connection.test.ts` | Connection factory creates valid Prisma instance |
| `src/lib/__tests__/storage.test.ts`   | R2 utility functions with mocked R2 binding      |

**Existing tests to update:**

| Test File                                                     | Update Required                   |
| ------------------------------------------------------------- | --------------------------------- |
| `src/integrations/clerk/__tests__/issue-token.server.test.ts` | Delete after Stage 4              |
| `src/integrations/clerk/__tests__/provision.server.test.ts`   | Update mocks to use Neon          |
| `src/lib/__tests__/route-access.test.ts`                      | Update mocks if Supabase-specific |

### Integration Tests

Add integration tests against a **Neon test branch**:

```bash
# Create test branch in Neon
neonctl branches create --name test --parent main

# Run integration tests against test branch
NEON_TEST_URL="postgresql://..." bun test --config vitest.integration.config.ts
```

### E2E Testing

Before each stage cutover, manually test:

| Scenario                          | Stage |
| --------------------------------- | ----- |
| Admin login and portal access     | 4, 7  |
| HR review and approve application | 5     |
| Employee submit leave request     | 5     |
| Upload onboarding document        | 6     |
| Download signed resume URL        | 6     |
| Manager approve timesheet         | 5     |
| Profile avatar upload             | 6     |

### Migration Validation

```bash
# After Stage 7 dual-write, run daily
bun run scripts/validate-migration.ts

# Checks:
# - Row count per table: Supabase vs Neon
# - Sample row comparison (10 rows per table, random)
# - Storage object count per bucket
# - No orphaned foreign keys
```

### RLS Validation (Existing)

The existing `rls-audit.test.ts` must pass against Neon:

```bash
# Update test to point to Neon
NEON_DATABASE_URL="..." bun run test src/integrations/clerk/__tests__/rls-audit.test.ts
```

---

## Security Checklist

### Secrets

- [ ] Neon connection strings in Doppler only, never in code
- [ ] R2 access keys in Doppler only, never in code
- [ ] `NEON_DATABASE_URL` never in `VITE_` prefixed variables (server-only)
- [ ] `R2_SECRET_ACCESS_KEY` never in `VITE_` prefixed variables (server-only)
- [ ] Separate Neon credentials for admin connections vs user connections

### auth.uid() Security

- [ ] `app.current_user_id` is ONLY set via `SET LOCAL` (transaction-scoped, not session-scoped)
- [ ] Value is ONLY set AFTER Clerk JWT verification succeeds
- [ ] Value is ALWAYS the `auth_user_id` from `clerk_user_map`, never the raw Clerk user ID
- [ ] No path exists that sets `app.current_user_id` to a hardcoded or client-provided value
- [ ] Admin connections (bypass RLS) use a SEPARATE database connection that never sets `app.current_user_id`

### Object Storage Security

- [ ] All R2 buckets are PRIVATE by default
- [ ] No public R2 bucket policies (even for avatars — use short-lived signed URLs)
- [ ] R2 presigned URLs expire within 7 days maximum
- [ ] Avatar presigned URLs expire within 24 hours
- [ ] Resume and document presigned URLs expire within 1 hour
- [ ] R2 access from Workers only (no public bucket access)
- [ ] Content-Type validated server-side before storage
- [ ] File size limits enforced server-side before upload

### SQL Injection

- [ ] All queries use Prisma's parameterized query API
- [ ] No raw string interpolation in `db.execute(sql`...${variable}...`)` — use `sql.raw` only for static identifiers
- [ ] User input NEVER concatenated into SQL strings

### RLS Verification

- [ ] Run existing `rls-audit.test.ts` against Neon before Stage 7
- [ ] Verify all 104+ policies present in Neon schema
- [ ] Verify `auth.uid()` returns null for unauthenticated requests
- [ ] Verify admin bypass is ONLY possible via separate admin connection

---

## Observability

### Logging

Add structured logging throughout the migration:

```typescript
// In auth middleware (Neon branch)
console.log("[neon-auth]", {
  userId: mapping.authUserId,
  clerkUserId,
  durationMs: Date.now() - start,
  event: "auth-context-set",
});

// In storage operations
console.log("[r2]", {
  bucket,
  key,
  operation: "upload" | "download" | "delete",
  durationMs,
  success,
});
```

### Metrics to Track

| Metric                        | Target  | Alert Threshold |
| ----------------------------- | ------- | --------------- |
| Neon query latency (p99)      | < 100ms | > 500ms         |
| Auth context set duration     | < 10ms  | > 50ms          |
| R2 upload duration (1MB)      | < 500ms | > 2s            |
| R2 signed URL generation      | < 20ms  | > 100ms         |
| Failed auth attempts          | < 1%    | > 5%            |
| RLS policy violations (error) | 0       | > 0             |

### Neon Console Monitoring

After cutover, set up Neon console alerts for:

- Compute utilization > 80%
- Connection pool utilization > 90%
- Failed query rate > 1%
- Slow query log (> 1 second)

---

## CDN Strategy

### Cloudflare R2 + Cache Rules

After storage migrates to R2:

**Avatars (public, cacheable):**

- Serve via Cloudflare Cache
- `Cache-Control: public, max-age=86400` (24 hours)
- On profile update: purge Cloudflare cache for the avatar key

**Documents (private, no cache):**

- Serve via short-lived signed URLs only
- `Cache-Control: private, no-store`
- Signed URL expiry: 1 hour (resumes, onboarding-docs, identity-docs)

---

## Final Readiness Checklist

### Pre-Migration (Stages 1–3)

- [ ] Neon project created in correct region (ap-southeast-1)
- [ ] Schema migrated and validated (26 tables, 8 functions, 4 enums, 104+ policies)
- [ ] `auth.uid()` custom function working correctly
- [ ] `auth.users` table populated with all Supabase user UUIDs
- [ ] Prisma schema matches Supabase schema exactly
- [ ] TypeScript types generated and reviewed
- [ ] All existing 64 tests pass against Supabase (baseline confirmed)
- [ ] R2 buckets created and CORS configured

### During Migration (Stages 4–6)

- [ ] GoTrue JWT issuance replaced by direct Clerk JWT in Neon middleware
- [ ] All server functions rewritten to Prisma
- [ ] All storage operations rewritten to R2
- [ ] `neonMigrationEnabled` flag routes correctly
- [ ] `r2StorageEnabled` flag routes correctly
- [ ] All 64 tests pass (updated for Neon)
- [ ] Build passes: `bun run build`
- [ ] No TypeScript errors

### Pre-Cutover (Stage 7)

- [ ] 14-day dual-write period complete with zero discrepancies
- [ ] Performance benchmarks met (Neon p99 < 100ms)
- [ ] Storage migration verified (object counts and checksums)
- [ ] All team members have tested Neon path manually
- [ ] Rollback procedure tested and documented
- [ ] Monitoring alerts configured in Neon console
- [ ] ConfigCat flags set to correct values for gradual rollout

### Post-Cutover (Stage 8)

- [ ] Production traffic running entirely on Neon for 30 days
- [ ] Zero critical errors in 30-day period
- [ ] Supabase decommissioned
- [ ] Old Supabase files removed from codebase
- [ ] Environment variables cleaned up
- [ ] Doppler configs updated (Supabase vars removed)
- [ ] `implementation.md` updated with migration completion

---

## Implementation Notes for Executing Engineers

### Do NOT Use

- `supabase.from()` in any new code after Stage 3
- `supabase.storage` in any new code after Stage 6 begins
- Hardcoded UUIDs anywhere in auth-related code
- `session`-level `SET app.current_user_id` (must be `SET LOCAL` for transaction-scoped)

### Do USE

- `context.db` (Prisma) in all new server functions
- `context.db.execute(sql`SET LOCAL app.current_user_id = ${userId}`)` only in middleware
- `env.R2_*` bindings for all storage operations
- Feature flags `neonMigrationEnabled` and `r2StorageEnabled` to gate new code paths
- Neon branching for all schema changes (never directly on production)

### Critical Invariants (Never Break)

1. **`auth.uid()` must return the auth.users UUID** — never the Clerk user ID string
2. **`clerk_user_map` must always be consistent** — Clerk ID ↔ auth.users UUID bijection
3. **`SET LOCAL app.current_user_id` must always be called within a transaction**
4. **Admin connections must never set `app.current_user_id`** — they bypass RLS entirely
5. **All FK references to auth.users must use UUIDs** — unchanged from current schema
6. **RLS policies must not be modified** — only the `auth.uid()` implementation changes

---

_Document last updated: 2026-07-29_
_Next review: After Stage 1 completion_
_Owner: Engineering Team_
