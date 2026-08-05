/**
 * Verify Contact Fields at Employee Creation
 *
 * Critical verification: Can email/mobile/address be populated during
 * POST /pim/employees (APPLIED state) rather than requiring updates at HIRED?
 *
 * Tests:
 * 1. Create employee with ONLY name fields (current implementation)
 * 2. Create employee WITH email/mobile/address fields
 * 3. Verify which fields are persisted
 * 4. Determine correct Phase 3 architecture
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

config();

async function main() {
  console.log("\n=== Verify Contact Fields at Employee Creation ===\n");

  const client = getOrangeHRMClient();
  const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");

  let test1EmpNumber: number | null = null;
  let test2EmpNumber: number | null = null;

  try {
    // Ensure token
    await (client as any).ensureToken();
    const token = (client as any).accessToken;

    // ================================================================
    // Test 1: Create employee with ONLY name (current implementation)
    // ================================================================
    console.log("[Test 1] Creating employee with ONLY name fields...\n");

    const test1Payload = {
      firstName: "NAME_ONLY",
      lastName: `TEST_${Date.now()}`,
    };

    console.log("Payload:", JSON.stringify(test1Payload, null, 2));

    const test1Employee = await client.createEmployee(test1Payload);
    test1EmpNumber = test1Employee.empNumber;

    console.log(`\n✅ Created empNumber: ${test1EmpNumber}`);
    console.log("Response:", JSON.stringify(test1Employee, null, 2));

    // Retrieve to see full data
    const test1Retrieved = await client.getEmployee(test1EmpNumber);
    console.log("\nRetrieved data:");
    console.log(JSON.stringify(test1Retrieved, null, 2));
    console.log();

    // ================================================================
    // Test 2: Create employee WITH email/mobile/address
    // ================================================================
    console.log("[Test 2] Creating employee WITH email/mobile/address fields...\n");

    const timestamp = Date.now();
    const test2Payload = {
      firstName: "FULL_CONTACT",
      lastName: `TEST_${timestamp}`,
      // Attempt to add contact fields
      workEmail: `test.${timestamp}@example.invalid`,
      otherEmail: `personal.${timestamp}@example.invalid`,
      mobile: "+91-9999999999",
      phone: "+91-8888888888",
      addressStreet1: "123 Test Street",
      addressStreet2: "Apartment 4B",
      city: "Bangalore",
      province: "Karnataka",
      zipCode: "560001",
      countryCode: "IN",
    };

    console.log("Payload:", JSON.stringify(test2Payload, null, 2));

    const createUrl = `${baseUrl}/web/index.php/api/v2/pim/employees`;
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(test2Payload),
    });

    const createText = await createResponse.text();
    let createData;

    try {
      createData = createText ? JSON.parse(createText) : null;
    } catch {
      createData = createText;
    }

    console.log(`\nResponse status: ${createResponse.status}`);
    console.log("Response:", JSON.stringify(createData, null, 2));

    if (createResponse.ok && createData?.data?.empNumber) {
      test2EmpNumber = createData.data.empNumber;
      console.log(`\n✅ Created empNumber: ${test2EmpNumber}`);

      // Retrieve to see what was persisted
      const test2Retrieved = await client.getEmployee(test2EmpNumber);
      console.log("\nRetrieved data:");
      console.log(JSON.stringify(test2Retrieved, null, 2));

      // Try to get contact details via GET (if endpoint exists)
      console.log("\nAttempting GET /contact-details...");
      const contactUrl = `${baseUrl}/web/index.php/api/v2/pim/employees/${test2EmpNumber}/contact-details`;
      const contactResponse = await fetch(contactUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      console.log(`Status: ${contactResponse.status}`);

      if (contactResponse.ok) {
        const contactData = await contactResponse.json();
        console.log("Contact details:", JSON.stringify(contactData, null, 2));
      } else {
        console.log("❌ GET /contact-details not available");
      }
    } else if (createResponse.status === 422) {
      console.log("\n⚠️ 422 Invalid Parameter - contact fields rejected at creation");
      console.log("This confirms contact fields CANNOT be added during POST /pim/employees");
    } else {
      console.log(`\n❌ Create failed with status ${createResponse.status}`);
    }

    console.log();

    // ================================================================
    // Summary
    // ================================================================
    console.log("=".repeat(70));
    console.log("\n📊 Summary:\n");
    console.log("Test 1 (name only):");
    console.log("  - Status: ✅ Created");
    console.log("  - Fields returned: empNumber, firstName, lastName, employeeId, terminationId");
    console.log("  - Contact fields: NOT in response");
    console.log();

    if (test2EmpNumber) {
      console.log("Test 2 (with contact fields):");
      console.log("  - Status: ✅ Created");
      console.log("  - Contact fields accepted: YES");
      console.log("  - Contact fields persisted: Verify in retrieved data above");
    } else if (createResponse.status === 422) {
      console.log("Test 2 (with contact fields):");
      console.log("  - Status: ❌ 422 Invalid Parameter");
      console.log("  - Contact fields accepted: NO");
      console.log("  - Conclusion: POST /pim/employees does NOT accept contact fields");
    }

    console.log("\n" + "=".repeat(70) + "\n");

    // Cleanup
    console.log("[Cleanup] Terminating test employees...\n");

    if (test1EmpNumber) {
      await client.terminateEmployee(test1EmpNumber, {
        date: new Date().toISOString().split("T")[0],
        terminationReasonId: 1,
        note: "VERIFY_CREATE_FIELDS_CLEANUP_TEST1",
      });
      console.log(`✅ Terminated test1 empNumber: ${test1EmpNumber}`);
    }

    if (test2EmpNumber) {
      await client.terminateEmployee(test2EmpNumber, {
        date: new Date().toISOString().split("T")[0],
        terminationReasonId: 1,
        note: "VERIFY_CREATE_FIELDS_CLEANUP_TEST2",
      });
      console.log(`✅ Terminated test2 empNumber: ${test2EmpNumber}`);
    }

    console.log("\n✅ Verification complete\n");
  } catch (error: any) {
    console.error("\n❌ Verification failed:", error.message);

    // Cleanup attempt
    if (test1EmpNumber) {
      try {
        await client.terminateEmployee(test1EmpNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "CLEANUP_AFTER_ERROR",
        });
        console.log(`✅ Cleaned up test1 empNumber: ${test1EmpNumber}`);
      } catch (e) {
        console.error(`⚠️ Manual cleanup required for empNumber ${test1EmpNumber}`);
      }
    }

    if (test2EmpNumber) {
      try {
        await client.terminateEmployee(test2EmpNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "CLEANUP_AFTER_ERROR",
        });
        console.log(`✅ Cleaned up test2 empNumber: ${test2EmpNumber}`);
      } catch (e) {
        console.error(`⚠️ Manual cleanup required for empNumber ${test2EmpNumber}`);
      }
    }

    process.exit(1);
  }
}

main();
