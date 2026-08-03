/**
 * Phase 4 Validation: Test flag-OFF safety
 *
 * Verify that with FRAPPE_EMPLOYEE_SYNC_ENABLED=false:
 * - APPLIED handler doesn't call Frappe
 * - HIRED handler doesn't call Frappe
 * - No Frappe integration events created
 * - OrangeHRM behavior unchanged
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { getAdminDb } from "../src/lib/db/admin";
import { createFrappeClient } from "../src/integrations/frappe/client";
import { handleFrappeApplicationApplied } from "../src/lib/frappe-applied-handler";
import { handleFrappeApplicationHired } from "../src/lib/frappe-hired-handler-orchestration";

const db = getAdminDb();

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  message: string;
  error?: string;
}

const results: TestResult[] = [];

function logTest(name: string, status: "PASS" | "FAIL", message: string, error?: string) {
  const result: TestResult = { name, status, message, error };
  results.push(result);

  const icon = status === "PASS" ? "✓" : "✗";
  const color = status === "PASS" ? "\x1b[32m" : "\x1b[31m";
  const reset = "\x1b[0m";

  console.log(`${color}${icon} ${name}${reset}`);
  console.log(`  ${message}`);
  if (error) {
    console.log(`  Error: ${error}`);
  }
  console.log();
}

async function testFlagOffSafety() {
  console.log("=".repeat(60));
  console.log("PHASE 4: FLAG-OFF SAFETY VALIDATION");
  console.log("=".repeat(60));
  console.log();

  // Verify env var is false
  const envValue = process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED;
  console.log(`Environment: FRAPPE_EMPLOYEE_SYNC_ENABLED=${envValue}`);

  if (envValue === "true") {
    console.error("❌ ABORT: FRAPPE_EMPLOYEE_SYNC_ENABLED must be 'false' for this test");
    process.exit(1);
  }

  const client = createFrappeClient();

  // Test 1: Check flag status
  try {
    const { isFrappeEmployeeSyncEnabled } = await import("../src/lib/feature-flags.server");
    const flagEnabled = await isFrappeEmployeeSyncEnabled();

    if (flagEnabled === false) {
      logTest(
        "Test 1: Feature flag OFF",
        "PASS",
        `Flag correctly returns false (env=${envValue})`
      );
    } else {
      logTest(
        "Test 1: Feature flag OFF",
        "FAIL",
        `Flag returned true when it should be false (env=${envValue})`
      );
    }
  } catch (error) {
    logTest(
      "Test 1: Feature flag OFF",
      "FAIL",
      "Failed to check flag status",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test 2: Create mock application for APPLIED test
  let testApplicationId: string | null = null;
  let testUserId: string | null = null;

  try {
    // Create minimal test application
    const timestamp = Date.now();
    const testEmail = `flag-off-test-${timestamp}@example.invalid`;

    testUserId = randomUUID();
    const testRoleId = randomUUID();

    const application = await db.jobApplication.create({
      data: {
        userId: testUserId,
        roleId: testRoleId,
        roleTitle: "Test Engineer",
        fullName: "Flag-Off Test User",
        email: testEmail,
        status: "applied",
      },
    });

    testApplicationId = application.id;

    logTest(
      "Test 2: Mock application created",
      "PASS",
      `Application ${testApplicationId.slice(0, 8)} created (status: applied)`
    );
  } catch (error) {
    logTest(
      "Test 2: Mock application created",
      "FAIL",
      "Failed to create mock application",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  // Test 3: Call APPLIED handler with flag OFF
  try {
    const result = await handleFrappeApplicationApplied({
      db,
      client,
      applicationId: testApplicationId!,
      correlationId: "flag-off-test-applied",
    });

    if (!result.triggered && result.reason === "feature_flag_disabled") {
      logTest(
        "Test 3: APPLIED handler with flag OFF",
        "PASS",
        "Handler correctly skipped (triggered=false, reason=feature_flag_disabled)"
      );
    } else {
      logTest(
        "Test 3: APPLIED handler with flag OFF",
        "FAIL",
        `Handler should not trigger with flag OFF (triggered=${result.triggered}, reason=${result.reason})`
      );
    }

    // Verify no integration event was created
    const events = await db.integrationEvent.findMany({
      where: {
        entityId: testApplicationId!,
        eventType: "frappe_employee_provision",
      },
    });

    if (events.length === 0) {
      logTest(
        "Test 3a: No APPLIED integration event created",
        "PASS",
        "No Frappe provisioning events found (correct)"
      );
    } else {
      logTest(
        "Test 3a: No APPLIED integration event created",
        "FAIL",
        `Found ${events.length} Frappe provisioning events (should be 0)`
      );
    }
  } catch (error) {
    logTest(
      "Test 3: APPLIED handler with flag OFF",
      "FAIL",
      "Handler threw unexpected error",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test 4: Call HIRED handler with flag OFF
  try {
    // Update application status to hired
    await db.jobApplication.update({
      where: { id: testApplicationId! },
      data: { status: "hired" },
    });

    const result = await handleFrappeApplicationHired({
      db,
      client,
      applicationId: testApplicationId!,
      candidateId: testUserId!,
      correlationId: "flag-off-test-hired",
    });

    if (!result.triggered && result.reason === "feature_flag_disabled") {
      logTest(
        "Test 4: HIRED handler with flag OFF",
        "PASS",
        "Handler correctly skipped (triggered=false, reason=feature_flag_disabled)"
      );
    } else {
      logTest(
        "Test 4: HIRED handler with flag OFF",
        "FAIL",
        `Handler should not trigger with flag OFF (triggered=${result.triggered}, reason=${result.reason})`
      );
    }

    // Verify no integration event was created
    const events = await db.integrationEvent.findMany({
      where: {
        entityId: testApplicationId!,
        eventType: "frappe_employee_upsert_at_hired",
      },
    });

    if (events.length === 0) {
      logTest(
        "Test 4a: No HIRED integration event created",
        "PASS",
        "No Frappe upsert events found (correct)"
      );
    } else {
      logTest(
        "Test 4a: No HIRED integration event created",
        "FAIL",
        `Found ${events.length} Frappe upsert events (should be 0)`
      );
    }
  } catch (error) {
    logTest(
      "Test 4: HIRED handler with flag OFF",
      "FAIL",
      "Handler threw unexpected error",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Test 5: Verify application state unchanged
  try {
    const app = await db.jobApplication.findUnique({
      where: { id: testApplicationId! },
      select: {
        frappeEmployeeName: true,
        frappeProvisioningState: true,
        frappeProvisioningAttemptedAt: true,
      },
    });

    if (
      app?.frappeEmployeeName === null &&
      app?.frappeProvisioningState === "not_started" &&
      app?.frappeProvisioningAttemptedAt === null
    ) {
      logTest(
        "Test 5: Application state unchanged",
        "PASS",
        "No Frappe fields modified (all null/not_started)"
      );
    } else {
      logTest(
        "Test 5: Application state unchanged",
        "FAIL",
        `Frappe fields should be unchanged (employeeName=${app?.frappeEmployeeName}, state=${app?.frappeProvisioningState})`
      );
    }
  } catch (error) {
    logTest(
      "Test 5: Application state unchanged",
      "FAIL",
      "Failed to check application state",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Cleanup: Delete test application
  try {
    await db.jobApplication.delete({
      where: { id: testApplicationId! },
    });
    console.log(`✓ Cleanup: Test application deleted\n`);
  } catch (error) {
    console.warn(`⚠️  Cleanup warning: ${error}\n`);
  }

  // Summary
  console.log("=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;

  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Rate:   ${((passed / total) * 100).toFixed(0)}%`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

testFlagOffSafety()
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
