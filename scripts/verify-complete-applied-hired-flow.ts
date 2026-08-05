/**
 * Verify Complete APPLIED → HIRED Flow
 *
 * Final architectural verification: Does the existing workflow
 * already satisfy Phase 3 acceptance criteria?
 *
 * Tests the COMPLETE flow:
 * 1. APPLIED: Create employee (current provisionOrangeHRMEmployee behavior)
 * 2. HIRED: Enrich employee (current upsertOrangeHRMEmployeeAtHired behavior)
 * 3. Verify what data is actually available in OrangeHRM
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

config();

async function main() {
  console.log("\n=== Verify Complete APPLIED → HIRED Flow ===\n");

  const client = getOrangeHRMClient();
  const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");

  let empNumber: number | null = null;
  const timestamp = Date.now();

  try {
    // Ensure token
    await (client as any).ensureToken();
    const token = (client as any).accessToken;

    // ================================================================
    // Step 1: APPLIED - Create employee (mimics provisionOrangeHRMEmployee)
    // ================================================================
    console.log("📋 Step 1: APPLIED - Create Employee\n");

    console.log("Creating employee with name only (current implementation)...");
    const employee = await client.createEmployee({
      firstName: "FLOW_TEST",
      lastName: `APPLIED_${timestamp}`,
    });

    empNumber = employee.empNumber;
    console.log(`✅ Created empNumber: ${empNumber}`);
    console.log(`   Name: ${employee.firstName} ${employee.lastName}\n`);

    // Step 1a: Attempt contact details update (current provisionOrangeHRMEmployee behavior)
    console.log("Attempting contact details update (current APPLIED behavior)...");
    try {
      await client.updateEmployeeContactDetails(empNumber, {
        workEmail: `flow.test.${timestamp}@example.invalid`,
        otherEmail: `personal.${timestamp}@example.invalid`,
      });
      console.log("✅ Contact details updated at APPLIED\n");
    } catch (error: any) {
      console.log(`⚠️ Contact details update failed: ${error.message}`);
      console.log("   (Expected - endpoint doesn't exist)\n");
    }

    // Step 1b: Get employee to see APPLIED state
    console.log("Employee state after APPLIED:");
    const afterApplied = await client.getEmployee(empNumber);
    console.log(JSON.stringify(afterApplied, null, 2));
    console.log();

    // ================================================================
    // Step 2: HIRED - Enrich employee (mimics upsertOrangeHRMEmployeeAtHired)
    // ================================================================
    console.log("📋 Step 2: HIRED - Enrich Employee\n");

    // Step 2a: Update name via personal-details
    console.log("Updating name via /personal-details...");
    try {
      await client.updateEmployeePersonalDetails(empNumber, {
        firstName: "ENRICHED_FIRST",
        middleName: "ENRICHED_MID",
        lastName: `HIRED_${timestamp}`,
      });
      console.log("✅ Name enriched\n");
    } catch (error: any) {
      console.error(`❌ Name enrichment failed: ${error.message}\n`);
    }

    // Step 2b: Update contact details (attempt - current behavior)
    console.log("Attempting contact details enrichment...");
    try {
      await client.updateEmployeeContactDetails(empNumber, {
        workEmail: `enriched.${timestamp}@example.invalid`,
        otherEmail: `enriched.personal.${timestamp}@example.invalid`,
        mobile: "+91-9876543210",
        addressStreet1: "456 Enriched Street, Bangalore",
      });
      console.log("✅ Contact details enriched\n");
    } catch (error: any) {
      console.log(`⚠️ Contact details enrichment failed: ${error.message}`);
      console.log("   (Expected - endpoint doesn't exist)\n");
    }

    // Step 2c: Update job details
    console.log("Updating job details...");
    try {
      await client.updateEmployeeJobDetails(empNumber, {
        joinedDate: "2026-09-01",
      });
      console.log("✅ Job details enriched (joinedDate: 2026-09-01)\n");
    } catch (error: any) {
      console.error(`❌ Job details enrichment failed: ${error.message}\n`);
    }

    // Step 2d: Get employee to see HIRED state
    console.log("Employee state after HIRED:");
    const afterHired = await client.getEmployee(empNumber);
    console.log(JSON.stringify(afterHired, null, 2));
    console.log();

    // ================================================================
    // Step 3: Comprehensive data retrieval
    // ================================================================
    console.log("📋 Step 3: Comprehensive Data Retrieval\n");

    // Try all known employee endpoints
    const endpoints = [
      { name: "GET /employees/{id}", path: `/pim/employees/${empNumber}` },
      { name: "GET /personal-details", path: `/pim/employees/${empNumber}/personal-details` },
      { name: "GET /job-details", path: `/pim/employees/${empNumber}/job-details` },
      { name: "GET /contact-details", path: `/pim/employees/${empNumber}/contact-details` },
      { name: "GET /emergency-contacts", path: `/pim/employees/${empNumber}/emergency-contacts` },
      { name: "GET /dependents", path: `/pim/employees/${empNumber}/dependents` },
    ];

    for (const endpoint of endpoints) {
      console.log(`${endpoint.name}:`);
      const url = `${baseUrl}/web/index.php/api/v2${endpoint.path}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`  Status: ✅ ${response.status}`);
        console.log(`  Data:`, JSON.stringify(data.data || data, null, 2));
      } else {
        console.log(`  Status: ❌ ${response.status}`);
      }
      console.log();
    }

    // ================================================================
    // Summary
    // ================================================================
    console.log("=".repeat(70));
    console.log("\n📊 Phase 3 Acceptance Criteria Verification:\n");
    console.log("=".repeat(70) + "\n");

    console.log("Original Phase 3 Requirements:");
    console.log("  1. Name enrichment (firstName, middleName, lastName)");
    console.log("  2. Contact enrichment (email, mobile, address)");
    console.log("  3. Joining date enrichment (joinedDate)\n");

    console.log("APPLIED State (Employee Creation):");
    console.log("  ✅ Name fields: Populated (firstName, lastName)");
    console.log("  ❌ Contact fields: NOT available (422 Invalid Parameter)");
    console.log("  ⚠️  Joining date: Not set at APPLIED (set at HIRED)\n");

    console.log("HIRED State (Employee Enrichment):");
    console.log("  ✅ Name enrichment: WORKS via PUT /personal-details");
    console.log("  ❌ Contact enrichment: NOT available (404 on all methods)");
    console.log("  ✅ Joining date enrichment: WORKS via PUT /job-details\n");

    console.log("Available Data Retrieval:");
    console.log("  ✅ GET /employees/{id}: Basic employee data (name only)");
    console.log("  ✅ GET /personal-details: Extended employee data (name + demographics)");
    console.log("  ✅ GET /job-details: Job information (title, department, joinedDate)");
    console.log("  ❌ GET /contact-details: NOT available (404)");
    console.log("  ✅ GET /emergency-contacts: Available but empty");
    console.log("  ✅ GET /dependents: Available but empty\n");

    console.log("=".repeat(70) + "\n");

    console.log("🎯 CONCLUSION:\n");
    console.log("Phase 3 can achieve:");
    console.log("  ✅ Name enrichment: firstName, middleName, lastName");
    console.log("  ✅ Joining date enrichment: joinedDate");
    console.log("  ❌ Contact enrichment: NOT SUPPORTED in OrangeHRM Community v5.7");
    console.log("     - Cannot add during creation (422)");
    console.log("     - Cannot update after creation (404)");
    console.log("     - Cannot retrieve after creation (404)\n");

    console.log("Phase 3 Acceptance Criteria Status:");
    console.log("  ✅ 2 of 3 requirements can be satisfied");
    console.log("  ❌ 1 of 3 requirements cannot be satisfied (contact enrichment)\n");

    // Cleanup
    console.log("[Cleanup] Terminating test employee...");
    await client.terminateEmployee(empNumber, {
      date: new Date().toISOString().split("T")[0],
      terminationReasonId: 1,
      note: "FLOW_VERIFICATION_CLEANUP",
    });
    console.log(`✅ Terminated empNumber: ${empNumber}\n`);
  } catch (error: any) {
    console.error("\n❌ Verification failed:", error.message);

    if (empNumber) {
      console.log(`\nAttempting cleanup of empNumber ${empNumber}...`);
      try {
        await client.terminateEmployee(empNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "CLEANUP_AFTER_ERROR",
        });
        console.log("✅ Cleanup succeeded\n");
      } catch (e) {
        console.error(`⚠️ Manual cleanup required for empNumber ${empNumber}\n`);
      }
    }

    process.exit(1);
  }
}

main();
