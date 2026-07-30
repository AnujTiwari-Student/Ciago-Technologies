/**
 * Stage 1 validation — verify the migrated Neon schema.
 *
 * Runs the acceptance-criteria checks from plans.md Stage 1:
 *   - All 26 application tables present (+ auth.users)
 *   - All stored functions present
 *   - All enums present
 *   - All RLS policies present
 *   - auth.uid() returns null when unset
 *   - auth.uid() returns correct UUID when set via SET LOCAL
 *
 * Run: bun run scripts/neon-validate.ts
 */
import { neon } from "@neondatabase/serverless";

const neonUrl = process.env.NEON_DATABASE_URL;
if (!neonUrl) {
  console.error("FATAL: NEON_DATABASE_URL is not set in .env");
  process.exit(1);
}
const sql = neon(neonUrl);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  console.log("=== Stage 1 Validation ===\n");

  // 1. Tables
  const tables = await sql`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'auth') AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `;
  const tableNames = tables.map((t) => `${t.table_schema}.${t.table_name}`);
  const publicTables = tableNames.filter((n) => n.startsWith("public."));
  check(`public schema table count == 26`, publicTables.length === 26, `got ${publicTables.length}`);
  check(`auth.users exists`, tableNames.includes("auth.users"));
  console.log(`\nTables:\n  ${tableNames.join("\n  ")}\n`);

  // 2. Functions
  const fns = await sql`
    SELECT routine_schema, routine_name
    FROM information_schema.routines
    WHERE routine_schema IN ('public', 'auth') AND routine_type = 'FUNCTION'
    ORDER BY routine_schema, routine_name
  `;
  const fnNames = fns.map((f) => `${f.routine_schema}.${f.routine_name}`);
  const expectedFns = [
    "auth.uid",
    "public.has_role",
    "public.is_admin_user",
    "public.admin_set_user_role",
    "public.apply_for_role",
    "public.complete_onboarding",
    "public.finalize_onboarding_role",
    "public.list_directory",
    "public.prune_rate_limits",
  ];
  for (const e of expectedFns) {
    check(`function ${e} exists`, fnNames.includes(e));
  }
  console.log(`\nAll functions found:\n  ${fnNames.join("\n  ")}\n`);

  // 3. Enums
  const enums = await sql`
    SELECT t.typname
    FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typtype = 'e' AND n.nspname = 'public'
    ORDER BY t.typname
  `;
  const enumNames = enums.map((e) => e.typname);
  for (const e of ["app_role", "dept_type", "job_posting_status", "job_track_type"]) {
    check(`enum ${e} exists`, enumNames.includes(e));
  }

  // 4. RLS policies
  const policies = await sql`
    SELECT COUNT(*)::int AS count FROM pg_policies
    WHERE schemaname = 'public'
  `;
  const policyCount = policies[0].count as number;
  // plans.md says 104+ but that includes ~20 storage.objects policies (migrating to R2).
  // Net public-schema policies after all DROP/re-CREATE sequences = ~83.
  check(`public RLS policy count >= 80`, policyCount >= 80, `got ${policyCount}`);

  // 5. auth.uid() behaviour
  const unsetUid = await sql`SELECT auth.uid() AS uid`;
  check(`auth.uid() returns NULL when unset`, unsetUid[0].uid === null);

  const testUuid = "00000000-0000-0000-0000-000000000001";
  const setResult = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testUuid}, true)`,
    tx`SELECT auth.uid() AS uid`,
  ]);
  check(
    `auth.uid() returns UUID when SET LOCAL`,
    setResult[1][0].uid === testUuid,
    `got ${setResult[1][0].uid}`,
  );

  // 6. has_role smoke test with simulated user
  const roleCheck = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testUuid}, true)`,
    tx`SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin`,
  ]);
  check(
    `has_role(auth.uid(), …) runs without error`,
    typeof roleCheck[1][0].is_admin === "boolean",
  );

  // Summary
  console.log(failures === 0 ? "\n=== ALL CHECKS PASSED ===" : `\n=== ${failures} CHECK(S) FAILED ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
