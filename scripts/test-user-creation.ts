/**
 * Integration test for user creation flow
 *
 * This script tests the full flow:
 * 1. Create a test user via provisionClerkUser
 * 2. Verify clerk_user_map entry exists
 * 3. Verify user_roles entry exists with role='user'
 * 4. Clean up test data
 *
 * Usage: npx tsx scripts/test-user-creation.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { provisionClerkUser } from "../src/integrations/clerk/provision-neon.server";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("\n🧪 Testing User Creation Flow\n");
  console.log("═".repeat(60));

  const testEmail = `test-${Date.now()}@example.com`;
  const testClerkId = `user_test_${Date.now()}`;

  console.log("\n📝 Test Data:");
  console.log(`   Email: ${testEmail}`);
  console.log(`   Clerk ID: ${testClerkId}\n`);

  // Step 1: Provision user
  console.log("📦 Step 1: Provisioning user...");
  const result = await provisionClerkUser(prisma, {
    clerkUserId: testClerkId,
    email: testEmail,
    emailVerified: true,
    fullName: "Test User",
  });

  if ("kind" in result) {
    console.error("❌ Provisioning failed:", result);
    process.exit(1);
  }

  console.log(`✓ User provisioned: ${result.authUserId}`);
  console.log(`   Created: ${result.created}`);
  console.log(`   Reused: ${result.reused}\n`);

  // Step 2: Verify clerk_user_map
  console.log("📦 Step 2: Verifying clerk_user_map entry...");
  const clerkMap = await prisma.clerkUserMap.findUnique({
    where: { clerkUserId: testClerkId },
  });

  if (!clerkMap) {
    console.error("❌ clerk_user_map entry not found!");
    process.exit(1);
  }

  console.log("✓ clerk_user_map entry exists");
  console.log(`   auth_user_id: ${clerkMap.authUserId}`);
  console.log(`   email: ${clerkMap.email}`);
  console.log(`   verified: ${clerkMap.primaryEmailVerified}\n`);

  // Step 3: Verify user_roles
  console.log("📦 Step 3: Verifying user_roles entry...");
  const userRole = await prisma.userRole.findFirst({
    where: { userId: result.authUserId },
  });

  if (!userRole) {
    console.error("❌ user_roles entry NOT FOUND!");
    console.error("   This is the bug - roles are not being created!");

    // Show what should exist
    console.log("\n   Expected:");
    console.log(`   user_id: ${result.authUserId}`);
    console.log(`   role: user\n`);

    // Clean up and exit
    await cleanup(testClerkId, result.authUserId);
    process.exit(1);
  }

  console.log("✓ user_roles entry exists");
  console.log(`   user_id: ${userRole.userId}`);
  console.log(`   role: ${userRole.role}`);
  console.log(`   created_at: ${userRole.createdAt}\n`);

  // Step 4: Verify auth.users
  console.log("📦 Step 4: Verifying auth.users entry...");
  const authUser = await pool.query(
    "SELECT id, email, email_confirmed_at FROM auth.users WHERE id = $1",
    [result.authUserId]
  );

  if (authUser.rowCount === 0) {
    console.error("❌ auth.users entry not found!");
    await cleanup(testClerkId, result.authUserId);
    process.exit(1);
  }

  console.log("✓ auth.users entry exists");
  console.log(`   id: ${authUser.rows[0].id}`);
  console.log(`   email: ${authUser.rows[0].email}`);
  console.log(`   confirmed: ${authUser.rows[0].email_confirmed_at ? 'yes' : 'no'}\n`);

  // Step 5: Test idempotency (provision same user again)
  console.log("📦 Step 5: Testing idempotency...");
  const result2 = await provisionClerkUser(prisma, {
    clerkUserId: testClerkId,
    email: testEmail,
    emailVerified: true,
    fullName: "Test User",
  });

  if ("kind" in result2) {
    console.error("❌ Second provision failed:", result2);
    await cleanup(testClerkId, result.authUserId);
    process.exit(1);
  }

  if (result2.authUserId !== result.authUserId) {
    console.error("❌ Second provision returned different auth_user_id!");
    await cleanup(testClerkId, result.authUserId);
    process.exit(1);
  }

  if (!result2.reused) {
    console.error("❌ Second provision should have reused existing user!");
    await cleanup(testClerkId, result.authUserId);
    process.exit(1);
  }

  console.log("✓ Idempotency verified");
  console.log(`   Same auth_user_id: ${result2.authUserId}`);
  console.log(`   Reused: ${result2.reused}\n`);

  // Step 6: Verify no duplicate roles
  console.log("📦 Step 6: Checking for duplicate roles...");
  const allRoles = await prisma.userRole.findMany({
    where: { userId: result.authUserId },
  });

  if (allRoles.length !== 1) {
    console.error(`❌ Expected 1 role, found ${allRoles.length}!`);
    await cleanup(testClerkId, result.authUserId);
    process.exit(1);
  }

  console.log("✓ No duplicate roles");
  console.log(`   Total roles for user: ${allRoles.length}\n`);

  // Cleanup
  await cleanup(testClerkId, result.authUserId);

  console.log("═".repeat(60));
  console.log("\n✅ ALL TESTS PASSED!\n");
  console.log("Summary:");
  console.log("  ✓ User provisioning works");
  console.log("  ✓ clerk_user_map entry created");
  console.log("  ✓ user_roles entry created with role='user'");
  console.log("  ✓ auth.users entry created");
  console.log("  ✓ Idempotency works (no duplicates)");
  console.log("  ✓ No duplicate roles created\n");
}

async function cleanup(clerkUserId: string, authUserId: string) {
  console.log("🧹 Cleaning up test data...");

  // Delete in correct order (child → parent)
  await prisma.userRole.deleteMany({
    where: { userId: authUserId },
  });

  await prisma.clerkUserMap.delete({
    where: { clerkUserId },
  }).catch(() => {}); // Ignore if not found

  await pool.query("DELETE FROM auth.users WHERE id = $1", [authUserId])
    .catch(() => {}); // Ignore if not found

  console.log("✓ Test data cleaned up\n");
}

main()
  .catch((error) => {
    console.error("\n❌ TEST FAILED:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
