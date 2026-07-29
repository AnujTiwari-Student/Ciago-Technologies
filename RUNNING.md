# RUNNING.md � Developer Guide

## Requirements

| Tool      | Version          | Notes                                      |
| --------- | ---------------- | ------------------------------------------ |
| Node.js   | = 20.x           | LTS recommended; check `.nvmrc` if present |
| Bun       | = 1.2.x          | Primary package manager and runtime        |
| Prisma    | 7.9.1            | Installed as devDependency                 |
| Clerk     | Account required | Sign up at https://clerk.com               |
| ConfigCat | Account required | Sign up at https://configcat.com           |
| Postgres  | 15+ / Neon       | Neon (prod) or Docker local Postgres       |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```env
# Clerk Auth
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (current DB � pre-Neon migration)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Neon (future DB � post-migration)
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# ConfigCat
CONFIGCAT_SDK_KEY=configcat-sdk-1/...

# App
VITE_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## Installation

Full setup from a fresh clone:

```bash
# 1. Clone repository
git clone https://github.com/your-org/ciago-technologies.git
cd ciago-technologies

# 2. Install dependencies
bun install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 4. Generate Prisma Client
bun run prisma:generate

# 5. Start development server
bun run dev
```

---

## Prisma Commands

```bash
# Generate Prisma Client types (must run after schema changes)
bun run prisma:generate

# Run all pending migrations (production / CI)
bun run prisma:migrate

# Create and apply a new migration (development)
bun run prisma:migrate:dev

# Reset database and re-apply all migrations (DESTRUCTIVE)
bun run prisma:migrate:reset

# Open Prisma Studio (visual DB browser)
bun run prisma:studio

# Validate schema without generating client
bun run prisma:validate

# Format schema file
bun run prisma:format

# Seed database
bun run prisma:seed
```

> **Important:** `DIRECT_URL` must point to the Neon _direct_ connection (not the pooler endpoint) for migrations to work.

---

## Development Commands

```bash
# Install dependencies
bun install

# Start development server (hot reload)
bun run dev

# Build for production
bun run build

# Run linter
bun run lint

# Format code
bun run format

# Type-check without emitting
bunx tsc --noEmit

# Run tests
bun run test

# Preview production build locally
bun run preview
```

---

## Feature Flag Setup

### Architecture

Feature flags are managed by **ConfigCat**. The architecture uses three layers:

| Layer        | File                                 | Runtime            |
| ------------ | ------------------------------------ | ------------------ |
| Shared types | `src/lib/feature-flags.ts`           | Both               |
| Server SDK   | `src/lib/feature-flags.server.ts`    | Server only        |
| Client hooks | `src/lib/feature-flags.client.tsx`   | Client only        |
| RPC bridge   | `src/lib/feature-flags.functions.ts` | TanStack server fn |

### Where flags are stored

- **ConfigCat dashboard** (https://app.configcat.com) � source of truth for flag values
- **`CONFIGCAT_SDK_KEY`** env variable � connects server SDK to your ConfigCat environment
- **`DEFAULT_CAPABILITIES`** in `src/lib/feature-flags.ts` � fallback values when ConfigCat is unreachable

### How flags are loaded

**Server-side:** `isFlagOn(FEATURE_FLAGS.dashboard)` calls ConfigCat server SDK synchronously (AutoPoll, 60s interval).

**Client-side:** `useFeatureFlag(FEATURE_FLAGS.dashboard, false)` uses `configcat-react` Provider. The Provider is mounted in the React tree (not in `__root.tsx` due to TanStack Start's server-component boundary).

### Current flags

| Flag Name             | ConfigCat Key         | Default | Purpose                          |
| --------------------- | --------------------- | ------- | -------------------------------- |
| `clerkAuthentication` | `clerkAuthentication` | `false` | Toggle Clerk vs Supabase auth    |
| `dashboard`           | `dashboardEnabled`    | `true`  | Enable/disable dashboard portals |

### Dashboard feature flag

The `dashboardEnabled` flag gates access to all authenticated portals:

- `/admin` � Admin portal
- `/hr` � HR portal
- `/manager` � Manager portal
- `/employee` � Employee portal
- `/users` � Users list

When `dashboardEnabled = false`, users hitting any of these routes are redirected to `/forbidden?reason=dashboard_disabled`.

The guard runs server-side in `beforeLoad` via `requireDashboardEnabled()` in `src/routes/_authenticated/-guard.ts`.

### How caching works

ConfigCat AutoPoll mode polls every **60 seconds**. Between polls, the last fetched value is used. This means flag changes propagate within 60 seconds without any cache invalidation logic needed.

### How to update a flag

1. Go to https://app.configcat.com
2. Select your project and config
3. Find the flag (e.g., `dashboardEnabled`)
4. Toggle the value
5. Save � propagates to all server instances within 60 seconds

---

## Testing Guide

### Initial Setup

1. Complete Installation steps above
2. Ensure `.env.local` has valid `CONFIGCAT_SDK_KEY`
3. Ensure your ConfigCat project has the following flags:
   - `clerkAuthentication` (Boolean)
   - `dashboardEnabled` (Boolean)

---

### Test 1: Database Migration

**Objective:** Verify Prisma schema is valid and migrations work.

**Steps:**

1. Set `DATABASE_URL` and `DIRECT_URL` to a Neon dev branch
2. Run `bun run prisma:validate`
3. Run `bun run prisma:migrate:dev --name initial`

**Expected result:** Migration files created in `prisma/migrations/`, schema applied to database.

---

### Test 2: Seeding

**Objective:** Verify seed data loads correctly.

**Steps:**

1. Run `bun run prisma:seed`

**Expected result:** Seed data visible in Prisma Studio (`bun run prisma:studio`).

---

### Test 3: Login (Clerk)

**Objective:** Verify Clerk authentication works end-to-end.

**Steps:**

1. Ensure `clerkAuthentication` flag is **ON** in ConfigCat
2. Start dev server: `bun run dev`
3. Navigate to `http://localhost:3000`
4. Click Sign In
5. Complete Clerk sign-in flow

