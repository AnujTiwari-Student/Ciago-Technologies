import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

// ============================================================
// Shared types
// ============================================================
export type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
};

export type StaffUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  role: "user" | "admin";
  department_id: string | null;
  department_name: string | null;
};

const STAFF_ROLES = ["admin"] as const;

async function assertAdmin(_db: any, userId: string) {
  const { getAdminDb } = await import("@/lib/db/admin");
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({ where: { userId, role: "admin" } });
  if (count === 0) throw new Error("Forbidden");
}

// ============================================================
// Departments
// ============================================================
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Department[]> => {
    const { getAdminDb } = await import("@/lib/db/admin");
    const adminDb = getAdminDb();
    const rows = await adminDb.department.findMany({
      select: { id: true, name: true, code: true, description: true },
      orderBy: { name: "asc" },
    });
    return rows as Department[];
  });

// ============================================================
// Staff directory (admin only)
// ============================================================
export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffUser[]> => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const [roles, depts, mappings, profiles] = await Promise.all([
      adminDb.userRole.findMany({
        where: { role: { in: STAFF_ROLES as any } },
        select: { userId: true, role: true, departmentId: true },
      }),
      adminDb.department.findMany({ select: { id: true, name: true } }),
      adminDb.clerkUserMap.findMany({
        select: { authUserId: true, email: true, createdAt: true },
      }),
      adminDb.profile.findMany({
        select: { userId: true, fullName: true },
      }),
    ]);

    const deptMap = new Map(depts.map((d) => [d.id, d.name]));
    const emailMap = new Map(mappings.map((m) => [m.authUserId, { email: m.email, createdAt: m.createdAt }]));
    const nameMap = new Map(profiles.map((p) => [p.userId, p.fullName]));

    const bestByUser = new Map<string, { role: string; department_id: string | null }>();
    for (const r of roles) {
      if (!bestByUser.has(r.userId)) {
        bestByUser.set(r.userId, { role: r.role, department_id: r.departmentId ?? null });
      }
    }

    const userIds = Array.from(new Set(roles.map((r) => r.userId)));
    return userIds.map((id): StaffUser => {
      const best = bestByUser.get(id);
      const role = (best?.role ?? "user") as StaffUser["role"];
      const department_id = best?.department_id ?? null;
      const info = emailMap.get(id);
      return {
        id,
        email: info?.email ?? null,
        created_at: info?.createdAt?.toISOString() ?? "",
        full_name: nameMap.get(id) ?? null,
        role,
        department_id,
        department_name: department_id ? (deptMap.get(department_id) ?? null) : null,
      };
    });
  });

// ============================================================
// Role assignment (admin only)
// ============================================================
const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "admin"]),
  departmentId: z.string().uuid().nullable().optional(),
});

export const setStaffUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => setRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role.");
    }

    if (data.role === "user") {
      await adminDb.userRole.deleteMany({
        where: { userId: data.userId, role: { in: STAFF_ROLES as any } },
      });
    } else {
      await adminDb.userRole.deleteMany({
        where: { userId: data.userId, role: { in: STAFF_ROLES as any } },
      });
      await adminDb.userRole.create({
        data: {
          userId: data.userId,
          role: data.role as any,
          departmentId: data.departmentId ?? null,
        },
      });
    }

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "role.updated",
        targetResource: data.userId,
        details: { new_role: data.role, department_id: data.departmentId ?? null },
      },
    });
    return { ok: true };
  });
