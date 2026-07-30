/**
 * Stage 1: Migrate Supabase schema to Neon (WORKING v5).
 *
 * Splits each migration file into complete SQL statements (handling $$ blocks
 * and multi-line statements), filters out Supabase-specific statements,
 * then executes each statement INDIVIDUALLY so a single failure doesn't
 * cascade and block the rest of the file.
 *
 * Root cause of v4 failure: sending concatenated SQL per-file meant one error
 * (e.g. a duplicate policy or orphaned comment) blocked all subsequent
 * statements in that file — including critical CREATE TABLE/TYPE/FUNCTION DDL.
 *
 * Run: bun run scripts/migrate-schema.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const SCHEMA_OUTPUT = join(process.cwd(), "supabase", "migrations-neon.sql");
const neonUrl = process.env.NEON_DATABASE_URL;
if (!neonUrl) { console.error("FATAL: NEON_DATABASE_URL not set"); process.exit(1); }

// ---------------------------------------------------------------------------
// 1. Custom auth schema DDL
// ---------------------------------------------------------------------------
const AUTH_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;
`;

// ---------------------------------------------------------------------------
// 2. Strip line comments outside dollar-quoted blocks, then split into
//    complete statements. This prevents orphaned comment text (after a
//    semicolon) from being parsed as SQL (root cause of "syntax error at
//    or near 'only'/'one'/'the'" errors in v4).
// ---------------------------------------------------------------------------
function stripLineComments(sql: string): string {
  const lines = sql.split("\n");
  const result: string[] = [];
  let inDollarQuote = false;
  let dollarTag = "";

  for (const line of lines) {
    if (inDollarQuote) {
      const closeIdx = line.indexOf(dollarTag);
      if (closeIdx !== -1) {
        inDollarQuote = false;
      }
      result.push(line);
      continue;
    }

    // Check if this line opens a dollar-quoted block
    const dollarMatch = line.match(/\$([a-zA-Z0-9_]*)\$/);
    if (dollarMatch) {
      const tag = dollarMatch[0];
      const afterFirst = line.slice(line.indexOf(tag) + tag.length);
      if (!afterFirst.includes(tag)) {
        inDollarQuote = true;
        dollarTag = tag;
      }
      result.push(line);
      continue;
    }

    // Strip line comments (-- ...) only outside dollar blocks
    const commentIdx = line.indexOf("--");
    if (commentIdx === -1) {
      result.push(line);
    } else if (commentIdx === 0) {
      // Entire line is a comment — skip
      result.push("");
    } else {
      // Check it's not inside a string literal (simple heuristic: count single quotes before --)
      const beforeComment = line.slice(0, commentIdx);
      const quoteCount = (beforeComment.match(/'/g) || []).length;
      if (quoteCount % 2 === 0) {
        result.push(beforeComment);
      } else {
        result.push(line);
      }
    }
  }
  return result.join("\n");
}

function splitStatements(sql: string): string[] {
  const cleaned = stripLineComments(sql);
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];

    if (!inDollarQuote && char === "$" && next === "$") {
      inDollarQuote = true;
      dollarTag = "$$";
      current += "$$";
      i++;
    } else if (!inDollarQuote && char === "$" && /^\$[a-zA-Z0-9_]+\$/.test(cleaned.slice(i))) {
      const match = cleaned.slice(i).match(/^\$([a-zA-Z0-9_]+)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
      } else {
        current += char;
      }
    } else if (inDollarQuote && cleaned.slice(i, i + dollarTag.length) === dollarTag) {
      inDollarQuote = false;
      current += dollarTag;
      i += dollarTag.length - 1;
    } else if (!inDollarQuote && char === ";") {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = "";
    } else {
      current += char;
    }
  }

  const final = current.trim();
  if (final) {
    statements.push(final);
  }

  return statements;
}

// ---------------------------------------------------------------------------
// 3. Filter out Supabase-only statements
// ---------------------------------------------------------------------------
function shouldSkipStatement(stmt: string): { skip: boolean; reason: string } {
  const t = stmt.replace(/\s+/g, " ").trim();

  // storage.objects policies
  if (/\bON\s+storage\.objects\b/i.test(t)) return { skip: true, reason: "storage.policy" };
  if (/\bON\s+storage\b/i.test(t) && /\bPOLICY\b/i.test(t)) return { skip: true, reason: "storage.policy" };

  // storage.function references in policies
  if (/\bstorage\.(foldername|extension|filename)\b/i.test(t)) return { skip: true, reason: "storage.fn" };

  // pg_cron
  if (/CREATE\s+EXTENSION.*pg_cron/i.test(t)) return { skip: true, reason: "pg_cron" };
  if (/\bcron\.(unschedule|schedule)\s*\(/i.test(t)) return { skip: true, reason: "cron.api" };

  // GRANT/REVOKE to Supabase-only roles
  if (/^\s*(GRANT|REVOKE)\b/i.test(t) && /\b(authenticated|anon|service_role)\b/i.test(t)) {
    return { skip: true, reason: "role.grant" };
  }

  return { skip: false, reason: "" };
}

// ---------------------------------------------------------------------------
// 4. Main — execute statements INDIVIDUALLY per file so one failure doesn't
//    cascade. This is the critical fix: v4 sent the whole file as one query,
//    meaning a single failed GRANT would block the CREATE TABLE in the same file.
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Stage 1: Schema Migration (Supabase → Neon) v5 ===\n");

  const pool = new Pool({ connectionString: neonUrl });

  try {
    console.log("Dropping existing schemas for clean migration…");
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await pool.query("DROP SCHEMA IF EXISTS auth CASCADE;");
    await pool.query("CREATE SCHEMA public;");

    console.log("Creating auth schema + GoTrue-compatible roles…");
    await pool.query(AUTH_SCHEMA_SQL);
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN BYPASSRLS;
        END IF;
      END $$;
    `);
    console.log("  auth.users + auth.uid() + anon/authenticated/service_role roles applied.\n");

    const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
    console.log(`Processing ${files.length} migration files…\n`);

    let totalApplied = 0, totalFailed = 0, skippedFiles = 0, skippedStmts = 0;
    const errors: string[] = [];
    const combinedBlocks: string[] = [AUTH_SCHEMA_SQL];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      const stmts = splitStatements(raw);

      const filtered: string[] = [];
      let removedInFile = 0;
      for (const s of stmts) {
        const check = shouldSkipStatement(s);
        if (check.skip) {
          removedInFile++;
          skippedStmts++;
        } else {
          filtered.push(s);
        }
      }

      if (filtered.length === 0) {
        console.log(`  [${fi + 1}/${files.length}] ${file} — SKIPPED (all ${removedInFile} stmts filtered)`);
        skippedFiles++;
        continue;
      }

      // Execute each statement individually
      let fileApplied = 0, fileFailed = 0;
      const fileErrors: string[] = [];

      for (const stmt of filtered) {
        try {
          await pool.query(stmt + ";");
          fileApplied++;
        } catch (err: any) {
          fileFailed++;
          const msg = err.message?.slice(0, 200) || "unknown error";
          fileErrors.push(msg);
        }
      }

      totalApplied += fileApplied;
      totalFailed += fileFailed;

      if (fileFailed === 0) {
        console.log(`  [${fi + 1}/${files.length}] ${file} — OK (${fileApplied} stmts, -${removedInFile} filtered)`);
      } else {
        console.log(`  [${fi + 1}/${files.length}] ${file} — PARTIAL (${fileApplied} OK, ${fileFailed} failed, -${removedInFile} filtered)`);
        for (const e of fileErrors.slice(0, 3)) {
          errors.push(`${file}: ${e}`);
          console.log(`      ↳ ${e}`);
        }
      }

      const cleanSql = filtered.join(";\n") + ";";
      combinedBlocks.push(`-- [${file}]\n${cleanSql}`);
    }

    const combined = combinedBlocks.join("\n\n");
    writeFileSync(SCHEMA_OUTPUT, combined, "utf-8");
    console.log(`\n→ ${SCHEMA_OUTPUT} (${(combined.length / 1024).toFixed(1)} KB)`);
    console.log(`\n=== Stage 1 Migration Summary ===`);
    console.log(`Files: ${files.length} | Stmts applied: ${totalApplied} | Stmts failed: ${totalFailed} | Files skipped: ${skippedFiles} | Stmts filtered: ${skippedStmts}`);

    if (errors.length > 0) {
      console.log(`\nFirst ${Math.min(20, errors.length)} failures:`);
      errors.slice(0, 20).forEach(e => console.log(`  ${e}`));
    }

    if (totalFailed === 0) {
      console.log("\n✓ ALL STATEMENTS APPLIED SUCCESSFULLY");
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
