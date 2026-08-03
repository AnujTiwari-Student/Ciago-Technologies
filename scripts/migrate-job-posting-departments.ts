/**
 * One-time migration: Link existing job postings to Department table
 * Maps job_postings.department (string) → departments.name → departments.id
 */

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  try {
    console.log("🔄 Migrating job posting departments...\n");

    // Get all departments
    const depts = await client.query(`SELECT id, name, code FROM departments`);
    const deptByName = new Map(depts.rows.map((d) => [d.name.toLowerCase(), d.id]));

    console.log(`Found ${depts.rows.length} departments:`);
    console.table(depts.rows);

    // Get all job postings with null department_id
    const postings = await client.query(`
      SELECT id, title, department
      FROM job_postings
      WHERE department_id IS NULL
    `);

    console.log(`\nFound ${postings.rows.length} postings needing migration\n`);

    let updated = 0;
    let skipped = 0;

    for (const posting of postings.rows) {
      const deptId = deptByName.get(posting.department.toLowerCase());

      if (deptId) {
        await client.query(
          `UPDATE job_postings SET department_id = $1 WHERE id = $2`,
          [deptId, posting.id]
        );
        console.log(`✓ ${posting.title} → ${posting.department}`);
        updated++;
      } else {
        console.log(`⚠ Skipped "${posting.title}" - department "${posting.department}" not found`);
        skipped++;
      }
    }

    console.log(`\n✅ Migration complete: ${updated} updated, ${skipped} skipped\n`);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
