/**
 * Stage 1 — Neon connectivity check and current-state inspection.
 *
 * Reads NEON_DATABASE_URL from .env, connects to Neon, and reports:
 *   - PostgreSQL version
 *   - Existing tables in public/auth schemas
 *   - Existing enums
 *   - Existing functions
 *   - Existing RLS policies
 *
 * Run: bun run scripts/neon-check.ts
 */
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: NEON_DATABASE_URL is not set in .env");
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  console.log("=== Neon Connectivity Check ===\n");

  // 1. Version
  const version = await sql`SELECT version()`;
  console.log("Connected:", version[0].version);

  // 2. Existing tables
  const tables = await sql`
    SELECT table_name, table_schema
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'auth')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name
  `;
  console.log(`\n--- Tables (${tables.length}) ---`);
  for (const t of tables) {
    console.log(`  ${t.table_schema}.${t.table_name}`);
  }

  // 3. Existing enums
  const enums = await sql`
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typtype = 'e' AND n.nspname = 'public'
    ORDER BY t.typname
  `;
  console.log(`\n--- Enums (${enums.length}) ---`);
  for (const e of enums) {
    console.log(`  ${e.typname}`);
  }

  // 4. Existing functions
  const functions = await sql`
    SELECT routine_name, routine_schema
    FROM information_schema.routines
    WHERE routine_schema IN ('public', 'auth')
      AND routine_type = 'FUNCTION'
    ORDER BY routine_schema, routine_name
  `;
  console.log(`\n--- Functions (${functions.length}) ---`);
  for (const f of functions) {
    console.log(`  ${f.routine_schema}.${f.routine_name}`);
  }

  // 5. RLS policies
  const policies = await sql`
    SELECT tablename, policyname
    FROM pg_policies
    ORDER BY tablename, policyname
  `;
  console.log(`\n--- RLS Policies (${policies.length}) ---`);
  for (const p of policies) {
    console.log(`  ${p.tablename}: ${p.policyname}`);
  }

  // 6. Extensions
  const exts = await sql`
    SELECT extname FROM pg_extension ORDER BY extname
  `;
  console.log(`\n--- Extensions (${exts.length}) ---`);
  for (const e of exts) {
    console.log(`  ${e.extname}`);
  }

  console.log("\n=== Check Complete ===");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
