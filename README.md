# Ciago Technologies

> Official website for **Ciago Technologies**.

Built with a modern, type-safe, server-rendered stack — TanStack Start on Cloudflare Workers, Supabase, Clerk auth, and a shadcn/ui component system.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) — file-based routing, SSR via Nitro |
| Deployment | Cloudflare Workers |
| Build tool | Vite 8, Bun, `@lovable.dev/vite-tanstack-config` |
| Language | TypeScript 5.8 (strict mode, bundler module resolution, `@/*` path alias) |
| UI | shadcn/ui (`new-york` style, `slate` base), Tailwind CSS 4, Radix UI, lucide-react |
| Auth | Clerk (feature-flagged via `USE_CLERK_AUTH`); legacy Supabase auth retained for rollback |
| Database | Supabase (Lovable Cloud) — planned migration to **Neon** |
| Storage | Supabase Storage — planned migration to **Cloudflare R2** |
| Feature flags | ConfigCat (`@configcat/sdk`, `configcat-react`) |
| Email | Resend (server-side notification templates) |
| Bot protection | Cloudflare Turnstile + Postgres sliding-window rate limiter + honeypot |
| Data access | Direct `@supabase/supabase-js` client queries (no ORM) |
| Testing | Vitest, co-located `__tests__/` directories |
| Linting/formatting | ESLint 9 + Prettier (`eslint-plugin-prettier`) |
| Secrets | `.env` (current) → Doppler (planned) |
| CI/CD | Lovable-managed deployments |
| Package manager | Bun (`bunfig.toml` enforces a 24-hour supply-chain guard) |

### Roles

`admin > hr > manager > employee > user` — see `src/lib/route-access.ts`.

### Auto-generated files — never hand-edit

- `src/routeTree.gen.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- A Supabase project (URL + keys)
- A Clerk application (if `USE_CLERK_AUTH` is enabled)
- A ConfigCat SDK key

### Install

```bash
bun install
```

### Environment

Copy the example env file and fill in required values:

```bash
cp .env.example .env
```

### Run locally

```bash
bun dev
```

---

## Available Scripts

| Command | Tool | Purpose |
|---|---|---|
| `bun dev` | Vite dev | Start local development server |
| `bun run test` | Vitest (`vitest run`) | Run all unit tests once |
| `bun run lint` | ESLint 9 | Lint the entire project |
| `bun run build` | Vite build | Production build (Nitro → Cloudflare Workers) |
| `bun run format` | Prettier | Format all files (`prettier --write .`) |

---

## Project Structure

```
src/
├── routes/                # File-based routes (flat, dot-separated)
│   └── _authenticated/    # e.g. onboarding.tsx
├── components/
│   ├── ui/                # shadcn primitives
│   ├── site/              # Product/marketing components
│   └── hr/                # HR-specific components
├── hooks/                 # use-my-roles, use-is-admin, use-lookups, etc.
├── lib/                   # Server functions, server-only helpers, providers
├── integrations/
│   ├── clerk/
│   └── supabase/
supabase/
└── migrations/             # *.sql — 36 files, 104 RLS policies
scripts/
├── rls-audit.ts
└── clerk-test-user.ts
```

### Server logic conventions

- `*.functions.ts` — client-callable server functions (`createServerFn`)
- `*.server.ts` — server-only code, never bundled to the client
  - ESLint blocks the Next.js `server-only` package via `no-restricted-imports`; use `*.server.ts` naming or `@tanstack/react-start/server-only` instead.

---

## Contributing

Follow [`WORKFLOW.md`](./WORKFLOW.md) — the canonical engineering workflow reference for this repository. It covers the full project lifecycle: planning, development, branching, commit conventions, PR checklists, code review, testing, security/performance/accessibility review, database and storage migrations, feature flags, deployment, rollback, and monitoring.

**Rule of thumb:** if reality diverges from `WORKFLOW.md`, fix the document and ship the fix in the same PR.

---

## License

Proprietary — © Ciago Technologies. All rights reserved.
