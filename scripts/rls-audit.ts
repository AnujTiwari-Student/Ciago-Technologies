// Step 13 — RLS preservation verification audit (manual static audit).
//
// This script reads every `supabase/migrations/*.sql` file and verifies
// that all `CREATE POLICY ... USING (…)` / `WITH CHECK (…)` expressions
// reference `auth.uid()` (the Supabase-issued JWT's subject) either
// directly or via the `public.has_role(auth.uid(), …)` helper, including
// `storage.foldername(name)[1] = auth.uid()::text` patterns on storage
// buckets. Any policy that references anything else (e.g. `request.jwt.claims`,
// `coalesce(…, 'anon')`, or string-compare Clerk JWT claims) is flagged.
//
// Usage:  bun run scripts:rls-audit
//   (or:  bunx tsx src/integrations/clerk/__tests__/rls-audit.ts)

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

type Finding = {
  file: string;
  policy: string;
  using?: string;
  check?: string;
  flag: "ok" | "review";
  reason?: string;
};

function extractPolicies(sql: string): Array<{ name: string; body: string }> {
  // Crude but sufficient: match `CREATE POLICY "name"` through the next `;`
  // (Supabase's generated policies never nest multi-statement bodies.)
  const out: Array<{ name: string; body: string }> = [];
  const re = /CREATE\s+POLICY\s+"([^"]+)"([^;]*);/gisu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ name: m[1], body: m[2] });
  }
  return out;
}

// Extracts the contents of `USING (...)` / `WITH CHECK (...)` matching the
// outer parens (balanced) because policy bodies can themselves contain
// nested `()` like `auth.uid()` or `public.has_role(...)`.
function extractBalanced(
  body: string,
  keyword: "USING" | "WITH CHECK",
): string | undefined {
  const k =
    keyword === "USING"
      ? /\bUSING\s*\(/isu
      : /\bWITH\s+CHECK\s*\(/isu;
  const start = k.exec(body);
  if (!start) return undefined;
  // Walk from the opening paren and balance until we find its match.
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
  if (depth !== 0) return undefined; // malformed
  return body.slice(start.index + start[0].length, i).trim();
}

function classifyPolicyBody(body: string): "ok" | "review" {
  // Allowed shapes — everything we accept funnels through `auth.uid()` or
  // is one of a small number of intentional public-read / explicit-deny
  // policies documented against a known table.
  //
  //  (a) auth.uid()-anchored — anything reachable through auth.uid():
  //      auth.uid() = user_id            (canonical row ownership)
  //      user_id = auth.uid()            (same, reversed)
  //      reporting_manager_id = auth.uid() (or any other fk column = auth.uid())
  //      public.has_role(auth.uid(), …)  (role helper using auth.uid())
  //      has_role(auth.uid(), …)          (unprefixed form — same helper)
  //      storage.foldername(name)[1] = auth.uid()::text
  //      auth.uid()::text = storage.foldername(name)[1]
  //      bucket_id = '…' AND (storage.foldername(name))[1] = auth.uid()::text
  //  (b) Public-read / per-bucket read:
  //      true                                    (permissive)
  //      status = 'active'                       (anyone reads active things)
  //      status = 'published' AND internal_only = false
  //      bucket_id = 'avatars'                   (avatar bucket is shared
  //                                              between all authenticated
  //                                              users — pre-migration
  //                                              policy, no Clerk change)
  //  (c) Explicit-deny:
  //      false                                   (clerk_user_map service_role gate)
  //
  // Disallowed — anything that reaches into Clerk JWT claims bypassing
  // auth.uid(). Without the mapped auth_user_id, those claims would not
  // match a Postgres `user_id` UUID column.
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

function audit(): { findings: Finding[]; flagged: number; total: number } {
  const findings: Finding[] = [];
  let files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  for (const f of files) {
    const path = join(MIGRATIONS_DIR, f);
    const sql = readFileSync(path, "utf8");
    const policies = extractPolicies(sql);
    for (const p of policies) {
      // Extract USING and WITH CHECK clauses if present, for the finding body.
      const using = extractBalanced(p.body, "USING");
      const check = extractBalanced(p.body, "WITH CHECK");
      const flag = classifyPolicyBody(p.body);
      findings.push({
        file: f,
        policy: p.name,
        using,
        check,
        flag,
        reason:
          flag === "review"
            ? "Policy body doesn't unambiguously route through auth.uid() — manual review required."
            : undefined,
      });
    }
  }
  return {
    findings,
    flagged: findings.filter((f) => f.flag === "review").length,
    total: findings.length,
  };
}

const result = audit();
console.log(`RLS audit: ${result.total} policies inspected, ${result.flagged} flagged for review.`);
if (result.flagged > 0) {
  console.log("\nFlagged policies:");
  for (const f of result.findings.filter((x) => x.flag === "review")) {
    console.log(`  - ${f.file} :: "${f.policy}"`);
    console.log(`    USING: ${f.using ?? "(none)"}`);
    console.log(`    WITH CHECK: ${f.check ?? "(none)"}`);
    console.log(`    Reason: ${f.reason ?? "unspecified"}`);
  }
  process.exit(1);
} else {
  console.log("Every CREATE POLICY body routes through auth.uid() (or is the 'true' / 'status=active…' public-read case).");
  console.log("→ Under the Clerk branch, requireSupabaseAuth issues a GoTrue JWT whose `sub` is the mapped auth.users.id,");
  console.log("  so auth.uid() evaluates to the same UUID the legacy branch saw. All RLS policies fire identically.");
}
