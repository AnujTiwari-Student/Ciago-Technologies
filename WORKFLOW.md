# Ciago Technologies — Site Workflow & File Map

A single-reference map of every major user flow on the platform and the files that power it. Paths are project-relative.

---

## 1. Application Shell & Infrastructure

| Concern | File |
| --- | --- |
| Router bootstrap | `src/router.tsx` |
| SSR entry | `src/server.ts` |
| Start config (middleware, auth attacher) | `src/start.ts` |
| Root layout, `<head>`, CSP, providers | `src/routes/__root.tsx` |
| Auth-gated layout (`/_authenticated/*`) | `src/routes/_authenticated/route.tsx` |
| Global styles / Tailwind theme | `src/styles.css` |
| Theme (dark/light) provider | `src/lib/theme.tsx` |
| Auth context/provider | `src/lib/auth.tsx` |
| Auto-generated route tree (do not edit) | `src/routeTree.gen.ts` |

**Integrations**
- Supabase browser client — `src/integrations/supabase/client.ts`
- Supabase admin (server-only) — `src/integrations/supabase/client.server.ts`
- Auth middleware (server fn) — `src/integrations/supabase/auth-middleware.ts`
- Auth token attacher (client) — `src/integrations/supabase/auth-attacher.ts`
- Generated DB types — `src/integrations/supabase/types.ts`
- Lovable OAuth helper — `src/integrations/lovable/index.ts`

---

## 2. Public Marketing Site

Flow: visitor lands on `/` → browses services, thinking, careers, resources → optionally requests estimate or applies.

| Page | Route file | Notes |
| --- | --- | --- |
| Home | `src/routes/index.tsx` | Hero + `BusinessServices` grid |
| What We Do | `src/routes/what-we-do.tsx` | Tabbed practice areas + FAQ (JSON-LD) |
| What We Think | `src/routes/what-we-think.tsx` | Vision / thought leadership |
| About Us | `src/routes/about-us.tsx` | Story, values, timeline |
| Careers (list + apply) | `src/routes/careers.tsx` | Requires auth to apply |
| Project Estimator | `src/routes/estimate.tsx` | Uses `src/lib/estimates.functions.ts` |
| Resources (gated) | `src/routes/resources.tsx` | Uses `src/lib/resources.functions.ts` |
| Legal — Privacy | `src/routes/privacy.tsx` |  |
| Legal — Terms | `src/routes/terms.tsx` |  |
| Legal — Cookies | `src/routes/cookies.tsx` |  |
| Legal — Security | `src/routes/security.tsx` |  |
| Forbidden (403) | `src/routes/forbidden.tsx` |  |
| Sitemap | `src/routes/sitemap[.]xml.ts` |  |

**Shared site chrome**
- Header/nav — `src/components/site/Header.tsx`
- Footer — `src/components/site/Footer.tsx`
- Illustrations — `src/components/site/Illustration.tsx`
- Tech stack grid — `src/components/site/TechStackGrid.tsx`
- Live status widget — `src/components/site/StatusWidget.tsx`
- Legal layout — `src/components/site/LegalLayout.tsx`
- Turnstile captcha — `src/components/site/Turnstile.tsx` + `src/lib/turnstile.server.ts`

**SEO/AEO**: per-route `head()`, `public/robots.txt`, `public/llms.txt`, sitemap route above.

---

## 3. Authentication & Portal Routing

Flow: `/auth` (dual tabs — Candidate / Employee) → Supabase sign-in → post-login destination resolved by role.

| Concern | File |
| --- | --- |
| Sign-in / sign-up page | `src/routes/auth.tsx` |
| Post-login role routing | `src/routes/auth.tsx` (`resolvePostLoginDestination`) |
| Auth guard for `/_authenticated/*` | `src/routes/_authenticated/route.tsx` |
| Access matrix (pure) | `src/lib/route-access.ts` |
| Role hooks | `src/hooks/use-my-roles.tsx`, `use-is-admin.tsx`, `use-is-employee.tsx` |
| Admin redirect helper | `src/hooks/use-admin-redirect.tsx` |
| Rate limiting | `src/lib/rateLimit.server.ts` |

Rules enforced:
- Candidate on Employee tab → signed out + `/forbidden`.
- Staff on Candidate tab → signed out with prompt.
- `admin > hr > manager > employee > user` role hierarchy (`src/lib/route-access.ts`).

---

## 4. Candidate Lifecycle

Flow: Apply on `/careers` → track on `/my-applications` → receive offer → complete `/onboarding` → land in `/employee` (or DOJ holding screen).

| Step | Route / component | Server logic |
| --- | --- | --- |
| Browse & apply | `src/routes/careers.tsx` | `src/lib/applications.functions.ts`, `src/lib/applications.query.ts` |
| My applications | `src/routes/_authenticated/my-applications.tsx` | `src/lib/applications.functions.ts` |
| Onboarding wizard | `src/routes/_authenticated/onboarding.tsx` | `src/lib/onboarding.functions.ts`, `src/lib/onboarding-docs.ts` |
| Doc uploader (candidate) | `src/components/site/OnboardingDocUploader.tsx` | Storage bucket `onboarding-docs` |
| DOJ holding screen | `src/components/site/DojHoldingScreen.tsx` | Countdown until DOJ |
| Profile | `src/routes/_authenticated/profile.tsx` | `src/lib/profile.functions.ts` |

