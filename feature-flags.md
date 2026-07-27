# ConfigCat Feature Flag Architecture & Implementation Plan

> **Project:** Ciago Spark
> **Phase:** 3 — ConfigCat Feature Flag Planning
> **Deliverable:** `feature-flags.md`
> **Status:** Configuration packages installed (`@configcat/sdk`, `configcat-react`); integration NOT yet implemented. This document is the plan.
> **Do not implement.** This is planning only.
> **Last code inspection:** 2026-07-27 against the working tree at `C:\\Ciago Spark`

---

# 1. Executive Summary

Ciago Spark has a nascent feature-flag system. The `USE_CLERK_AUTH` boolean flag (an environment-variable-driven runtime toggle) is the only active flag wired through the codebase. A `FEATURE_FLAGS` constant maps 15 named capability keys — but these are **string labels**, not runtime-evaluated toggles: no code reads them from ConfigCat, no component gates on them. The `@configcat/sdk` and `configcat-react` packages are installed but not integrated; `src/lib/feature-flags.server.ts` is an empty file intended for server-side evaluation.

This document covers:
- the existing flag surface and its limitations
- a complete ConfigCat integration architecture for client + server evaluation on Cloudflare Workers (edge runtime)
- a stage-by-stage implementation plan
- security, performance, testing, and CI/CD considerations

---

# 2. Current Implementation Analysis

## 2.1 File: `src/lib/feature-flags.ts`

### Types

```typescript
export type FeatureFlags = { USE_CLERK_AUTH: boolean };
export type FeatureKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];
export type Capabilities = Record<FeatureKey, boolean>;
```

- `FeatureFlags` is a type with a single key, `USE_CLERK_AUTH: boolean`. This is the **runtime** flag — read via `readFlag`.
- `FeatureKey` is the union of all `FEATURE_FLAGS` string values (e.g. `"employeePortalEnabled"`, `"maintenanceMode"`).
- `Capabilities` is `Record<FeatureKey, boolean>` — a map from capability key to boolean. **No code instantiates this type.**

### `readFlag` function

```typescript
function readFlag(name: keyof FeatureFlags, fallback: boolean): boolean {
  const viteRaw = import.meta.env?.[`VITE_${name}`];
  const procRaw = process.env?.[name];
  const raw = viteRaw ?? procRaw;
  if (raw === undefined) return fallback;
  return raw === "1" || raw === "true";
}
```

Reads `VITE_USE_CLERK_AUTH` (client, Vite build-time) then `USE_CLERK_AUTH` (server, `process.env`). Returns `true` for `"1"` or `"true"`. Default: `false`.

### `FLAGS` object

```typescript
export const FLAGS: FeatureFlags = { USE_CLERK_AUTH: readFlag("USE_CLERK_AUTH", false) };
```

### `FEATURE_FLAGS` constant

15 string-valued capability keys (not booleans, not evaluated):

| Key | String Value | Purpose (intended) |
|-----|-------------|-------------------|
| `employeePortal` | `"employeePortalEnabled"` | Gate employee portal |
| `managerPortal` | `"managerPortalEnabled"` | Gate manager portal |
| `hrPortal` | `"hrPortalEnabled"` | Gate HR portal |
| `onboardingPortal` | `"onboardingPortalEnabled"` | Gate onboarding wizard |
| `documentUploads` | `"documentUploadsEnabled"` | Gate file uploads |
| `interviewScheduling` | `"interviewSchedulingEnabled"` | Gate interview slot management |
| `offerManagement` | `"offerManagementEnabled"` | Gate offer creation |
| `leaveManagement` | `"leaveManagementEnabled"` | Gate leave workflows |
| `attendance` | `"attendanceEnabled"` | Gate attendance tracking |
| `timesheets` | `"timesheetsEnabled"` | Gate timesheet entry |
| `payrollPortal` | `"payrollPortalEnabled"` | Gate payroll views |
| `referrals` | `"referralsEnabled"` | Gate referral submission |
| `internalMobility` | `"internalMobilityEnabled"` | Gate internal job posting |
| `advancedAnalytics` | `"advancedAnalyticsEnabled"` | Gate advanced dashboard |
| `maintenanceMode` | `"maintenanceMode"` | Global kill-switch banner |