**Expected result:** Redirected to appropriate portal based on role (`/admin`, `/hr`, `/manager`, `/employee`).

---

### Test 4: Enable Dashboard Flag

**Objective:** Verify dashboard portals are accessible when flag is ON.

**Steps:**

1. Set `dashboardEnabled = true` in ConfigCat
2. Wait up to 60 seconds (AutoPoll interval) or restart dev server
3. Log in with any role
4. Navigate to your portal (e.g., `/employee`)

**Expected result:** Portal loads normally.

---

### Test 5: Disable Dashboard Flag

**Objective:** Verify dashboard portals are blocked when flag is OFF.

**Steps:**

1. Set `dashboardEnabled = false` in ConfigCat
2. Wait up to 60 seconds
3. Try navigating to `/employee`, `/admin`, `/hr`, `/manager`, `/users`

**Expected result:** All routes redirect to `/forbidden?reason=dashboard_disabled`.

---

### Test 6: Refresh Behaviour

**Objective:** Verify ConfigCat polling refreshes flag state without page reload.

**Steps:**

1. Set `dashboardEnabled = false`, confirm redirect to `/forbidden`
2. Set `dashboardEnabled = true` in ConfigCat
3. Wait 60 seconds
4. Try navigating to `/employee` again

**Expected result:** Portal loads without needing a full page reload (next navigation picks up updated flag).

---

### Test 7: Persistence

**Objective:** Verify flag state persists across server restarts.

**Steps:**

1. Set `dashboardEnabled = false` in ConfigCat
2. Restart dev server: `Ctrl+C` then `bun run dev`
3. Navigate to any protected portal

**Expected result:** Still redirected to `/forbidden` � flag loaded fresh from ConfigCat on startup.

---

### Test 8: Hydration

**Objective:** Verify server-rendered flag state matches client-side state.

**Steps:**

1. Enable `dashboardEnabled`
2. Load `/employee` page
3. Check browser console for hydration warnings

**Expected result:** No React hydration mismatch errors.

---

### Test 9: Multiple Users

**Objective:** Verify flag applies globally (not per-user in current architecture).

**Steps:**

1. Log in as User A, note dashboard access
2. Log in as User B in another browser/profile
3. Set `dashboardEnabled = false`
4. Wait 60 seconds
5. Both users attempt to navigate to their portals

**Expected result:** Both users see `/forbidden` � global flag affects all users equally.

---

### Test 10: Permissions (Role Check)

**Objective:** Verify role-based access still works when `dashboardEnabled = true`.

**Steps:**

1. Ensure `dashboardEnabled = true`
2. Log in as an `employee` role user
3. Navigate to `/admin`

**Expected result:** Redirected to `/forbidden?reason=insufficient_role` � role guard runs after dashboard guard.

---

### Test 11: API Validation

**Objective:** Verify API server functions respect authentication.

**Steps:**

1. Open browser DevTools ? Network tab
2. Log out of the application
3. Attempt to call a server function directly (via the TanStack router server function URL)

**Expected result:** 401 Unauthorized response.

---

### Test 12: Middleware Validation

