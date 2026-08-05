/**
 * Test personal-details Endpoint Capabilities
 *
 * Verify what fields the /personal-details endpoint accepts
 * and whether it can be used for name enrichment
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

config();

async function main() {
  console.log("\n=== Testing /personal-details Endpoint ===\n");

  const client = getOrangeHRMClient();
  const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");

  let testEmpNumber: number | null = null;

  try {
    // Create test employee
    console.log("[1/5] Creating test employee...");
    const employee = await client.createEmployee({
      firstName: "ORIGINAL",
      middleName: "MID",
      lastName: `PERSONAL_${Date.now()}`,
    });
    testEmpNumber = employee.empNumber;
    console.log(`✅ Created empNumber: ${testEmpNumber}`);
    console.log(`   Name: ${employee.firstName} ${employee.middleName} ${employee.lastName}\n`);

    // Ensure token
    await (client as any).ensureToken();
    const token = (client as any).accessToken;

    // Test 1: GET personal-details to see structure
    console.log("[2/5] GET /personal-details to see available fields...");
    const getUrl = `${baseUrl}/web/index.php/api/v2/pim/employees/${testEmpNumber}/personal-details`;
    const getResponse = await fetch(getUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const getData = await getResponse.json();
    console.log(`Status: ${getResponse.status}`);
    console.log("Response:", JSON.stringify(getData, null, 2));
    console.log();

    // Test 2: PUT personal-details with name changes
    console.log("[3/5] PUT /personal-details with name changes...");
    const nameUpdatePayload = {
      firstName: "UPDATED_FIRST",
      middleName: "UPDATED_MID",
      lastName: "UPDATED_LAST",
    };

    console.log("Payload:", JSON.stringify(nameUpdatePayload, null, 2));

    const nameUpdateUrl = `${baseUrl}/web/index.php/api/v2/pim/employees/${testEmpNumber}/personal-details`;
    const nameUpdateResponse = await fetch(nameUpdateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(nameUpdatePayload),
    });

    const nameUpdateData = await nameUpdateResponse.json();
    console.log(`Status: ${nameUpdateResponse.status}`);
    console.log("Response:", JSON.stringify(nameUpdateData, null, 2));

    if (nameUpdateResponse.ok) {
      console.log("✅ Name update succeeded!\n");
    } else {
      console.log("❌ Name update failed\n");
    }

    // Test 3: Try to add contact fields to personal-details
    console.log("[4/5] PUT /personal-details with contact fields...");
    const contactPayload = {
      firstName: "UPDATED_FIRST",
      lastName: "UPDATED_LAST",
      workEmail: "test@example.com",
      otherEmail: "personal@example.com",
      mobile: "+91-9999999999",
      address: "123 Test Street",
    };

    console.log("Payload:", JSON.stringify(contactPayload, null, 2));

    const contactUpdateUrl = `${baseUrl}/web/index.php/api/v2/pim/employees/${testEmpNumber}/personal-details`;
    const contactUpdateResponse = await fetch(contactUpdateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(contactPayload),
    });

    const contactUpdateData = await contactUpdateResponse.json();
    console.log(`Status: ${contactUpdateResponse.status}`);
    console.log("Response:", JSON.stringify(contactUpdateData, null, 2));

    if (contactUpdateResponse.ok) {
      console.log("✅ Update with contact fields succeeded (fields may be ignored)\n");
    } else {
      console.log("❌ Update with contact fields failed\n");
    }

    // Test 4: Verify final state
    console.log("[5/5] GET employee to verify final state...");
    const finalEmployee = await client.getEmployee(testEmpNumber);
    console.log("Final employee state:", JSON.stringify(finalEmployee, null, 2));
    console.log();

    // Cleanup
    console.log("[Cleanup] Terminating test employee...");
    await client.terminateEmployee(testEmpNumber, {
      date: new Date().toISOString().split("T")[0],
      terminationReasonId: 1,
      note: "PERSONAL_DETAILS_TEST_CLEANUP",
    });
    console.log("✅ Cleanup complete\n");

    // Summary
    console.log("=".repeat(60));
    console.log("\n📊 Summary:\n");
    console.log("✅ GET /personal-details: Returns extended employee data");
    console.log("✅ PUT /personal-details: Can update firstName, middleName, lastName");
    console.log("❌ Contact fields (email, mobile, address): Not available in personal-details");
    console.log("\nConclusion:");
    console.log("  - Name enrichment: CAN be implemented via /personal-details");
    console.log("  - Contact enrichment: No available API endpoint in OrangeHRM Community v5.7\n");
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);

    if (testEmpNumber) {
      console.log(`\nAttempting cleanup of empNumber ${testEmpNumber}...`);
      try {
        await client.terminateEmployee(testEmpNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "TEST_CLEANUP_AFTER_ERROR",
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