## 2.2 File: `src/lib/feature-flags.server.ts`

**Empty** (0 bytes). Intended for server-side ConfigCat SDK initialization. Not implemented.

## 2.3 Consumers of `FLAGS.USE_CLERK_AUTH`

11 files read `FLAGS`:

| File | Usage |
|------|-------|
| `src/lib/auth.tsx` | Branches AuthProvider (Clerk vs Supabase) |
| `src/integrations/clerk/client.tsx` | Gates ClerkProvider |
| `src/integrations/supabase/auth-attacher.ts` | Branches Bearer source |
| `src/integrations/supabase/auth-middleware.ts` | Branches token verification |
| `src/routes/auth.tsx` | Branches form components (lazy ClerkForms vs legacy) |
| `src/routes/_authenticated/route.tsx` | Branches guard (window vs getUser) |
| `src/hooks/use-ensure-user-mapped.ts` | No-op when flag off |
| `src/hooks/use-is-admin.tsx` | Branches role-source (server fn vs direct query) |
| `src/hooks/use-is-employee.tsx` | Same pattern |
| `src/hooks/use-my-roles.tsx` | Same pattern |
| `src/lib/feature-flags.ts` | Self (definition) |

## 2.4 What's missing

1. **No ConfigCat SDK initialization** — `feature-flags.server.ts` is empty; no client-side provider mounted.
2. **No runtime evaluation of `FEATURE_FLAGS`** — the 15 strings are exported but never read from ConfigCat.
3. **No response-time evaluation hook** — `isOn(key)` helper missing.
4. **No environment separation** — a single `CONFIGCAT_SDK_KEY` is in `.env` (development). Staging/production keys not documented.
5. **No SSR evaluation** — flag values are not fetched server-side during SSR.
6. **No cache / offline fallback** — if ConfigCat is unreachable, no default values are configured.

---

# 3. Recommended Additional Feature Flags

The 15 existing capability flags are **portal-level gates**. The following additional flags are recommended **only when architecturally justified** — not for the sake of completeness.

## 3.1 Recommended (high architectural justification)

| Flag Key | Type | Justification |
|----------|------|---------------|
| `maintenanceMode` | boolean | **Already in `FEATURE_FLAGS`.** Should be wired as a global banner + read-only banner. Kill-switch for planned downtime. |
| `neonMigrationEnabled` | boolean | Phase 2 plans a Supabase → Neon migration. A feature flag allows gradual cutover (read from Neon for 10% of requests, then 100%). Mirrors the proven `USE_CLERK_AUTH` pattern. |
| `r2StorageEnabled` | boolean | Phase 2 plans Supabase Storage → Cloudflare R2. A flag allows gradual cutover of upload/download paths. |
| `newCandidateExperience` | boolean | If the careers page is redesigned, a flag allows A/B testing the old vs new experience. Justified because the careers page directly affects conversion. |
| `killApplications` | boolean | Emergency stop for the job application form (e.g. all positions filled). Prevents new submissions without a code change. |

## 3.2 Consider (medium justification)

| Flag Key | Type | Justification |
|----------|------|---------------|
| `advancedAuditLogging` | boolean | Toggle verbose audit logging during security incidents without redeploy. |
| `rateLimitScaleFactor` | number (1.0 default) | Scale rate limits up/down without a code change. Useful during traffic spikes or for temporary relaxation during load tests. |

## 3.3 Not recommended (low justification)

