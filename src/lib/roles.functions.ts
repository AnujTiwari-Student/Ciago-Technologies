import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

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

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRolesPayload> => {
    // Use adminDb to bypass RLS — user's own role must always be readable
    const adminDb = getAdminDb();
    const rows = await adminDb.userRole.findMany({
      where: { userId: context.userId },
      select: { role: true, departmentId: true },
    });

    const roles = new Set(rows.map((r) => r.role));
    const isAdmin = roles.has("admin");
    const departmentId = rows.find((r) => r.departmentId)?.departmentId ?? null;
    return {
      isAdmin,
      isHr: isAdmin,
      isManager: false,
      isEmployee: false,
      isStaff: isAdmin,
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

    const roles = new Set(roleRows.map((r) => r.role));
    const isAdmin = roles.has("admin");

    return {
      userId: context.userId,
      isAdmin,
      isHr: isAdmin,
      isManager: false,
      isEmployee: false,
      hasPreDojOnboarding: onboardingRows.length > 0,
    };
  });
