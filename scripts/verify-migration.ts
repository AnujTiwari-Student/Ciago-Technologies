import { Pool } from "pg";
import "dotenv/config";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log("=== VERIFYING PHASE 1 MIGRATION ===\n");

    // Check new tables
    console.log("📋 NEW TABLES:");
    const tables = await client.query(`
      SELECT tablename FROM pg_tables
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
      ORDER BY tablename
    `);

    tables.rows.forEach((row) => {
      console.log(`  ✅ ${row.tablename}`);
    });
    console.log(`  Total: ${tables.rows.length}/8`);
    console.log("");

    // Check job_applications columns
    console.log("📋 job_applications NEW COLUMNS:");
    const jobAppCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'job_applications'
      AND column_name IN (
        'orangehrm_employee_id',
        'orangehrm_provisioning_state',
        'orangehrm_provisioning_attempted_at',
        'orangehrm_provisioning_succeeded_at',
        'orangehrm_record_status',
        'orangehrm_terminated_at',
        'orangehrm_termination_reason',
        'lifecycle_version'
      )
      ORDER BY column_name
    `);

    jobAppCols.rows.forEach((row) => {
      console.log(`  ✅ ${row.column_name}`);
    });
    console.log(`  Total: ${jobAppCols.rows.length}/8`);
    console.log("");

    // Check employees columns
    console.log("📋 employees NEW COLUMNS:");
    const empCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'employees'
      AND column_name IN (
        'orangehrm_system_user_id',
        'ess_account_status',
        'orangehrm_record_status',
        'orangehrm_terminated_at',
        'orangehrm_termination_reason',
        'offboarding_status',
        'offboarding_initiated_at',
        'offboarding_completed_at',
        'last_working_day',
        'offboarding_reason'
      )
      ORDER BY column_name
    `);

    empCols.rows.forEach((row) => {
      console.log(`  ✅ ${row.column_name}`);
    });
    console.log(`  Total: ${empCols.rows.length}/10`);
    console.log("");

    // Check enums
    console.log("📋 NEW ENUMS:");
    const enums = await client.query(`
      SELECT typname FROM pg_type
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
      ORDER BY typname
    `);

    enums.rows.forEach((row) => {
      console.log(`  ✅ ${row.typname}`);
    });
    console.log(`  Total: ${enums.rows.length}/10`);
    console.log("");

    // Check foreign key constraints
    console.log("📋 FOREIGN KEY CONSTRAINTS:");
    const fks = await client.query(`
      SELECT
        conname AS constraint_name,
        confdeltype AS on_delete_action
      FROM pg_constraint
      WHERE contype = 'f'
      AND conname IN (
        'setup_tokens_application_id_fkey',
        'background_verifications_application_id_fkey',
        'offboarding_tasks_offboarding_id_fkey',
        'external_access_revocation_events_offboarding_id_fkey'
      )
      ORDER BY conname
    `);

    fks.rows.forEach((row) => {
      const action =
        row.on_delete_action === "r"
          ? "RESTRICT"
          : row.on_delete_action === "c"
            ? "CASCADE"
            : row.on_delete_action;
      console.log(`  ✅ ${row.constraint_name}: ON DELETE ${action}`);
    });
    console.log("");

    // Check setup_tokens unique constraint
    console.log("📋 SETUP TOKENS UNIQUE CONSTRAINT:");
    const setupTokenIdx = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'setup_tokens'
      AND indexname = 'idx_setup_tokens_one_active_per_application'
    `);

    if (setupTokenIdx.rows.length > 0) {
      console.log(`  ✅ ${setupTokenIdx.rows[0].indexname}`);
      console.log(`     ${setupTokenIdx.rows[0].indexdef}`);

      if (
        setupTokenIdx.rows[0].indexdef.includes("status = 'unused'::text") &&
        !setupTokenIdx.rows[0].indexdef.includes("now()")
      ) {
        console.log("  ✅ Predicate: status = 'unused' (NO now() - CORRECT)");
      } else if (setupTokenIdx.rows[0].indexdef.includes("now()")) {
        console.log("  ❌ WARNING: Predicate contains now() (should not)");
      }
    } else {
      console.log("  ❌ Constraint NOT FOUND");
    }
    console.log("");

    // Data integrity check
    console.log("📋 DATA INTEGRITY:");
    const jobAppCount = await client.query("SELECT COUNT(*) FROM job_applications");
    const employeeCount = await client.query("SELECT COUNT(*) FROM employees");

    console.log(`  job_applications: ${jobAppCount.rows[0].count} (expected: 1)`);
    console.log(`  employees: ${employeeCount.rows[0].count} (expected: 0)`);
    console.log("");

    console.log("✅ MIGRATION VERIFICATION COMPLETE");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
