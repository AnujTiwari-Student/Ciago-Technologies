# Ciago Technologies — Platform Reference

A single reference for engineers/architects covering: **folder structure, database schema, RLS model, jobs & scheduling, email architecture, bot / captcha confirmation, and SEO/AEO setup**.

See also: `WORKFLOW.md` for user-flow → file mapping.

---

## 1. Folder Structure

```
ciago-vision-hub/
├── public/
│   ├── robots.txt              # Crawler rules + sitemap directive
│   ├── llms.txt                # AEO (LLM discoverability)
│   ├── logo-light.svg
│   └── logo-dark.svg
├── supabase/
│   └── config.toml             # Auto-generated (do not edit project settings)
├── src/
│   ├── router.tsx              # TanStack Router bootstrap
│   ├── server.ts               # SSR entry
│   ├── start.ts                # Middleware + auth attacher
│   ├── styles.css              # Tailwind theme tokens
│   ├── routeTree.gen.ts        # AUTO-GENERATED (never edit)
│   │
│   ├── routes/                 # File-based routes
│   │   ├── __root.tsx          # Shell, <head>, CSP, providers
│   │   ├── index.tsx           # Home /
│   │   ├── what-we-do.tsx
│   │   ├── what-we-think.tsx
│   │   ├── about-us.tsx
│   │   ├── careers.tsx
│   │   ├── estimate.tsx
│   │   ├── resources.tsx
│   │   ├── auth.tsx            # Dual-tab (candidate / staff) sign-in
│   │   ├── privacy.tsx | terms.tsx | cookies.tsx | security.tsx
│   │   ├── forbidden.tsx
│   │   ├── sitemap[.]xml.ts    # Dynamic sitemap
│   │   └── _authenticated/     # Auth-gated subtree
│   │       ├── route.tsx       # Guard (redirects to /auth)
│   │       ├── my-applications.tsx
│   │       ├── onboarding.tsx
│   │       ├── profile.tsx
│   │       ├── employee.tsx
│   │       ├── manager.tsx
│   │       ├── hr.tsx
│   │       ├── admin.tsx
│   │       └── users.tsx       # Directory
│   │
│   ├── components/
│   │   ├── ui/                 # shadcn primitives (button, dialog, table…)
│   │   ├── site/               # Header, Footer, Illustration, StatusWidget,
│   │   │                       # NotificationBell, Turnstile, OnboardingDocUploader,
│   │   │                       # DojHoldingScreen, LegalLayout, TechStackGrid
│   │   └── hr/HrTasksPanel.tsx
│   │
│   ├── lib/                    # Server fns (*.functions.ts), server-only (*.server.ts),
│   │   │                       # pure helpers, and providers
│   │   ├── auth.tsx
│   │   ├── theme.tsx
│   │   ├── route-access.ts     # Role hierarchy matrix (pure)
│   │   ├── onboarding-docs.ts  # Doc requirement rules per track
│   │   ├── hr-decisions.ts     # Pure ATS decision helpers (tested)
│   │   ├── payroll-utils.ts
│   │   ├── csv.ts
│   │   ├── applications.functions.ts
│   │   ├── admin.functions.ts | adminTasks.functions.ts
│   │   ├── hr.functions.ts | hrTasks.functions.ts
│   │   ├── employee.functions.ts | manager side via mobility.functions.ts
│   │   ├── attendance.functions.ts | leave.functions.ts
│   │   ├── payroll.functions.ts | resignation.functions.ts
│   │   ├── onboarding.functions.ts | jobPostings.functions.ts
│   │   ├── audit.functions.ts | notifications.functions.ts
│   │   ├── lookups.functions.ts | publicConfig.functions.ts
│   │   ├── estimates.functions.ts | resources.functions.ts
│   │   ├── profile.functions.ts | users.functions.ts
│   │   ├── orgHierarchy.functions.ts
│   │   ├── notifications.server.ts   # Resend email templates
│   │   ├── rateLimit.server.ts       # Sliding-window limiter
│   │   ├── turnstile.server.ts       # Cloudflare Turnstile verify
│   │   └── __tests__/                # Vitest unit tests
│   │
│   ├── hooks/
│   │   ├── use-my-roles.tsx | use-is-admin.tsx | use-is-employee.tsx
│   │   ├── use-admin-redirect.tsx | use-lookups.ts | use-mobile.tsx
│   │
│   └── integrations/
│       ├── supabase/
│       │   ├── client.ts             # Browser (publishable key) — auto-gen
│       │   ├── client.server.ts      # Admin (service role) — server-only
│       │   ├── auth-middleware.ts    # requireSupabaseAuth (server fn)
│       │   ├── auth-attacher.ts      # Client bearer attacher
│       │   └── types.ts              # DB types — auto-gen
│       └── lovable/index.ts          # Lovable OAuth helpers
├── WORKFLOW.md                       # Flow → file map
└── PLATFORM_REFERENCE.md             # This file
```

