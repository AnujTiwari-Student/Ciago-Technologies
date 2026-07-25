import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["employee", "admin"]);
    if (rolesErr) throw new Error(rolesErr.message);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id as string)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    const profileMap = new Map<string, string | null>();
    (profiles ?? []).forEach((p: any) => profileMap.set(p.user_id, p.full_name));

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map<string, string | null>();
    (usersData?.users ?? []).forEach((u: any) => emailMap.set(u.id, u.email ?? null));

    return ids
      .map((id) => ({
        id,
        full_name: profileMap.get(id) ?? null,
        email: emailMap.get(id) ?? null,
      }))
      .sort((a, b) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
  });

export const listAllAssignedTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminTask[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employee_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const ids = Array.from(new Set(rows.map((r) => r.assignee_id)));
    const profileMap = new Map<string, string | null>();
    const emailMap = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      (profiles ?? []).forEach((p: any) => profileMap.set(p.user_id, p.full_name));
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      (usersData?.users ?? []).forEach((u: any) => emailMap.set(u.id, u.email ?? null));
    }
    return rows.map((r) => ({
      ...r,
      assignee_name: profileMap.get(r.assignee_id) ?? null,
      assignee_email: emailMap.get(r.assignee_id) ?? null,
    })) as AdminTask[];
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
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("employee_tasks")
      .insert({
        assignee_id: data.assignee_id,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        due_date: data.due_date || null,
        project_reference: data.project_reference || null,
        assigned_by: context.userId,
        status: "to_do",
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Best-effort in-app notification
    await supabaseAdmin.from("in_app_notifications").insert({
      user_id: data.assignee_id,
      title: "New task assigned",
      body: data.title,
      link: "/employee",
    });

    // Best-effort audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "TASK_ASSIGNED",
      target_resource: row?.id ?? null,
      details: {
        assignee_id: data.assignee_id,
        title: data.title,
        priority: data.priority,
        due_date: data.due_date || null,
      },
    });

    return row as AdminTask;
  });
