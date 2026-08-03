/**
 * Database seed script.
 *
 * Run:  bun run prisma/seed.ts
 *
 * This script is idempotent — safe to re-run at any time.
 * It upserts reference data so existing rows are updated, not duplicated.
 *
 * === HOW TO EXTEND ===
 *
 * 1. ADDING A NEW ROLE:
 *    a) Add the value to the AppRole enum in prisma/schema.prisma
 *    b) Create a migration:  bunx prisma migrate dev --name add-role-xyz
 *    c) (Optional) Add a seed entry below if you want to auto-assign it
 *
 * 2. ADDING A DEPARTMENT:
 *    Add an entry to the DEPARTMENTS array below, then re-run this script.
 *
 * 3. ADDING AN EMPLOYMENT TYPE:
 *    Add an entry to the EMPLOYMENT_TYPES array below, then re-run this script.
 *
 * 4. ADDING A STATUS OPTION:
 *    Add an entry to the STATUS_OPTIONS array below, then re-run this script.
 */

import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const client = await pool.connect();

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENTS — add new departments here
// ─────────────────────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { code: "ENG", name: "Engineering", description: "Product Engineering & Platform" },
  { code: "HR", name: "Human Resources", description: "People Operations" },
  { code: "OPS", name: "Operations", description: "Business & Delivery Operations" },
  { code: "MGMT", name: "Management", description: "Leadership & Strategy" },
  { code: "PROD", name: "Product", description: "Product Management" },
  { code: "DES", name: "Design", description: "Design & UX" },
  { code: "FIN", name: "Finance", description: "Finance & Accounting" },
  { code: "SALES", name: "Sales", description: "Sales & Growth" },
  { code: "MKT", name: "Marketing", description: "Marketing & Brand" },
  { code: "CS", name: "Customer Support", description: "Customer Support" },
  { code: "LEGAL", name: "Legal", description: "Legal & Compliance" },
  { code: "IT", name: "IT Infrastructure", description: "IT & Infrastructure" },
];

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYMENT TYPES — add new types here
// ─────────────────────────────────────────────────────────────────────────────
const EMPLOYMENT_TYPES = [
  { code: "full_time", label: "Full-time", sort_order: 1 },
  { code: "part_time", label: "Part-time", sort_order: 2 },
  { code: "internship", label: "Internship", sort_order: 3 },
  { code: "apprenticeship", label: "Apprenticeship", sort_order: 4 },
  { code: "contractor", label: "Contractor", sort_order: 5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// STATUS OPTIONS — add new statuses here
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  // Job posting statuses
  { kind: "job_posting", code: "draft", label: "Draft", description: "Not visible to candidates", sort_order: 10 },
  { kind: "job_posting", code: "published", label: "Published", description: "Visible on public careers page", sort_order: 20 },
  { kind: "job_posting", code: "internal_only", label: "Internal only", description: "Visible to employees on internal mobility", sort_order: 30 },
  { kind: "job_posting", code: "closed", label: "Closed", description: "No longer accepting applications", sort_order: 40 },
  { kind: "job_posting", code: "archived", label: "Archived", description: "Hidden from all listings", sort_order: 50 },

  // Application statuses
  { kind: "application", code: "applied", label: "Applied", description: "Candidate has submitted an application", sort_order: 10 },
  { kind: "application", code: "screening", label: "Screening", description: "Recruiter reviewing profile", sort_order: 20 },
  { kind: "application", code: "interviewing", label: "Interviewing", description: "Interviews in progress", sort_order: 30 },
  { kind: "application", code: "offered", label: "Offered", description: "Offer extended to candidate", sort_order: 40 },
  { kind: "application", code: "hired", label: "Hired", description: "Candidate accepted and onboarded", sort_order: 50 },
  { kind: "application", code: "rejected", label: "Rejected", description: "Application not moving forward", sort_order: 60 },

  // User account statuses
  { kind: "user_account", code: "active", label: "Active", description: "Account can sign in and use the app", sort_order: 10 },
  { kind: "user_account", code: "inactive", label: "Inactive", description: "Account temporarily disabled", sort_order: 20 },
  { kind: "user_account", code: "suspended", label: "Suspended", description: "Account suspended by administrator", sort_order: 30 },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEV USER ROLES — assign dashboard roles to development accounts
// These entries are looked up by email via clerk_user_map.
// Roles: admin = full admin, system_engineer = system/infra access, developer = dev dashboard access
// ─────────────────────────────────────────────────────────────────────────────
const DEV_USER_ROLES: { email: string; roles: string[]; department_code: string }[] = [
  {
    email: "anujavengers@gmail.com",
    roles: ["admin", "system_engineer", "developer"],
    department_code: "ENG",
  },
  {
    email: "atpay2901@gmail.com",
    roles: ["admin", "system_engineer", "developer"],
    department_code: "ENG",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 Seeding database...\n");

  // Seed departments
  for (const dept of DEPARTMENTS) {
    await client.query(
      `INSERT INTO departments (code, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = $2, description = $3`,
      [dept.code, dept.name, dept.description]
    );
  }
  console.log(`✓ departments: ${DEPARTMENTS.length} rows`);

  // Seed employment types
  for (const et of EMPLOYMENT_TYPES) {
    await client.query(
      `INSERT INTO employment_types (code, label, sort_order)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET label = $2, sort_order = $3`,
      [et.code, et.label, et.sort_order]
    );
  }
  console.log(`✓ employment_types: ${EMPLOYMENT_TYPES.length} rows`);

  // Seed status options
  for (const so of STATUS_OPTIONS) {
    await client.query(
      `INSERT INTO status_options (kind, code, label, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (kind, code) DO UPDATE SET label = $3, description = $4, sort_order = $5`,
      [so.kind, so.code, so.label, so.description, so.sort_order]
    );
  }
  console.log(`✓ status_options: ${STATUS_OPTIONS.length} rows`);

  // Seed dev user roles (idempotent via ON CONFLICT)
  let devRolesAssigned = 0;
  for (const devUser of DEV_USER_ROLES) {
    // Look up user_id from clerk_user_map by email
    const userResult = await client.query(
      `SELECT auth_user_id FROM clerk_user_map WHERE lower(email) = lower($1)`,
      [devUser.email]
    );
    if (userResult.rows.length === 0) {
      console.log(`  ⚠ skipping ${devUser.email} — not in clerk_user_map (user has not signed up yet)`);
      continue;
    }
    const userId = userResult.rows[0].auth_user_id;

    // Look up department_id
    const deptResult = await client.query(
      `SELECT id FROM departments WHERE code = $1`,
      [devUser.department_code]
    );
    const departmentId = deptResult.rows[0]?.id ?? null;

    for (const role of devUser.roles) {
      await client.query(
        `INSERT INTO user_roles (id, user_id, role, department_id)
         VALUES (gen_random_uuid(), $1, $2::app_role, $3)
         ON CONFLICT (user_id, role) DO UPDATE SET department_id = COALESCE($3, user_roles.department_id)`,
        [userId, role, departmentId]
      );
      devRolesAssigned++;
    }
  }
  console.log(`✓ dev_user_roles: ${devRolesAssigned} role assignments`);

  console.log("\n✅ Seed complete\n");
}

try {
  await main();
} catch (err: any) {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
