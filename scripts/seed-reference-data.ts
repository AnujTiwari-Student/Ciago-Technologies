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

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
  { code: "FULL_TIME", label: "Full-Time", sortOrder: 1 },
  { code: "PART_TIME", label: "Part-Time", sortOrder: 2 },
  { code: "CONTRACT", label: "Contract", sortOrder: 3 },
  { code: "INTERN", label: "Internship", sortOrder: 4 },
  { code: "PROBATION", label: "Probation", sortOrder: 5 },
];

const STATUS_OPTIONS = [
  { kind: "application", code: "APPLIED", label: "Applied", sortOrder: 1 },
  { kind: "application", code: "SCREENING", label: "Screening", sortOrder: 2 },
  { kind: "application", code: "INTERVIEWING", label: "Interviewing", sortOrder: 3 },
  { kind: "application", code: "OFFERED", label: "Offered", sortOrder: 4 },
  { kind: "application", code: "HIRED", label: "Hired", sortOrder: 5 },
  { kind: "application", code: "REJECTED", label: "Rejected", sortOrder: 6 },
];

async function main() {
  console.log("🌱 Seeding reference data...\n");

  // Clear existing data
  console.log("📦 Clearing existing reference data...");
  await pool.query("TRUNCATE TABLE departments, employment_types, status_options CASCADE");
  console.log("✓ Cleared\n");

  // Seed departments
  console.log("📦 Seeding departments...");
  for (const dept of DEPARTMENTS) {
    await prisma.department.create({ data: dept });
    console.log(`  ✓ ${dept.name}`);
  }

  // Seed employment types
  console.log("\n📦 Seeding employment types...");
  for (const empType of EMPLOYMENT_TYPES) {
    await prisma.employmentType.create({ data: empType });
    console.log(`  ✓ ${empType.label}`);
  }

  // Seed status options
  console.log("\n📦 Seeding status options...");
  for (const status of STATUS_OPTIONS) {
    await prisma.statusOption.create({ data: status });
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
    await prisma.$disconnect();
  });
