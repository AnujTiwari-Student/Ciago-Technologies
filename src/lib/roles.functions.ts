import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import type { AppRole } from "@prisma/client";
import { canAccessDashboard } from "@/lib/dashboard-access";

export type MyRoleRow = {
  role: string;
  department_id: string | null;
};

export type MyRolesPayload = {
  isAdmin: boolean;
  isHr: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isStaff: boolean;
  isDashboardUser: boolean;
  roles: AppRole[];
  departmentId: string | null;
};

export type MyEmployeeAccessPayload = {
  userId: string;
  isAdmin: boolean;
  isHr: boolean;
  isManager: boolean;
  isEmployee: boolean;
  hasPreDojOnboarding: boolean;
};

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRolesPayload> => {
    const adminDb = getAdminDb();
    const rows = await adminDb.userRole.findMany({
      where: { userId: context.userId },
      select: { role: true, departmentId: true },
    });

    const roles = rows.map((r) => r.role);
    const roleSet = new Set(roles);
    const isAdmin = roleSet.has("admin");
    const isHr = isAdmin || roleSet.has("hr");
    const isManager = roleSet.has("manager");
    const isEmployee = roleSet.has("employee");
    const departmentId = rows.find((r) => r.departmentId)?.departmentId ?? null;

    return {
      isAdmin,
      isHr,
      isManager,
      isEmployee,
      isStaff: isAdmin || isHr || isManager || isEmployee,
      isDashboardUser: canAccessDashboard(roles),
      roles,
      departmentId,
    };
  });

export const getMyAuthUserId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string> => {
    return context.userId;
  });

export const getMyEmployeeAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEmployeeAccessPayload> => {
    const adminDb = getAdminDb();
    const [roleRows, onboardingRows] = await Promise.all([
      adminDb.userRole.findMany({
        where: { userId: context.userId },
        select: { role: true },
      }),
      adminDb.onboardingRecord.findMany({
        where: { userId: context.userId, status: { in: ["accepted", "submitted"] } },
        select: { id: true },
      }),
    ]);

    const roleSet = new Set(roleRows.map((r) => r.role));
    const isAdmin = roleSet.has("admin");

    return {
      userId: context.userId,
      isAdmin,
      isHr: isAdmin || roleSet.has("hr"),
      isManager: roleSet.has("manager"),
      isEmployee: roleSet.has("employee"),
      hasPreDojOnboarding: onboardingRows.length > 0,
    };
  });