Notifications during lifecycle:
- Bell UI — `src/components/site/NotificationBell.tsx`
- Server — `src/lib/notifications.functions.ts`, `src/lib/notifications.server.ts` (Resend email templates)
- Audit trail — `src/lib/audit.functions.ts`

---

## 5. Employee Portal (`/employee`)

Flow: staff (or accepted candidate awaiting DOJ) opens portal → sees dashboard, attendance, leave, tasks, referrals.

| Feature | File(s) |
| --- | --- |
| Portal shell | `src/routes/_authenticated/employee.tsx` |
| Attendance + regularization | `src/lib/attendance.functions.ts` |
| Leave requests | `src/lib/leave.functions.ts` |
| Employee ops (tasks, referrals) | `src/lib/employee.functions.ts` |
| Payroll view + helpers | `src/lib/payroll.functions.ts`, `src/lib/payroll-utils.ts` |
| Resignation | `src/lib/resignation.functions.ts` |
| Internal mobility | `src/lib/mobility.functions.ts` |

---

## 6. Manager Portal (`/manager`)

| Feature | File |
| --- | --- |
| Portal shell (pipeline, directory, internal careers) | `src/routes/_authenticated/manager.tsx` |
| Approvals (leave / regularization) | `src/lib/leave.functions.ts`, `src/lib/attendance.functions.ts` |
| Team directory | `src/lib/orgHierarchy.functions.ts` |

Scope: managers see only their department (`useMyRoles().departmentId`).

---

## 7. HR Portal (`/hr`)

Flow: HR reviews the ATS pipeline → verifies onboarding documents → sets salary + DOJ → grants role via `finalize_onboarding_role` RPC.

| Feature | File |
| --- | --- |
| Portal shell | `src/routes/_authenticated/hr.tsx` |
| HR business logic (pipeline, decisions, signed URLs) | `src/lib/hr.functions.ts` |
| Pure decision helpers (testable) | `src/lib/hr-decisions.ts` |
| Doc rules (which docs per role/track) | `src/lib/onboarding-docs.ts` |
| Internal HR tasks Kanban | `src/components/hr/HrTasksPanel.tsx`, `src/lib/hrTasks.functions.ts` |
| Job postings (HR-side) | `src/lib/jobPostings.functions.ts` |

Track isolation: HR **cannot** review candidates flagged `hr_track` — only Admin can (enforced in `src/lib/hr.functions.ts`).

---

## 8. Admin Command Center (`/admin`, `/users`)

Flow: Admin dashboard → 4 tabs (Overview KPIs, Applications, Tasks, Jobs) + full user directory at `/users`.

| Feature | File |
| --- | --- |
| Command center | `src/routes/_authenticated/admin.tsx` |
| User directory / edit drawer | `src/routes/_authenticated/users.tsx` |
| Admin server logic | `src/lib/admin.functions.ts` |
| Task assignment | `src/lib/adminTasks.functions.ts` |
| Users management | `src/lib/users.functions.ts` |
| Job postings CRUD | `src/lib/jobPostings.functions.ts` |
| Lookups (departments, employment types, statuses) | `src/lib/lookups.functions.ts` + `src/hooks/use-lookups.ts` |
| Public runtime config | `src/lib/publicConfig.functions.ts` |

Admin owns fallback rights: when no HR exists, admin performs HR duties (doc verify, salary, DOJ).

---

## 9. Cross-Cutting Concerns

| Concern | File |
| --- | --- |
| Audit logging | `src/lib/audit.functions.ts` |
| In-app notifications | `src/lib/notifications.functions.ts` |
| Email templates (Resend) | `src/lib/notifications.server.ts` |
| CSV export | `src/lib/csv.ts` |
| Runtime error capture | `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `src/lib/lovable-error-reporting.ts` |
| Utilities | `src/lib/utils.ts` |
| shadcn/ui primitives | `src/components/ui/*` |

---

## 10. Data Layer (Supabase / Lovable Cloud)

- Tables in play: `job_postings`, `job_applications`, `user_roles`, `employees`, `identity_documents`, `onboarding_documents`, `interview_slots`, `leave_requests`, `attendance_records`, `employee_tasks`, `audit_logs`, `in_app_notifications`, `rate_limits`, `departments`, `employment_types`, `status_options`, `profiles`.
- Storage buckets: `onboarding-docs` (private, signed URLs via `src/lib/hr.functions.ts`).
- Key RPCs: `has_role`, `apply_for_role`, `finalize_onboarding_role`, `complete_onboarding`.
- Config: `supabase/config.toml` (auto-generated — do not edit project-level settings).

---

## 11. End-to-End Happy Path (visual)

```text
Visitor
  │
  ├─► /  ─►  /what-we-do  ─►  /careers  ─►  /auth (Candidate)
  │                                            │
  │                                            ▼
  │                                     /my-applications
  │                                            │
  │  (Admin/HR extend offer, notify)           ▼
  │                                     /onboarding  ─►  docs uploaded
  │                                                          │
  │                              (HR/Admin verify + set DOJ + salary)
  │                                                          │
  │                                                          ▼
  │                                       role granted (employee/hr/manager)
  │                                                          │
  │                                                          ▼
  │                        DojHoldingScreen  ─►  /employee  (portal live)
  │
Staff sign-in
  │
  └─► /auth (Employee) ─► role router ─► /admin | /hr | /manager | /employee
```

---

_Last updated as part of the WORKFLOW.md generation._