**Conventions**

- Server logic: `*.functions.ts` (client-callable via `createServerFn`) and `*.server.ts` (never imported from client bundles).
- Route files are flat, dot-separated (`_authenticated/onboarding.tsx`), no `src/pages/`.
- shadcn primitives in `components/ui`, product components in `components/site` and `components/hr`.

---

## 2. Database Schema

Backend: Supabase (Lovable Cloud). All app tables live in the `public` schema.

### 2.1 Auth & Identity

| Table              | Purpose                                             | Key columns                                                           |
| ------------------ | --------------------------------------------------- | --------------------------------------------------------------------- |
| `profiles`         | Public-safe user profile mirrored from `auth.users` | `user_id (FK auth.users)`, `full_name`, `avatar_url`, timestamps      |
| `user_roles`       | RBAC — **roles never live on `profiles`**           | `user_id`, `role app_role`, `department_id`, unique `(user_id, role)` |
| `departments`      | Standard vocabulary                                 | `id`, `name dept_type`, `is_active`                                   |
| `employment_types` | Vocabulary                                          | `id`, `name`, `is_active`                                             |
| `status_options`   | Vocabulary for job/user statuses                    | `id`, `scope`, `value`, `label`, `sort_order`                         |

**Enums**

- `app_role`: `admin`, `hr`, `manager`, `employee`, `user`
- `dept_type`: Engineering, Operations, Human Resource, Management, Product, Design, Finance, Sales, Marketing, Customer Support, Legal, IT Infrastructure

### 2.2 Recruiting / ATS

| Table              | Purpose                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `job_postings`     | Open roles — `job_code` (e.g. `CGT-ENG-1001`), `track_type` (standard / hr_track / manager_track), `visibility` (draft / published / internal_only / closed / archived), department, employment type, salary band |
| `job_applications` | Applicant record — `user_id`, `role_id`, `role_title`, resume path/link, `status` (applied → screening → interviewing → offered → hired / rejected), `is_soft_deleted`, `deleted_at`                              |
| `interview_slots`  | Scheduled interviews with panel + outcome                                                                                                                                                                         |
| `referrals`        | Employee-submitted referrals                                                                                                                                                                                      |

### 2.3 Onboarding

| Table                  | Purpose                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding_records`   | Per-candidate onboarding: `application_id`, `emergency_contact`, `id_ack`, `code_of_conduct_ack`, `verification_status`, `doj`, `status` (draft → submitted → approved / declined) |
| `onboarding_documents` | Uploaded docs required per track (offer letter, PAN, Aadhaar, etc.)                                                                                                                |
| `identity_documents`   | Government IDs (private storage refs)                                                                                                                                              |

### 2.4 Employee Operations

| Table                | Purpose                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `employees`          | Employment record — designation, team, DOJ, work model, base salary, reporting manager/HR, probation, background/doc verification status |
| `attendance_records` | Daily check-in/out + regularization requests                                                                                             |
| `leave_requests`     | Leave lifecycle (pending → manager_approved → hr_approved / rejected)                                                                    |
| `employee_tasks`     | Kanban tasks assigned to staff                                                                                                           |
| `timesheets`         | Weekly time entries                                                                                                                      |
| `salary_structures`  | CTC components per employee                                                                                                              |
| `salary_slips`       | Monthly payslips                                                                                                                         |
| `resignations`       | Resignation workflow with notice period                                                                                                  |

### 2.5 Cross-cutting

| Table                  | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `audit_logs`           | Immutable actor/action/target trail                    |
| `in_app_notifications` | Bell UI, marked read per user                          |
| `rate_limits`          | Sliding-window buckets (used by `rateLimit.server.ts`) |
| `project_estimates`    | Leads from `/estimate`                                 |
| `resource_downloads`   | Gated whitepaper access log                            |

### 2.6 Storage Buckets (all private, signed URLs)

- `resumes` — applicant uploads
- `avatars` — profile photos
- `onboarding-docs` — signed offer letters, policies
- `identity-docs` — government IDs

### 2.7 Key Database Functions (RPCs)

| Function                                  | Purpose                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `has_role(uid, role)`                     | `SECURITY DEFINER` — safe RLS predicate                                          |
| `is_admin_user(uid)`                      | Fast admin check                                                                 |
| `apply_for_role(...)`                     | Atomic apply with advisory lock + 90-day cooldown                                |
| `complete_onboarding(id)`                 | Submits paperwork (status → submitted)                                           |
| `finalize_onboarding_role(id)`            | HR/Admin gate: promotes user to employee / manager / hr after DOJ + verification |
| `admin_set_user_role(target, role, dept)` | Admin-only role assignment                                                       |
| `list_directory()`                        | Admin/HR view of all users + employment data                                     |
| `assign_job_code()`                       | Trigger — generates `CGT-DEP-####`                                               |
| `grant_admin_for_seeded_emails()`         | Bootstraps admin role for seed emails                                            |
| `prevent_hr_admin_role_change()`          | Trigger — blocks HR from touching admin rows                                     |
| `prune_rate_limits()`                     | Housekeeping for `rate_limits`                                                   |

