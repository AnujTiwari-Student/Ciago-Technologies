/**
 * Server functions for OrangeHRM integration.
 * Handles salary fetch and ESS provisioning.
 */

import { createServerFn } from "@tanstack/start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import { getActorRoles } from "@/lib/roles.functions";

async function assertAdmin(db: any, userId: string) {
  const roles = await getActorRoles(db, userId);
  if (!roles.isAdmin) {
    throw new Error("Forbidden: Admin access required");
  }
}

const fetchSalarySchema = z.object({
  user_id: z.string().uuid(),
});

export const fetchOrangeHRMSalary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => fetchSalarySchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);

    const { isOrangeHRMSalarySyncEnabled } = await import("@/lib/feature-flags.server");
    const salaryEnabled = await isOrangeHRMSalarySyncEnabled();

    if (!salaryEnabled) {
      return null;
    }

    const adminDb = getAdminDb();
    const employee = await adminDb.employee.findUnique({
      where: { userId: data.user_id },
      select: { orangehrmEmployeeId: true },
    });

    if (!employee?.orangehrmEmployeeId) {
      return null;
    }

    try {
      const { getOrangeHRMClient } = await import("@/integrations/orangehrm/client");
      const client = getOrangeHRMClient();

      const salaryComponents = await client.getSalary(employee.orangehrmEmployeeId);

      if (!salaryComponents || salaryComponents.length === 0) {
        return null;
      }

      // Get the primary/base salary component
      const baseSalary = salaryComponents[0];

      return {
        amount: parseFloat(baseSalary.amount),
        currency: baseSalary.currencyType?.id || baseSalary.currencyId || "INR",
        component: baseSalary.salaryComponent?.name || "Base Salary",
        payFrequency: baseSalary.payFrequency?.name || null,
      };
    } catch (error: unknown) {
      console.error("[orangehrm] Salary fetch failed:", error);
      return null;
    }
  });

const createESSAccountSchema = z.object({
  user_id: z.string().uuid(),
});

export const createOrangeHRMESSAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createESSAccountSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);

    const { isOrangeHRMProvisioningEnabled } = await import("@/lib/feature-flags.server");
    const provisioningEnabled = await isOrangeHRMProvisioningEnabled();

    if (!provisioningEnabled) {
      throw new Error("OrangeHRM ESS provisioning is not enabled");
    }

    const adminDb = getAdminDb();
    const [employee, profile] = await Promise.all([
      adminDb.employee.findUnique({
        where: { userId: data.user_id },
        select: { orangehrmEmployeeId: true, workEmail: true, personalEmail: true },
      }),
      adminDb.profile.findUnique({
        where: { userId: data.user_id },
        select: { fullName: true },
      }),
    ]);

    if (!employee?.orangehrmEmployeeId) {
      throw new Error("Employee not found in OrangeHRM");
    }

    const email = employee.workEmail || employee.personalEmail;
    if (!email) {
      throw new Error("Employee email not found");
    }

    try {
      const { getOrangeHRMClient } = await import("@/integrations/orangehrm/client");
      const client = getOrangeHRMClient();

      // Generate username from email (before @)
      const username = email.split("@")[0];

      // Generate temporary password
      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

      // ESS role ID is typically 2 in OrangeHRM
      const essRoleId = 2;

      const ohrUser = await client.createUser({
        username,
        password: tempPassword,
        status: true,
        userRoleId: essRoleId,
        empNumber: employee.orangehrmEmployeeId,
      });

      await adminDb.auditLog.create({
        data: {
          actorId: context.userId,
          actorEmail: (context.claims as any)?.email ?? null,
          action: "ORANGEHRM_ESS_ACCOUNT_CREATED",
          targetResource: `employees/${data.user_id}`,
          details: {
            orangehrm_user_id: ohrUser.id,
            username,
            employee_name: profile?.fullName,
          },
        },
      });

      // TODO: Send email with credentials via Resend (Phase 9)

      return {
        success: true,
        username,
        tempPassword,
        userId: ohrUser.id,
      };
    } catch (error: unknown) {
      console.error("[orangehrm] ESS account creation failed:", error);

      await adminDb.auditLog.create({
        data: {
          actorId: context.userId,
          actorEmail: (context.claims as any)?.email ?? null,
          action: "ORANGEHRM_ESS_ACCOUNT_CREATION_FAILED",
          targetResource: `employees/${data.user_id}`,
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        },
      });

      throw new Error(
        `Failed to create ESS account: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  });
