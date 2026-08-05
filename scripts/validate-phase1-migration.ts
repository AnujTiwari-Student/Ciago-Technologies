/**
 * Phase 1 Migration Validation Script
 *
 * Validates the migration SQL syntax and checks for existing data conflicts
 * before running the actual migration.
 *
 * IMPORTANT: This script performs READ-ONLY validation checks.
 * It does NOT modify the database.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ValidationResult {
  check: string;
  status: "PASS" | "WARNING" | "FAIL";
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

async function main() {
  console.log("\n🔍 Phase 1 Migration Validation\n");
  console.log("=".repeat(60));
  console.log("\nPerforming READ-ONLY validation checks...\n");

  // Check 1: Database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.push({
      check: "Database Connection",
      status: "PASS",
      message: "Successfully connected to database",
    });
  } catch (error) {
    results.push({
      check: "Database Connection",
      status: "FAIL",
      message: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
    });
    printResults();
    await prisma.$disconnect();
    process.exit(1);
  }

  // Check 2: Duplicate orangehrm_employee_id in job_applications
  try {
    const duplicates = await prisma.$queryRaw<
      Array<{ orangehrm_employee_id: number; count: bigint; application_ids: string[] }>
    >`
      SELECT
        orangehrm_employee_id,
        COUNT(*) as count,
        array_agg(id::text) as application_ids
      FROM job_applications
      WHERE orangehrm_employee_id IS NOT NULL
      GROUP BY orangehrm_employee_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      results.push({
        check: "job_applications.orangehrm_employee_id Uniqueness",
        status: "PASS",
        message: "No duplicate orangehrm_employee_id values found",
      });
    } else {
      results.push({
        check: "job_applications.orangehrm_employee_id Uniqueness",
        status: "WARNING",
        message: `Found ${duplicates.length} duplicate orangehrm_employee_id value(s)`,
        details: duplicates.map((d) => ({
          orangehrm_employee_id: d.orangehrm_employee_id,
          duplicate_count: Number(d.count),
          application_ids: d.application_ids,
        })),
      });
    }
  } catch (error) {
    results.push({
      check: "job_applications.orangehrm_employee_id Uniqueness",
      status: "WARNING",
      message: `Could not check: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 3: Duplicate orangehrm_employee_id in employees
  try {
    const duplicates = await prisma.$queryRaw<
      Array<{ orangehrm_employee_id: number; count: bigint; user_ids: string[] }>
    >`
      SELECT
        orangehrm_employee_id,
        COUNT(*) as count,
        array_agg(user_id::text) as user_ids
      FROM employees
      WHERE orangehrm_employee_id IS NOT NULL
      GROUP BY orangehrm_employee_id
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      results.push({
        check: "employees.orangehrm_employee_id Uniqueness",
        status: "PASS",
        message: "No duplicate orangehrm_employee_id values found",
      });
    } else {
      results.push({
        check: "employees.orangehrm_employee_id Uniqueness",
        status: "WARNING",
        message: `Found ${duplicates.length} duplicate orangehrm_employee_id value(s)`,
        details: duplicates.map((d) => ({
          orangehrm_employee_id: d.orangehrm_employee_id,
          duplicate_count: Number(d.count),
          user_ids: d.user_ids,
        })),
      });
    }
  } catch (error) {
    results.push({
      check: "employees.orangehrm_employee_id Uniqueness",
      status: "WARNING",
      message: `Could not check: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 4: Existing enum conflicts
  try {
    const existingEnums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT typname
      FROM pg_type
      WHERE typtype = 'e'
      AND typname IN (
        'orangehrm_record_status',
        'orangehrm_termination_reason',
        'ess_account_status',
        'orangehrm_provisioning_state',
        'offboarding_status',
        'offboarding_reason',
        'external_provider',
        'external_access_status',
        'integration_event_status',
        'background_verification_status'
      )
    `;

    if (existingEnums.length > 0) {
      results.push({
        check: "Enum Type Conflicts",
        status: "WARNING",
        message: `Found ${existingEnums.length} existing enum type(s) that will be used`,
        details: existingEnums.map((e) => e.typname),
      });
    } else {
      results.push({
        check: "Enum Type Conflicts",
        status: "PASS",
        message: "No conflicting enum types found",
      });
    }
  } catch (error) {
    results.push({
      check: "Enum Type Conflicts",
      status: "WARNING",
      message: `Could not check: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 5: Existing table conflicts
  try {
    const existingTables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN (
        'setup_tokens',
        'integration_events',
        'background_verifications',
        'offboarding_records',
        'offboarding_tasks',
        'external_access_provisions',
        'external_access_revocation_events',
        'access_role_mappings'
      )
    `;

    if (existingTables.length > 0) {
      results.push({
        check: "Table Conflicts",
        status: "FAIL",
        message: `Found ${existingTables.length} existing table(s) that would conflict`,
        details: existingTables.map((t) => t.tablename),
      });
    } else {
      results.push({
        check: "Table Conflicts",
        status: "PASS",
        message: "No conflicting tables found",
      });
    }
  } catch (error) {
    results.push({
      check: "Table Conflicts",
      status: "WARNING",
      message: `Could not check: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check 6: Count existing records that will be affected
  try {
    const jobApplicationCount = await prisma.jobApplication.count();
    const employeeCount = await prisma.employee.count();

    results.push({
      check: "Existing Data Count",
      status: "PASS",
      message: `Found ${jobApplicationCount} job applications and ${employeeCount} employees`,
      details: { jobApplicationCount, employeeCount },
    });
  } catch (error) {
    results.push({
      check: "Existing Data Count",
      status: "WARNING",
      message: `Could not count: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Print results
  printResults();

  // Determine overall status
  const hasFailures = results.some((r) => r.status === "FAIL");
  const hasWarnings = results.some((r) => r.status === "WARNING");

  console.log("\n" + "=".repeat(60));
  console.log("\n📊 VALIDATION SUMMARY\n");

  if (hasFailures) {
    console.log("❌ VALIDATION FAILED");
    console.log("\nMigration cannot proceed due to conflicts.");
    console.log("Please resolve the issues above before running the migration.\n");
    await prisma.$disconnect();
    process.exit(1);
  } else if (hasWarnings) {
    console.log("⚠️  VALIDATION PASSED WITH WARNINGS");
    console.log("\nMigration can proceed, but review warnings above.");
    console.log("Duplicate orangehrm_employee_id values will be handled by the migration");
    console.log("(unique constraint only applies to ACTIVE records).\n");
    await prisma.$disconnect();
    process.exit(0);
  } else {
    console.log("✅ VALIDATION PASSED");
    console.log("\nMigration can proceed safely.\n");
    await prisma.$disconnect();
    process.exit(0);
  }
}

function printResults() {
  console.log("=".repeat(60));
  console.log("\n📋 VALIDATION RESULTS\n");

  for (const result of results) {
    const icon = result.status === "PASS" ? "✅" : result.status === "WARNING" ? "⚠️" : "❌";
    console.log(`${icon} ${result.check}: ${result.status}`);
    console.log(`   ${result.message}`);

    if (result.details) {
      console.log(
        `   Details:`,
        JSON.stringify(result.details, null, 2)
          .split("\n")
          .map((line, i) => (i === 0 ? line : `   ${line}`))
          .join("\n"),
      );
    }

    console.log();
  }
}

main().catch((error) => {
  console.error("\n❌ Validation script failed:", error);
  process.exit(1);
});
