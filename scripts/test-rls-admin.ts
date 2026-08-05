/**
 * Test RLS and admin role fetching
 */
import { createUserDb } from "@/lib/db/neon";

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const ADMIN_USER_ID = "6fbafe7e-b595-4b02-ad8a-2c0aba52a9cf";

async function main() {
  console.log("=== Testing RLS and Admin Role ===\n");
  console.log(`Testing with user ID: ${ADMIN_USER_ID}\n`);

  const db = createUserDb(DATABASE_URL, ADMIN_USER_ID);

  try {
    // Test 1: Fetch roles with RLS
    console.log("Test 1: Fetching roles with RLS...");
    const roles = await db.withRLS((tx) =>
      tx.userRole.findMany({
        where: { userId: ADMIN_USER_ID },
        select: { role: true, departmentId: true },
      }),
    );
    console.log(`  ✓ Found ${roles.length} role(s):`);
    roles.forEach((r) => {
      console.log(`    - ${r.role} (dept: ${r.departmentId || "none"})`);
    });

    // Test 2: Check if admin role exists
    const roleSet = new Set(roles.map((r) => r.role));
    const isAdmin = roleSet.has("admin");
    console.log(`\nTest 2: Is admin? ${isAdmin ? "✓ YES" : "❌ NO"}`);

    // Test 3: Verify the RLS policy directly with raw SQL
    console.log("\nTest 3: Testing RLS policy with raw query...");
    const rawRoles = await db.withRLS(
      (tx) =>
        tx.$queryRaw`
        SELECT role, department_id
        FROM user_roles
        WHERE user_id = ${ADMIN_USER_ID}::uuid
      `,
    );
    console.log(`  ✓ Raw query returned ${(rawRoles as any[]).length} role(s)`);

    // Test 4: Check auth.uid() function
    console.log("\nTest 4: Checking auth.uid() within transaction...");
    const uidResult = await db.withRLS((tx) => tx.$queryRaw`SELECT auth.uid() as current_user_id`);
    console.log(`  ✓ auth.uid() returns:`, (uidResult as any[])[0]?.current_user_id);

    console.log("\n✓ All tests passed!");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
    process.exit(1);
  }
}

main();
