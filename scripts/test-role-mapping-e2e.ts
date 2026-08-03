/**
 * E2E: Validate each CiagoTech role → Frappe role mapping against live Frappe
 * Tests: employee, manager, hr, admin/system_engineer/developer
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { getAdminDb } from "../src/lib/db/admin";
import { createFrappeClient } from "../src/integrations/frappe/client";
import type { AppRole } from "@prisma/client";

const db = getAdminDb();
const client = createFrappeClient();

interface RoleTestCase {
  label: string;
  ciagoRoles: AppRole[];
  expectedRoles: string[];
  forbiddenRoles: string[];
}

const TEST_CASES: RoleTestCase[] = [
  {
    label: "employee",
    ciagoRoles: ["employee"],
    expectedRoles: ["Employee", "Employee Self Service"],
    forbiddenRoles: ["Administrator", "System Manager", "HR Manager", "Leave Approver"],
  },
  {
    label: "manager",
    ciagoRoles: ["employee", "manager"],
    expectedRoles: ["Employee", "Employee Self Service", "Leave Approver", "Expense Approver"],
    forbiddenRoles: ["Administrator", "System Manager", "HR Manager"],
  },
  {
    label: "hr",
    ciagoRoles: ["employee", "hr"],
    expectedRoles: ["Employee", "Employee Self Service", "HR User", "HR Manager"],
    forbiddenRoles: ["Administrator", "System Manager"],
  },
  {
    label: "admin+system_engineer",
    ciagoRoles: ["employee", "admin", "system_engineer"],
    expectedRoles: ["Employee", "Employee Self Service", "System Manager"],
    forbiddenRoles: ["Administrator"],
  },
];

async function main() {
  const flagEnabled = process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED === "true";
  if (!flagEnabled) {
    console.error("BLOCKED: FRAPPE_EMPLOYEE_SYNC_ENABLED must be 'true'");
    process.exit(1);
  }

  console.log("=" .repeat(60));
  console.log("E2E: Role Mapping Validation Against Live Frappe");
  console.log("=" .repeat(60));

  let passed = 0;
  let failed = 0;

  for (const tc of TEST_CASES) {
    const email = `role-e2e-${tc.label}-${Date.now()}@example.invalid`;
    const userId = randomUUID();
    const fullName = `Role Test ${tc.label}`;
    let empName: string | null = null;

    console.log(`\n--- Testing: ${tc.label} (${tc.ciagoRoles.join(", ")}) ---`);

    try {
      // Create user roles in CiagoTech
      for (const role of tc.ciagoRoles) {
        await db.userRole.create({ data: { userId, role } });
      }

      // Create application
      const app = await db.jobApplication.create({
        data: {
          userId,
          roleId: randomUUID(),
          roleTitle: "Test",
          fullName,
          email,
          status: "applied",
          lifecycleVersion: 1,
        },
      });

      // APPLIED: create Frappe Employee
      const { handleFrappeApplicationApplied } = await import("../src/lib/frappe-applied-handler");
      await handleFrappeApplicationApplied({ db, client, applicationId: app.id });

      const appAfter = await db.jobApplication.findUnique({
        where: { id: app.id },
        select: { frappeEmployeeName: true },
      });
      empName = appAfter?.frappeEmployeeName || null;

      if (!empName) {
        console.log(`  ❌ Employee not created`);
        failed++;
        continue;
      }

      // HIRED: enrich + provision User
      await db.jobApplication.update({ where: { id: app.id }, data: { status: "hired" } });

      const { upsertFrappeEmployeeAtHired, extractFrappeOnboardingData } = await import(
        "../src/lib/frappe-hired-handler"
      );

      const onboardingData = extractFrappeOnboardingData({
        application: { id: app.id, userId, fullName, email, roleTitle: "Test", status: "hired" },
        onboardingRecord: null,
        employee: null,
        jobPosting: null,
      });

      await upsertFrappeEmployeeAtHired(app.id, userId, onboardingData, db, client);

      // Check roles in Frappe
      const user = await client.getUser(email);
      const actualRoles = user?.roles?.map((r: any) => r.role) || [];

      let allExpected = true;
      for (const expected of tc.expectedRoles) {
        if (!actualRoles.includes(expected)) {
          console.log(`  ❌ Missing expected role: ${expected}`);
          allExpected = false;
        }
      }

      let noForbidden = true;
      for (const forbidden of tc.forbiddenRoles) {
        if (actualRoles.includes(forbidden)) {
          console.log(`  ❌ FORBIDDEN role present: ${forbidden}`);
          noForbidden = false;
        }
      }

      if (allExpected && noForbidden) {
        console.log(`  ✅ Roles correct: [${actualRoles.join(", ")}]`);
        passed++;
      } else {
        console.log(`  ❌ Actual roles: [${actualRoles.join(", ")}]`);
        failed++;
      }

      // Cleanup
      await client.disableUser(email);
      await client.terminateEmployee(empName, new Date().toISOString().split("T")[0]);
      await db.integrationEvent.deleteMany({ where: { entityId: app.id } });
      await db.auditLog.deleteMany({ where: { targetResource: `job_applications/${app.id}` } });
      await db.jobApplication.delete({ where: { id: app.id } });
      await db.userRole.deleteMany({ where: { userId } });
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;

      // Attempt cleanup
      try { if (empName) await client.terminateEmployee(empName, new Date().toISOString().split("T")[0]); } catch {}
      try { await db.userRole.deleteMany({ where: { userId } }); } catch {}
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS: ${passed} pass, ${failed} fail (${TEST_CASES.length} total)`);
  console.log(`${"=".repeat(60)}`);

  if (failed > 0) process.exit(1);
}

main().catch(console.error);