**Objective:** Verify Clerk middleware protects the `_authenticated` layout.

**Steps:**

1. Clear all cookies/sessions
2. Navigate directly to `/employee`

**Expected result:** Redirected to Clerk sign-in page.

---

### Test 13: Server Action Validation

**Objective:** Verify server actions check auth before running.

**Steps:**

1. Log in as a user without admin role
2. Attempt to call an admin-only server action

**Expected result:** Action returns 403 or throws authorization error.

---

### Test 14: Cache Invalidation

**Objective:** Verify React Query cache invalidates after feature flag changes.

**Steps:**

1. Load the dashboard with `dashboardEnabled = true`
2. Toggle flag to `false` in ConfigCat
3. Wait 60 seconds
4. Without refreshing, attempt navigation

**Expected result:** Navigation redirects to `/forbidden` as the server re-evaluates the flag on each `beforeLoad`.

---

### Test 15: Production Verification

**Objective:** Verify production build works correctly.

**Steps:**

1. Run `bun run build`
2. Verify build completes without errors
3. Run `bun run preview`
4. Test all portals

**Expected result:** Build succeeds, all portals respond correctly.

---

## Troubleshooting

### Prisma

**Problem:** `Error: PrismaClient is unable to be run in the browser`
**Fix:** Ensure `prisma.ts` is only imported in server-side code. Never import it from `*.client.tsx` files.

**Problem:** `Error: Can't reach database server`
**Fix:** Verify `DATABASE_URL` is set and points to a reachable Postgres/Neon instance.

**Problem:** `prisma generate` fails with schema errors
**Fix:** Run `bun run prisma:validate` to see detailed validation errors.

---

### Migrations

**Problem:** Migration fails with `P3009 migrate found failed migrations`
**Fix:** Run `bun run prisma:migrate:reset` (DESTRUCTIVE � resets all data in dev only).

**Problem:** `Error: The "url" and "directUrl" properties are no longer supported in schema.prisma`
**Fix:** Remove `url` and `directUrl` from `datasource db` block in `prisma/schema.prisma`. They belong in `prisma.config.ts`.

---

### Clerk

**Problem:** Clerk sign-in redirect loop
**Fix:** Verify `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` match the same Clerk application.

**Problem:** `clerkClient()` throws on server
**Fix:** Ensure `CLERK_SECRET_KEY` is set in `.env.local` (not just `VITE_` prefix).

---

### Environment Variables

**Problem:** `VITE_` variables undefined on server
**Fix:** Server-side code cannot access `VITE_` prefixed variables. Use non-prefixed names for server-only secrets.

**Problem:** ConfigCat SDK key missing warning
**Fix:** Set `CONFIGCAT_SDK_KEY` in `.env.local`. The system falls back to `DEFAULT_CAPABILITIES` if missing � this is intentional for offline development.

---

### Feature Flags

**Problem:** Feature flags not updating after 60 seconds
**Fix:** Check `CONFIGCAT_SDK_KEY` is correct. Verify the flag key in ConfigCat exactly matches the string in `FEATURE_FLAGS` map (`src/lib/feature-flags.ts`).

**Problem:** `FeatureFlagsProvider` not found error
**Fix:** The provider must be inside the React tree but NOT in `__root.tsx`. Mount it in a client layout component instead.

---

### Dashboard

**Problem:** Dashboard redirects to `/forbidden` even when `dashboardEnabled = true`
**Fix:**

1. Check ConfigCat dashboard � is the flag actually set to `true`?
2. Wait 60 seconds for AutoPoll to pick up the change
3. Check `CONFIGCAT_SDK_KEY` matches the correct environment (Test vs Production key)

---

### Build Failures

**Problem:** `bun run build` fails with TypeScript errors
**Fix:** Run `bunx tsc --noEmit` first to see all type errors without building.

**Problem:** Build fails with `Cannot find module '@prisma/client'`
**Fix:** Run `bun run prisma:generate` before building.

---

### pnpm / Bun

**Problem:** Lockfile conflicts between `bun.lock` and `pnpm-lock.yaml`
**Fix:** This project uses **Bun** exclusively. Delete `pnpm-lock.yaml` if present and run `bun install`.

---

### Turbo

This project does not currently use Turborepo. If a `turbo.json` is present, it is from the initial template and can be ignored.

---

### Database Connection

**Problem:** Neon connection timeout
**Fix:** Neon suspends serverless branches after inactivity. The first request after suspension has a cold-start delay (~500ms). This is expected.

**Problem:** SSL required error
**Fix:** Add `?sslmode=require` to `DATABASE_URL` and `DIRECT_URL`.
