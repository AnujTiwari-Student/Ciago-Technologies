#!/usr/bin/env tsx
/**
 * Test script to check what data exists in OrangeHRM
 * Run: npx tsx scripts/test-orangehrm-data.ts
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

// Load .env file
config();

async function main() {
  console.log("🔍 Checking OrangeHRM data...\n");

  try {
    const client = getOrangeHRMClient();

    // Test 1: Get Job Titles
    console.log("📋 Job Titles:");
    console.log("=".repeat(50));
    try {
      const jobTitles = await client.getJobTitles();
      if (jobTitles.length === 0) {
        console.log("❌ No job titles found!");
        console.log("   → Add job titles in: Admin → Job → Job Titles");
      } else {
        jobTitles.forEach((jt, i) => {
          console.log(`${i + 1}. ID: ${jt.id} - ${jt.title} ${jt.deleted ? "(deleted)" : ""}`);
        });
      }
    } catch (error: any) {
      console.error("❌ Failed to get job titles:", error.message);
    }

    console.log("\n");

    // Test 2: Get Sub-units (Departments)
    console.log("🏢 Sub-Units (Departments):");
    console.log("=".repeat(50));
    try {
      const subunits = await client.getSubunits();
      if (subunits.length === 0) {
        console.log("❌ No sub-units found!");
        console.log("   → Add departments in: Admin → Organization → Structure");
      } else {
        subunits.forEach((su, i) => {
          console.log(`${i + 1}. ID: ${su.id} - ${su.name} (Unit ID: ${su.unitId})`);
        });
      }
    } catch (error: any) {
      console.error("❌ Failed to get sub-units:", error.message);
    }

    console.log("\n");

    // Test 3: Get Employment Statuses
    console.log("💼 Employment Statuses:");
    console.log("=".repeat(50));
    try {
      const statuses = await client.getEmploymentStatuses();
      if (statuses.length === 0) {
        console.log("❌ No employment statuses found!");
        console.log("   → Add statuses in: Admin → Job → Employment Status");
      } else {
        statuses.forEach((s, i) => {
          console.log(`${i + 1}. ID: ${s.id} - ${s.name}`);
        });
      }
    } catch (error: any) {
      console.error("❌ Failed to get employment statuses:", error.message);
    }

    console.log("\n");

    // Test 4: Get Latest Employee
    console.log("👤 Latest Employees:");
    console.log("=".repeat(50));
    try {
      // Try to get employees 1-10
      let foundCount = 0;
      for (let i = 1; i <= 10; i++) {
        try {
          const emp = await client.getEmployee(i);
          if (emp) {
            console.log(
              `Employee #${emp.empNumber}: ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId})`
            );
            foundCount++;
          }
        } catch {
          // Employee not found, continue
        }
      }
      if (foundCount === 0) {
        console.log("❌ No employees found in first 10 IDs");
      }
    } catch (error: any) {
      console.error("❌ Failed to get employees:", error.message);
    }

    console.log("\n");
    console.log("✅ Test complete!");
    console.log("\n");
    console.log("📝 Summary:");
    console.log("=".repeat(50));
    console.log("To provision employees successfully, you need:");
    console.log("1. ✓ At least one Job Title defined");
    console.log("2. ✓ At least one Sub-Unit (department) defined");
    console.log("3. ✓ At least one Employment Status defined");
    console.log("\nIf any are missing, add them in OrangeHRM Admin before hiring.");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.message.includes("authorization required")) {
      console.log("\n💡 Run: npx tsx scripts/orangehrm-auth.ts");
    }
    if (error.message.includes("credentials missing")) {
      console.log("\n💡 Check .env file for:");
      console.log("   - ORANGEHRM_BASE_URL");
      console.log("   - ORANGEHRM_CLIENT_ID");
      console.log("   - ORANGEHRM_CLIENT_SECRET");
    }
    process.exit(1);
  }
}

main();
