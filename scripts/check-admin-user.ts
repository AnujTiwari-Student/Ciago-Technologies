/**
 * Debug script to check admin user and roles
 */
import { neon } from "@neondatabase/serverless";

const neonUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!neonUrl) {
  console.error("FATAL: DATABASE_URL or NEON_DATABASE_URL is not set in .env");
  process.exit(1);
}
const sql = neon(neonUrl);

async function main() {
  console.log("=== Checking Admin User Setup ===\n");

  // 1. Check auth.users
  const authUsers = await sql`
    SELECT id, email
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log("Auth users:");
  authUsers.forEach((u) => {
    console.log(`  - ${u.id} | ${u.email || "no email"}`);
  });

  // 2. Check user_roles table
  const userRoles = await sql`
    SELECT ur.id, ur.user_id, ur.role, ur.department_id, ur.created_at
    FROM user_roles ur
    ORDER BY ur.created_at DESC
    LIMIT 10
  `;
  console.log("\nUser roles:");
  userRoles.forEach((r) => {
    console.log(`  - User: ${r.user_id} | Role: ${r.role} | Dept: ${r.department_id || "none"}`);
  });

  // 3. Check if there are any admin roles
  const adminRoles = await sql`
    SELECT ur.user_id, ur.role, au.email
    FROM user_roles ur
    LEFT JOIN auth.users au ON au.id = ur.user_id
    WHERE ur.role = 'admin'
  `;
  console.log("\nAdmin users:");
  if (adminRoles.length === 0) {
    console.log("  ❌ NO ADMIN USERS FOUND!");
  } else {
    adminRoles.forEach((r) => {
      console.log(`  - User: ${r.user_id} | Email: ${r.email || "unknown"}`);
    });
  }

  // 4. Check clerk_user_map
  const clerkMappings = await sql`
    SELECT clerk_user_id, auth_user_id, email, primary_email_verified
    FROM clerk_user_map
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log("\nClerk user mappings:");
  clerkMappings.forEach((m) => {
    console.log(
      `  - Clerk: ${m.clerk_user_id} | Auth: ${m.auth_user_id} | Email: ${m.email || "none"} | Verified: ${m.primary_email_verified}`,
    );
  });

  // 5. Cross-check: find users with clerk mappings and their roles
  const clerkUsersWithRoles = await sql`
    SELECT
      cum.clerk_user_id,
      cum.auth_user_id,
      cum.email,
      ur.role
    FROM clerk_user_map cum
    LEFT JOIN user_roles ur ON ur.user_id = cum.auth_user_id
    ORDER BY cum.created_at DESC
    LIMIT 10
  `;
  console.log("\nClerk users with roles:");
  clerkUsersWithRoles.forEach((r) => {
    console.log(`  - Clerk: ${r.clerk_user_id} | Email: ${r.email} | Role: ${r.role || "NO ROLE"}`);
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
