/**
 * Test: send multiple statements via tagged template (which actually executes).
 */
import { neon } from "@neondatabase/serverless";
const db = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  // Tagged template executes immediately
  await db`CREATE SCHEMA IF NOT EXISTS test_multi_tagged`;
  await db`CREATE TABLE IF NOT EXISTS test_multi_tagged.t1 (id int primary key, name text)`;
  await db`INSERT INTO test_multi_tagged.t1 VALUES (1, 'hello')`;
  const result = await db`SELECT * FROM test_multi_tagged.t1`;
  console.log("Tagged template result:", result);

  // Cleanup
  await db`DROP SCHEMA IF EXISTS test_multi_tagged CASCADE`;
}

main().catch((e) => console.error("ERROR:", e.message));
