/**
 * Phase 2: Frappe HR Integration Test
 *
 * Tests complete APPLIED → HIRED lifecycle with live Frappe instance
 *
 * Prerequisites:
 * - Frappe HR running at http://localhost:8180
 * - FRAPPE_API_KEY and FRAPPE_API_SECRET in .env
 * - FRAPPE_BASE_URL=http://localhost:8180 in .env
 * - FRAPPE_COMPANY_NAME=Ciago Technologies (or your company name)
 *
 * Tests:
 * 1. Authentication test
 * 2. Create employee (APPLIED simulation)
 * 3. Retrieve employee
 * 4. Update employee (HIRED simulation)
 * 5. Idempotency test (re-run update)
 * 6. Reconciliation test (simulate crash recovery)
 * 7. Cleanup (mark as Left, not delete)
 */

import "dotenv/config";
import { createFrappeClient } from "../src/integrations/frappe/client";
import type { CreateEmployeePayload, UpdateEmployeePayload } from "../src/integrations/frappe/types";

// Test configuration
const TEST_CONFIG = {
  testEmail: `test.employee.${Date.now()}@example.com`,
  testFirstName: "Test",
  testLastName: "Employee",
  testMiddleName: "Phase2",
  testGender: "Other" as const,
  testDOB: "1990-01-01",
  testJoiningDate: new Date().toISOString().split('T')[0],
  testMobile: "+1234567890",
  testAddress: "123 Test Street, Test City, Test Province",
};

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "EXPECTED_FAIL";
  message: string;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

function logTest(name: string, status: TestResult["status"], message: string, error?: string, data?: any) {
  const result: TestResult = { name, status, message, error, data };
  results.push(result);

  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : status === "SKIP" ? "○" : "⚠";
  const color = status === "PASS" ? "\x1b[32m" : status === "FAIL" ? "\x1b[31m" : status === "SKIP" ? "\x1b[33m" : "\x1b[35m";
  const reset = "\x1b[0m";

  console.log(`${color}${icon} ${name}${reset}`);
  console.log(`  ${message}`);
  if (error) {
    console.log(`  Error: ${error}`);
  }
  if (data) {
    console.log(`  Data:`, JSON.stringify(data, null, 2));
  }
  console.log();
}

