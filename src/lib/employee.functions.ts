import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

async function assertEmployee(db: any, userId: string) {
  const count = await db.withRLS((tx: any) =>
    tx.userRole.count({
      where: { userId, role: { in: ["employee", "admin"] } },
    }),
  );
  if (count === 0) throw new Error("Forbidden");
}

// ============================================================
// TASKS
// ============================================================
export type EmployeeTask = {
  id: string;
  assignee_id: string;
  title: string;
  description: string | null;
  status: "to_do" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmployeeTask[]> => {
    await assertEmployee(context.db, context.userId);
    const rows = await context.db.withRLS((tx) =>
      tx.employeeTask.findMany({
        where: { assigneeId: context.userId },
        orderBy: { createdAt: "desc" },
      }),
    );
    return rows as unknown as EmployeeTask[];
  });

const taskUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["to_do", "in_progress", "blocked", "done"]).default("to_do"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  due_date: z.string().nullable().optional(),
});

export const upsertMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => taskUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.db, context.userId);
    const row = await context.db.withRLS((tx) =>
      tx.employeeTask.upsert({
        where: { id: data.id ?? "00000000-0000-0000-0000-000000000000" },
        create: {
          assigneeId: context.userId,
          title: data.title,
          description: data.description ?? null,
          status: data.status,
          priority: data.priority,
          dueDate: data.due_date || null,
        },
        update: {
          title: data.title,
          description: data.description ?? null,
          status: data.status,
          priority: data.priority,
          dueDate: data.due_date || null,
        },
      }),
    );
    return row as unknown as EmployeeTask;
  });

const taskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["to_do", "in_progress", "blocked", "done"]),
});

export const updateMyTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => taskStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.db, context.userId);
    await context.db.withRLS((tx) =>
      tx.employeeTask.updateMany({
        where: { id: data.id, assigneeId: context.userId },
        data: { status: data.status },
      }),
    );
    return { ok: true };
  });

const taskDeleteSchema = z.object({ id: z.string().uuid() });
export const deleteMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => taskDeleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.db, context.userId);
    await context.db.withRLS((tx) =>
      tx.employeeTask.deleteMany({
        where: { id: data.id, assigneeId: context.userId },
      }),
    );
    return { ok: true };
  });

// ============================================================
// TIMESHEETS
// ============================================================
export type Timesheet = {
  id: string;
  employee_id: string;
  date: string;
  hours_logged: number;
  project_reference: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const listMyTimesheets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Timesheet[]> => {
    await assertEmployee(context.db, context.userId);
    const rows = await context.db.withRLS((tx) =>
      tx.timesheet.findMany({
        where: { employeeId: context.userId },
        orderBy: { date: "desc" },
        take: 60,
      }),
    );
    return rows as unknown as Timesheet[];
  });

const timesheetSchema = z.object({
  date: z.string().min(4),
  hours_logged: z.number().min(0.25).max(24),
  project_reference: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const logTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => timesheetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.db, context.userId);
    const row = await context.db.withRLS((tx) =>
      tx.timesheet.create({
        data: {
          employeeId: context.userId,
          date: data.date,
          hoursLogged: data.hours_logged,
          projectReference: data.project_reference,
          notes: data.notes ?? null,
        },
      }),
    );
    return row as unknown as Timesheet;
  });

export const deleteTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.db, context.userId);
    await context.db.withRLS((tx) =>
      tx.timesheet.deleteMany({
        where: { id: data.id, employeeId: context.userId },
      }),
    );
    return { ok: true };
  });

// ============================================================
// REFERRALS
// ============================================================
export type Referral = {
  id: string;
  employee_id: string;
  candidate_name: string;
  candidate_email: string;
  job_posting_id: string | null;
  referral_status: "pending" | "interviewing" | "hired" | "rejected";
  notes: string | null;
  created_at: string;
  updated_at: string;
  job_title?: string | null;
  job_code?: string | null;
};

export const listMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Referral[]> => {
    await assertEmployee(context.db, context.userId);
    const rows = await context.db.withRLS((tx) =>
      tx.referral.findMany({
        where: { employeeId: context.userId },
        include: { jobPosting: { select: { title: true, jobCode: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
    return (rows as any[]).map((r) => ({
      ...r,
      job_title: r.jobPosting?.title ?? null,
      job_code: r.jobPosting?.jobCode ?? null,
    })) as unknown as Referral[];
  });

const referralSchema = z.object({
  candidate_name: z.string().trim().min(2).max(120),
  candidate_email: z.string().trim().email().max(255),
  job_posting_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const createReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => referralSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.db, context.userId);
    const row = await context.db.withRLS((tx) =>
      tx.referral.create({
        data: {
          employeeId: context.userId,
          candidateName: data.candidate_name,
          candidateEmail: data.candidate_email,
          jobPostingId: data.job_posting_id ?? null,
          notes: data.notes ?? null,
        },
      }),
    );
    return row as unknown as Referral;
  });
