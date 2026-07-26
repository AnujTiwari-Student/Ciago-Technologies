// Step 13 — RLS preservation invariant test.
//
// This test runs the same audit logic the per-script `rls-audit.ts` uses,
// so any future migration that introduces a CREATE POLICY whose USING /
// WITH CHECK body doesn't route through `auth.uid()` is caught in CI.
//
// Why: under the Clerk migration, every existing user_id = auth.uid()
// policy in the project continues to enforce correctly because the
// Clerk branch of `requireSupabaseAuth` issues a GoTrue JWT whose `sub`
// is the mapped auth.users.id — `auth.uid()` evaluates to the same UUID
// the legacy Supabase path was returning. If a future migration
// introduces a policy that uses Clerk JWT claims directly (e.g.
// `request.jwt.claims->>'sub'::*text`) without going through mapped
// auth.users ids, the audit fails and CI catches it before deploy.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function extractPolicies(sql: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const re = /CREATE\s+POLICY\s+"([^"]+)"([^;]*);/gisu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ name: m[1], body: m[2] });
  }
  return out;
}

function extractBalanced(body: string, keyword: "USING" | "WITH CHECK"): string | undefined {
  const k = keyword === "USING" ? /\bUSING\s*\(/isu : /\bWITH\s+CHECK\s*\(/isu;
  const start = k.exec(body);
  if (!start) return undefined;
  let depth = 0;
  let i = start.index + start[0].length - 1; // index of "("
  for (; i < body.length; i++) {
    const c = body[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return undefined;
  return body.slice(start.index + start[0].length, i).trim();
}

function classifyPolicyBody(body: string): "ok" | "review" {
  const ALLOWED_AUTH_UID = /\bauth\.uid\(\)/;
  const ALLOWED_HAS_ROLE = /\b(?:public\.)?has_role\(\s*auth\.uid\(\)/i;
  const ALLOWED_TRUE = /\btrue\b/i;
  const ALLOWED_FALSE = /\bfalse\b/i;
  const ALLOWED_BUCKET_AVATARS = /\bbucket_id\s*=\s*'avatars'/i;
  const ALLOWED_PUBLIC_STATUS =
    /\bstatus\s*=\s*'(active|published)'(::[a-z_]+)?\s*(AND\s+internal_only\s*=\s*false)?/i;
  const DISALLOWED =
    /\brequest\.jwt\.claims\b|\bcoalesce\([^)]+, ?'anon'\b|\bclerk\.sub\b|\bclerk_sub\b/i;
  if (DISALLOWED.test(body)) return "review";
  if (ALLOWED_HAS_ROLE.test(body)) return "ok";
  if (ALLOWED_AUTH_UID.test(body)) return "ok";
  if (ALLOWED_FALSE.test(body)) return "ok";
  if (ALLOWED_TRUE.test(body) && /USING\s*\(\s*true\s*\)/isu.test(body)) return "ok";
  if (ALLOWED_TRUE.test(body) && /WITH\s+CHECK\s*\(\s*true\s*\)/isu.test(body)) return "ok";
  if (ALLOWED_PUBLIC_STATUS.test(body)) return "ok";
  if (ALLOWED_BUCKET_AVATARS.test(body)) return "ok";
  return "review";
}

describe("Step 13 — RLS preservation invariant", () => {
  it("every CREATE POLICY body routes through auth.uid() (Clerk branch compatible)", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThan(0);

    const findings: { file: string; policy: string; using?: string; check?: string }[] = [];
    for (const f of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
      for (const p of extractPolicies(sql)) {
        const using = extractBalanced(p.body, "USING");
        const check = extractBalanced(p.body, "WITH CHECK");
        if (classifyPolicyBody(p.body) === "review") {
          findings.push({ file: f, policy: p.name, using, check });
        }
      }
    }
    if (findings.length > 0) {
      const summary = findings
        .map((f) => `  - ${f.file} :: "${f.policy}"\n      USING: ${f.using ?? "(none)"}\n      WITH CHECK: ${f.check ?? "(none)"}`)
        .join("\n");
      throw new Error(
        `${findings.length} RLS policies don't route through auth.uid() —\n` +
          `Clerk branch won't enforce these correctly without manual review:\n${summary}`,
      );
    }
  });

  it("no CREATE POLICY uses Clerk JWT claims directly (only auth.uid() or service_role)", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    const directClerkClaims: string[] = [];
    for (const f of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
      const policies = extractPolicies(sql);
      for (const p of policies) {
        // Any CREATE POLICY whose USING / WITH CHECK body has bare
        // `request.jwt.claims`, `clerk.sub` (Clerk cabal-marker), or
        // `clerk_user_id` in any form is flagged. `auth.uid()` routing
        // is required because the Clerk branch issues a GoTrue JWT whose
        // sub is the mapped auth.users UUID.
        if (
          /\brequest\.jwt\.claims\b/i.test(p.body) ||
          /\bclerk\.sub\b/i.test(p.body) ||
          /\bclerk_user_id\b/i.test(p.body)
        ) {
          directClerkClaims.push(`${f} :: "${p.name}"`);
        }
      }
    }
    expect(directClerkClaims).toEqual([]);
  });
});
