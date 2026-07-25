import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  role: "user" | "employee" | "manager" | "hr" | "admin";
  department_id: string | null;
  department_name: string | null;
};

const STAFF_ROLES = ["employee", "manager", "hr", "admin"] as const;

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

// ============================================================
// Departments — readable by any signed-in staff via RLS
// ============================================================
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Department[]> => {
    const { data, error } = await context.supabase
      .from("departments")
      .select("id, name, code, description")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Department[];
  });

// ============================================================
// Staff directory (admin only) — joins auth users with their
// highest current staff role and the department attached to it.
// ============================================================
export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffUser[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: usersData, error: usersErr }, { data: rolesData }, { data: depts }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
        supabaseAdmin
          .from("user_roles")
          .select("user_id, role, department_id")
          .in("role", STAFF_ROLES as any),
        supabaseAdmin.from("departments").select("id, name"),
      ]);
    if (usersErr) throw new Error(usersErr.message);

    const deptMap = new Map<string, string>();
    for (const d of (depts ?? []) as any[]) deptMap.set(d.id, d.name);

    // Role priority: admin > hr > manager > employee
    const priority: Record<string, number> = { admin: 4, hr: 3, manager: 2, employee: 1 };
    const bestByUser = new Map<string, { role: string; department_id: string | null }>();
    for (const r of (rolesData ?? []) as any[]) {
      const cur = bestByUser.get(r.user_id);
      if (!cur || (priority[r.role] ?? 0) > (priority[cur.role] ?? 0)) {
        bestByUser.set(r.user_id, { role: r.role, department_id: r.department_id ?? null });
      }
    }

    return usersData.users.map((u): StaffUser => {
      const best = bestByUser.get(u.id);
      const role = (best?.role ?? "user") as StaffUser["role"];
      const department_id = best?.department_id ?? null;
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        full_name:
          ((u.user_metadata as any)?.full_name || (u.user_metadata as any)?.name || null) as
            | string
            | null,
        role,
        department_id,
        department_name: department_id ? (deptMap.get(department_id) ?? null) : null,
      };
    });
  });

// ============================================================
// Promotion / demotion (admin only) — routed through the
// admin_set_user_role RPC which enforces admin and audit-logs.
// ============================================================
const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "employee", "manager", "hr", "admin"]),
  departmentId: z.string().uuid().nullable().optional(),
});

export const setStaffUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => setRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own admin role.");
    }

    if (data.role === "user") {
      // Strip every staff role — user drops back to standard candidate.
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .in("role", STAFF_ROLES as any);
      if (error) throw new Error(error.message);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: context.userId,
        actor_email: (context.claims as any)?.email ?? null,
        action: "role.updated",
        target_resource: data.userId,
        details: { new_role: "user", department_id: null } as any,
      });
      return { ok: true };
    }

    const { error } = await (context.supabase as any).rpc("admin_set_user_role", {
      _target_user_id: data.userId,
      _new_role: data.role,
      _department_id: data.departmentId ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
