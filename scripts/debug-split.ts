/**
 * Debug: how does splitStatements() handle the app_role migration?
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    } else if (!inDollarQuote && char === "$" && /^\$[a-zA-Z0-9_]*\$/.test(sql.slice(i))) {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
      } else {
        current += char;
      }
    } else if (inDollarQuote && sql.slice(i, i + dollarTag.length) === dollarTag) {
      inDollarQuote = false;
      current += dollarTag;
      i += dollarTag.length - 1;
    } else if (!inDollarQuote && char === ";") {
      const stmt = current.trim();
      if (stmt && !/^(--\s*|$)/.test(stmt)) {
        statements.push(stmt);
      }
      current = "";
    } else {
      current += char;
    }
  }

  const final = current.trim();
  if (final && !/^(--\s*|$)/.test(final)) {
    statements.push(final);
  }

  return statements;
}

const file = "supabase/migrations/20260723184122_d636b76f-9d64-4575-b280-8b0316c0147d.sql";
const raw = readFileSync(join(process.cwd(), file), "utf-8");
const stmts = splitStatements(raw);

console.log(`Total statements: ${stmts.length}\n`);
stmts.forEach((s, i) => {
  console.log(`--- Statement ${i + 1} ---`);
  console.log(s.slice(0, 400));
  if (s.length > 400) console.log(`... (${s.length - 400} more chars)`);
  console.log();
});
