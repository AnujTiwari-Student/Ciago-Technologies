import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import "dotenv/config";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("📦 Connecting to database...");
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log("📖 Reading migration SQL...");
    const sql = await readFile(
      "prisma/migrations/20260801_lifecycle_foundation_v2/migration.sql",
      "utf-8",
    );

    console.log("🚀 Applying migration...");
    console.log("");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("");
    console.log("✅ Migration applied successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("");
    console.error("❌ Migration failed!");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