| Flag Key | Why not |
|----------|---------|
| `experimentalUiV2` | Use A/B testing tools (e.g. GrowthBook, PostHog) for UI experiments. ConfigCat is for infrastructure/feature gates, not UI variants. |
| `percentageRollout` | ConfigCat supports percentage targeting natively; no separate flag needed. |
| `regionalRollout` | Cloudflare Workers run on edge; geographic targeting at the flag level is not meaningful. Use Cloudflare's built-in geo-routing instead. |
| `userSpecificFlags` | ConfigCat supports user-level targeting natively (via targeting rules). No special flag needed. |
| `apiVersioning` | API versioning should be a route-level concern (`/v1/`, `/v2/`), not a feature flag. |

---

# 4. ConfigCat Architecture

## 4.1 SDK selection

| Surface | SDK | Why |
|---------|-----|-----|
| Client (React) | `configcat-react` ^5.1.0 | Already installed. Provides `<ConfigCatProvider>` + `useFlag()` hook. Polls ConfigCat CDN for config JSON. |
| Server (server fns, middleware) | `@configcat/sdk` ^1.1.0 | Already installed. Lightweight Node/edge-compatible SDK. No React dependency. |

## 4.2 Initialization (server-side)

`src/lib/feature-flags.server.ts` (currently empty) must be replaced with:

```typescript
import { createClient } from "@configcat/sdk";

// Singleton client — created once per worker isolate.
let _client: ReturnType<typeof createClient> | undefined;

export function getConfigCatClient() {
  if (_client) return _client;
  const sdkKey = process.env.CONFIGCAT_SDK_KEY;
  if (!sdkKey) {
    console.warn("[configcat] CONFIGCAT_SDK_KEY not set. All flags fall back to defaults.");
    return null;
  }
  _client = createClient(sdkKey, {
    // Polling mode: auto-poll. Refreshes config from CDN every 60s.
    // On Cloudflare Workers, the isolate may be recycled before 60s,
    // so each fresh isolate fetches the latest config on first call.
    pollIntervalSeconds: 60,
    // Offline mode not needed — CDN is always reachable from Workers.
  });
  return _client;
}
```

### Why auto-poll (not lazy-load)

Cloudflare Worker isolates are short-lived. Lazy-load would fetch on first `isOn()` call, adding ~100ms latency to the first request. Auto-poll fetches the config on client creation (module load) and refreshes every 60s. On a fresh isolate, the first request pays the fetch cost; subsequent requests within the isolate's lifetime read from the in-memory cache.

### Fallback behavior

If `CONFIGCAT_SDK_KEY` is not set, `getConfigCatClient()` returns `null`. Callers must handle this:

```typescript
export async function isFlagOn(key: string, defaultValue = false): Promise<boolean> {
  const client = getConfigCatClient();
  if (!client) return defaultValue;
  try {
    return await client.getBooleanFlagValue(key, defaultValue);
  } catch {
    return defaultValue;
  }
}
```

## 4.3 Initialization (client-side)

In `src/routes/__root.tsx`, inside the provider tree:

```typescript
import { ConfigCatProvider } from "configcat-react";

// ... inside RootComponent, after ClerkProviderBoundary:
<ConfigCatProvider sdkKey={import.meta.env.VITE_CONFIGCAT_SDK_KEY}>
  {/* existing providers */}
</ConfigCatProvider>
```

**Important**: The client SDK key (`VITE_CONFIGCAT_SDK_KEY`) must be the ConfigCat **client-side** SDK key, not the server-side key. ConfigCat provides separate keys for client vs server evaluation.

### Client-side evaluation hook

```typescript
import { useFlag } from "configcat-react";

function MyComponent() {
  const [advancedAnalytics, isLoading] = useFlag("advancedAnalyticsEnabled", false);
  if (isLoading) return <Skeleton />;
  if (!advancedAnalytics) return null;
  return <AdvancedDashboard />;
}
```

## 4.4 SSR evaluation

During SSR, the server-side client (`feature-flags.server.ts`) can evaluate flags and pass values to the client via `createServerFn`:

