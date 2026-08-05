/**
 * Inspect OrangeHRM Employee Data Structure
 *
 * Creates a test employee and inspects the full data structure returned
 * to understand what fields are available and how they're structured.
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

config();

async function main() {
  console.log("\n=== OrangeHRM Employee Data Structure Inspection ===\n");

  const client = getOrangeHRMClient();
  let testEmpNumber: number | null = null;

  try {
    // Create test employee with all possible fields
    console.log("[1/3] Creating test employee with all available fields...");
    const createPayload = {
      firstName: "TEST",
      middleName: "MIDDLE",
      lastName: `INSPECT_${Date.now()}`,
    };

    console.log("Create payload:", JSON.stringify(createPayload, null, 2));

    const created = await client.createEmployee(createPayload);
    testEmpNumber = created.empNumber;

    console.log("\nCreated employee response:");
    console.log(JSON.stringify(created, null, 2));
    console.log();

    // Retrieve employee to see full data structure
    console.log("[2/3] Retrieving employee to inspect full data structure...");
    const retrieved = await client.getEmployee(testEmpNumber);

    console.log("\nRetrieved employee data:");
    console.log(JSON.stringify(retrieved, null, 2));
    console.log();

    // Try to update with extended payload
    console.log("[3/3] Testing extended update payload...");
    console.log("Attempting PUT /pim/employees/{empNumber} with extended fields...\n");

    const updatePayload = {
      firstName: "TEST_UPDATED",
      middleName: "MID",
      lastName: `INSPECT_${Date.now()}_UPD`,
      employeeId: `TEST-${Date.now()}`,
      otherId: "OTHER-123",
      gender: 1,
      maritalStatus: "Single",
      birthday: "1990-01-01",
    };

    console.log("Update payload:", JSON.stringify(updatePayload, null, 2));

    try {
      const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");
      const url = `${baseUrl}/web/index.php/api/v2/pim/employees/${testEmpNumber}`;

      // Get token from client
      await (client as any).ensureToken();
      const token = (client as any).accessToken;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      const responseText = await response.text();

      console.log(`\nResponse status: ${response.status}`);
      console.log(`Response body:`, responseText ? JSON.parse(responseText) : "(empty)");

      if (!response.ok) {
        console.log(`\n❌ Update failed with status ${response.status}`);
      } else {
        console.log(`\n✅ Update succeeded`);

        // Retrieve again to see what changed
        const afterUpdate = await client.getEmployee(testEmpNumber);
        console.log("\nEmployee data after update:");
        console.log(JSON.stringify(afterUpdate, null, 2));
      }
    } catch (error: any) {
      console.error(`\n❌ Update error: ${error.message}`);
    }

    // Cleanup
    console.log("\n[Cleanup] Terminating test employee...");
    await client.terminateEmployee(testEmpNumber, {
      date: new Date().toISOString().split("T")[0],
      terminationReasonId: 1,
      note: "INSPECTION_TEST_CLEANUP",
    });
    console.log("✅ Cleanup complete\n");
  } catch (error: any) {
    console.error("\n❌ Inspection failed:", error.message);

    if (testEmpNumber) {
      console.log(`\nAttempting cleanup of empNumber ${testEmpNumber}...`);
      try {
        await client.terminateEmployee(testEmpNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "INSPECTION_CLEANUP_AFTER_ERROR",
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
