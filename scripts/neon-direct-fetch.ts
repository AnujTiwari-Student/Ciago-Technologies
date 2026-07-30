/**
 * Test: direct HTTP POST to Neon SQL endpoint with proper headers.
 */
async function main() {
  const url = process.env.NEON_DATABASE_URL!;
  const u = new URL(url);
  const host = u.hostname;
  const dbName = u.pathname.slice(1);
  const connStr = `${u.protocol}//${u.username}:${encodeURIComponent(u.password)}@${u.host}${u.pathname}`;

  const apiUrl = `https://${host}/sql`;

  const sql = `
    CREATE SCHEMA IF NOT EXISTS test_direct;
    CREATE TABLE IF NOT EXISTS test_direct.t1 (id int primary key, name text);
    INSERT INTO test_direct.t1 VALUES (1, 'hello');
    SELECT * FROM test_direct.t1;
  `;

  console.log("POST", apiUrl, "db:", dbName);

  try {
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": connStr,
        "Neon-Database": dbName,
        "Neon-Pool-Opt": "true",
      },
      body: JSON.stringify({ query: sql }),
    });

    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response:", text.slice(0, 1000));
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }

  // Cleanup
  try {
    const resp2 = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Neon-Connection-String": connStr,
        "Neon-Database": dbName,
        "Neon-Pool-Opt": "true",
      },
      body: JSON.stringify({ query: "DROP SCHEMA IF EXISTS test_direct CASCADE;" }),
    });
    console.log("\nCleanup status:", resp2.status);
    const t2 = await resp2.text();
    console.log("Cleanup:", t2.slice(0, 500));
  } catch (e: any) {
    console.log("Cleanup ERROR:", e.message);
  }
}

main();
