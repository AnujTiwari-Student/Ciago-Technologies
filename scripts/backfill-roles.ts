import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  console.log("Checking for users missing roles...");

  const missing = await sql`
    SELECT cum.auth_user_id, cum.email
    FROM clerk_user_map cum
    LEFT JOIN user_roles ur ON ur.user_id = cum.auth_user_id
    WHERE ur.id IS NULL
  `;

  console.log(`Users missing roles: ${missing.length}`);

  for (const row of missing) {
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${row.auth_user_id}, 'user')`;
    console.log(`  ✓ Assigned 'user' role to: ${row.email}`);
  }

  const allRoles = await sql`
    SELECT ur.user_id, ur.role, cum.email
    FROM user_roles ur
    JOIN clerk_user_map cum ON cum.auth_user_id = ur.user_id
  `;

  console.log(`\nAll user_roles (${allRoles.length}):`);
  for (const r of allRoles) {
    console.log(`  ${r.email} -> ${r.role}`);
  }
}

main().catch(console.error);
