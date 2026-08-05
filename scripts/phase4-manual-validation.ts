/**
 * Phase 4: Manual Validation - APPLIED → HIRED Lifecycle
 *
 * This test validates the complete lifecycle with Frappe integration ENABLED.
 * Must be run with FRAPPE_EMPLOYEE_SYNC_ENABLED=true in environment.
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
  data?: any;
}

const results: TestResult[] = [];

function logTest(
  name: string,
  status: "PASS" | "FAIL",
  message: string,
  error?: string,
  data?: any,
) {
  const result: TestResult = { name, status, message, error, data };
  results.push(result);

  const icon = status === "PASS" ? "✓" : "✗";
  const color = status === "PASS" ? "\x1b[32m" : "\x1b[31m";
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

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 4 MANUAL VALIDATION - APPLIED → HIRED");
  console.log("=".repeat(60));
  console.log(
    `Environment: FRAPPE_EMPLOYEE_SYNC_ENABLED=${process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED}\n`,
  );

  if (process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED !== "true") {
    console.error("❌ ABORT: Must run with FRAPPE_EMPLOYEE_SYNC_ENABLED=true");
    process.exit(1);
  }

  const client = createFrappeClient();
  let testApplicationId: string | null = null;
  let testUserId: string = randomUUID();
  let frappeEmployeeName: string | null = null;

  try {
    // Find a published job posting
    const jobPosting = await db.jobPosting.findFirst({
      where: { status: "published" },
      select: { id: true, title: true },
    });

    if (!jobPosting) {
      console.error("❌ No published job posting found. Creating minimal test job...");
      const testJob = await db.jobPosting.create({
        data: {
          id: randomUUID(),
          title: "Phase4 Test Engineer",
          department: "Engineering",
          status: "published",
          description: "Test job for Phase 4 validation",
        },
      });
      console.log(`✓ Created test job: ${testJob.title}\n`);
    }

    const roleId =
      jobPosting?.id || (await db.jobPosting.findFirst({ where: { status: "published" } }))!.id;
    const roleTitle = jobPosting?.title || "Test Engineer";

    // Create test application
    const timestamp = Date.now();
    const testEmail = `phase4-test-${timestamp}@example.invalid`;

    console.log("Step 1: Creating test application...");
    const application = await db.jobApplication.create({
      data: {
        userId: testUserId,
        roleId,
        roleTitle,
        fullName: "Phase4 Test Candidate",
        email: testEmail,
        status: "screening",
      },
    });
    testApplicationId = application.id;
    console.log(`✓ Application created: ${testApplicationId.slice(0, 8)}\n`);

    // TEST 1: APPLIED → Frappe Employee Creation
    console.log("Test 1: APPLIED → Create Frappe Employee");
    try {
      // Update to APPLIED status
      await db.jobApplication.update({
        where: { id: testApplicationId },
        data: { status: "applied" },
      });

      const result = await handleFrappeApplicationApplied({
        db,
        client,
        applicationId: testApplicationId,
        correlationId: "phase4-validation-applied",
      });

      if (result.triggered && result.provisioningResult?.success) {
        frappeEmployeeName = result.provisioningResult.employeeName;
        logTest(
          "Test 1: APPLIED",
          "PASS",
          `Frappe employee created: ${frappeEmployeeName}`,
          undefined,
          {
            action: result.provisioningResult.action,
            employeeName: frappeEmployeeName,
          },
        );
      } else {
        logTest(
          "Test 1: APPLIED",
          "FAIL",
          "Failed to create Frappe employee",
          result.provisioningResult?.error || "Unknown error",
          result,
        );
      }
    } catch (error) {
      logTest(
        "Test 1: APPLIED",
        "FAIL",
        "APPLIED test threw error",
        error instanceof Error ? error.message : String(error),
      );
    }

    // TEST 2: Verify Frappe Employee exists
    if (frappeEmployeeName) {
      console.log("Test 2: Verify Frappe Employee in live instance");
      try {
        const employee = await client.getEmployee(frappeEmployeeName);

        if (employee) {
          logTest(
            "Test 2: Frappe Employee Exists",
            "PASS",
            `Employee ${frappeEmployeeName} found in Frappe`,
            undefined,
            {
              name: employee.name,
              first_name: employee.first_name,
              last_name: employee.last_name,
              status: employee.status,
              company: employee.company,
            },
          );
        } else {
          logTest(
            "Test 2: Frappe Employee Exists",
            "FAIL",
            `Employee ${frappeEmployeeName} not found in Frappe`,
          );
        }
      } catch (error) {
        logTest(
          "Test 2: Frappe Employee Exists",
          "FAIL",
          "Failed to retrieve employee from Frappe",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // TEST 3: Verify database state
    console.log("Test 3: Verify database state");
    try {
      const app = await db.jobApplication.findUnique({
        where: { id: testApplicationId },
        select: {
          frappeEmployeeName: true,
          frappeProvisioningState: true,
          frappeProvisioningSucceededAt: true,
        },
      });

      if (
        app?.frappeEmployeeName === frappeEmployeeName &&
        (app?.frappeProvisioningState === "succeeded" ||
          app?.frappeProvisioningState === "needs_manual_review") &&
        app?.frappeProvisioningSucceededAt !== null
      ) {
        logTest(
          "Test 3: Database State",
          "PASS",
          `Application database state correct (state=${app.frappeProvisioningState})`,
          undefined,
          {
            frappeEmployeeName: app.frappeEmployeeName,
            state: app.frappeProvisioningState,
          },
        );
      } else {
        logTest(
          "Test 3: Database State",
          "FAIL",
          "Application database state incorrect",
          `Expected: employeeName=${frappeEmployeeName}, state=succeeded/needs_manual_review, Got: ${JSON.stringify(app)}`,
        );
      }
    } catch (error) {
      logTest(
        "Test 3: Database State",
        "FAIL",
        "Failed to check database state",
        error instanceof Error ? error.message : String(error),
      );
    }

    // TEST 4: Idempotency - Repeat APPLIED
    console.log("Test 4: Idempotency - Repeat APPLIED");
    try {
      const result = await handleFrappeApplicationApplied({
        db,
        client,
        applicationId: testApplicationId,
        correlationId: "phase4-validation-applied-duplicate",
      });

      // Should skip because already completed
      if (!result.triggered && result.reason === "already_completed") {
        logTest(
          "Test 4: APPLIED Idempotency",
          "PASS",
          "Duplicate APPLIED correctly skipped (already completed)",
          undefined,
          { reason: result.reason },
        );
      } else if (result.triggered && result.provisioningResult?.action === "already_provisioned") {
        logTest(
          "Test 4: APPLIED Idempotency",
          "PASS",
          "Duplicate APPLIED correctly handled (already provisioned)",
          undefined,
          { action: result.provisioningResult.action },
        );
      } else {
        logTest(
          "Test 4: APPLIED Idempotency",
          "FAIL",
          "Duplicate APPLIED should not create new employee",
          undefined,
          result,
        );
      }
    } catch (error) {
      logTest(
        "Test 4: APPLIED Idempotency",
        "FAIL",
        "Idempotency test threw error",
        error instanceof Error ? error.message : String(error),
      );
    }

    // TEST 5: HIRED → Enrichment (simplified - minimal required data)
    console.log("Test 5: HIRED → Enrich Frappe Employee");
    try {
      // Update to HIRED status
      await db.jobApplication.update({
        where: { id: testApplicationId },
        data: { status: "hired" },
      });

      // Create minimal employee record (HIRED handler expects this)
      await db.employee.upsert({
        where: { userId: testUserId },
        create: {
          userId: testUserId,
          department: "engineering", // Use enum value
          designation: "Software Engineer",
          doj: new Date(),
        },
        update: {},
      });

      const result = await handleFrappeApplicationHired({
        db,
        client,
        applicationId: testApplicationId,
        candidateId: testUserId,
        correlationId: "phase4-validation-hired",
      });

      if (result.triggered && result.upsertResult?.success) {
        logTest(
          "Test 5: HIRED",
          "PASS",
          `Frappe employee enriched: ${result.upsertResult.employeeName}`,
          undefined,
          {
            action: result.upsertResult.action,
            employeeName: result.upsertResult.employeeName,
          },
        );
      } else {
        logTest(
          "Test 5: HIRED",
          "FAIL",
          "Failed to enrich Frappe employee",
          result.upsertResult?.error || "Unknown error",
          result,
        );
      }
    } catch (error) {
      logTest(
        "Test 5: HIRED",
        "FAIL",
        "HIRED test threw error",
        error instanceof Error ? error.message : String(error),
      );
    }

    // TEST 6: Cleanup
    console.log("Test 6: Cleanup");
    try {
      if (frappeEmployeeName) {
        // Terminate employee in Frappe
        await client.updateEmployee(frappeEmployeeName, {
          status: "Left",
          relieving_date: new Date().toISOString().split("T")[0],
        });
        console.log(`✓ Frappe employee ${frappeEmployeeName} terminated`);
      }

      // Delete test application
      await db.jobApplication.delete({ where: { id: testApplicationId } });
      console.log(`✓ Test application deleted`);

      // Delete test employee if exists
      try {
        await db.employee.delete({ where: { userId: testUserId } });
        console.log(`✓ Test employee record deleted`);
      } catch (e) {
        // May not exist
      }

      logTest("Test 6: Cleanup", "PASS", "Test data cleaned up successfully");
    } catch (error) {
      logTest(
        "Test 6: Cleanup",
        "FAIL",
        "Cleanup failed",
        error instanceof Error ? error.message : String(error),
      );
    }

    // Summary
    console.log("\n" + "=".repeat(60));
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
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
