import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * HR internal task manager — dedicated to HR/admin duty tracking
 * (offer-letter drafts, verifications, payroll cutoffs, etc.).
 * Reuses `employee_tasks` with a fixed `project_reference` marker so
 * these do not mix with candidate/employee work items.
 */
const HR_MARKER = "HR_INTERNAL";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getRoles(supabase: any, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return new Set((data ?? []).map((r: { role: string }) => r.role));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertHrOrAdmin(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!roles.has("hr") && !roles.has("admin")) throw new Error("Forbidden");
  return roles;
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
    await assertHrOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["hr", "admin"]);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id as string)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("user_id, full_name").in("user_id", ids);
    const nameMap = new Map<string, string | null>();
    (profiles ?? []).forEach((p) => nameMap.set(p.user_id as string, (p.full_name as string) ?? null));
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map<string, string | null>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (usersData?.users ?? []).forEach((u: any) => emailMap.set(u.id, u.email ?? null));
    return ids
      .map((id) => ({ id, full_name: nameMap.get(id) ?? null, email: emailMap.get(id) ?? null }))
      .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
  });

export const listHrTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HrTask[]> => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employee_tasks")
      .select("*")
      .eq("project_reference", HR_MARKER)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const ids = Array.from(new Set(rows.map((r) => r.assignee_id as string)));
    const nameMap = new Map<string, string | null>();
    const emailMap = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("user_id, full_name").in("user_id", ids);
      (profiles ?? []).forEach((p) => nameMap.set(p.user_id as string, (p.full_name as string) ?? null));
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (usersData?.users ?? []).forEach((u: any) => emailMap.set(u.id, u.email ?? null));
    }
    return rows.map((r) => ({
      ...(r as unknown as HrTask),
      assignee_name: nameMap.get(r.assignee_id as string) ?? null,
      assignee_email: emailMap.get(r.assignee_id as string) ?? null,
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
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Assignee must also be HR/admin — reject cross-role tasks.
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.assignee_id);
    const roles = new Set((roleRows ?? []).map((r) => r.role as string));
    if (!roles.has("hr") && !roles.has("admin")) {
      throw new Error("HR tasks may only be assigned to HR or admin users.");
    }
    const { data: row, error } = await supabaseAdmin
      .from("employee_tasks")
      .insert({
        assignee_id: data.assignee_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        due_date: data.due_date || null,
        project_reference: HR_MARKER,
        assigned_by: context.userId,
        status: "to_do",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("in_app_notifications").insert({
      user_id: data.assignee_id,
      title: "New HR task assigned",
      body: data.title,
      link: "/hr?tab=tasks",
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actor_email: (context.claims as any)?.email ?? null,
      action: "HR_TASK_CREATED",
      target_resource: row?.id ?? null,
      details: { assignee_id: data.assignee_id, title: data.title, due_date: data.due_date || null },
    });
    return row as unknown as HrTask;
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["to_do", "in_progress", "blocked", "done"]),
});

export const updateHrTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("employee_tasks")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("project_reference", HR_MARKER)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actor_email: (context.claims as any)?.email ?? null,
      action: "HR_TASK_STATUS_UPDATED",
      target_resource: data.id,
      details: { to: data.status },
    });
    return row as unknown as HrTask;
  });
