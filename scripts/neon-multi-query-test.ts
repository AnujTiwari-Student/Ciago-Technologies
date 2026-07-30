/**
 * Test: execute multi-statement SQL via query().
 */
import { neon } from "@neondatabase/serverless";
const db = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  const multiSql = `
    CREATE SCHEMA IF NOT EXISTS test_multi_query;
    CREATE TABLE IF NOT EXISTS test_multi_query.t1 (id int primary key, name text);
    INSERT INTO test_multi_query.t1 VALUES (1, 'hello'), (2, 'world');
    SELECT * FROM test_multi_query.t1 ORDER BY id;
  `;

  try {
    const results = await db.query(multiSql);
    console.log("Multi-statement results:", results);
    console.log("Number of result sets:", results.length);
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }

  // Cleanup
  await db.query("DROP SCHEMA IF EXISTS test_multi_query CASCADE");
}

main().catch(e => console.error("FATAL:", e.message));