```typescript
// server fn
export const getFeatureFlags = createServerFn({ method: "GET" })
  .handler(async () => {
    const client = getConfigCatClient();
    if (!client) return defaultFlags();
    const keys = Object.values(FEATURE_FLAGS);
    const results = await Promise.all(
      keys.map(async (k) => [k, await client.getBooleanFlagValue(k, false)])
    );
    return Object.fromEntries(results);
  });
```

## 4.5 Caching

| Layer | Cache | TTL | Invalidation |
|-------|-------|-----|-------------|
| Server (per isolate) | In-memory (auto-poll) | 60s | Auto-refresh; fresh isolate re-fetches |
| Client (browser) | In-memory (configcat-react) | 60s | Auto-refresh from CDN |
| SSR → client handoff | One-shot (server fn result) | Per-request | Not cached — fetched fresh on each SSR |

## 4.6 Offline / failure behavior

| Scenario | Behavior |
|----------|----------|
| ConfigCat CDN unreachable (server) | `getBooleanFlagValue()` returns the default value (the `defaultValue` parameter). |
| ConfigCat CDN unreachable (client) | `useFlag()` returns the default value after a timeout. |
| `CONFIGCAT_SDK_KEY` missing | `getConfigCatClient()` returns `null`; all flags return defaults. |
| Worker isolate recycled | New isolate fetches fresh config on first call; ~100ms cold-start cost. |

---

# 5. Environment Strategy

## 5.1 Current state

| Environment | Key | Source |
|-------------|-----|--------|
| Development | `CONFIGCAT_SDK_KEY` | `.env` (local) |

## 5.2 Proposed state

| Environment | Variable | Key Type | Managed By |
|-------------|----------|----------|------------|
| Development | `CONFIGCAT_SDK_KEY` | Client SDK key (dev environment) | `.env` (temporary, → Doppler) |
| Development | `VITE_CONFIGCAT_SDK_KEY` | Client SDK key (dev, Vite-injected) | `.env` |
| Development | `CONFIGCAT_SERVER_SDK_KEY` | Server SDK key (dev) | `.env` |
| Staging | `CONFIGCAT_SDK_KEY` | Client SDK key (staging) | Doppler |
| Staging | `VITE_CONFIGCAT_SDK_KEY` | Client SDK key (staging, Vite-injected) | Doppler |
| Staging | `CONFIGCAT_SERVER_SDK_KEY` | Server SDK key (staging) | Doppler |
| Production | `CONFIGCAT_SDK_KEY` | Client SDK key (production) | Doppler |
| Production | `VITE_CONFIGCAT_SDK_KEY` | Client SDK key (production, Vite-injected) | Doppler |
| Production | `CONFIGCAT_SERVER_SDK_KEY` | Server SDK key (production) | Doppler |

## 5.3 Naming convention

- **Client SDK keys**: `CONFIGCAT_SDK_KEY` (server读了只用) / `VITE_CONFIGCAT_SDK_KEY` (browser bundle). These are safe to ship in client JS — they're ConfigCat's "client-side" evaluation keys.
- **Server SDK keys**: `CONFIGCAT_SERVER_SDK_KEY` — never prefixed with `VITE_`. Used only by server fns / middleware. Can evaluate flags with targeting rules that include user attributes.

## 5.4 Secret rotation

ConfigCat SDK keys are long-lived tokens (not JWTs). Rotation procedure:
1. Create a new SDK key in the ConfigCat Dashboard (Product → SDK keys → Add).
2. Update the key in Doppler (or `.env` for development).
3. Redeploy.
4. Verify flags evaluate correctly.
5. Delete the old SDK key in the ConfigCat Dashboard.

## 5.5 Access control

- ConfigCat Dashboard access: limited to project owners + on-call engineers.
- SDK key access: managed via Doppler (no .env in staging/production).
- Client SDK keys are safe to ship in the browser (they can only read flag values, not modify them).

---

# 6. Feature Flag Folder Structure

## 6.1 Current

```
src/lib/
  feature-flags.ts           # FLAGS, FEATURE_FLAGS, FeatureKey, Capabilities
  feature-flags.server.ts     # EMPTY
```

## 6.2 Proposed

