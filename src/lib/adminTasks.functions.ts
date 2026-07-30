import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

async function assertAdmin(db: any, userId: string) {
  const count = await db.withRLS((tx: any) =>
    tx.userRole.count({ where: { userId, role: "admin" } }),
  );
  if (count === 0) throw new Error("Forbidden");
}

export type EmployeeOption = {
  id: string;
  email: string | null;
  full_name: string | null;
};

export type AdminTask = {
  id: string;
  assignee_id: string;
  title: string;
  description: string | null;
  status: "to_do" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  project_reference: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  assignee_name: string | null;
  assignee_email: string | null;
};

export const listEmployeesForAssignment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmployeeOption[]> => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const roles = await adminDb.userRole.findMany({
      where: { role: { in: ["employee", "admin"] } },
      select: { userId: true },
    });
    const ids = Array.from(new Set(roles.map((r) => r.userId)));
    if (ids.length === 0) return [];

    const [profiles, mappings] = await Promise.all([
      adminDb.profile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, fullName: true },
      }),
      adminDb.clerkUserMap.findMany({
        where: { authUserId: { in: ids } },
        select: { authUserId: true, email: true },
      }),
    ]);

    const nameMap = new Map(profiles.map((p) => [p.userId, p.fullName]));
    const emailMap = new Map(mappings.map((m) => [m.authUserId, m.email]));

    return ids
      .map((id) => ({
        id,
        full_name: nameMap.get(id) ?? null,
        email: emailMap.get(id) ?? null,
      }))
      .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
  });

export const listAllAssignedTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTask[]> => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const rows = await adminDb.employeeTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const ids = Array.from(new Set(rows.map((r) => r.assigneeId)));
    const [profiles, mappings] = ids.length
      ? await Promise.all([
          adminDb.profile.findMany({
            where: { userId: { in: ids } },
            select: { userId: true, fullName: true },
          }),
          adminDb.clerkUserMap.findMany({
            where: { authUserId: { in: ids } },
            select: { authUserId: true, email: true },
          }),
        ])
      : [[], []];

    const nameMap = new Map(profiles.map((p) => [p.userId, p.fullName]));
    const emailMap = new Map(mappings.map((m) => [m.authUserId, m.email]));

    return rows.map((r) => ({
      ...(r as unknown as AdminTask),
      assignee_name: nameMap.get(r.assigneeId) ?? null,
      assignee_email: emailMap.get(r.assigneeId) ?? null,
    }));
  });

const assignSchema = z.object({
  assignee_id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().nullable().optional(),
  project_reference: z.string().trim().max(120).nullable().optional(),
});

export const assignTaskToEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const row = await adminDb.employeeTask.create({
      data: {
        assigneeId: data.assignee_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        dueDate: data.due_date || null,
        projectReference: data.project_reference || null,
        assignedBy: context.userId,
        status: "to_do",
      },
    });

    await adminDb.inAppNotification.create({
      data: {
        userId: data.assignee_id,
        title: "New task assigned",
        body: data.title,
        link: "/employee",
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "TASK_ASSIGNED",
        targetResource: row.id,
        details: {
          assignee_id: data.assignee_id,
          title: data.title,
          priority: data.priority,
          due_date: data.due_date || null,
        },
      },
    });

    return row as unknown as AdminTask;
  });
