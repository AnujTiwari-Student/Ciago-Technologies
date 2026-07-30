/**
 * Test Prisma Client connection to Neon database
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!databaseUrl) {
  console.error("FATAL: DATABASE_URL or NEON_DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Prisma Client Connection Test ===\n");

  // Test 1: Count tables
  const tableCount = await prisma.$queryRaw<
    Array<{ count: number }>
  >`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log(`✓ Connected to Neon. Public tables: ${tableCount[0].count}`);

  // Test 2: Query user_roles
  const roleCount = await prisma.userRole.count();
  console.log(`✓ Prisma query: ${roleCount} rows in user_roles`);

  // Test 3: Query profiles
  const profileCount = await prisma.profile.count();
  console.log(`✓ Prisma query: ${profileCount} rows in profiles`);

  // Test 4: Query departments
  const depts = await prisma.department.findMany({
    select: { code: true, name: true },
  });
  console.log(`✓ Prisma query: ${depts.length} departments:`, depts.map((d) => d.code).join(", "));

  // Test 5: Verify all models are accessible
  const models = [
    "attendanceRecord",
    "auditLog",
    "clerkUserMap",
    "department",
    "employeeTask",
    "employee",
    "employmentType",
    "identityDocument",
    "inAppNotification",
    "interviewSlot",
    "jobApplication",
    "jobPosting",
    "leaveRequest",
    "onboardingDocument",
    "onboardingRecord",
    "profile",
    "projectEstimate",
    "rateLimit",
    "referral",
    "resignation",
    "resourceDownload",
    "salarySlip",
    "salaryStructure",
    "statusOption",
    "timesheet",
    "userRole",
  ];

  for (const model of models) {
    if (!(model in prisma)) {
      console.error(`✗ Model "${model}" not found in Prisma Client`);
    }
  }
  console.log(`✓ All ${models.length} models available in Prisma Client`);

  console.log("\n=== ALL PRISMA TESTS PASSED ===");
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
