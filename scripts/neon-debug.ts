/**
 * Debug: test sql.unsafe() with simple statements.
 */
import { neon } from "@neondatabase/serverless";

const neonUrl = process.env.NEON_DATABASE_URL!;
const sql = neon(neonUrl);

async function main() {
  // Test 1: tagged template
  const r1 = await sql`SELECT 1 AS test`;
  console.log("Tagged template:", r1);

  // Test 2: unsafe with single statement
  try {
    const r2 = await sql.unsafe("SELECT 2 AS test");
    console.log("Unsafe (no semicolon):", r2);
  } catch (e) {
    const error = e as Error;
    console.log("Unsafe (no semicolon) ERROR:", error.message);
  }

  // Test 3: unsafe with semicolon
  try {
    const r3 = await sql.unsafe("SELECT 3 AS test;");
    console.log("Unsafe (with semicolon):", r3);
  } catch (e) {
    const error = e as Error;
    console.log("Unsafe (with semicolon) ERROR:", error.message);
  }

  // Test 4: unsafe CREATE SCHEMA
  try {
    const r4 = await sql.unsafe("CREATE SCHEMA IF NOT EXISTS test_debug");
    console.log("Unsafe CREATE SCHEMA:", r4);
  } catch (e) {
    const error = e as Error;
    console.log("Unsafe CREATE SCHEMA ERROR:", error.message);
  }

  // Test 5: check if test_debug schema exists
  const r5 = await sql`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name = 'test_debug'
  `;
  console.log("test_debug schema exists:", r5.length > 0);

  // Cleanup
  await sql.unsafe("DROP SCHEMA IF EXISTS test_debug");
}

main().catch((e) => console.error("FATAL:", e));
