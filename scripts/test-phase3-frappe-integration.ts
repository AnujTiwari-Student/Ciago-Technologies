/**
 * Phase 3: Frappe HR Integration - Live End-to-End Test
 *
 * Tests the complete application lifecycle with Frappe integration
 *
 * Prerequisites:
 * - Frappe HR running at http://localhost:8180
 * - Database accessible (Prisma client configured)
 * - FRAPPE_EMPLOYEE_SYNC_ENABLED environment variable
 * - Development environment only (never run against production)
 *
 * Tests:
 * 1. Flag OFF → No Frappe API calls
 * 2. Flag ON + Mock APPLIED → Frappe Employee created
 * 3. Duplicate APPLIED → No duplicate employee
 * 4. Flag ON + Mock HIRED → Existing employee enriched
 * 5. Duplicate HIRED → Idempotent (no errors)
 * 6. Verify database state (frappeEmployeeName persisted)
 * 7. Cleanup (mark as Left, delete test application)
 */

import "dotenv/config";
import { getAdminDb } from "../src/lib/db/admin";
import { createFrappeClient } from "../src/integrations/frappe/client";
import { handleFrappeApplicationApplied } from "../src/lib/frappe-applied-handler";
import { handleFrappeApplicationHired } from "../src/lib/frappe-hired-handler-orchestration";

const db = getAdminDb();

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