---

## 3. Row-Level Security (RLS) Model

**Every `public.*` table has RLS enabled**, and every `CREATE TABLE` migration is paired with explicit `GRANT`s (Supabase does not grant Data API access by default).

### 3.1 Role hierarchy (enforced in `src/lib/route-access.ts` and DB policies)

```
admin  >  hr  >  manager  >  employee  >  user (candidate)
```

### 3.2 Policy patterns

| Table                                                    | Read                                                                                                                  | Write                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `profiles`                                               | Owner + admin/HR                                                                                                      | Owner                                                                                 |
| `user_roles`                                             | Owner + admin/HR (via `has_role`)                                                                                     | Admin only; `prevent_hr_admin_role_change` trigger blocks HR from touching admin rows |
| `job_postings`                                           | Anonymous: only `visibility='published'` AND `track_type='standard'`. Staff: all except `hr_track` (unless HR/admin). | HR / Admin                                                                            |
| `job_applications`                                       | Owner sees own; HR/Admin see all except `hr_track` (HR excluded from those — Admin only)                              | Owner insert via `apply_for_role` RPC; status updates by HR/Admin                     |
| `onboarding_records`                                     | Owner + HR/Admin                                                                                                      | Owner for paperwork; HR/Admin for verification                                        |
| `onboarding_documents` / `identity_documents`            | Owner + HR/Admin                                                                                                      | Owner uploads; HR/Admin verify                                                        |
| `employees`                                              | Owner + reporting manager + HR/Admin                                                                                  | HR/Admin                                                                              |
| `attendance_records`                                     | Owner + manager (same dept) + HR/Admin                                                                                | Owner insert; owner/manager/HR update — strict `WITH CHECK` (no `true`)               |
| `leave_requests`                                         | Owner + manager + HR/Admin                                                                                            | Owner insert; manager approves stage 1; HR approves stage 2                           |
| `employee_tasks`                                         | Assignee + assigner + admin/HR                                                                                        | Admin/HR/Manager create; assignee updates status                                      |
| `audit_logs`                                             | Admin/HR read                                                                                                         | Server-side inserts only                                                              |
| `in_app_notifications`                                   | Owner read/mark-read                                                                                                  | Server-side inserts                                                                   |
| `rate_limits`, `resource_downloads`, `project_estimates` | Admin/HR read                                                                                                         | Server-side (service role)                                                            |

### 3.3 Security hardening in place

- `SECURITY DEFINER` functions: `EXECUTE` **revoked** from `PUBLIC` and `anon`; granted only to `authenticated`.
- Track isolation: `hr_track` applications invisible to HR (handled in `hr.functions.ts` + policies) — Admin only.
- HR ≠ Admin: `prevent_hr_admin_role_change` trigger stops HR privilege escalation.
- Sensitive columns (`profiles.email`, salary, identity docs) limited by column-level policies or fetched only through `SECURITY DEFINER` RPCs.
- CSP + Turnstile enforced at edge (see §5, §6).

---

## 4. Jobs, Cron & Background Work

Managed by Postgres (`pg_cron`) and server-fn invocations — the app runs on Cloudflare Workers, so there is **no long-lived Node process**.

