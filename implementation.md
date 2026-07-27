# Ciago Spark — Living Implementation Journal

> **This document is the project's canonical engineering history and execution log.**
> It must always reflect the latest project state. Any engineer or AI must be able to
> immediately understand what has been implemented, what is in progress, what remains,
> why every decision was made, and where every change occurred.

---

## Project Progress Tracker

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Clerk Documentation & Architecture Audit | 🟡 In Progress |
| Phase 2 | Neon + Cloudflare R2 Migration Planning | ⬜ Not Started |
| Phase 3 | ConfigCat Feature Flag Planning | ⬜ Not Started |
| Phase 4 | Enterprise Dockerization & Deployment Architecture | ⬜ Not Started |

---

## Pre-Existing Work (Clerk Migration — 15 Steps, COMPLETE)

The Clerk auth-provider migration was completed across 15 incremental steps prior to
this documentation initiative. This section documents what already exists in the codebase.

### Summary

The Ciago Spark project underwent a 15-step migration from Lovable-Cloud Supabase
Authentication to Clerk as the authentication provider, gated behind the `USE_CLERK_AUTH`
feature flag. The migration was **auth-provider-only**: Postgres remains the identity,
authorization, and RLS source of truth. Clerk handles authentication (who you are);
Postgres handles authorization (what you can do).

### Key Architectural Decisions

1. **Sidecar mapping table** (`public.clerk_user_map`): Maps Clerk user IDs (opaque
   strings) to Supabase `auth.users` UUIDs. This preserves every existing FK, RLS policy,
   stored procedure, and trigger — no database schema changes beyond the mapping table.

2. **GoTrue JWT issuance**: The Clerk auth middleware (`auth-middleware.ts` Clerk branch)
   verifies the Clerk Session JWT, provisions/maps the sidecar row, then mints a GoTrue
   JWT (via `generateLink` + `verifyOtp`) whose `sub` is the mapped `auth.users.id`. This
   means `auth.uid()` evaluates identically under both auth paths — zero RLS rewrites.

3. **Feature flag gating**: `USE_CLERK_AUTH` (read from `VITE_USE_CLERK_AUTH` /
   `process.env.USE_CLERK_AUTH`) controls every branch. Flag-off = legacy Supabase auth,
   byte-equivalent to pre-migration. Flag-on = Clerk auth. Rollback = flip the flag.

4. **Token bridge**: `window.__clerkAuthToken` is published by `<ClerkTokenBridge />`
   in `client.tsx` and consumed by the client-side `auth-attacher.ts` to attach Bearer
   tokens to server-fn RPCs. This avoids calling React hooks from non-component middleware.

5. **Eager ClerkProvider**: `ClerkProviderBoundary` mounts `<ClerkProvider>` eagerly
   (not lazily) when the flag is on. Lazy mounting caused `useClerkSignal can only be
   used within <ClerkProvider />` crashes during SSR.

### Files Created by the Migration

| File | Purpose |
|------|---------|
| `src/integrations/clerk/client.tsx` | ClerkProviderBoundary — flag-aware mount point for Clerk. Eager ClerkProvider + ClerkTokenBridge. |
| `src/integrations/clerk/forms.tsx` | Clerk-backed auth form components (signIn, signUp, social). Lazy-loaded. |
| `src/integrations/clerk/provision.server.ts` | Clerk→Supabase identity provisioning (clerk_user_map). Idempotent. Server-only. |
| `src/integrations/clerk/issue-token.server.ts` | GoTrue JWT issuer for Clerk auth path. Cached per auth_user_id. Server-only. |
| `src/integrations/clerk/ensure-mapping.server.ts` | First-login provisioning server fn. Called by useEnsureUserMapped hook. |
| `src/integrations/clerk/__tests__/issue-token.server.test.ts` | Unit tests for token issuer. |
| `src/integrations/clerk/__tests__/provision.server.test.ts` | Unit tests for provisioner. |
| `src/integrations/clerk/__tests__/rls-audit.test.ts` | RLS preservation invariant test (CI-enforced). |
| `src/hooks/use-ensure-user-mapped.ts` | Client hook: ensures clerk_user_map row exists on first mount. |
| `scripts/rls-audit.ts` | CLI static audit: verifies all RLS policies route through auth.uid(). |
| `scripts/clerk-test-user.ts` | CLI: provisions dummy Clerk user for E2E testing. |
| `supabase/migrations/20260724201018_26f2d3a1-…-7a0e6f1c9b25.sql` | Migration: creates clerk_user_map table, indexes, trigger, RLS. |
| `docs/STEP-13-RLS-VERIFICATION.md` | RLS verification documentation. |
| `docs/STEP-14-CUTOVER.md` | Cutover runbook. |

### Files Modified by the Migration

| File | What Changed |
|------|--------------|
| `src/lib/auth.tsx` | Added ClerkAuthProvider branch with normalizeClerkUser; legacy path preserved. |
| `src/lib/feature-flags.ts` | Added USE_CLERK_AUTH flag + FEATURE_FLAGS/FeatureKey/Capabilities types. |
| `src/lib/portal.functions.ts` | Created: server fn resolveMyPortal (replaces client-side resolver for Clerk branch). |
| `src/lib/roles.functions.ts` | Created: getMyRoles server fn (role hooks now defer to this under Clerk). |
| `src/integrations/supabase/auth-middleware.ts` | Added Clerk branch (verifyToken → provision → issueToken → buildUserClient). |
| `src/integrations/supabase/auth-attacher.ts` | Added Clerk branch (reads window.__clerkAuthToken). |
| `src/routes/__root.tsx` | Added ClerkProviderBoundary wrapper + EnsureUserMapped + Clerk CSP domains. |
| `src/routes/auth.tsx` | Flag-aware dispatcher: lazy-loads ClerkForms when flag on; legacy forms preserved. |
| `src/routes/_authenticated/route.tsx` | Added Clerk branch (reads window.__clerkAuthToken for guard). |
| `src/hooks/use-my-roles.tsx` | Added Clerk branch (defers to getMyRoles server fn). |
| `src/hooks/use-is-admin.tsx` | Added Clerk branch (defers to getMyRoles server fn). |
| `src/hooks/use-is-employee.tsx` | Added Clerk branch (defers to getMyRoles server fn). |
| `package.json` | Added @clerk/clerk-react, @clerk/tanstack-react-start, @clerk/backend, @configcat/sdk, configcat-react. |

### Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `USE_CLERK_AUTH` | Server | Master feature flag (0/1). Controls Clerk vs legacy auth. |
| `VITE_USE_CLERK_AUTH` | Client | Same flag, Vite-injected for client bundle. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Client | Clerk publishable key (safe for browser bundle). |
| `CLERK_PUBLISHABLE_KEY` | Server | Fallback for SSR if VITE_ prefix not set. |
| `CLERK_SECRET_KEY` | Server-only | Clerk secret key for verifyToken + createClerkClient. NEVER prefixed with VITE_. |
| `CONFIGCAT_SDK_KEY` | Server/Client | ConfigCat SDK key (development environment). |
| `SUPABASE_URL` | Server | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Supabase publishable (anon) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Supabase service role key — bypasses RLS. NEVER in client bundle. |
| `VITE_SUPABASE_URL` | Client | Same as SUPABASE_URL, Vite-injected. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Same as SUPABASE_PUBLISHABLE_KEY, Vite-injected. |
| `RESEND_API_KEY` | Server-only | Resend email API key. |
| `TURNSTILE_SITE_KEY` | Client | Cloudflare Turnstile site key. |
| `TURNSTILE_SECRET_KEY` | Server-only | Cloudflare Turnstile secret key. |
| `SUPABASE_PROJECT_ID` | Server | Supabase project ID. |

---

## Entry 1 — Documentation Initiative (Phase 1-4 Planning)

### Metadata

- **Date**: 2026-07-27
- **Phase**: Phase 1 — Clerk Documentation & Architecture Audit
- **Feature**: Enterprise Documentation Package
- **Engineer / AI**: Hermes Agent (z-ai/glm-5.2 via nvidia)
- **Status**: 🟡 In Progress
- **Version**: 1.0.0

### Objective

Create an enterprise-grade documentation package covering:
1. Clerk integration architecture audit (`clerk.md`)
2. Canonical engineering workflow reference (`workflow.md` rewrite)
3. Platform technical reference (`platform_reference.md` redesign)
4. Neon + Cloudflare R2 migration planning (`plans.md`)
5. ConfigCat feature flag planning (`feature-flags.md`)
6. Dockerization & deployment architecture (`docker.md` + `docker-plan.md`)

### Scope

- Authentication (Clerk)
- Authorization (Postgres RLS)
- Database (Supabase → Neon migration planning)
- Storage (Supabase Storage → Cloudflare R2)
- Feature Flags (ConfigCat)
- Deployment (Docker)
- Middleware
- SSR/CSR
- Security
- Environment Management
- CI/CD
- Documentation

### Previous Step

The 15-step Clerk migration is COMPLETE. All steps verified with build, test, and the
RLS invariant. The codebase is production-ready with Clerk as the auth provider.

### Current Step

Creating the implementation journal, then proceeding through Phase 1 deliverables.

### Next Recommended Step

Complete Phase 1: clerk.md → workflow.md → platform_reference.md, then proceed to
Phase 2 (plans.md), Phase 3 (feature-flags.md), and Phase 4 (docker.md + docker-plan.md).

### AI Handover Notes

**Current project state**: Clerk migration complete. The codebase runs TanStack Start
+ React 19 + Vite 8 + Bun + Supabase + Clerk + ConfigCat + shadcn/ui on Cloudflare
Workers (via Nitro). 36 migrations define the database schema with 104 RLS policies.
All policies route through `auth.uid()` — verified by the static RLS audit.

**Completed work**: 15-step Clerk migration (auth-provider swap only, Postgres unchanged).

**Pending work**: 4 phases of documentation (this initiative).

**Implementation order**: Phase 1 (clerk.md, workflow.md, platform_reference.md) →
Phase 2 (plans.md) → Phase 3 (feature-flags.md) → Phase 4 (docker.md, docker-plan.md).

**Important architectural decisions**:
- Postgres remains the sole source of truth for authorization and RLS.
- Clerk handles authentication only via sidecar mapping to auth.users.
- GoTrue JWT issuance ensures auth.uid() compatibility.
- Feature flag `USE_CLERK_AUTH` enables/disables the entire Clerk path.
- ConfigCat SDK is installed but only `maintenanceMode` is wired into FEATURE_FLAGS.

**Files requiring future modification**: See each phase's deliverable for specifics.

**Assumptions explicitly avoided**: No assumptions made — all information gathered from
direct codebase inspection.

**Blockers**: None identified.

**Recommendations for the next AI or engineer**:
- Read this journal first.
- Read `prompt.md` for the full task specification.
- Follow the phase order strictly; each phase builds on the previous.
- Do NOT implement anything — phases 2-4 are planning only ("DO NOT IMPLEMENT").
- Verify all claims against the actual codebase; never trust documentation blindly.
