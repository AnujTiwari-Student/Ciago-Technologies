/**
 * Complete Database Reset & Seed Script
 *
 * This script will:
 * 1. TRUNCATE all tables (delete all data)
 * 2. Seed reference data (departments, employment_types, status_options)
 * 3. Verify the database is ready
 *
 * WARNING: This DELETES ALL DATA!
 *
 * Usage: npx tsx scripts/reset-database.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// REFERENCE DATA
// ============================================================================

const DEPARTMENTS = [
  { code: "ENG", name: "Engineering", description: "Product Engineering & Platform" },
  { code: "HR", name: "Human Resources", description: "People Operations" },
  { code: "OPS", name: "Operations", description: "Business & Delivery Operations" },
  { code: "MGMT", name: "Management", description: "Leadership & Strategy" },
  { code: "PROD", name: "Product", description: "Product Management" },
  { code: "DES", name: "Design", description: "Design & UX" },
  { code: "FIN", name: "Finance", description: "Finance & Accounting" },
  { code: "SALES", name: "Sales", description: "Sales & Growth" },
  { code: "MKT", name: "Marketing", description: "Marketing & Brand" },
  { code: "CS", name: "Customer Support", description: "Customer Support" },
  { code: "LEGAL", name: "Legal", description: "Legal & Compliance" },
  { code: "IT", name: "IT Infrastructure", description: "IT & Infrastructure" },
];

const EMPLOYMENT_TYPES = [
  { code: "FULL_TIME", label: "Full-Time", sortOrder: 1 },
  { code: "PART_TIME", label: "Part-Time", sortOrder: 2 },
  { code: "CONTRACT", label: "Contract", sortOrder: 3 },
  { code: "INTERN", label: "Internship", sortOrder: 4 },
  { code: "PROBATION", label: "Probation", sortOrder: 5 },
];

const STATUS_OPTIONS = [
  { kind: "application", code: "APPLIED", label: "Applied", sortOrder: 1 },
  { kind: "application", code: "SCREENING", label: "Screening", sortOrder: 2 },
  { kind: "application", code: "INTERVIEWING", label: "Interviewing", sortOrder: 3 },
  { kind: "application", code: "OFFERED", label: "Offered", sortOrder: 4 },
  { kind: "application", code: "HIRED", label: "Hired", sortOrder: 5 },
  { kind: "application", code: "REJECTED", label: "Rejected", sortOrder: 6 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function truncateTable(tableName: string): Promise<boolean> {
  try {
    await pool.query(`TRUNCATE TABLE ${tableName} CASCADE`);
    return true;
  } catch (error: any) {
    // Table might not exist or other error
    return false;
  }
}

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function main() {
  console.log("\n🚨 WARNING: This will DELETE ALL DATA from the database!");
  console.log("⏳ Starting in 3 seconds... Press Ctrl+C to cancel\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  STEP 1: TRUNCATING ALL TABLES");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Order matters - delete child tables first to avoid FK constraints
  const tablesToTruncate = [
    // Child tables first
    "in_app_notifications",
    "audit_logs",
    "service_account_mappings",
    "emails",
    "identity_documents",
    "onboarding_documents",
    "onboarding_records",
    "job_applications",
    "job_postings",
    "salary_slips",
    "salary_structures",
    "timesheets",
    "resignations",
    "leave_requests",
    "interview_slots",
    "attendance_records",
    "referrals",
    "resource_downloads",
    "rate_limits",
    "employees",
    "profiles",
    "user_roles",
    "clerk_user_map",
    // Reference tables
    "departments",
    "employment_types",
    "status_options",
  ];

  let successCount = 0;
  let skipCount = 0;

  for (const table of tablesToTruncate) {
    const success = await truncateTable(table);
    if (success) {
      console.log(`✓ Cleared ${table}`);
      successCount++;
    } else {
      console.log(`⚠ Skipped ${table} (doesn't exist or error)`);
      skipCount++;
    }
  }

  console.log(`\n✓ Truncated ${successCount} tables, skipped ${skipCount}\n`);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  STEP 2: SEEDING REFERENCE DATA");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Seed Departments
  console.log("📦 Seeding Departments...");
  for (const dept of DEPARTMENTS) {
    await prisma.department.create({ data: dept });
  }
  console.log(`✓ Created ${DEPARTMENTS.length} departments\n`);

  // Seed Employment Types
  console.log("📦 Seeding Employment Types...");
  for (const empType of EMPLOYMENT_TYPES) {
    await prisma.employmentType.create({ data: empType });
  }
  console.log(`✓ Created ${EMPLOYMENT_TYPES.length} employment types\n`);

  // Seed Status Options
  console.log("📦 Seeding Status Options...");
  for (const status of STATUS_OPTIONS) {
    await prisma.statusOption.create({ data: status });
  }
  console.log(`✓ Created ${STATUS_OPTIONS.length} status options\n`);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  STEP 3: VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const deptCount = await prisma.department.count();
  const empTypeCount = await prisma.employmentType.count();
  const statusCount = await prisma.statusOption.count();
  const userRoleCount = await prisma.userRole.count();
  const clerkMapCount = await prisma.clerkUserMap.count();

  console.log("📊 Database State:");
  console.log(`   Departments: ${deptCount}`);
  console.log(`   Employment Types: ${empTypeCount}`);
  console.log(`   Status Options: ${statusCount}`);
  console.log(`   User Roles: ${userRoleCount}`);
  console.log(`   Clerk User Maps: ${clerkMapCount}`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ✅ DATABASE RESET COMPLETE!");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("📝 NEXT STEPS:\n");
  console.log("1. Sign up at /auth to create a new user");
  console.log("2. The provision script will automatically:");
  console.log("   - Create entry in clerk_user_map");
  console.log("   - Create entry in profiles");
  console.log("   - Create entry in user_roles (role: 'user')");
  console.log("\n3. To make yourself admin, run this SQL:\n");
  console.log("   UPDATE user_roles");
  console.log("   SET role = 'admin'");
  console.log("   WHERE user_id = (");
  console.log("     SELECT auth_user_id FROM clerk_user_map");
  console.log("     WHERE email = 'your-email@example.com'");
  console.log("   );\n");

  console.log("🔍 To verify user creation works:");
  console.log("   - Sign up with a new account");
  console.log("   - Check: SELECT * FROM user_roles;");
  console.log("   - You should see one row with role='user'\n");
}

main()
  .catch((error) => {
    console.error("\n❌ ERROR:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
