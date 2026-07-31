import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config();

const sql = neon(process.env.NEON_DATABASE_URL!);

async function main() {
  // Make all users admin
  await sql`UPDATE user_roles SET role = 'admin' WHERE role = 'user'`;

  const roles = await sql`
    SELECT ur.user_id, ur.role, cum.email
    FROM user_roles ur
    JOIN clerk_user_map cum ON cum.auth_user_id = ur.user_id
  `;
  console.log("Updated user_roles:");
  for (const r of roles) console.log(` ${r.email} -> ${r.role}`);
}

main().catch(console.error);
