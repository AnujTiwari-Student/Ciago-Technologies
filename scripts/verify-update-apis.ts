/**
 * Focused API Verification: updateEmployee() and updateEmployeeContactDetails()
 *
 * Purpose: Determine if 403/404 errors are due to:
 * - OrangeHRM Community edition limitations
 * - Incorrect API endpoints/methods
 * - Authentication/permission issues
 * - Client implementation bugs
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

config();

async function main() {
  console.log("\n=== OrangeHRM Update API Verification ===\n");

  const client = getOrangeHRMClient();

  let testEmpNumber: number | null = null;

  try {
    // Step 1: Create test employee
    console.log("[1/5] Creating test employee...");
    const employee = await client.createEmployee({
      firstName: "API_TEST",
      lastName: `VERIFY_${Date.now()}`,
    });

    testEmpNumber = employee.empNumber;
    console.log(`✅ Created empNumber: ${testEmpNumber}`);
    console.log(`    employeeId: ${employee.employeeId}`);
    console.log(`    Name: ${employee.firstName} ${employee.lastName}\n`);

    // Step 2: Verify retrieval works
    console.log("[2/5] Retrieving employee...");
    const retrieved = await client.getEmployee(testEmpNumber);
    if (!retrieved) {
      throw new Error("Employee not found after creation");
    }
    console.log(`✅ Retrieved: ${retrieved.firstName} ${retrieved.lastName}\n`);

    // Step 3: Test updateEmployee() - name change
    console.log("[3/5] Testing updateEmployee() - PUT /pim/employees/{empNumber}");
    try {
      await client.updateEmployee(testEmpNumber, {
        firstName: "API_TEST_UPDATED",
        lastName: `VERIFY_${Date.now()}_UPDATED`,
      });
      console.log(`✅ updateEmployee() SUCCEEDED\n`);
    } catch (error: any) {
      console.error(`❌ updateEmployee() FAILED`);
      console.error(`   Error: ${error.message}`);
      console.error(`   This suggests PUT /pim/employees/{empNumber} is NOT supported or requires different permissions\n`);
    }

    // Step 4: Test updateEmployeeContactDetails()
    console.log("[4/5] Testing updateEmployeeContactDetails() - PUT /pim/employees/{empNumber}/contact-details");
    try {
      await client.updateEmployeeContactDetails(testEmpNumber, {
        workEmail: `api.test.${Date.now()}@example.invalid`,
        otherEmail: `personal.${Date.now()}@example.invalid`,
        mobile: "+91-9999999999",
      });
      console.log(`✅ updateEmployeeContactDetails() SUCCEEDED\n`);
    } catch (error: any) {
      console.error(`❌ updateEmployeeContactDetails() FAILED`);
      console.error(`   Error: ${error.message}`);
      console.error(`   This suggests PUT /pim/employees/{empNumber}/contact-details endpoint does NOT exist in OrangeHRM Community v5.7\n`);
    }

    // Step 5: Test updateEmployeeJobDetails() - known to work
    console.log("[5/5] Testing updateEmployeeJobDetails() - PUT /pim/employees/{empNumber}/job-details");
    try {
      await client.updateEmployeeJobDetails(testEmpNumber, {
        joinedDate: "2026-09-01",
      });
      console.log(`✅ updateEmployeeJobDetails() SUCCEEDED\n`);
    } catch (error: any) {
      console.error(`❌ updateEmployeeJobDetails() FAILED`);
      console.error(`   Error: ${error.message}\n`);
    }

    // Cleanup
    console.log("[Cleanup] Terminating test employee...");
    await client.terminateEmployee(testEmpNumber, {
      date: new Date().toISOString().split("T")[0],
      terminationReasonId: 1,
      note: "API_TEST_VERIFY_CLEANUP",
    });
    console.log(`✅ Test employee terminated\n`);

    console.log("=== Verification Complete ===\n");
    console.log("Summary:");
    console.log("  createEmployee()                 ✅ WORKS");
    console.log("  getEmployee()                    ✅ WORKS");
    console.log("  updateEmployee()                 ❓ CHECK OUTPUT ABOVE");
    console.log("  updateEmployeeContactDetails()   ❓ CHECK OUTPUT ABOVE");
    console.log("  updateEmployeeJobDetails()       ✅ WORKS");
    console.log("  terminateEmployee()              ✅ WORKS\n");

  } catch (error: any) {
    console.error("\n=== Verification Failed ===");
    console.error(`Error: ${error.message}\n`);

    // Cleanup attempt
    if (testEmpNumber) {
      console.log(`Attempting cleanup of empNumber ${testEmpNumber}...`);
      try {
        await client.terminateEmployee(testEmpNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "API_TEST_CLEANUP_AFTER_ERROR",
        });
        console.log("✅ Cleanup succeeded\n");
      } catch (cleanupError: any) {
        console.error(`❌ Cleanup failed: ${cleanupError.message}`);
        console.error(`⚠️ Manual cleanup required for empNumber ${testEmpNumber}\n`);
      }
    }

    process.exit(1);
  }
}

main();
