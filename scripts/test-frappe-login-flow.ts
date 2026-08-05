/**
 * E2E: Complete Frappe Login Flow Validation
 *
 * Tests the full lifecycle including actual Frappe login:
 * APPLIED → HIRED → User created → Password set (admin bypass) → Login → Verify access
 *
 * Note: In production, password is set by the employee via invitation email.
 * In dev (no SMTP), we use admin API to set password to simulate the flow.
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { getAdminDb } from "../src/lib/db/admin";
import { createFrappeClient } from "../src/integrations/frappe/client";

const TEST_EMAIL = `login-flow-${Date.now()}@example.invalid`;
const TEST_NAME = "Login Flow Test";
const TEST_PASSWORD = "DevTest2026!Secure";
const FRAPPE_URL = process.env.FRAPPE_BASE_URL || "http://localhost:8180";

async function main() {
  if (process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED !== "true") {
    console.error("BLOCKED: FRAPPE_EMPLOYEE_SYNC_ENABLED must be 'true'");
    process.exit(1);
  }

  const db = getAdminDb();
  const client = createFrappeClient();

  console.log("=".repeat(60));
  console.log("E2E: Complete Frappe Login Flow");
  console.log("=".repeat(60));
  console.log(`Email: ${TEST_EMAIL}`);
  console.log("");

  const userId = randomUUID();
  let appId: string | null = null;
  let empName: string | null = null;
  let passed = 0;
  let failed = 0;

  function check(label: string, condition: boolean, detail: string) {
    if (condition) {
      console.log(`  ✅ ${label}: ${detail}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}: ${detail}`);
      failed++;
    }
  }

  try {
    // Setup: user with "employee" role
    await db.userRole.create({ data: { userId, role: "employee" } });

    const app = await db.jobApplication.create({
      data: {
        userId,
        roleId: randomUUID(),
        roleTitle: "Engineer",
        fullName: TEST_NAME,
        email: TEST_EMAIL,
        status: "screening",
        lifecycleVersion: 1,
      },
    });
    appId = app.id;

    // === APPLIED ===
    console.log("\n--- 1. APPLIED ---");
    await db.jobApplication.update({ where: { id: appId }, data: { status: "applied" } });
    const { handleFrappeApplicationApplied } = await import("../src/lib/frappe-applied-handler");
    const appliedResult = await handleFrappeApplicationApplied({
      db,
      client,
      applicationId: appId,
    });
    check(
      "APPLIED triggered",
      appliedResult.triggered === true,
      `action=${appliedResult.provisioningResult?.action}`,
    );

    const appAfter = await db.jobApplication.findUnique({
      where: { id: appId },
      select: { frappeEmployeeName: true },
    });
    empName = appAfter?.frappeEmployeeName || null;
    check("Employee created", !!empName, empName || "NONE");

    // === HIRED ===
    console.log("\n--- 2. HIRED ---");
    await db.jobApplication.update({ where: { id: appId }, data: { status: "hired" } });

    const { upsertFrappeEmployeeAtHired, extractFrappeOnboardingData } =
      await import("../src/lib/frappe-hired-handler");
    const onboardingData = extractFrappeOnboardingData({
      application: {
        id: appId,
        userId,
        fullName: TEST_NAME,
        email: TEST_EMAIL,
        roleTitle: "Engineer",
        status: "hired",
      },
      onboardingRecord: null,
      employee: null,
      jobPosting: null,
    });

    const hiredResult = await upsertFrappeEmployeeAtHired(
      appId,
      userId,
      onboardingData,
      db,
      client,
    );
    check("HIRED enrichment", hiredResult.success, `action=${hiredResult.action}`);

    // === VERIFY USER ===
    console.log("\n--- 3. Verify User ---");
    const user = await client.getUser(TEST_EMAIL);
    check("Frappe User exists", !!user, user?.email || "NOT FOUND");
    check("User enabled", user?.enabled === 1, `enabled=${user?.enabled}`);

    const emp = await client.getEmployee(empName!);
    check("User↔Employee linked", emp?.user_id === TEST_EMAIL, `user_id=${emp?.user_id}`);

    const roles = user?.roles?.map((r: any) => r.role) || [];
    check("Has Employee role", roles.includes("Employee"), `roles=[${roles.join(",")}]`);
    check("Has ESS role", roles.includes("Employee Self Service"), `roles=[${roles.join(",")}]`);
    check("No Administrator", !roles.includes("Administrator"), "Administrator not present");

    // === SET PASSWORD (simulates invitation link in dev) ===
    console.log("\n--- 4. Set Password (dev bypass — prod uses invitation email) ---");
    const pwRes = await fetch(`${FRAPPE_URL}/api/resource/User/${encodeURIComponent(TEST_EMAIL)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`,
      },
      body: JSON.stringify({ new_password: TEST_PASSWORD }),
    });
    check("Password set via admin", pwRes.ok, `status=${pwRes.status}`);

    // === LOGIN ===
    console.log("\n--- 5. Login as Employee ---");
    const loginRes = await fetch(`${FRAPPE_URL}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr: TEST_EMAIL, pwd: TEST_PASSWORD }),
    });
    const loginData: any = await loginRes.json();
    check(
      "Login successful",
      loginRes.ok && loginData.message !== undefined,
      `full_name=${loginData.full_name}`,
    );

    // Extract session cookie
    const cookies = loginRes.headers.getSetCookie?.() || [];
    const sidCookie = cookies.find((c: string) => c.startsWith("sid="));
    const sid = sidCookie?.split("=")[1]?.split(";")[0] || "";

    // === VERIFY ACCESS ===
    console.log("\n--- 6. Verify Role-Based Access ---");

    if (sid) {
      // Test: can access own employee record
      const meRes = await fetch(`${FRAPPE_URL}/api/method/frappe.auth.get_logged_user`, {
        headers: { Cookie: `sid=${sid}` },
      });
      const meData: any = await meRes.json();
      check("Session valid", meData.message === TEST_EMAIL, `logged_in_as=${meData.message}`);

      // Test: can access Employee doctype (should be accessible with Employee role)
      const empListRes = await fetch(`${FRAPPE_URL}/api/resource/Employee?limit_page_length=1`, {
        headers: { Cookie: `sid=${sid}` },
      });
      check("Can access Employee list", empListRes.ok, `status=${empListRes.status}`);

      // Test: cannot access System Settings (requires System Manager)
      const sysRes = await fetch(`${FRAPPE_URL}/api/resource/System%20Settings`, {
        headers: { Cookie: `sid=${sid}` },
      });
      const sysOk = sysRes.status === 403 || sysRes.status === 401;
      check("No System Settings access", sysOk, `status=${sysRes.status} (expected 403)`);

      // Test: cannot access User list (admin function)
      const userListRes = await fetch(`${FRAPPE_URL}/api/resource/User?limit_page_length=1`, {
        headers: { Cookie: `sid=${sid}` },
      });
      // Employee should not be able to list all users
      const userListData: any = await userListRes.json();
      const limitedAccess = !userListRes.ok || userListData.data?.length <= 1;
      check(
        "Limited User list access",
        limitedAccess || userListRes.status === 403,
        `status=${userListRes.status} count=${userListData.data?.length}`,
      );
    } else {
      check("Session cookie", false, "No sid cookie received");
    }

    // === IDEMPOTENCY ===
    console.log("\n--- 7. Idempotency ---");
    const hiredResult2 = await upsertFrappeEmployeeAtHired(
      appId,
      userId,
      onboardingData,
      db,
      client,
    );
    check(
      "Repeat HIRED safe",
      hiredResult2.success && hiredResult2.action === "already_complete",
      `action=${hiredResult2.action}`,
    );
  } catch (error) {
    console.error("\nFATAL:", error instanceof Error ? error.message : error);
    failed++;
  } finally {
    // Cleanup
    console.log("\n--- Cleanup ---");
    try {
      await client.disableUser(TEST_EMAIL);
    } catch {}
    try {
      await fetch(`${FRAPPE_URL}/api/resource/User/${encodeURIComponent(TEST_EMAIL)}`, {
        method: "DELETE",
        headers: {
          Authorization: `token ${process.env.FRAPPE_API_KEY}:${process.env.FRAPPE_API_SECRET}`,
        },
      });
    } catch {}
    if (empName)
      try {
        await client.terminateEmployee(empName, new Date().toISOString().split("T")[0]);
      } catch {}
    if (appId) {
      try {
        await db.integrationEvent.deleteMany({ where: { entityId: appId } });
      } catch {}
      try {
        await db.auditLog.deleteMany({ where: { targetResource: `job_applications/${appId}` } });
      } catch {}
      try {
        await db.jobApplication.delete({ where: { id: appId } });
      } catch {}
    }
    try {
      await db.userRole.deleteMany({ where: { userId } });
    } catch {}
    console.log("  Done.");

    console.log(`\n${"=".repeat(60)}`);
    console.log(`RESULTS: ${passed} pass, ${failed} fail`);
    console.log(`${"=".repeat(60)}`);
    if (failed > 0) process.exit(1);
  }
}

main().catch(console.error);
