import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Access guard: employee OR admin
// ============================================================
async function assertEmployee(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["employee", "admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden");
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
    await assertEmployee(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("employee_tasks")
      .select("*")
      .eq("assignee_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeTask[];
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
  .inputValidator((d: unknown) => taskUpsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.supabase, context.userId);
    const payload: any = {
      ...data,
      assignee_id: context.userId,
      description: data.description ?? null,
      due_date: data.due_date || null,
    };
    const { data: row, error } = await context.supabase
      .from("employee_tasks")
      .upsert(payload)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as EmployeeTask;
  });

const taskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["to_do", "in_progress", "blocked", "done"]),
});

export const updateMyTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("employee_tasks")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("assignee_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const taskDeleteSchema = z.object({ id: z.string().uuid() });
export const deleteMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskDeleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("employee_tasks")
      .delete()
      .eq("id", data.id)
      .eq("assignee_id", context.userId);
    if (error) throw new Error(error.message);
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
    await assertEmployee(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("timesheets")
      .select("*")
      .eq("employee_id", context.userId)
      .order("date", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as Timesheet[];
  });

const timesheetSchema = z.object({
  date: z.string().min(4),
  hours_logged: z.number().min(0.25).max(24),
  project_reference: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const logTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => timesheetSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("timesheets")
      .insert({
        employee_id: context.userId,
        date: data.date,
        hours_logged: data.hours_logged,
        project_reference: data.project_reference,
        notes: data.notes ?? null,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as Timesheet;
  });

export const deleteTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("timesheets")
      .delete()
      .eq("id", data.id)
      .eq("employee_id", context.userId);
    if (error) throw new Error(error.message);
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
    await assertEmployee(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("referrals")
      .select("*, job_postings(title, job_code)")
      .eq("employee_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      ...r,
      job_title: r.job_postings?.title ?? null,
      job_code: r.job_postings?.job_code ?? null,
    })) as Referral[];
  });

const referralSchema = z.object({
  candidate_name: z.string().trim().min(2).max(120),
  candidate_email: z.string().trim().email().max(255),
  job_posting_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const createReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => referralSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertEmployee(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("referrals")
      .insert({
        employee_id: context.userId,
        candidate_name: data.candidate_name,
        candidate_email: data.candidate_email,
        job_posting_id: data.job_posting_id ?? null,
        notes: data.notes ?? null,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as Referral;
  });
