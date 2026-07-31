/**
 * Test Prisma transaction directly without the wrapper
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set");
  process.exit(1);
}

const ADMIN_USER_ID = "6fbafe7e-b595-4b02-ad8a-2c0aba52a9cf";

async function main() {
  console.log("=== Testing Prisma Transaction Directly ===\n");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

  try {
    console.log("Test 1: Simple query without transaction...");
    const allRoles = await prisma.userRole.findMany({
      where: { userId: ADMIN_USER_ID },
    });
    console.log(`  ✓ Found ${allRoles.length} role(s) without RLS`);

    console.log("\nTest 2: Transaction with SET LOCAL...");
    const roles = await prisma.$transaction(async (tx) => {
      console.log("  - Setting RLS context...");
      await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${ADMIN_USER_ID}'`);
      console.log("  - Querying with RLS...");
      return tx.userRole.findMany({
        where: { userId: ADMIN_USER_ID },
        select: { role: true, departmentId: true },
      });
    });

    console.log(`  ✓ Found ${roles.length} role(s) with RLS:`);
    roles.forEach((r) => {
      console.log(`    - ${r.role} (dept: ${r.departmentId || "none"})`);
    });

    const roleSet = new Set(roles.map((r) => r.role));
    console.log(`\n  Is admin? ${roleSet.has("admin") ? "✓ YES" : "❌ NO"}`);

    console.log("\n✓ All tests passed!");
  } catch (err) {
    console.error("\n❌ Test failed:", err);
    throw err;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