```
src/lib/
  feature-flags.ts           # Keep: FLAGS (runtime env flags), FEATURE_FLAGS (key constants)
  feature-flags.server.ts    # MODIFY: ConfigCat server client + isFlagOn helper
  feature-flags.client.tsx    # NEW: ConfigCatProvider wrapper + useFlagSafe hook
src/integrations/
  configcat/                  # NEW FOLDER
    client.ts                 # NEW: client SDK init + types
    server.ts                 # NEW: server SDK init (alias for feature-flags.server.ts)
```

## 6.3 Files to modify

| File | Change |
|------|--------|
| `src/routes/__root.tsx` | Wrap provider tree in `<ConfigCatProvider>` |
| `src/lib/feature-flags.server.ts` | Replace empty file with ConfigCat server client + `isFlagOn()` |
| `package.json` | No change — packages already installed |

## 6.4 Ownership

| Owner | Responsibility |
|-------|---------------|
| Platform engineering | SDK initialization, server client, key rotation |
| Feature teams | Flag creation in ConfigCat Dashboard, targeting rules |
| DevOps | Doppler integration, staging/production keys |

---

# 7. Stage-by-Stage Implementation Plan

## Stage 1: Server-side ConfigCat client

**Objective**: Initialize the `@configcat/sdk` client and expose `isFlagOn()`.

**Files**:
- Modify: `src/lib/feature-flags.server.ts`
- Create: `src/integrations/configcat/server.ts`

**Implementation**:
1. Write `getConfigCatClient()` singleton in `feature-flags.server.ts`.
2. Write `isFlagOn(key, defaultValue)` async helper.
3. Write `getConfigCatAllValues()` helper for bulk evaluation.
4. Handle missing key gracefully (return defaults).

**Validation**:
- `bun run build` passes.
- `bun run test` passes.
- Manual: call `isFlagOn("maintenanceMode", false)` — returns a boolean.

**Rollback**: Revert `feature-flags.server.ts` to empty (0 bytes).

**Dependencies**: None (packages already installed).

**Completion criteria**: `isFlagOn()` is callable from any server fn; returns defaults when key is missing.

---

## Stage 2: Client-side ConfigCat provider

**Objective**: Mount `<ConfigCatProvider>` in the React tree and expose `useFlagSafe()`.

**Files**:
- Create: `src/lib/feature-flags.client.tsx`
- Modify: `src/routes/__root.tsx`

**Implementation**:
1. Write `ConfigCatProviderWrapper` component that reads `VITE_CONFIGCAT_SDK_KEY` and mounts `<ConfigCatProvider>`.
2. If key is missing, render children without provider (graceful degradation).
3. Write `useFlagSafe(key, defaultValue)` hook that falls back when provider is absent.
4. Wrap `__root.tsx` provider tree in `ConfigCatProviderWrapper`.

**Validation**:
- `bun run build` passes.
- `bun run test` passes.
- Manual: `useFlagSafe("maintenanceMode", false)` in a test component.

**Rollback**: Remove `ConfigCatProviderWrapper` from `__root.tsx`.

**Dependencies**: Stage 1 (server client) not strictly required, but both should land together for consistency.

**Completion criteria**: `useFlagSafe()` is callable from any React component; returns defaults when provider is missing.

---

## Stage 3: Server fn for SSR flag evaluation

**Objective**: Expose a server fn that returns all flag values for SSR.

**Files**:
- Create: `src/lib/feature-flags.functions.ts`

**Implementation**:
1. `getFeatureFlags()` server fn using `createServerFn({ method: "GET" })`.
2. Reads all `FEATURE_FLAGS` values and evaluates each via `isFlagOn()`.
3. Returns `Capabilities`-shaped object.

**Validation**:
- `bun run build` passes.
- `bun run test` passes.
- Manual: call `getFeatureFlags()` — returns a `Record<string, boolean>`.

**Rollback**: Delete `feature-flags.functions.ts`.

**Dependencies**: Stage 1.

