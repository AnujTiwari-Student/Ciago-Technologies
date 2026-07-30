/**
 * Test: Use Pool (pgwire protocol) for multi-statement SQL.
 */
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function main() {
  const multiSql = `
    CREATE SCHEMA IF NOT EXISTS test_pool;
    CREATE TABLE IF NOT EXISTS test_pool.t1 (id int primary key, name text);
    INSERT INTO test_pool.t1 VALUES (1, 'hello'), (2, 'world');
    SELECT * FROM test_pool.t1 ORDER BY id;
  `;

  try {
    const r = await pool.query(multiSql);
    console.log("Pool multi-statement result:", JSON.stringify(r, null, 2));
  } catch (e: any) {
    console.log("Pool ERROR:", e.message);
  }

  // Cleanup
  await pool.query("DROP SCHEMA IF EXISTS test_pool CASCADE");
  await pool.end();
}

main();