| Job                                      | Schedule                                   | Implementation                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purge soft-deleted rejected applications | Daily                                      | `pg_cron` job — hard delete `job_applications` where `is_soft_deleted AND deleted_at < now() - interval '5 days'` + resume purge from `resumes` bucket |
| Purge rejected records after cooldown    | Daily                                      | `pg_cron` — enforces 90-day retention window on rejected applications                                                                                  |
| Rate-limit table prune                   | Opportunistic (~1 % of calls) + daily cron | `prune_rate_limits()` RPC called from `rateLimit.server.ts`                                                                                            |
| DOJ role finalization                    | On-demand                                  | HR/Admin triggers `finalize_onboarding_role(id)` after doc verification + DOJ set                                                                      |
| Job code generation                      | Per-insert trigger                         | `assign_job_code()` on `job_postings`                                                                                                                  |
| Admin bootstrap                          | On new user confirm                        | `grant_admin_for_seeded_emails()` trigger on `auth.users`                                                                                              |

**Public HTTP endpoints for external callers** live under `src/routes/api/public/*` (webhook signature required). None are wired to `pg_cron` at the moment; new scheduled jobs should call the SQL functions above directly.

---

## 5. Email Architecture

**Provider**: Resend (via `RESEND_API_KEY` secret).

### 5.1 Layers

```
Server function
   └── src/lib/notifications.server.ts    (renders HTML template + calls Resend)
   └── src/lib/notifications.functions.ts (createServerFn wrappers, in-app + email fan-out)
        │
        ├── in_app_notifications INSERT   → NotificationBell (realtime bell UI)
        └── Resend POST /emails           → recipient inbox
```

### 5.2 Triggers currently wired

| Event                                                                                    | Recipient              | Template                                         |
| ---------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------ |
| New job application submitted                                                            | `career@ciagotech.com` | `applications.functions.ts::renderEmail`         |
| Application status changed (`screening`, `interviewing`, `offered`, `hired`, `rejected`) | Applicant              | `notifications.server.ts::getStatusEmailContent` |
| Onboarding approved / DOJ set                                                            | Candidate              | `notifications.functions.ts`                     |
| Task assigned by admin                                                                   | Assignee               | `adminTasks.functions.ts`                        |
| Leave decision (manager / HR)                                                            | Requester              | `leave.functions.ts`                             |

### 5.3 Sender / deliverability

- `FROM`: `Ciago Technologies <onboarding@resend.dev>` (until custom domain is verified in Resend).
- Reply-to set to the applicant on inbound hire pipeline emails.
- All templates are inline-styled HTML (email-safe), light background `#ffffff` always.
- Resume links in emails are 7-day signed URLs from the `resumes` bucket.

### 5.4 Failure model

- Missing `RESEND_API_KEY` → warn + skip (never blocks the primary DB write).
- Resend HTTP errors are logged; the application/onboarding transaction still succeeds.
- Bounces / suppression are not currently tracked (roadmap: switch to Lovable managed email + webhook events).

---

## 6. Bot Confirmation (Cloudflare Turnstile)

All public write surfaces are protected by **Cloudflare Turnstile** + a Postgres-backed rate limiter + honeypot fields.

### 6.1 Components

| Layer               | File                                                            | Responsibility                                                                  |
| ------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Widget (client)     | `src/components/site/Turnstile.tsx`                             | Renders invisible/managed Turnstile widget, exposes `token`                     |
| Verify (server)     | `src/lib/turnstile.server.ts`                                   | POSTs token + IP to `https://challenges.cloudflare.com/turnstile/v0/siteverify` |
| Rate limit (server) | `src/lib/rateLimit.server.ts`                                   | Sliding window over `public.rate_limits`                                        |
| Secrets             | `TURNSTILE_SITE_KEY` (client) + `TURNSTILE_SECRET_KEY` (server) | Configured in Lovable Cloud secrets                                             |

### 6.2 Protected surfaces

| Endpoint                                             | Rate bucket                     | Extras                                               |
| ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------- |
| Job application submit (`applications.functions.ts`) | `apply` — 10 / hour / (user+IP) | Honeypot `hp`, Turnstile verify, 90-day cooldown RPC |
| Project estimator (`estimates.functions.ts`)         | `estimate`                      | Turnstile + honeypot                                 |
| Resource download unlock (`resources.functions.ts`)  | `resource`                      | Turnstile                                            |
| Contact / lead capture                               | `contact`                       | Turnstile                                            |

### 6.3 Verification flow