**Completion criteria**: SSR can evaluate all flags in a single server-fn call.

---

## Stage 4: Wire `maintenanceMode` flag

**Objective**: First real flag integration — the `maintenanceMode` kill-switch.

**Files**:
- Modify: `src/routes/__root.tsx` or a new `MaintenanceBanner` component
- Modify: `src/routes/_authenticated/route.tsx` (optional: redirect to maintenance page)

**Implementation**:
1. If `maintenanceMode` is ON, render a full-screen maintenance banner.
2. Optionally: prevent access to authenticated routes (redirect to `/maintenance`).

**Validation**:
- `bun run build` passes.
- Manual: toggle `maintenanceMode` in ConfigCat Dashboard; verify banner appears.

**Rollback**: Revert `__root.tsx` changes.

**Dependencies**: Stages 2 + 3.

**Completion criteria**: `maintenanceMode` flag controls a visible banner when ON.

---

## Stage 5: Wire `USE_CLERK_AUTH` migration flag (optional, long-term)

**Objective**: Migrate `USE_CLERK_AUTH` from env-var to ConfigCat for runtime control.

**Important caveat**: This is **optional and long-term**. The `USE_CLERK_AUTH` flag currently uses `readFlag()` which reads env vars at module-load time (Vite build-time replacement). ConfigCat flags are async (Promise-based). Converting `USE_CLERK_AUTH` to async would require every consumer to become async, which is a significant refactor. **Do not attempt this until the legacy auth branches are deleted and the flag is the only code path.**

**Dependencies**: Legacy auth branches deleted (post-cutover Phase).

**Completion criteria**: Not applicable yet. Document as future work.

---

# 8. Required Environment Variables

| Variable | Environment | Scope | Purpose | Required | Runtime |
|----------|-------------|-------|---------|----------|---------|
| `CONFIGCAT_SDK_KEY` | Development | Server | ConfigCat client SDK key (dev) | Yes | Server fns |
| `VITE_CONFIGCAT_SDK_KEY` | Development | Client | ConfigCat client SDK key (dev, Vite-injected) | Yes | Browser |
| `CONFIGCAT_SERVER_SDK_KEY` | Development | Server | ConfigCat server SDK key (dev) | Optional (for targeting) | Server fns |
| `CONFIGCAT_SDK_KEY` | Staging | Server | ConfigCat client SDK key (staging) | Yes (Doppler) | Server fns |
| `VITE_CONFIGCAT_SDK_KEY` | Staging | Client | ConfigCat client SDK key (staging, Vite-injected) | Yes (Doppler) | Browser |
| `CONFIGCAT_SERVER_SDK_KEY` | Staging | Server | ConfigCat server SDK key (staging) | Optional (Doppler) | Server fns |
| `CONFIGCAT_SDK_KEY` | Production | Server | ConfigCat client SDK key (production) | Yes (Doppler) | Server fns |
| `VITE_CONFIGCAT_SDK_KEY` | Production | Client | ConfigCat client SDK key (production, Vite-injected) | Yes (Doppler) | Browser |
| `CONFIGCAT_SERVER_SDK_KEY` | Production | Server | ConfigCat server SDK key (production) | Optional (Doppler) | Server fns |

---

# 9. Security Review

| Concern | Risk | Mitigation |
|---------|------|------------|
| Client SDK key exposure | Low | ConfigCat client SDK keys are safe to ship in the browser — they can only read flag values, not modify them. |
| Server SDK key exposure | Medium | `CONFIGCAT_SERVER_SDK_KEY` must never be in the client bundle. Use `.server.ts` suffix and dynamic imports. |
| SSR evaluation | Low | Server client initialises with server key; client bundle uses the client key. No cross-contamination. |
| Stale values | Low | Auto-poll refreshes every 60s. For critical kill-switches, consider manual refresh on demand. |
| Fallback behaviour | Acceptable | Missing key → all flags return defaults. Defaults must be conservative (defaults = current behavior). |
| CSP | Verify | ConfigCat client SDK fetches from `https://cdn.configcat.com`. Add to `connect-src` in CSP. |
| Targeting rule injection | Low | Targeting rules are set in the ConfigCat Dashboard (not in code). No user-controllable input reaches the SDK. |

