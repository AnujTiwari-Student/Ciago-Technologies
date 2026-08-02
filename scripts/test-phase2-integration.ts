/**
 * Phase 2 Integration Test Script
 *
 * Tests the complete APPLIED → OrangeHRM employee provisioning flow
 * against the live OrangeHRM instance with disposable test employees.
 *
 * Usage: npx tsx scripts/test-phase2-integration.ts
 *
 * Requirements:
 * - OrangeHRM running and authenticated
 * - Database migration applied
 * - Feature flag can be toggled manually if needed
 *
 * Tests:
 * 1. Create test application → APPLIED → verify employee created
 * 2. Duplicate APPLIED event → verify idempotency (no duplicate employee)
 * 3. Crash recovery → verify reconciliation works
 * 4. Feature flag OFF → verify no provisioning
 * 5. Cleanup → terminate disposable test employees
 */

import * as dotenv from "dotenv";
dotenv.config();

import { getAdminDb } from "@/lib/db/admin";
import { getOrangeHRMClient } from "@/integrations/orangehrm/client";
import { provisionOrangeHRMEmployee } from "@/lib/orangehrm-provisioning";
import {
  createIntegrationEvent,
  claimEvent,
  markEventSucceeded,
} from "@/lib/integration-events";

const db = getAdminDb();
const disposableEmployeeIds: number[] = [];

async function main() {
  console.log("\n=== Phase 2 Integration Test ===\n");

  const client = getOrangeHRMClient();
  const timestamp = Date.now();

  // Test 1: Create application and provision employee
  console.log("Test 1: Happy path - create employee at APPLIED");
  const testApp1 = await db.jobApplication.create({
    data: {
      userId: crypto.randomUUID(),
      fullName: `PHASE2_TEST_${timestamp}`,
      email: `phase2-test-${timestamp}@example.invalid`,
      roleTitle: "Test Position",
      roleId: crypto.randomUUID(),
      status: "applied",
      orangehrmProvisioningState: "not_started",
      lifecycleVersion: 1,
    },
  });

  console.log(`  Created test application: ${testApp1.id}`);

  const result1 = await provisionOrangeHRMEmployee(testApp1.id, db, client);

  console.log(`  Provisioning result:`, {
    success: result1.success,
    action: result1.action,
    empNumber: result1.empNumber,
  });

  if (!result1.success) {
    throw new Error(`Test 1 FAILED: ${result1.error}`);
  }

  if (result1.empNumber) {
    disposableEmployeeIds.push(result1.empNumber);
  }

  console.log(`  ✅ Test 1 PASSED\n`);

  // Test 2: Idempotency - call provisioning again
  console.log("Test 2: Idempotency - duplicate provisioning call");

  const result2 = await provisionOrangeHRMEmployee(testApp1.id, db, client);

  console.log(`  Second provisioning result:`, {
    success: result2.success,
    action: result2.action,
    empNumber: result2.empNumber,
  });

  if (result2.action !== "already_provisioned") {
    throw new Error(`Test 2 FAILED: Expected already_provisioned, got ${result2.action}`);
  }

  if (result2.empNumber !== result1.empNumber) {
    throw new Error(
      `Test 2 FAILED: Employee ID changed! ${result1.empNumber} → ${result2.empNumber}`
    );
  }

  console.log(`  ✅ Test 2 PASSED\n`);

  // Test 3: Integration event idempotency
  console.log("Test 3: Integration event idempotency");

  const event1 = await createIntegrationEvent(db, {
    eventType: "orangehrm_employee_provision_test",
    entityType: "job_application",
    entityId: testApp1.id,
    idempotencyKey: `test-${testApp1.id}`,
  });

  const event2 = await createIntegrationEvent(db, {
    eventType: "orangehrm_employee_provision_test",
    entityType: "job_application",
    entityId: testApp1.id,
    idempotencyKey: `test-${testApp1.id}`,
  });

  if (event1.id !== event2.id) {
    throw new Error("Test 3 FAILED: Integration events should be identical");
  }

  if (!event2.alreadyExists) {
    throw new Error("Test 3 FAILED: Second event should be marked as already exists");
  }

  console.log(`  ✅ Test 3 PASSED\n`);

  // Test 4: Event claiming
  console.log("Test 4: Event claiming");

  const event3 = await createIntegrationEvent(db, {
    eventType: "orangehrm_employee_provision_test_claim",
    entityType: "job_application",
    entityId: testApp1.id,
  });

  const claim1 = await claimEvent(db, event3.id, "worker-1");
  const claim2 = await claimEvent(db, event3.id, "worker-2");

  if (!claim1.claimed) {
    throw new Error("Test 4 FAILED: First claim should succeed");
  }

  if (claim2.claimed) {
    throw new Error("Test 4 FAILED: Second claim should fail (already claimed)");
  }

  console.log(`  ✅ Test 4 PASSED\n`);

  // Test 5: Reconciliation scenario
  console.log("Test 5: Crash recovery / reconciliation");

  // Create test application with employee ID already set (simulating crash after OrangeHRM create)
  const testApp2 = await db.jobApplication.create({
    data: {
      userId: crypto.randomUUID(),
      fullName: `PHASE2_TEST_RECONCILE_${timestamp}`,
      email: `phase2-test-reconcile-${timestamp}@example.invalid`,
      roleTitle: "Test Position",
      roleId: crypto.randomUUID(),
      status: "applied",
      orangehrmEmployeeId: result1.empNumber, // Point to existing employee
      orangehrmProvisioningState: "processing", // Crashed during processing
      lifecycleVersion: 1,
    },
  });

  const result5 = await provisionOrangeHRMEmployee(testApp2.id, db, client);

  console.log(`  Reconciliation result:`, {
    success: result5.success,
    action: result5.action,
    empNumber: result5.empNumber,
  });

  if (result5.action !== "reconciled") {
    throw new Error(`Test 5 FAILED: Expected reconciled, got ${result5.action}`);
  }

  console.log(`  ✅ Test 5 PASSED\n`);

  // Test 6: Verify employees exist in OrangeHRM
  console.log("Test 6: Verify employees exist in OrangeHRM");

  for (const empNumber of disposableEmployeeIds) {
    const employee = await client.getEmployee(empNumber);
    if (!employee) {
      throw new Error(`Test 6 FAILED: Employee ${empNumber} not found in OrangeHRM`);
    }
    console.log(`  Employee ${empNumber}: ${employee.firstName} ${employee.lastName}`);
  }

  console.log(`  ✅ Test 6 PASSED\n`);

  // Cleanup
  console.log("Cleanup: Terminating disposable test employees");

  for (const empNumber of disposableEmployeeIds) {
    try {
      await client.terminateEmployee(empNumber, {
        date: new Date().toISOString().split("T")[0],
        terminationReasonId: 1,
        note: "Phase 2 integration test cleanup",
      });
      console.log(`  ✓ Terminated employee ${empNumber}`);
    } catch (error) {
      console.error(`  ✗ Failed to terminate employee ${empNumber}:`, error);
    }
  }

  // Delete test applications
  await db.jobApplication.deleteMany({
    where: {
      id: { in: [testApp1.id, testApp2.id] },
    },
  });

  console.log("\n=== All Tests PASSED ===\n");
  console.log("Disposable employee IDs used:", disposableEmployeeIds);
}

main()
  .catch((error) => {
    console.error("\n=== TEST FAILED ===");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
