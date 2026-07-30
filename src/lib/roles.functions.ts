import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export type MY_ROLES_KEY = "admin" | "hr" | "manager" | "employee" | string;
const ROLE_PRIORITY: Record<string, number> = {
  admin: 4,
  hr: 3,
  manager: 2,
  employee: 1,
};

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRolesPayload> => {
    const rows = await context.db.withRLS((tx) =>
      tx.userRole.findMany({
        where: { userId: context.userId },
        select: { role: true, departmentId: true },
      }),
    );

    const roles = new Set(rows.map((r) => r.role));
    const isAdmin = roles.has("admin");
    const isHr = roles.has("hr");
    const isManager = roles.has("manager");
    const isEmployee = roles.has("employee");
    const departmentId =
      rows
        .filter((r) => r.departmentId)
        .sort((a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0))[0]
        ?.departmentId ?? null;
    return {
      isAdmin,
      isHr,
      isManager,
      isEmployee,
      isStaff: isAdmin || isHr || isManager || isEmployee,
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
    const [roleRows, onboardingRows] = await context.db.withRLS((tx) =>
      Promise.all([
        tx.userRole.findMany({
          where: { userId: context.userId },
          select: { role: true },
        }),
        tx.onboardingRecord.findMany({
          where: { userId: context.userId, status: { in: ["accepted", "submitted"] } },
          select: { id: true },
        }),
      ]),
    );

    const roles = new Set(roleRows.map((r) => r.role));
    const isAdmin = roles.has("admin");
    const isHr = roles.has("hr");
    const isManager = roles.has("manager");
    const isEmployee = roles.has("employee");

    return {
      userId: context.userId,
      isAdmin,
      isHr,
      isManager,
      isEmployee,
      hasPreDojOnboarding: onboardingRows.length > 0,
    };
  });
