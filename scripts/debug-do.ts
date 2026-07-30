/**
 * Debug: trace splitStatements() through the DO block.
 */
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
      i++;
    } else if (!inDollarQuote && char === "$" && /^\$[a-zA-Z0-9_]+\$/.test(sql.slice(i))) {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]+)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        i += dollarTag.length - 1;
      } else {
        current += char;
      }
    } else if (inDollarQuote && sql.slice(i, i + dollarTag.length) === dollarTag) {
      inDollarQuote = false;
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

const testSql = `DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY
);`;

const stmts = splitStatements(testSql);
console.log(`Total: ${stmts.length}\n`);
stmts.forEach((s, i) => {
  console.log(`--- ${i + 1} ---`);
  console.log(s);
  console.log();
});
