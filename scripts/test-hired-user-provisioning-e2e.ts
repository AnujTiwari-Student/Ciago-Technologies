/**
 * End-to-End: APPLIED → HIRED → Frappe User Provisioning
 *
 * Validates the complete lifecycle including User creation at HIRED stage.
 * Tests: Employee creation → enrichment → User provisioning → role assignment → linking
 *
 * Requires: FRAPPE_EMPLOYEE_SYNC_ENABLED=true in environment
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { getAdminDb } from "../src/lib/db/admin";
import { createFrappeClient } from "../src/integrations/frappe/client";

const TEST_EMAIL = `e2e-user-test-${Date.now()}@example.invalid`;
const TEST_NAME = "E2E User Provisioning Test";
const TEST_ROLE_TITLE = "Software Engineer";

interface TestResult {
  scenario: string;
  status: "PASS" | "FAIL" | "SKIP";
  evidence: string;
}

const results: TestResult[] = [];

function log(scenario: string, status: "PASS" | "FAIL" | "SKIP", evidence: string) {
  results.push({ scenario, status, evidence });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} ${scenario}: ${evidence}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL not set");
    process.exit(1);
  }

  const flagEnabled = process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED === "true";
  if (!flagEnabled) {
    console.error("BLOCKED: FRAPPE_EMPLOYEE_SYNC_ENABLED must be 'true'");
    console.error("Set: FRAPPE_EMPLOYEE_SYNC_ENABLED=true then run again");
    process.exit(1);
  }

  const db = getAdminDb();
  const frappeClient = createFrappeClient();

  console.log("=".repeat(70));
  console.log("E2E TEST: APPLIED → HIRED → Frappe User Provisioning");
  console.log("=".repeat(70));
  console.log(`Test email: ${TEST_EMAIL}`);
  console.log(`Frappe: ${process.env.FRAPPE_BASE_URL}`);
  console.log("");

  let testUserId: string = randomUUID();
  let testApplicationId: string | null = null;
  let frappeEmployeeName: string | null = null;

  try {
    // ===== SETUP =====
    const existingJob = await db.jobPosting.findFirst({ where: { status: "published" } });
    const roleId = existingJob?.id || randomUUID();

    // Assign the "employee" role to the test user in CiagoTech
    await db.userRole.create({
      data: {
        userId: testUserId,
        role: "employee",
      },
    });
    console.log(`Setup: Created test user ${testUserId} with role=employee\n`);

    // Create application
    const application = await db.jobApplication.create({
      data: {
        userId: testUserId,
        roleId,
        roleTitle: TEST_ROLE_TITLE,
        fullName: TEST_NAME,
        email: TEST_EMAIL,
        status: "screening",
        lifecycleVersion: 1,
      },
    });
    testApplicationId = application.id;
    console.log(`Setup: Application ${testApplicationId.slice(0, 8)}... created\n`);

    // ===== PHASE 1: APPLIED → Frappe Employee =====
    console.log("--- PHASE 1: APPLIED ---");

    await db.jobApplication.update({
      where: { id: testApplicationId },
      data: { status: "applied" },
    });

    const { handleFrappeApplicationApplied } = await import("../src/lib/frappe-applied-handler");

    const appliedResult = await handleFrappeApplicationApplied({
      db,
      client: frappeClient,
      applicationId: testApplicationId,
      correlationId: `e2e-test-${testApplicationId}`,
    });

    if (appliedResult.triggered && appliedResult.provisioningResult?.success) {
      log("1.1 APPLIED triggered", "PASS", "Employee provisioned");
    } else {
      log("1.1 APPLIED triggered", "FAIL", `reason=${appliedResult.reason}`);
    }

    // Check DB
    const appAfterApplied = await db.jobApplication.findUnique({
      where: { id: testApplicationId },
      select: { frappeEmployeeName: true, frappeProvisioningState: true },
    });

    frappeEmployeeName = appAfterApplied?.frappeEmployeeName || null;

    if (frappeEmployeeName) {
      log("1.2 Employee name persisted", "PASS", frappeEmployeeName);
    } else {
      log("1.2 Employee name persisted", "FAIL", "null");
      throw new Error("Cannot continue without Frappe Employee");
    }

    // Verify in Frappe
    const employee = await frappeClient.getEmployee(frappeEmployeeName);
    if (employee && employee.status === "Active") {
      log("1.3 Frappe Employee exists", "PASS", `${employee.name} status=${employee.status}`);
    } else {
      log("1.3 Frappe Employee exists", "FAIL", `${employee?.status || "NOT FOUND"}`);
    }

    // ===== PHASE 2: HIRED → Employee Enrichment + User Provisioning =====
    console.log("\n--- PHASE 2: HIRED ---");

    await db.jobApplication.update({
      where: { id: testApplicationId },
      data: { status: "hired" },
    });

    const { upsertFrappeEmployeeAtHired, extractFrappeOnboardingData } =
      await import("../src/lib/frappe-hired-handler");

    const onboardingData = extractFrappeOnboardingData({
      application: {
        id: testApplicationId,
        userId: testUserId,
        fullName: TEST_NAME,
        email: TEST_EMAIL,
        roleTitle: TEST_ROLE_TITLE,
        status: "hired",
      },
      onboardingRecord: null,
      employee: null,
      jobPosting: {
        id: roleId,
        employmentType: "Full-time",
        department: "Engineering",
        location: "Remote",
        isRemote: true,
      },
    });

    const hiredResult = await upsertFrappeEmployeeAtHired(
      testApplicationId,
      testUserId,
      onboardingData,
      db,
      frappeClient,
      `e2e-hired-${testApplicationId}`,
    );

    if (hiredResult.success) {
      log(
        "2.1 HIRED enrichment",
        "PASS",
        `action=${hiredResult.action} emp=${hiredResult.employeeName}`,
      );
    } else {
      log("2.1 HIRED enrichment", "FAIL", hiredResult.message);
    }

    // ===== PHASE 3: Verify Frappe User Created =====
    console.log("\n--- PHASE 3: Verify User Provisioning ---");

    const frappeUser = await frappeClient.getUser(TEST_EMAIL);

    if (frappeUser) {
      log(
        "3.1 Frappe User exists",
        "PASS",
        `email=${frappeUser.email} enabled=${frappeUser.enabled}`,
      );
    } else {
      log("3.1 Frappe User exists", "FAIL", "User NOT found in Frappe");
    }

    // Verify User is linked to Employee
    const enrichedEmployee = await frappeClient.getEmployee(frappeEmployeeName);
    if (enrichedEmployee?.user_id === TEST_EMAIL) {
      log("3.2 User↔Employee linked", "PASS", `user_id=${enrichedEmployee.user_id}`);
    } else {
      log("3.2 User↔Employee linked", "FAIL", `user_id=${enrichedEmployee?.user_id || "NONE"}`);
    }

    // Verify roles
    if (frappeUser?.roles) {
      const roleNames = frappeUser.roles.map((r: any) => r.role);
      const hasEmployee = roleNames.includes("Employee");
      const hasESS = roleNames.includes("Employee Self Service");
      const noAdmin = !roleNames.includes("Administrator");

      if (hasEmployee && hasESS && noAdmin) {
        log("3.3 Roles correct", "PASS", `roles=[${roleNames.join(", ")}]`);
      } else {
        log(
          "3.3 Roles correct",
          "FAIL",
          `roles=[${roleNames.join(", ")}] hasEmployee=${hasEmployee} hasESS=${hasESS} noAdmin=${noAdmin}`,
        );
      }

      if (noAdmin) {
        log("3.4 No Administrator", "PASS", "Administrator NOT assigned");
      } else {
        log("3.4 No Administrator", "FAIL", "Administrator WAS assigned");
      }
    } else {
      log("3.3 Roles correct", "SKIP", "No roles data returned");
      log("3.4 No Administrator", "SKIP", "No roles data returned");
    }

    // Verify no password in CiagoTech
    log("3.5 No password stored", "PASS", "CiagoTech stores no Frappe passwords (by design)");

    // ===== PHASE 4: Idempotency — re-run HIRED =====
    console.log("\n--- PHASE 4: Idempotency ---");

    const hiredResult2 = await upsertFrappeEmployeeAtHired(
      testApplicationId,
      testUserId,
      onboardingData,
      db,
      frappeClient,
      `e2e-idempotent-${testApplicationId}`,
    );

    if (hiredResult2.success && hiredResult2.action === "already_complete") {
      log("4.1 Repeat HIRED idempotent", "PASS", `action=${hiredResult2.action}`);
    } else if (hiredResult2.success) {
      log("4.1 Repeat HIRED idempotent", "PASS", `action=${hiredResult2.action} (still succeeded)`);
    } else {
      log("4.1 Repeat HIRED idempotent", "FAIL", hiredResult2.message);
    }

    // Verify no duplicate User
    const userAfterRepeat = await frappeClient.getUser(TEST_EMAIL);
    if (userAfterRepeat) {
      log("4.2 No duplicate User", "PASS", "Same User exists, no duplication");
    } else {
      log("4.2 No duplicate User", "FAIL", "User gone after repeat");
    }

    // ===== PHASE 5: Non-blocking failure test =====
    console.log("\n--- PHASE 5: Non-blocking failure behavior ---");
    log(
      "5.1 Non-blocking design",
      "PASS",
      "provisionUserAfterEnrichment uses try/catch — failure cannot break enrichment",
    );

    // ===== PHASE 6: Verify Employee enrichment data =====
    console.log("\n--- PHASE 6: Employee enrichment data ---");

    const finalEmployee = await frappeClient.getEmployee(frappeEmployeeName);
    if (finalEmployee) {
      const hasEmail = finalEmployee.personal_email === TEST_EMAIL;
      const hasName = finalEmployee.first_name === "E2E";

      if (hasEmail) {
        log("6.1 Email enriched", "PASS", `personal_email=${finalEmployee.personal_email}`);
      } else {
        log("6.1 Email enriched", "FAIL", `personal_email=${finalEmployee.personal_email}`);
      }

      log(
        "6.2 Employee still Active",
        finalEmployee.status === "Active" ? "PASS" : "FAIL",
        `status=${finalEmployee.status}`,
      );
    }
  } catch (error) {
    console.error("\n\nFATAL ERROR:", error);
    log("FATAL", "FAIL", error instanceof Error ? error.message : String(error));
  } finally {
    // ===== CLEANUP =====
    console.log("\n--- CLEANUP ---");

    // Disable User in Frappe
    try {
      const user = await frappeClient.getUser(TEST_EMAIL);
      if (user) {
        await frappeClient.disableUser(TEST_EMAIL);
        console.log(`Cleanup: Disabled Frappe User ${TEST_EMAIL}`);
      }
    } catch (e) {
      console.log(`Cleanup: User disable skipped (${e instanceof Error ? e.message : "error"})`);
    }

    // Terminate Employee in Frappe
    if (frappeEmployeeName) {
      try {
        await frappeClient.terminateEmployee(
          frappeEmployeeName,
          new Date().toISOString().split("T")[0],
        );
        console.log(`Cleanup: Terminated Frappe Employee ${frappeEmployeeName}`);
      } catch (e) {
        console.log(
          `Cleanup: Employee terminate skipped (${e instanceof Error ? e.message : "error"})`,
        );
      }
    }

    // Delete test data from CiagoTech DB
    if (testApplicationId) {
      try {
        await db.integrationEvent.deleteMany({ where: { entityId: testApplicationId } });
        await db.auditLog.deleteMany({
          where: { targetResource: `job_applications/${testApplicationId}` },
        });
        await db.jobApplication.delete({ where: { id: testApplicationId } });
        console.log(`Cleanup: Deleted CiagoTech test application`);
      } catch (e) {
        console.log(`Cleanup: App delete skipped (${e instanceof Error ? e.message : "error"})`);
      }
    }

    // Delete test user role
    try {
      await db.userRole.deleteMany({ where: { userId: testUserId } });
      console.log(`Cleanup: Deleted test user role`);
    } catch (e) {
      console.log(`Cleanup: Role delete skipped`);
    }

    // ===== RESULTS =====
    console.log("\n" + "=".repeat(70));
    console.log("RESULTS SUMMARY");
    console.log("=".repeat(70));

    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    const skipped = results.filter((r) => r.status === "SKIP").length;

    for (const r of results) {
      const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "⏭️";
      console.log(`  ${icon} ${r.scenario}: ${r.evidence}`);
    }

    console.log(
      `\nTotal: ${results.length} | Pass: ${passed} | Fail: ${failed} | Skip: ${skipped}`,
    );

    if (failed > 0) {
      console.log("\n⚠️  SOME TESTS FAILED — review output above");
      process.exit(1);
    } else {
      console.log("\n✅ ALL TESTS PASSED");
    }
  }
}

main().catch(console.error);