function logTest(
  name: string,
  status: TestResult["status"],
  message: string,
  error?: string,
  data?: any,
) {
  const result: TestResult = { name, status, message, error, data };
  results.push(result);

  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  const color = status === "PASS" ? "\x1b[32m" : status === "FAIL" ? "\x1b[31m" : "\x1b[33m";
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
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  const total = results.length;

  console.log("\n" + "=".repeat(60));
  console.log("PHASE 3 FRAPPE INTEGRATION TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total:          ${total}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`Success Rate:   ${Math.round((passed / (total - skipped)) * 100)}%`);
  console.log("=".repeat(60) + "\n");
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 3 FRAPPE HR INTEGRATION TEST");
  console.log("=".repeat(60) + "\n");

  let testApplicationId: string | null = null;
  let testUserId: string | null = null;
  let testEmployeeName: string | null = null;
  const client = createFrappeClient();

  try {
    // Create test application
    console.log("Setup: Creating test application");
    const testUser = await db.users.create({
      data: {
        email: `test.phase3.${Date.now()}@example.com`,
        raw_user_meta_data: { full_name: "Phase3 Test User" },
      },
    });
    testUserId = testUser.id;

    const testJobPosting = await db.jobPosting.findFirst({
      where: { status: "published" },
      select: { id: true, title: true },
    });

    if (!testJobPosting) {
      throw new Error("No published job posting found - please create one first");
    }

    const testApplication = await db.jobApplication.create({
      data: {
        userId: testUserId,
        roleId: testJobPosting.id,
        roleTitle: testJobPosting.title,
        fullName: "Phase3 Test Candidate",
        email: testUser.email!,
        status: "screening",
      },
    });
    testApplicationId = testApplication.id;

    console.log(`Setup complete: Application ${testApplicationId.slice(0, 8)}\n`);

    // Test 1: Flag OFF → No Frappe API calls
    console.log("Test 1: Feature Flag OFF (no Frappe API calls)");
    try {
      process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED = "false";

      const result = await handleFrappeApplicationApplied({
        db,
        client,
        applicationId: testApplicationId,
      });

      if (result.triggered === false && result.reason === "feature_flag_disabled") {
        logTest(
          "Test 1: Flag OFF",
          "PASS",
          "Frappe integration correctly disabled when flag is OFF",
          undefined,
          { triggered: result.triggered, reason: result.reason },
        );
      } else {
        logTest(
          "Test 1: Flag OFF",
          "FAIL",
          "Frappe integration should not trigger when flag is OFF",
          `Unexpected result: ${JSON.stringify(result)}`,
        );
      }
    } catch (error) {
      logTest(
        "Test 1: Flag OFF",
        "FAIL",
        "Flag OFF test failed with error",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 2: Flag ON + APPLIED → Frappe Employee created
    console.log("Test 2: APPLIED with Flag ON (create employee)");
    try {
      process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED = "true";

      const result = await handleFrappeApplicationApplied({
        db,
        client,
        applicationId: testApplicationId,
        correlationId: "phase3-test-applied",
      });

      if (result.triggered && result.provisioningResult?.success) {
        testEmployeeName = result.provisioningResult.employeeName;

        logTest(
          "Test 2: APPLIED",
          "PASS",
          `Frappe employee created: ${testEmployeeName}`,
          undefined,
          {
            employeeName: testEmployeeName,
            action: result.provisioningResult.action,
          },
        );
      } else {
        logTest(
          "Test 2: APPLIED",
          "FAIL",
          "Failed to create Frappe employee",
          result.provisioningResult?.error || "Unknown error",
        );
      }
    } catch (error) {
      logTest(
        "Test 2: APPLIED",
        "FAIL",
        "APPLIED test failed with error",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 3: Duplicate APPLIED → No duplicate employee
    console.log("Test 3: Duplicate APPLIED (idempotency)");
    try {
      const result = await handleFrappeApplicationApplied({
        db,
        client,
        applicationId: testApplicationId,
        correlationId: "phase3-test-applied-duplicate",
      });

      if (!result.triggered && result.reason === "already_completed") {
        logTest(
          "Test 3: Duplicate APPLIED",
          "PASS",
          "Duplicate APPLIED correctly detected (idempotent)",
          undefined,
          { reason: result.reason },
        );
      } else if (result.provisioningResult?.action === "already_provisioned") {
        logTest(
          "Test 3: Duplicate APPLIED",
          "PASS",
          "Duplicate provisioning correctly handled",
          undefined,
          { action: result.provisioningResult.action },
        );
      } else {
        logTest(
          "Test 3: Duplicate APPLIED",
          "FAIL",
          "Duplicate APPLIED should not create another employee",
          `Unexpected result: ${JSON.stringify(result)}`,
        );
      }
    } catch (error) {
      logTest(
        "Test 3: Duplicate APPLIED",
        "FAIL",
        "Duplicate APPLIED test failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 4: HIRED → Existing employee enriched
    console.log("Test 4: HIRED (enrich existing employee)");
    try {
      // First, create onboarding record
      await db.onboardingRecord.create({
        data: {
          userId: testUserId,
          applicationId: testApplicationId,
          roleTitle: testJobPosting.title,
          status: "verified",
          doj: new Date(),
          department: "engineering",
        },
      });

      const result = await handleFrappeApplicationHired({
        db,
        client,
        applicationId: testApplicationId,
        candidateId: testUserId,
        correlationId: "phase3-test-hired",
      });

      if (result.triggered && result.upsertResult?.success) {
        logTest(
          "Test 4: HIRED",
          "PASS",
          `Frappe employee enriched: ${result.upsertResult.employeeName}`,
          undefined,
          {
            employeeName: result.upsertResult.employeeName,
            action: result.upsertResult.action,
          },
        );
      } else {
        logTest(
          "Test 4: HIRED",
          "FAIL",
          "Failed to enrich Frappe employee",
          result.upsertResult?.error || "Unknown error",
        );
      }
    } catch (error) {
      logTest(
        "Test 4: HIRED",
        "FAIL",
        "HIRED test failed with error",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 5: Duplicate HIRED → Idempotent
    console.log("Test 5: Duplicate HIRED (idempotency)");
    try {
      const result = await handleFrappeApplicationHired({
        db,
        client,
        applicationId: testApplicationId,
        candidateId: testUserId,
        correlationId: "phase3-test-hired-duplicate",
      });

      if (result.triggered && result.upsertResult?.success) {
        logTest(
          "Test 5: Duplicate HIRED",
          "PASS",
          "Duplicate HIRED handled correctly (idempotent)",
          undefined,
          {
            action: result.upsertResult.action,
            employeeName: result.upsertResult.employeeName,
          },
        );
      } else if (!result.triggered && result.reason === "already_completed") {
        logTest(
          "Test 5: Duplicate HIRED",
          "PASS",
          "Duplicate HIRED event detected (already completed)",
          undefined,
          { reason: result.reason },
        );
      } else {
        logTest(
          "Test 5: Duplicate HIRED",
          "FAIL",
          "Duplicate HIRED should not fail",
          result.upsertResult?.error || "Unknown error",
        );
      }
    } catch (error) {
      logTest(
        "Test 5: Duplicate HIRED",
        "FAIL",
        "Duplicate HIRED test failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Test 6: Database state verification
    console.log("Test 6: Database state verification");
    try {
      const application = await db.jobApplication.findUnique({
        where: { id: testApplicationId },
        select: {
          frappeEmployeeName: true,
          frappeProvisioningState: true,
          frappeRecordStatus: true,
        },
      });

      if (
        application?.frappeEmployeeName === testEmployeeName &&
        (application.frappeProvisioningState === "succeeded" ||
          application.frappeProvisioningState === "needs_manual_review") &&
        application.frappeRecordStatus === "ACTIVE"
      ) {
        logTest(
          "Test 6: Database State",
          "PASS",
          "Frappe employee name persisted correctly in database",
          undefined,
          {
            frappeEmployeeName: application.frappeEmployeeName,
            frappeProvisioningState: application.frappeProvisioningState,
            frappeRecordStatus: application.frappeRecordStatus,
          },
        );
      } else {
        logTest(
          "Test 6: Database State",
          "FAIL",
          "Database state incorrect",
          `Expected ${testEmployeeName}, got ${application?.frappeEmployeeName}`,
        );
      }
    } catch (error) {
      logTest(
        "Test 6: Database State",
        "FAIL",
        "Database verification failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  } catch (error) {
    console.error("Test setup failed:", error);
  } finally {
    // Cleanup
    console.log("Cleanup: Removing test data");
    try {
      if (testEmployeeName) {
        await client.terminateEmployee(testEmployeeName, new Date().toISOString().split("T")[0]);
        console.log(`✓ Marked Frappe employee ${testEmployeeName} as Left`);
      }

      if (testApplicationId) {
        await db.onboardingRecord.deleteMany({ where: { applicationId: testApplicationId } });
        await db.integrationEvent.deleteMany({ where: { entityId: testApplicationId } });
        await db.jobApplication.delete({ where: { id: testApplicationId } });
        console.log(`✓ Deleted test application`);
      }

      if (testUserId) {
        await db.employee.deleteMany({ where: { userId: testUserId } });
        await db.users.delete({ where: { id: testUserId } });
        console.log(`✓ Deleted test user`);
      }
    } catch (cleanupError) {
      console.error("Cleanup failed:", cleanupError);
    }

    // No need to disconnect - getAdminDb() manages the connection
    printSummary();
  }
}

main().catch(console.error);
