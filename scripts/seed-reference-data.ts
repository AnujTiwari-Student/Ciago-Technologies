/**
 * Seed Reference Data Only
 *
 * This script seeds the 3 core reference tables:
 * 1. departments
 * 2. employment_types
 * 3. status_options
 *
 * Usage: npx tsx scripts/seed-reference-data.ts
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

const EMPLOYMENT_TYPES = [
  { code: "full_time", label: "Full-time", sortOrder: 1 },
  { code: "part_time", label: "Part-time", sortOrder: 2 },
  { code: "internship", label: "Internship", sortOrder: 3 },
  { code: "apprenticeship", label: "Apprenticeship", sortOrder: 4 },
  { code: "contractor", label: "Contractor", sortOrder: 5 },
];

const STATUS_OPTIONS = [
  { kind: "job_posting", code: "draft", label: "Draft", sortOrder: 10 },
  { kind: "job_posting", code: "published", label: "Published", sortOrder: 20 },
  { kind: "job_posting", code: "internal_only", label: "Internal only", sortOrder: 30 },
  { kind: "job_posting", code: "closed", label: "Closed", sortOrder: 40 },
  { kind: "job_posting", code: "archived", label: "Archived", sortOrder: 50 },
  { kind: "application", code: "applied", label: "Applied", sortOrder: 10 },
  { kind: "application", code: "screening", label: "Screening", sortOrder: 20 },
  { kind: "application", code: "interviewing", label: "Interviewing", sortOrder: 30 },
  { kind: "application", code: "offered", label: "Offered", sortOrder: 40 },
  { kind: "application", code: "hired", label: "Hired", sortOrder: 50 },
  { kind: "application", code: "rejected", label: "Rejected", sortOrder: 60 },
  { kind: "user_account", code: "active", label: "Active", sortOrder: 10 },
  { kind: "user_account", code: "inactive", label: "Inactive", sortOrder: 20 },
  { kind: "user_account", code: "suspended", label: "Suspended", sortOrder: 30 },
];

async function main() {
  console.log("🌱 Seeding reference data...\n");

  console.log("📦 Clearing existing reference data...");
  await pool.query("TRUNCATE TABLE departments, employment_types, status_options CASCADE");
  console.log("✓ Cleared\n");

  console.log("📦 Seeding departments...");
  for (const dept of DEPARTMENTS) {
    await pool.query(
      `INSERT INTO departments (code, name, description) VALUES ($1, $2, $3)`,
      [dept.code, dept.name, dept.description]
    );
    console.log(`  ✓ ${dept.name}`);
  }

  console.log("\n📦 Seeding employment types...");
  for (const empType of EMPLOYMENT_TYPES) {
    await pool.query(
      `INSERT INTO employment_types (code, label, sort_order) VALUES ($1, $2, $3)`,
      [empType.code, empType.label, empType.sortOrder]
    );
    console.log(`  ✓ ${empType.label}`);
  }

  console.log("\n📦 Seeding status options...");
  for (const status of STATUS_OPTIONS) {
    await pool.query(
      `INSERT INTO status_options (kind, code, label, sort_order) VALUES ($1, $2, $3, $4)`,
      [status.kind, status.code, status.label, status.sortOrder]
    );
    console.log(`  ✓ ${status.label}`);
  }

  console.log("\n✅ Reference data seeded successfully!\n");
  console.log("📋 Seeded:");
  console.log(`  - ${DEPARTMENTS.length} departments`);
  console.log(`  - ${EMPLOYMENT_TYPES.length} employment types`);
  console.log(`  - ${STATUS_OPTIONS.length} status options\n`);
}

main()
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
