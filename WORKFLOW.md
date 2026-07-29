# Ciago Spark — Engineering Workflow

> **Canonical engineering workflow reference for the Ciago Spark project.**
> Phase 1, Deliverable 2 — complete rewrite of `WORKFLOW.md`.
>
> This document is the **single source of truth** for how every engineer and
> AI agent plans, builds, reviews, ships, and operates features in this
> repository. Follow it exactly. When reality diverges from this document,
> fix the document and ship the fix in the same PR.

---

## Table of Contents

| #   | Workflow                                                                            | #   | Workflow                                                               |
| --- | ----------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------- |
| 1   | [Complete Project Lifecycle](#1-complete-project-lifecycle)                         | 19  | [Storage Workflow](#19-storage-workflow)                               |
| 2   | [Development Workflow](#2-development-workflow)                                     | 20  | [Migration Workflow](#20-migration-workflow)                           |
| 3   | [Architecture-First Development Process](#3-architecture-first-development-process) | 21  | [Testing Workflow](#21-testing-workflow)                               |
| 4   | [Planning Before Implementation](#4-planning-before-implementation)                 | 22  | [Type Safety Requirements](#22-type-safety-requirements)               |
| 5   | [AI Agent Workflow](#5-ai-agent-workflow)                                           | 23  | [Security Review Workflow](#23-security-review-workflow)               |
| 6   | [Human Developer Workflow](#6-human-developer-workflow)                             | 24  | [Performance Review Workflow](#24-performance-review-workflow)         |
| 7   | [Branching Strategy](#7-branching-strategy)                                         | 25  | [Accessibility Review Workflow](#25-accessibility-review-workflow)     |
| 8   | [Git Commit Conventions](#8-git-commit-conventions)                                 | 26  | [SEO Validation Workflow](#26-seo-validation-workflow)                 |
| 9   | [Pull Request Checklist](#9-pull-request-checklist)                                 | 27  | [RLS Validation Workflow](#27-rls-validation-workflow)                 |
| 10  | [Code Review Standards](#10-code-review-standards)                                  | 28  | [Production Deployment Workflow](#28-production-deployment-workflow)   |
| 11  | [Documentation Requirements](#11-documentation-requirements)                        | 29  | [Rollback Workflow](#29-rollback-workflow)                             |
| 12  | [Feature Development Lifecycle](#12-feature-development-lifecycle)                  | 30  | [Monitoring & Observability](#30-monitoring--observability-workflow)   |
| 13  | [Bug Fix Workflow](#13-bug-fix-workflow)                                            | 31  | [Release Workflow](#31-release-workflow)                               |
| 14  | [Refactoring Workflow](#14-refactoring-workflow)                                    | 32  | [Hotfix Workflow](#32-hotfix-workflow)                                 |
| 15  | [Authentication Workflow (Clerk)](#15-authentication-workflow-clerk)                | 33  | [Environment Management Workflow](#33-environment-management-workflow) |
| 16  | [Authorization Workflow](#16-authorization-workflow)                                | 34  | [Doppler Migration Workflow](#34-doppler-migration-workflow)           |
| 17  | [Feature Flag Workflow (ConfigCat)](#17-feature-flag-workflow-configcat)            | 35  | [Documentation Update Workflow](#35-documentation-update-workflow)     |
| 18  | [Database Workflow](#18-database-workflow)                                          |     |                                                                        |

---

## Project Snapshot

> Read this section once. Every workflow below assumes these facts as
> background. If a fact here is wrong, fix it **before** touching code.

| Concern                          | Value                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Framework                        | TanStack Start (file-based routing, SSR via Nitro on Cloudflare Workers)             |
| Build                            | Vite 8, Bun, `@lovable.dev/vite-tanstack-config`                                     |
| Language                         | TypeScript 5.8, strict mode, bundler module resolution, `@/*` path alias             |
| UI                               | shadcn/ui (`new-york` style, `slate` base), Tailwind CSS 4, Radix UI, lucide-react   |
| Auth                             | Clerk (gated by `USE_CLERK_AUTH` flag); legacy Supabase auth preserved for rollback  |
| Database                         | Supabase (Lovable Cloud) → planned migration to Neon                                 |
| Storage                          | Supabase Storage → planned migration to Cloudflare R2                                |
| Feature Flags                    | ConfigCat (`@configcat/sdk`, `configcat-react`, `CONFIGCAT_SDK_KEY` in env)          |
| Email                            | Resend (notifications server templates)                                              |
| Bot Protection                   | Cloudflare Turnstile + Postgres sliding-window rate limiter + honeypot               |
| ORM                              | None — direct `@supabase/supabase-js` client queries                                 |
| Roles                            | `admin > hr > manager > employee > user` (see `src/lib/route-access.ts`)             |
| Tests                            | Vitest, co-located `__tests__/` directories                                          |
| Linting                          | ESLint 9 + Prettier + `eslint-plugin-prettier` (run together)                        |
| Secrets                          | `.env` (temporary) → Doppler (planned)                                               |
| CI/CD                            | Lovable-managed deploys (currently)                                                  |
| Package Manager                  | Bun (`bunfig.toml` has a 24-hour supply-chain guard)                                 |
| Auto-generated (never hand-edit) | `src/routeTree.gen.ts`, `src/integrations/supabase/types.ts`, `supabase/config.toml` |

### Conventions at a Glance

- **Server logic** — `*.functions.ts` (`createServerFn`, client-callable) and `*.server.ts` (server-only, never in client bundle). The ESLint rule `no-restricted-imports` blocks the Next.js `server-only` package; use `*.server.ts` naming or `@tanstack/react-start/server-only` instead.
- **Routes** — flat, dot-separated, file-based (`src/routes/_authenticated/onboarding.tsx`). No `src/pages/`.
- **Components** — `components/ui` (shadcn primitives), `components/site` (product), `components/hr`.
- **Hooks** — `src/hooks/` (`use-my-roles`, `use-is-admin`, `use-is-employee`, `use-admin-redirect`, `use-lookups`, `use-mobile`, `use-ensure-user-mapped`).
- **Lib** — `src/lib/` (functions, server-only, pure helpers, providers).
- **Integrations** — `src/integrations/clerk/`, `src/integrations/supabase/`.
- **Migrations** — `supabase/migrations/*.sql` (36 files, 104 RLS policies).
- **Scripts** — `scripts/` (`rls-audit.ts`, `clerk-test-user.ts`).
- **Tests** — co-located `__tests__/` directories next to the code under test.

### Verify Commands (memorize these)

| Command          | Tool                  | Purpose                                       |
| ---------------- | --------------------- | --------------------------------------------- |
| `bun dev`        | Vite dev              | Local development server                      |
| `bun run test`   | Vitest (`vitest run`) | Run all co-located unit tests once            |
| `bun run lint`   | ESLint 9              | Lint the full project (`eslint .`)            |
| `bun run build`  | Vite build            | Production build (Nitro → Cloudflare Workers) |
| `bun run format` | Prettier              | `prettier --write .` (format then re-stage)   |

### Workflow Section Template

Every numbered workflow below contains these subsections, in order:

> **Purpose** · **Trigger** · **Preconditions** · **Process (step-by-step)** ·
> **Files involved** · **Validation steps** · **Completion criteria** ·
> **Common mistakes** · **Best practices**

---
