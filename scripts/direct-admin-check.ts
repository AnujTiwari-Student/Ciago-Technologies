/**
 * Direct check without RLS wrapper
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const ADMIN_USER_ID = "6fbafe7e-b595-4b02-ad8a-2c0aba52a9cf";

async function main() {
  console.log("=== Direct Admin Check ===\n");

  // Test: Can we query roles directly?
  console.log("Checking roles without RLS transaction...");
  const roles = await sql`
    SELECT role, department_id
    FROM user_roles
    WHERE user_id = ${ADMIN_USER_ID}::uuid
  `;
  console.log(`Found ${roles.length} role(s):`);
  roles.forEach((r) => {
    console.log(`  - ${r.role} (dept: ${r.department_id || "none"})`);
  });

  const roleSet = new Set(roles.map((r: any) => r.role));
  console.log(`\nIs admin? ${roleSet.has("admin") ? "✓ YES" : "❌ NO"}`);

  // Test: Check RLS policies on user_roles table
  console.log("\n\nChecking RLS policies on user_roles...");
  const policies = await sql`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
    ORDER BY policyname
  `;
  console.log(`Found ${policies.length} RLS policies:`);
  policies.forEach((p: any) => {
    console.log(`  - ${p.policyname} (cmd: ${p.cmd})`);
  });

  // Test: Is RLS enabled?
  console.log("\n\nChecking if RLS is enabled on user_roles...");
  const rlsStatus = await sql`
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relname = 'user_roles' AND relnamespace = 'public'::regnamespace
  `;
  if (rlsStatus.length > 0) {
    console.log(`RLS enabled: ${rlsStatus[0].relrowsecurity ? "YES" : "NO"}`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
