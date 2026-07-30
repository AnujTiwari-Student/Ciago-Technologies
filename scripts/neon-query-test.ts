/**
 * Test: execute raw SQL strings via different methods.
 */
import { neon } from "@neondatabase/serverless";
const db = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  // Method 1: query() with raw string
  try {
    const r1 = await db.query("CREATE SCHEMA IF NOT EXISTS test_query");
    console.log("query() CREATE SCHEMA:", r1);
  } catch (e) {
    const error = e as Error;
    console.log("query() error:", error.message);
  }

  try {
    const r2 = await db.query("CREATE TABLE IF NOT EXISTS test_query.t1 (id int primary key)");
    console.log("query() CREATE TABLE:", r2);
  } catch (e) {
    const error = e as Error;
    console.log("query() error:", error.message);
  }

  try {
    const r3 = await db.query("INSERT INTO test_query.t1 VALUES (1), (2), (3)");
    console.log("query() INSERT:", r3);
  } catch (e) {
    const error = e as Error;
    console.log("query() error:", error.message);
  }

  try {
    const r4 = await db.query("SELECT * FROM test_query.t1");
    console.log("query() SELECT:", r4);
  } catch (e) {
    const error = e as Error;
    console.log("query() error:", error.message);
  }

  // Cleanup
  await db.query("DROP SCHEMA IF EXISTS test_query CASCADE");
}

main().catch((e) => console.error("FATAL:", e.message));