### CSP addition required

In `src/routes/__root.tsx`, add `https://cdn.configcat.com` to `connect-src`:

```
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev https://cdn.configcat.com
```

---

# 10. Performance Review

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Server cold-start | +100ms on first flag eval per isolate | Auto-poll fetches on client creation; subsequent calls are cache hits. |
| Client cold-start | +50ms on first flag eval | `configcat-react` uses lazy-init on first `useFlag` call; subsequent renders read cache. |
| Polling overhead | Negligible | Config JSON is ~2KB; one fetch per 60s per isolate/browser. |
| Render blocking | Low | `useFlagSafe` returns `isLoading=true` on first render; component shows fallthrough. Use Suspense or default-value patterns. |
| SSR latency | +50ms per SSR request (server fn for flag values) | Only called when SSR needs flag values (optional). Client-side eval handles the rest. |

---

# 11. CI/CD Impact

| Area | Impact |
|------|--------|
| Deployments | No new build step. ConfigCat config is fetched at runtime, not build-time. |
| Feature rollout | Flags can be toggled in ConfigCat Dashboard without redeploy. Immediate effect on next poll cycle (60s). |
| Release strategy | Use flags to gate new features. Release code with flag OFF; enable in Dashboard post-deploy. |
| Rollback | Disable flag in Dashboard (no redeploy). Code path reverts to default behavior. |
| Approvals | ConfigCat Dashboard can require approval workflows for production environment flags (ConfigCat feature). |

---

# 12. Testing Strategy

## 12.1 Unit tests

| Test | File | What it verifies |
|------|------|-----------------|
| `isFlagOn()` returns default when client is null | `src/lib/__tests__/feature-flags.server.test.ts` | Graceful degradation |
| `isFlagOn()` returns ConfigCat value when client is initialized | Same | Correct flag evaluation |
| `useFlagSafe()` returns default when provider is absent | `src/lib/__tests__/feature-flags.client.test.tsx` | Graceful degradation |

## 12.2 Integration tests

| Test | What it verifies |
|------|-----------------|
| `getFeatureFlags()` server fn returns all 15 flags | Server fn wiring |
| `maintenanceMode` ON → banner visible | Flag → UI routing |

## 12.3 E2E tests

| Test | What it verifies |
|------|-----------------|
| Toggle `maintenanceMode` in ConfigCat → banner appears within 60s | End-to-end flag evaluation |
| Toggle `killApplications` → application form disabled | Kill-switch effect |

## 12.4 Manual / staging validation

| Test | What it verifies |
|------|-----------------|
| All 15 `FEATURE_FLAGS` keys exist in ConfigCat Dashboard | Key parity |
| Staging SDK key evaluates against staging environment | Environment isolation |
| Production SDK key evaluates against production environment | Environment isolation |

---

# 13. Final Readiness Checklist

- [ ] `feature-flags.server.ts` initialized with ConfigCat server client
- [ ] `feature-flags.client.tsx` created with ConfigCatProvider + useFlagSafe
- [ ] `__root.tsx` wraps provider tree in ConfigCatProvider
- [ ] CSP updated to include `https://cdn.configcat.com`
- [ ] All 15 `FEATURE_FLAGS` keys created in ConfigCat Dashboard (development environment)
- [ ] `maintenanceMode` flag wired to a visible banner
- [ ] `getFeatureFlags()` server fn created for SSR
- [ ] Unit tests for isFlagOn / useFlagSafe
- [ ] `.env.example` documents all ConfigCat variables
- [ ] Doppler migration plan includes ConfigCat keys
- [ ] Staging ConfigCat environment created with staging keys
- [ ] Production ConfigCat environment created with production keys

---

*End of `feature-flags.md` — Phase 3*
