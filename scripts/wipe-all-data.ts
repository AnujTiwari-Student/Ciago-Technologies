/**
 * Wipe all data from database and Clerk.
 * WARNING: This deletes EVERYTHING.
 */

import { getAdminDb } from "@/lib/db/admin";
import { createClerkClient } from "@clerk/backend";

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

async function main() {
  console.log("\n========================================");
  console.log("WIPING ALL DATA");
  console.log("========================================\n");

  // 1. Wipe Clerk users
  console.log("1. Checking Clerk for users...");
  if (!CLERK_SECRET_KEY) {
    console.log("   ⚠️  No CLERK_SECRET_KEY - skipping Clerk cleanup");
  } else {
    const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
    const { data: users, totalCount } = await clerk.users.getUserList({ limit: 100 });

    console.log(`   Found ${totalCount} users in Clerk`);

    if (users.length > 0) {
      console.log("   Deleting Clerk users...");
      for (const user of users) {
        try {
          await clerk.users.deleteUser(user.id);
          console.log(
            `   ✓ Deleted Clerk user: ${user.id} (${user.emailAddresses[0]?.emailAddress})`,
          );
        } catch (err: any) {
          console.log(`   ✗ Failed to delete ${user.id}: ${err.message}`);
        }
      }
    } else {
      console.log("   ✓ No Clerk users to delete");
    }
  }
  console.log("");

  // 2. Wipe Neon database
  console.log("2. Wiping Neon database...");
  const adminDb = getAdminDb();

  // Delete from all tables in dependency order (reverse foreign key order)
  const tables = [
    { name: "inAppNotification", label: "in_app_notifications" },
    { name: "auditLog", label: "audit_logs" },
    { name: "onboardingDocument", label: "onboarding_documents" },
    { name: "onboardingRecord", label: "onboarding_records" },
    { name: "jobApplication", label: "job_applications" },
    { name: "jobPosting", label: "job_postings" },
    { name: "profile", label: "profile" },
    { name: "clerkUserMap", label: "clerk_user_map" },
  ];

  for (const table of tables) {
    try {
      const result = await (adminDb as any)[table.name].deleteMany({});
      console.log(`   ✓ Deleted from ${table.label}: ${result.count} rows`);
    } catch (err: any) {
      console.log(`   ⚠️  ${table.label}: ${err.message}`);
    }
  }

  // Delete from auth.users (manual query since it's not in Prisma schema)
  try {
    const authUsers = await adminDb.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users`;
    console.log(`   Found ${authUsers.length} rows in auth.users`);

    if (authUsers.length > 0) {
      await adminDb.$executeRawUnsafe(`DELETE FROM auth.users WHERE true`);
      console.log(`   ✓ Deleted from auth.users: ${authUsers.length} rows`);
    } else {
      console.log(`   ✓ auth.users already empty`);
    }
  } catch (err: any) {
    console.log(`   ✗ auth.users: ${err.message}`);
  }

  console.log("\n========================================");
  console.log("✅ WIPE COMPLETE");
  console.log("========================================\n");
  console.log("All data deleted from:");
  console.log("  - Clerk (all users)");
  console.log("  - Neon (all tables)");
  console.log("  - auth.users (all rows)");
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ FATAL ERROR:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
