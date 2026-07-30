/**
 * Debug: show first 20 statements after splitting.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

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

function stripSupabaseContent(sql: string): string {
  return sql.split("\n").filter((line) => {
    const t = line.trim();
    if (t.includes("ON storage.objects")) return false;
    if (/CREATE\s+EXTENSION.*pg_cron/i.test(t)) return false;
    if (t.includes("cron.unschedule(") || t.includes("cron.schedule(")) return false;
    if (/\bGRANT\b/.test(t) && /\bTO\b/.test(t) && /\b(authenticated|anon|service_role)\b/.test(t)) return false;
    if (/\bREVOKE\b/.test(t) && /\bFROM\b/.test(t) && /\b(authenticated|anon|service_role)\b/.test(t)) return false;
    return true;
  }).join("\n");
}

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1];

    if (!inDollarQuote && char === "$" && next === "$") {
      inDollarQuote = true;
      dollarTag = "$$";
      current += "$$";
      i++;
    } else if (!inDollarQuote && char === "$" && /^[a-zA-Z0-9_]*\$/.test(sql.slice(i))) {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
      } else {
        current += char;
      }
    } else if (inDollarQuote && sql.slice(i).startsWith(dollarTag)) {
      inDollarQuote = false;
      current += dollarTag;
      i += dollarTag.length - 1;
    } else if (!inDollarQuote && char === ";") {
      const stmt = current.trim();
      if (stmt && !/^--/.test(stmt.split("\n")[0])) {
        statements.push(stmt);
      }
      current = "";
    } else {
      current += char;
    }
  }

  const final = current.trim();
  if (final && !/^--/.test(final.split("\n")[0])) {
    statements.push(final);
  }

  return statements;
}

const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
let totalRemoved = 0;
const blocks: string[] = [];

for (const file of files) {
  const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
  const cleaned = stripSupabaseContent(raw);
  if (cleaned.trim()) {
    blocks.push(`-- [${file}]${cleaned}`);
  }
}

const combined = [AUTH_SCHEMA_SQL, ...blocks].join("\n\n");
const statements = splitStatements(combined);

console.log(`Total statements: ${statements.length}\n`);
console.log("First 30 statements:\n");
statements.slice(0, 30).forEach((stmt, i) => {
  console.log(`${i + 1}. ${stmt.slice(0, 150)}${stmt.length > 150 ? "..." : ""}\n`);
});
