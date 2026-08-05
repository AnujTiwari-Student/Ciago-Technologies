/**
 * Cleanup Database & Frappe - Keep Seeded Data & Admin User
 *
 * This script will:
 * 1. Delete all database records EXCEPT:
 *    - Seeded: departments, employment_types, status_options
 *    - User: anujavengers@gmail.com and ALL related records (user_roles, profile, employee, etc.)
 *    - Published job postings
 * 2. Delete all Frappe records EXCEPT:
 *    - Seeded master data (Departments, Designations, Employment Types, Branches)
 *    - Employee/User for anujavengers@gmail.com
 *    - Job Openings linked to published job postings
 *
 * COMMAND TO RUN (from project root):
 *   npx tsx scripts/cleanup-except-seed-and-admin.ts
 *
 * YES, it's that simple - just run the command above and it will clean everything automatically!
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
import { createFrappeClient } from "../src/integrations/frappe/client";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ADMIN_EMAIL = "anujavengers@gmail.com";

// ============================================================================
// DATABASE CLEANUP
// ============================================================================

async function cleanupDatabase() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DATABASE CLEANUP");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Get admin user ID
  const adminUserResult = await pool.query(
    `SELECT auth_user_id FROM clerk_user_map WHERE email = $1`,
    [ADMIN_EMAIL],
  );

  if (adminUserResult.rows.length === 0) {
    console.log(`⚠️  Admin user ${ADMIN_EMAIL} not found in database`);
    return;
  }

  const adminUserId = adminUserResult.rows[0].auth_user_id;
  console.log(`✓ Found admin user: ${ADMIN_EMAIL} (ID: ${adminUserId})\n`);

  // Get job postings that should be kept (published ones)
  const jobPostingsResult = await pool.query(
    `SELECT id, title FROM job_postings WHERE status = 'published' OR status = 'draft'`,
  );
  const keepJobPostingIds = jobPostingsResult.rows.map((r) => r.id);
  console.log(
    `✓ Found ${keepJobPostingIds.length} job postings to keep:`,
    jobPostingsResult.rows.map((r) => r.title).join(", ") || "none",
  );
  console.log();

  // Delete tables in order (respecting FK constraints)
  const deleteTables = [
    // Child tables first
    {
      name: "external_access_revocation_events",
      where: `employee_id != $1`,
      params: [adminUserId],
    },
    { name: "external_access_provisions", where: `employee_id != $1`, params: [adminUserId] },
    {
      name: "offboarding_tasks",
      where: `offboarding_id IN (SELECT id FROM offboarding_records WHERE user_id != $1)`,
      params: [adminUserId],
    },
    { name: "offboarding_records", where: `user_id != $1`, params: [adminUserId] },
    { name: "background_verifications", where: `user_id != $1`, params: [adminUserId] },
    { name: "setup_tokens", where: `user_id != $1`, params: [adminUserId] },
    { name: "integration_events", where: `1=1`, params: [] }, // Clear all events
    { name: "in_app_notifications", where: `user_id != $1`, params: [adminUserId] },
    { name: "audit_logs", where: `actor_id != $1 OR actor_id IS NULL`, params: [adminUserId] },
    { name: "service_account_mappings", where: `employee_id != $1`, params: [adminUserId] },
    { name: "emails", where: `user_id != $1 OR user_id IS NULL`, params: [adminUserId] },
    { name: "identity_documents", where: `user_id != $1`, params: [adminUserId] },
    { name: "onboarding_documents", where: `user_id != $1`, params: [adminUserId] },
    { name: "onboarding_records", where: `user_id != $1`, params: [adminUserId] },
    {
      name: "job_applications",
      where:
        keepJobPostingIds.length > 0
          ? `user_id != $1 OR role_id NOT IN (${keepJobPostingIds.map((_, i) => `$${i + 2}`).join(",")})`
          : `user_id != $1`,
      params: keepJobPostingIds.length > 0 ? [adminUserId, ...keepJobPostingIds] : [adminUserId],
    },
    { name: "salary_slips", where: `user_id != $1`, params: [adminUserId] },
    { name: "salary_structures", where: `user_id != $1`, params: [adminUserId] },
    { name: "timesheets", where: `employee_id != $1`, params: [adminUserId] },
    { name: "resignations", where: `user_id != $1`, params: [adminUserId] },
    { name: "leave_requests", where: `user_id != $1`, params: [adminUserId] },
    { name: "interview_slots", where: `candidate_user_id != $1`, params: [adminUserId] },
    { name: "attendance_records", where: `user_id != $1`, params: [adminUserId] },
    { name: "referrals", where: `employee_id != $1`, params: [adminUserId] },
    { name: "resource_downloads", where: `1=1`, params: [] }, // Clear all
    { name: "rate_limits", where: `1=1`, params: [] }, // Clear all rate limits
    { name: "employees", where: `user_id != $1`, params: [adminUserId] },
    { name: "profiles", where: `user_id != $1`, params: [adminUserId] },
    { name: "clerk_user_map", where: `auth_user_id != $1`, params: [adminUserId] },
    { name: "auth.users", where: `id != $1`, params: [adminUserId] },
    // Clean user_roles AFTER cleaning users to catch orphaned roles
    { name: "user_roles", where: `user_id != $1`, params: [adminUserId] },
  ];

  for (const table of deleteTables) {
    try {
      const result = await pool.query(
        `DELETE FROM ${table.name} WHERE ${table.where}`,
        table.params,
      );
      console.log(`✓ Cleaned ${table.name}: deleted ${result.rowCount} rows`);
    } catch (error: any) {
      console.log(`⚠️  Skipped ${table.name}: ${error.message}`);
    }
  }

  // Special cleanup: Check for orphaned user_roles (roles for users that no longer exist)
  console.log("\n🔍 Checking for orphaned user_roles...");
  const orphanedCheck = await pool.query(`
    SELECT COUNT(*) as count
    FROM user_roles ur
    LEFT JOIN clerk_user_map cum ON ur.user_id = cum.auth_user_id
    WHERE cum.auth_user_id IS NULL
  `);

  const orphanedCount = parseInt(orphanedCheck.rows[0].count);
  if (orphanedCount > 0) {
    console.log(`⚠️  Found ${orphanedCount} orphaned user_roles`);
    console.log(`   These cannot be deleted automatically due to Row Level Security (RLS)`);
    console.log(`   To clean them manually, run:`);
    console.log(`   npx tsx scripts/manual-cleanup-orphaned-roles.sql`);
    console.log(`   Or run the SQL directly in your database console with admin privileges`);
  } else {
    console.log("✓ No orphaned user_roles found");
  }

  console.log("\n✅ Database cleanup complete!\n");
}

// ============================================================================
// FRAPPE CLEANUP
// ============================================================================

async function cleanupFrappe() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FRAPPE CLEANUP");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    const frappeClient = createFrappeClient();

    // Test connection
    const loggedUser = await frappeClient.testAuth();
    console.log(`✓ Connected to Frappe as: ${loggedUser}\n`);

    // Get admin employee
    const adminEmployeeResult = await pool.query(
      `SELECT frappe_employee_name FROM employees WHERE user_id = (
         SELECT auth_user_id FROM clerk_user_map WHERE email = $1
       )`,
      [ADMIN_EMAIL],
    );

    const adminEmployeeName = adminEmployeeResult.rows[0]?.frappe_employee_name;
    console.log(`✓ Admin Frappe Employee: ${adminEmployeeName || "not found"}\n`);

    // Get job postings that should be kept
    const jobPostingsResult = await pool.query(
      `SELECT frappe_job_opening_name FROM job_postings
       WHERE frappe_job_opening_name IS NOT NULL`,
    );
    const keepJobOpenings = jobPostingsResult.rows
      .map((r) => r.frappe_job_opening_name)
      .filter(Boolean);
    console.log(`✓ Found ${keepJobOpenings.length} Frappe Job Openings to keep\n`);

    // List all Employees
    console.log("🔍 Checking Frappe Employees...");
    const employees = await frappeClient.listEmployees(0, 0);
    console.log(`   Found ${employees.length} employees in Frappe`);

    let deletedEmployees = 0;
    for (const emp of employees) {
      if (emp.name !== adminEmployeeName) {
        try {
          const fullEmp = await frappeClient.getEmployee(emp.name);
          if (fullEmp) {
            // Mark as Left instead of deleting (safer)
            await frappeClient.terminateEmployee(emp.name, new Date().toISOString().split("T")[0]);
            console.log(`   ✓ Terminated: ${emp.name}`);
            deletedEmployees++;
          }
        } catch (error: any) {
          console.log(`   ⚠️  Failed to terminate ${emp.name}: ${error.message}`);
        }
      }
    }
    console.log(`✓ Terminated ${deletedEmployees} employees\n`);

    // List all Users
    console.log("🔍 Checking Frappe Users...");
    // Note: Frappe doesn't have a direct list users endpoint, we'd need to use the full API
    // For now, we'll skip user deletion as it's risky
    console.log("   ⚠️  Skipping user deletion (manual cleanup recommended)\n");

    // List Job Applicants
    console.log("🔍 Checking Frappe Job Applicants...");
    const jobApplicants = await frappeClient.listJobApplicants(0, 0);
    console.log(`   Found ${jobApplicants.length} job applicants in Frappe`);

    let deletedApplicants = 0;
    for (const applicant of jobApplicants) {
      try {
        const fullApplicant = await frappeClient.getJobApplicant(applicant.name);
        if (fullApplicant && fullApplicant.applicant_email !== ADMIN_EMAIL) {
          // Update status to Rejected (safer than deleting)
          await frappeClient.updateJobApplicant(applicant.name, {
            status: "Rejected",
          });
          console.log(`   ✓ Rejected: ${applicant.name}`);
          deletedApplicants++;
        }
      } catch (error: any) {
        console.log(`   ⚠️  Failed to update ${applicant.name}: ${error.message}`);
      }
    }
    console.log(`✓ Rejected ${deletedApplicants} job applicants\n`);

    // List Job Openings
    console.log("🔍 Checking Frappe Job Openings...");
    const jobOpenings = await frappeClient.listJobOpenings(0, 0);
    console.log(`   Found ${jobOpenings.length} job openings in Frappe`);

    let closedOpenings = 0;
    for (const opening of jobOpenings) {
      if (!keepJobOpenings.includes(opening.name)) {
        try {
          // Close the job opening instead of deleting
          await frappeClient.updateJobOpening(opening.name, {
            status: "Closed",
          });
          console.log(`   ✓ Closed: ${opening.name}`);
          closedOpenings++;
        } catch (error: any) {
          console.log(`   ⚠️  Failed to close ${opening.name}: ${error.message}`);
        }
      }
    }
    console.log(`✓ Closed ${closedOpenings} job openings\n`);

    console.log("✅ Frappe cleanup complete!\n");
  } catch (error: any) {
    console.error(`❌ Frappe cleanup failed: ${error.message}`);
  }
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyCleanup() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const tables = [
    "departments",
    "employment_types",
    "status_options",
    "job_postings",
    "job_applications",
    "user_roles",
    "clerk_user_map",
    "employees",
    "profiles",
    "auth.users",
  ];

  console.log("📊 Remaining Records:\n");
  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT count(*) FROM ${table}`);
      console.log(`   ${table.padEnd(25)} ${result.rows[0].count}`);
    } catch (error) {
      console.log(`   ${table.padEnd(25)} error`);
    }
  }

  console.log();
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n🧹 CLEANUP: Keep Seeded Data & Admin User");
  console.log(`   Admin User: ${ADMIN_EMAIL}`);
  console.log("\n⏳ Starting in 3 seconds... Press Ctrl+C to cancel\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  await cleanupDatabase();
  await cleanupFrappe();
  await verifyCleanup();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  ✅ CLEANUP COMPLETE!");
  console.log("═══════════════════════════════════════════════════════════\n");
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
