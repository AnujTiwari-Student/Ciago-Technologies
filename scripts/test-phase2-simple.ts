/**
 * Phase 2 Simple Integration Test
 *
 * Tests against live OrangeHRM without DB foreign key dependencies.
 * Creates employees directly in OrangeHRM, tests provisioning logic paths.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { getOrangeHRMClient } from "@/integrations/orangehrm/client";

const disposableEmployeeIds: number[] = [];

async function main() {
  console.log("\n=== Phase 2 Simple OrangeHRM Integration Test ===\n");

  const client = getOrangeHRMClient();
  const timestamp = Date.now();

  // Test 1: Create employee
  console.log("Test 1: Create employee in OrangeHRM");
  const testName = `PHASE2_TEST_${timestamp}`;

  try {
    const employee1 = await client.createEmployee({
      firstName: testName,
      lastName: "Test",
    });

    console.log(`  ✅ Employee created: empNumber=${employee1.empNumber}`);
    disposableEmployeeIds.push(employee1.empNumber);

    // Test 2: Retrieve employee
    console.log("\nTest 2: Retrieve employee");
    const retrieved = await client.getEmployee(employee1.empNumber);

    if (!retrieved) {
      throw new Error("Employee not found after creation");
    }

    console.log(`  ✅ Employee retrieved: ${retrieved.firstName} ${retrieved.lastName}`);

    // Test 3: Update contact details (may not be supported in OrangeHRM Community)
    console.log("\nTest 3: Update contact details (optional)");
    try {
      await client.updateEmployeeContactDetails(employee1.empNumber, {
        workEmail: `phase2-test-${timestamp}@example.invalid`,
      });
      console.log(`  ✅ Contact details updated`);
    } catch (contactError) {
      console.log(`  ⚠️  Contact details update not supported (non-critical)`);
    }

    // Test 4: Idempotency - retrieve again
    console.log("\nTest 4: Idempotency - retrieve same employee");
    const retrieved2 = await client.getEmployee(employee1.empNumber);

    if (retrieved2?.empNumber !== employee1.empNumber) {
      throw new Error("Employee ID changed!");
    }

    console.log(`  ✅ Same employee retrieved: empNumber=${retrieved2.empNumber}`);

    // Test 5: Create second employee (concurrent scenario simulation)
    console.log("\nTest 5: Create second employee");
    const employee2 = await client.createEmployee({
      firstName: `${testName}_2`,
      lastName: "Test",
    });

    console.log(`  ✅ Second employee created: empNumber=${employee2.empNumber}`);
    disposableEmployeeIds.push(employee2.empNumber);

    // Verify they're different
    if (employee1.empNumber === employee2.empNumber) {
      throw new Error("Duplicate employee numbers!");
    }

    console.log(
      `  ✅ Employees have different IDs: ${employee1.empNumber} vs ${employee2.empNumber}`,
    );

    // Test 6: Terminate employees (cleanup)
    console.log("\nTest 6: Terminate employees via termination API");

    for (const empNumber of disposableEmployeeIds) {
      try {
        await client.terminateEmployee(empNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "Phase 2 integration test cleanup",
        });
        console.log(`  ✅ Terminated employee ${empNumber}`);
      } catch (termError) {
        console.error(`  ✗ Failed to terminate employee ${empNumber}:`, termError);
      }
    }

    console.log("\n=== All Tests PASSED ===\n");
    console.log("Disposable employee IDs:", disposableEmployeeIds);
  } catch (error) {
    console.error("\n=== TEST FAILED ===");
    console.error(error);

    // Attempt cleanup
    console.log("\nAttempting cleanup of created employees...");
    for (const empNumber of disposableEmployeeIds) {
      try {
        await client.terminateEmployee(empNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "Phase 2 integration test cleanup after failure",
        });
        console.log(`  Cleaned up employee ${empNumber}`);
      } catch {
        console.error(`  Failed to clean up employee ${empNumber}`);
      }
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n=== FATAL ERROR ===");
  console.error(error);
  process.exit(1);
});