function printSummary() {
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const skipped = results.filter(r => r.status === "SKIP").length;
  const expectedFail = results.filter(r => r.status === "EXPECTED_FAIL").length;
  const total = results.length;

  console.log("\n" + "=".repeat(60));
  console.log("PHASE 2 FRAPPE INTEGRATION TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total:          ${total}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`Expected Fail:  ${expectedFail}`);
  console.log(`Success Rate:   ${Math.round((passed / (total - skipped)) * 100)}%`);
  console.log("=".repeat(60) + "\n");
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("FRAPPE HR PHASE 2 INTEGRATION TEST");
  console.log("=".repeat(60) + "\n");

  let client: ReturnType<typeof createFrappeClient>;
  let testEmployeeName: string | null = null;

  try {
    // Test 1: Authentication
    console.log("Test 1: Authentication");
    try {
      client = createFrappeClient();
      const user = await client.testAuth();
      logTest(
        "Test 1: Authentication",
        "PASS",
        `Successfully authenticated as: ${user}`,
        undefined,
        { user }
      );
    } catch (error) {
      logTest(
        "Test 1: Authentication",
        "FAIL",
        "Failed to authenticate with Frappe API",
        error instanceof Error ? error.message : String(error)
      );
      return; // Cannot proceed without auth
    }

    // Test 2: Create Employee (APPLIED simulation)
    console.log("Test 2: Create Employee (APPLIED simulation)");
    try {
      const createPayload: CreateEmployeePayload = {
        first_name: TEST_CONFIG.testFirstName,
        middle_name: TEST_CONFIG.testMiddleName,
        last_name: TEST_CONFIG.testLastName,
        gender: TEST_CONFIG.testGender,
        date_of_birth: TEST_CONFIG.testDOB,
        date_of_joining: TEST_CONFIG.testJoiningDate,
        company: process.env.FRAPPE_COMPANY_NAME || "Ciago Technologies",
        personal_email: TEST_CONFIG.testEmail,
        company_email: TEST_CONFIG.testEmail,
      };

      const employee = await client!.createEmployee(createPayload);
      testEmployeeName = employee.name;

      logTest(
        "Test 2: Create Employee",
        "PASS",
        `Successfully created employee: ${employee.name}`,
        undefined,
        {
          name: employee.name,
          employee_name: employee.employee_name,
          status: employee.status,
        }
      );
    } catch (error) {
      logTest(
        "Test 2: Create Employee",
        "FAIL",
        "Failed to create employee",
        error instanceof Error ? error.message : String(error)
      );
      return; // Cannot proceed without employee
    }

    // Test 3: Retrieve Employee
    console.log("Test 3: Retrieve Employee");
    try {
      const employee = await client!.getEmployee(testEmployeeName!);

      if (!employee) {
        logTest(
          "Test 3: Retrieve Employee",
          "FAIL",
          `Employee ${testEmployeeName} not found after creation`
        );
      } else {
        logTest(
          "Test 3: Retrieve Employee",
          "PASS",
          `Successfully retrieved employee: ${employee.name}`,
          undefined,
          {
            name: employee.name,
            employee_name: employee.employee_name,
            personal_email: employee.personal_email,
            status: employee.status,
          }
        );
      }
    } catch (error) {
      logTest(
        "Test 3: Retrieve Employee",
        "FAIL",
        "Failed to retrieve employee",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Test 4: Update Employee (HIRED simulation - enrichment)
    console.log("Test 4: Update Employee (HIRED enrichment)");
    try {
      const updatePayload: UpdateEmployeePayload = {
        cell_number: TEST_CONFIG.testMobile,
        current_address: TEST_CONFIG.testAddress,
        date_of_joining: TEST_CONFIG.testJoiningDate, // Update with actual joining date
      };

      const updated = await client!.updateEmployee(testEmployeeName!, updatePayload);

      logTest(
        "Test 4: Update Employee",
        "PASS",
        `Successfully updated employee with HIRED enrichment data`,
        undefined,
        {
          name: updated.name,
          cell_number: updated.cell_number,
          current_address: updated.current_address,
          date_of_joining: updated.date_of_joining,
        }
      );
    } catch (error) {
      logTest(
        "Test 4: Update Employee",
        "FAIL",
        "Failed to update employee",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Test 5: Idempotency (re-run update)
    console.log("Test 5: Idempotency Test (re-run update)");
    try {
      const updatePayload: UpdateEmployeePayload = {
        cell_number: TEST_CONFIG.testMobile,
        current_address: TEST_CONFIG.testAddress,
      };

      const updated = await client!.updateEmployee(testEmployeeName!, updatePayload);

      logTest(
        "Test 5: Idempotency",
        "PASS",
        `Successfully re-ran update (idempotent operation)`,
        undefined,
        {
          name: updated.name,
          message: "No errors on duplicate update - idempotent",
        }
      );
    } catch (error) {
      logTest(
        "Test 5: Idempotency",
        "FAIL",
        "Failed idempotency test",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Test 6: Reconciliation (search by email)
    console.log("Test 6: Reconciliation Test (search by email)");
    try {
      const found = await client!.searchEmployeesByEmail(TEST_CONFIG.testEmail);

      if (found.length === 0) {
        logTest(
          "Test 6: Reconciliation",
          "FAIL",
          `No employees found with email: ${TEST_CONFIG.testEmail}`
        );
      } else if (found.length > 1) {
        logTest(
          "Test 6: Reconciliation",
          "FAIL",
          `Multiple employees found with email: ${TEST_CONFIG.testEmail}`,
          "Duplicate detection required",
          { count: found.length, names: found.map(e => e.name) }
        );
      } else {
        const reconciled = found[0];
        if (reconciled.name === testEmployeeName) {
          logTest(
            "Test 6: Reconciliation",
            "PASS",
            `Successfully reconciled employee by email`,
            undefined,
            {
              name: reconciled.name,
              email: TEST_CONFIG.testEmail,
            }
          );
        } else {
          logTest(
            "Test 6: Reconciliation",
            "FAIL",
            `Reconciled employee name mismatch`,
            `Expected: ${testEmployeeName}, Got: ${reconciled.name}`
          );
        }
      }
    } catch (error) {
      logTest(
        "Test 6: Reconciliation",
        "FAIL",
        "Failed reconciliation test",
        error instanceof Error ? error.message : String(error)
      );
    }

    // Test 7: Required Fields Validation
    console.log("Test 7: Required Fields Validation (negative test)");
    try {
      // Attempt to create employee without required fields
      await client!.createEmployee({
        first_name: "Invalid",
        // Missing: gender, date_of_birth, date_of_joining, company
      } as any);

      logTest(
        "Test 7: Required Fields",
        "FAIL",
        "Should have failed without required fields but succeeded"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("mandatory")) {
        logTest(
          "Test 7: Required Fields",
          "PASS",
          "Correctly rejected creation without required fields",
          undefined,
          { expectedError: "MandatoryError" }
        );
      } else {
        logTest(
          "Test 7: Required Fields",
          "FAIL",
          "Failed with unexpected error",
          message
        );
      }
    }

  } catch (error) {
    console.error("Unexpected test failure:", error);
  } finally {
    // Cleanup: Mark employee as Left (Frappe doesn't support DELETE)
    if (testEmployeeName) {
      console.log("Cleanup: Marking test employee as Left");
      try {
        await client!.terminateEmployee(testEmployeeName, new Date().toISOString().split('T')[0]);
        logTest(
          "Cleanup",
          "PASS",
          `Successfully marked test employee as Left: ${testEmployeeName}`,
          undefined,
          { action: "terminated", employeeName: testEmployeeName }
        );
      } catch (error) {
        logTest(
          "Cleanup",
          "FAIL",
          "Failed to cleanup test employee",
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    printSummary();
  }
}

main().catch(console.error);
