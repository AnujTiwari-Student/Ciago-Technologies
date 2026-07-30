/**
 * Test: send multiple statements in a single unsafe() call.
 */
import { neon } from "@neondatabase/serverless";
const db = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  const sql = `
    CREATE SCHEMA IF NOT EXISTS test_multi;
    CREATE TABLE IF NOT EXISTS test_multi.t1 (id int primary key, name text);
    INSERT INTO test_multi.t1 VALUES (1, 'hello');
    SELECT * FROM test_multi.t1;
  `;

  try {
    const r = await db.unsafe(sql);
    console.log("Type:", r?.constructor?.name);
    console.log("Result:", JSON.stringify(r, null, 2));
  } catch (e) {
    const error = e as Error & { message?: string };
    console.log("ERROR:", error.message?.slice(0, 500));
  }

  // Cleanup
  await db.unsafe("DROP SCHEMA IF EXISTS test_multi CASCADE;");
}

main();
