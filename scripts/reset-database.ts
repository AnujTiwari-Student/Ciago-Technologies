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

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
  { code: "full_time", label: "Full-time", sortOrder: 1 },
  { code: "part_time", label: "Part-time", sortOrder: 2 },
  { code: "internship", label: "Internship", sortOrder: 3 },
  { code: "apprenticeship", label: "Apprenticeship", sortOrder: 4 },
  { code: "contractor", label: "Contractor", sortOrder: 5 },
];

const STATUS_OPTIONS = [
  // Job posting statuses
  { kind: "job_posting", code: "draft", label: "Draft", sortOrder: 10 },
  { kind: "job_posting", code: "published", label: "Published", sortOrder: 20 },
  { kind: "job_posting", code: "internal_only", label: "Internal only", sortOrder: 30 },
  { kind: "job_posting", code: "closed", label: "Closed", sortOrder: 40 },
  { kind: "job_posting", code: "archived", label: "Archived", sortOrder: 50 },
  // Application statuses
  { kind: "application", code: "applied", label: "Applied", sortOrder: 10 },
  { kind: "application", code: "screening", label: "Screening", sortOrder: 20 },
  { kind: "application", code: "interviewing", label: "Interviewing", sortOrder: 30 },
  { kind: "application", code: "offered", label: "Offered", sortOrder: 40 },
  { kind: "application", code: "hired", label: "Hired", sortOrder: 50 },
  { kind: "application", code: "rejected", label: "Rejected", sortOrder: 60 },
  // User account statuses
  { kind: "user_account", code: "active", label: "Active", sortOrder: 10 },
  { kind: "user_account", code: "inactive", label: "Inactive", sortOrder: 20 },
  { kind: "user_account", code: "suspended", label: "Suspended", sortOrder: 30 },
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
    // Lifecycle & integration child tables
    "external_access_revocation_events",
    "external_access_provisions",
    "access_role_mappings",
    "offboarding_tasks",
    "offboarding_records",
    "background_verifications",
    "setup_tokens",
    "integration_events",
    // Notifications & audit
    "in_app_notifications",
    "audit_logs",
    // Service accounts & emails
    "service_account_mappings",
    "emails",
    // Documents & onboarding
    "identity_documents",
    "onboarding_documents",
    "onboarding_records",
    // Applications & jobs
    "job_applications",
    "job_postings",
    // Payroll & time
    "salary_slips",
    "salary_structures",
    "timesheets",
    // HR actions
    "resignations",
    "leave_requests",
    "interview_slots",
    "attendance_records",
    "referrals",
    "resource_downloads",
    "rate_limits",
    // Core user tables
    "employees",
    "profiles",
    "user_roles",
    "clerk_user_map",
    // Auth schema
    "auth.users",
    // Reference tables (will be re-seeded)
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
    await pool.query(
      `INSERT INTO departments (code, name, description) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = $2, description = $3`,
      [dept.code, dept.name, dept.description],
    );
  }
  console.log(`✓ Created ${DEPARTMENTS.length} departments\n`);

  // Seed Employment Types
  console.log("📦 Seeding Employment Types...");
  for (const empType of EMPLOYMENT_TYPES) {
    await pool.query(
      `INSERT INTO employment_types (code, label, sort_order) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET label = $2, sort_order = $3`,
      [empType.code, empType.label, empType.sortOrder],
    );
  }
  console.log(`✓ Created ${EMPLOYMENT_TYPES.length} employment types\n`);

  // Seed Status Options
  console.log("📦 Seeding Status Options...");
  for (const status of STATUS_OPTIONS) {
    await pool.query(
      `INSERT INTO status_options (kind, code, label, sort_order) VALUES ($1, $2, $3, $4)
       ON CONFLICT (kind, code) DO UPDATE SET label = $3, sort_order = $4`,
      [status.kind, status.code, status.label, status.sortOrder],
    );
  }
  console.log(`✓ Created ${STATUS_OPTIONS.length} status options\n`);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  STEP 3: VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const deptCount = (await pool.query("SELECT count(*) FROM departments")).rows[0].count;
  const empTypeCount = (await pool.query("SELECT count(*) FROM employment_types")).rows[0].count;
  const statusCount = (await pool.query("SELECT count(*) FROM status_options")).rows[0].count;
  const userRoleCount = (await pool.query("SELECT count(*) FROM user_roles")).rows[0].count;
  const clerkMapCount = (await pool.query("SELECT count(*) FROM clerk_user_map")).rows[0].count;

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
  });
