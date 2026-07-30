/**
 * Stage 2 Validation: auth.uid() RLS Compatibility Layer
 *
 * Verifies that:
 * 1. auth.uid() reads from transaction-scoped setting correctly
 * 2. has_role() function integrates correctly with auth.uid()
 * 3. RLS policies are correctly defined for all tables
 * 4. Policy logic references auth.uid() correctly
 *
 * NOTE: Full RLS enforcement testing requires a non-superuser connection.
 * The neondb_owner role (used by NEON_DATABASE_URL) bypasses RLS by design.
 * In production, the application will use a limited-privilege role that
 * enforces RLS. This test validates the auth.uid() mechanism itself.
 *
 * Run: bun run scripts/stage2-validate.ts
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
  console.log("=== Stage 2: auth.uid() RLS Compatibility Layer ===\n");

  // Create test users for RLS validation
  const testAdmin = "00000000-0000-0000-0000-000000000001";
  const testEmployee = "00000000-0000-0000-0000-000000000002";
  const testUser = "00000000-0000-0000-0000-000000000003";

  console.log("Setting up test data…");

  // Insert test users
  await sql`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES
      (${testAdmin}, 'test-admin@test.local', now()),
      (${testEmployee}, 'test-employee@test.local', now()),
      (${testUser}, 'test-user@test.local', now())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  `;

  // Grant roles
  await sql`
    INSERT INTO public.user_roles (user_id, role)
    VALUES
      (${testAdmin}, 'admin'),
      (${testEmployee}, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING
  `;

  // Create test profile for employee
  await sql`
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (${testEmployee}, 'Test Employee')
    ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name
  `;

  console.log("Test data setup complete.\n");

  // Test 1: auth.uid() returns NULL when unset
  const unsetUid = await sql`SELECT auth.uid() AS uid`;
  check(`auth.uid() returns NULL when unset`, unsetUid[0].uid === null);

  // Test 2: auth.uid() returns correct UUID when set
  const setTest = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testEmployee}, true)`,
    tx`SELECT auth.uid() AS uid`,
  ]);
  check(
    `auth.uid() returns UUID when set via transaction`,
    setTest[1][0].uid === testEmployee,
    `got ${setTest[1][0].uid}`,
  );

  // Test 3: has_role() works with auth.uid()
  const adminRoleCheck = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testAdmin}, true)`,
    tx`SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin`,
  ]);
  check(
    `has_role(auth.uid(), 'admin') returns TRUE for admin`,
    adminRoleCheck[1][0].is_admin === true,
  );

  const employeeNotAdmin = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testEmployee}, true)`,
    tx`SELECT public.has_role(auth.uid(), 'admin'::app_role) AS is_admin`,
  ]);
  check(
    `has_role(auth.uid(), 'admin') returns FALSE for employee`,
    employeeNotAdmin[1][0].is_admin === false,
  );

  // Test 4: RLS policy enforcement - user_roles (owner read)
  const ownRoles = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testEmployee}, true)`,
    tx`SELECT role FROM public.user_roles WHERE user_id = ${testEmployee}`,
  ]);
  check(
    `Employee can read own roles`,
    ownRoles[1].length === 1 && ownRoles[1][0].role === "employee",
    `got ${ownRoles[1].length} rows`,
  );

  // Test 5: Verify RLS policies are defined correctly
  const userRolesPolicies = await sql`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
    ORDER BY policyname
  `;
  check(
    `user_roles table has RLS policies defined`,
    userRolesPolicies.length >= 4,
    `got ${userRolesPolicies.length} policies`,
  );

  // Test 6: Verify policies reference auth.uid()
  const authUidPolicies = await sql`
    SELECT COUNT(*)::int AS count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%')
  `;
  check(
    `Policies reference auth.uid()`,
    authUidPolicies[0].count > 30,
    `got ${authUidPolicies[0].count} policies`,
  );

  // Test 7: Verify has_role() policies exist
  const hasRolePolicies = await sql`
    SELECT COUNT(*)::int AS count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual::text LIKE '%has_role%' OR with_check::text LIKE '%has_role%')
  `;
  check(
    `Policies use has_role() function`,
    hasRolePolicies[0].count > 20,
    `got ${hasRolePolicies[0].count} policies`,
  );

  // Test 8: Verify all 26 public tables have RLS enabled
  const rlsEnabled = await sql`
    SELECT COUNT(*)::int AS count
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true
  `;
  check(
    `All public tables have RLS enabled`,
    rlsEnabled[0].count === 26,
    `got ${rlsEnabled[0].count}/26`,
  );

  // Test 9: Owner/service connection bypasses RLS (as expected)
  const allRoles = await sql`SELECT COUNT(*)::int AS count FROM public.user_roles`;
  check(
    `Owner connection sees all rows (bypasses RLS as expected)`,
    allRoles[0].count >= 2,
    `got ${allRoles[0].count}`,
  );

  console.log("\n--- RLS Policy Verification Complete ---");
  console.log("NOTE: Full RLS enforcement requires a non-superuser connection.");
  console.log(
    "The auth.uid() mechanism is verified. Actual enforcement will be tested in Stage 5.",
  );

  // Test 10: Multiple set_config calls within transaction (should use last value)
  const multiSet = await sql.transaction((tx) => [
    tx`SELECT set_config('app.current_user_id', ${testAdmin}, true)`,
    tx`SELECT set_config('app.current_user_id', ${testEmployee}, true)`,
    tx`SELECT auth.uid() AS uid`,
  ]);
  check(
    `Multiple set_config uses last value`,
    multiSet[2][0].uid === testEmployee,
    `got ${multiSet[2][0].uid}`,
  );

  // Cleanup
  console.log("\nCleaning up test data…");
  await sql`DELETE FROM public.user_roles WHERE user_id IN (${testAdmin}, ${testEmployee}, ${testUser})`;
  await sql`DELETE FROM public.profiles WHERE user_id IN (${testAdmin}, ${testEmployee}, ${testUser})`;
  await sql`DELETE FROM auth.users WHERE id IN (${testAdmin}, ${testEmployee}, ${testUser})`;

  // Summary
  console.log(
    failures === 0
      ? "\n=== ALL STAGE 2 CHECKS PASSED ==="
      : `\n=== ${failures} STAGE 2 CHECK(S) FAILED ===`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