```
Browser  ─▶  Turnstile widget  ─▶  token
   │
   └─▶ createServerFn call (token in payload)
          │
          ├─ enforceRateLimit({ bucket, key: `${userId}:${ip}` })
          ├─ verifyTurnstile(token, ip, host)   → 400 on failure
          ├─ honeypot check (silent drop)
          └─ business logic (RPC / insert)
```

Failures return a user-safe error; rate-limiter failures **fail open** on infra errors so a DB blip cannot take forms down.

---

## 7. SEO & AEO

### 7.1 Per-route metadata

Every route defines its own `head()` (TanStack) with:

- Unique `<title>` **≤ 60 chars**
- Unique `<meta name="description">` **≤ 160 chars**
- `og:title`, `og:description`, `og:type`, `twitter:card`
- `og:image` / `twitter:image` at leaf routes when a meaningful hero exists
- Canonical relative URL

The root route (`src/routes/__root.tsx`) provides the shell + CSP headers only — never a title/description.

### 7.2 Structured data (JSON-LD)

| Route            | Schema                                                    |
| ---------------- | --------------------------------------------------------- |
| `/`              | `Organization`                                            |
| `/what-we-do`    | `Service` (×4) + `FAQPage`                                |
| `/what-we-think` | `WebPage`                                                 |
| `/about-us`      | `AboutPage`                                               |
| `/careers`       | `JobPosting` (dynamic, one per active `job_postings` row) |

### 7.3 Crawler config

- `public/robots.txt`
  - `Allow: /`
  - `Disallow: /auth`, `Disallow: /lovable/`
  - `Sitemap:` directive with absolute URL
- `src/routes/sitemap[.]xml.ts` — dynamic sitemap for all public routes (absolute `BASE_URL`)
- `public/llms.txt` — AEO summary for LLM ingestion (company overview, offerings, page index)

### 7.4 Performance / a11y signals crawlers reward

- Semantic HTML (`<main>`, `<section>`, `<article>`, `<nav>`)
- Single `<h1>` per page
- Alt text on all `Illustration` and image components
- Lazy-loaded below-the-fold imagery
- Responsive viewport + prefers-color-scheme (dark default)
- CSP meta tag in `__root.tsx` blocks third-party origin injection

### 7.5 Analytics / event tracking

- `trackEvent` fires on: apply-clicked, estimate-submitted, resource-downloaded, auth-completed.
- Sent to the browser console + (when configured) Lovable Analytics.

---

## 8. Migration: Supabase → Neon + Cloudflare R2

### 8.1 Migration State

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Neon Project Setup + Schema Migration | **COMPLETE** |
| 2 | auth.uid() RLS Compatibility Layer | **COMPLETE** |
| 3 | Prisma ORM Setup + Schema Definition | **COMPLETE** |
| 4 | Clerk Authentication Simplified | **IN PROGRESS** |
| 5 | Database Client Migration | NOT STARTED |
| 6 | Storage Migration (R2) | NOT STARTED |
| 7 | Dual-Write Period + Validation | NOT STARTED |
| 8 | Cutover + Decommission | NOT STARTED |

### 8.2 Neon Database

- **Connection**: `NEON_DATABASE_URL` in `.env`
- **Schema**: 26 public tables + `auth.users` + `auth.uid()` custom function
- **RLS**: 83 public-schema policies active (storage policies excluded — moving to R2)
- **Roles**: `anon`, `authenticated`, `service_role` created for DDL/policy validation
- **Auth function**: `auth.uid()` reads `current_setting('app.current_user_id', true)` — set via `SET LOCAL` per transaction

### 8.3 Key Decisions

1. `auth.uid()` uses `current_setting('app.current_user_id', true)` — transaction-scoped via `SET LOCAL`
2. Storage policies NOT migrated (R2 handles access control at application layer)
3. `GRANT`/`REVOKE` to Supabase roles retained as no-ops for DDL validity
4. Migration executes per-statement (not per-file batch) to isolate failures
5. The "104+ policies" in `plans.md` includes ~20 `storage.objects` policies — net public-schema count is 83

### 8.4 Migration Tooling

| Script | Purpose |
|--------|---------|
| `scripts/migrate-schema.ts` | Applies Supabase migrations to Neon (v5, working) |
| `scripts/neon-validate.ts` | Validates Stage 1 acceptance criteria |
| `supabase/migrations-neon.sql` | Generated combined SQL output |

---

_Last generated as a companion to `WORKFLOW.md`._
