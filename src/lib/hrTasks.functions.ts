import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

const HR_MARKER = "HR_INTERNAL";

async function assertHrOrAdmin(db: any, userId: string) {
  const count = await db.withRLS((tx: any) =>
    tx.userRole.count({ where: { userId, role: { in: ["hr", "admin"] } } }),
  );
  if (count === 0) throw new Error("Forbidden");
}

export type HrTask = {
  id: string;
  assignee_id: string;
  title: string;
  description: string | null;
  status: "to_do" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
  assignee_name: string | null;
  assignee_email: string | null;
};

export type HrPeer = { id: string; full_name: string | null; email: string | null };

export const listHrPeers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HrPeer[]> => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const roles = await adminDb.userRole.findMany({
      where: { role: { in: ["hr", "admin"] } },
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

export const listHrTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HrTask[]> => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const rows = await adminDb.employeeTask.findMany({
      where: { projectReference: HR_MARKER },
      orderBy: { createdAt: "desc" },
      take: 200,
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
      ...(r as unknown as HrTask),
      assignee_name: nameMap.get(r.assigneeId) ?? null,
      assignee_email: emailMap.get(r.assigneeId) ?? null,
    }));
  });

const createSchema = z.object({
  assignee_id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().nullable().optional(),
});

export const createHrTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const roleCount = await adminDb.userRole.count({
      where: { userId: data.assignee_id, role: { in: ["hr", "admin"] } },
    });
    if (roleCount === 0) {
      throw new Error("HR tasks may only be assigned to HR or admin users.");
    }

    const row = await adminDb.employeeTask.create({
      data: {
        assigneeId: data.assignee_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        dueDate: data.due_date || null,
        projectReference: HR_MARKER,
        assignedBy: context.userId,
        status: "to_do",
      },
    });

    await adminDb.inAppNotification.create({
      data: {
        userId: data.assignee_id,
        title: "New HR task assigned",
        body: data.title,
        link: "/hr?tab=tasks",
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "HR_TASK_CREATED",
        targetResource: row.id,
        details: {
          assignee_id: data.assignee_id,
          title: data.title,
          due_date: data.due_date || null,
        },
      },
    });
    return row as unknown as HrTask;
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["to_do", "in_progress", "blocked", "done"]),
});

export const updateHrTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const row = await adminDb.employeeTask.updateMany({
      where: { id: data.id, projectReference: HR_MARKER },
      data: { status: data.status },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "HR_TASK_STATUS_UPDATED",
        targetResource: data.id,
        details: { to: data.status },
      },
    });
    return { ok: true };
  });
