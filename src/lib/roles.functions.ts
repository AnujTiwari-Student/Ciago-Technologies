// Role queries exposed to client code as a server fn.
//
// Why server-fn: under the Clerk migration (Step 9) the role hooks stay
// client-side but they now invoke this function instead of querying the
// database directly. The benefit is twofold:
//   1) The query runs through `requireSupabaseAuth`, which already handles
//      the Bearer verification + per-user Supabase client construction for
//      both Legacy and Clerk branches. So the hooks don't need to know
//      which auth source is active — they always get an authoritative
//      per-user client whose RLS context matches the authenticated user.
//   2) The hooks render shape stays unchanged — same fields, same nullability.
//
// Under flag-off the behaviour is functionally identical to the previous
// direct-query implementation: the server fn calls the same `from("user_roles")`
// query, scoped to the per-user client (whose `auth.uid()` equals the user's
// session subject). Under flag-on, the per-user client is the one built in
// auth-middleware's clerk branch — same scope, same RLS enforcement, same
// Postgres remains the source of truth.

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
    const sb = context.supabase;
    const { data, error } = await sb
      .from("user_roles")
      .select("role, department_id")
      .eq("user_id", context.userId);
    if (error) {
      throw new Error(`getMyRoles failed: ${error.message}`);
    }
    const rows = (data ?? []) as MyRoleRow[];
    const roles = new Set(rows.map((r) => r.role));
    const isAdmin = roles.has("admin");
    const isHr = roles.has("hr");
    const isManager = roles.has("manager");
    const isEmployee = roles.has("employee");
    // Highest-priority staff role with a department attached wins.
    const departmentId =
      rows
        .filter((r) => r.department_id)
        .sort((a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0))[0]
        ?.department_id ?? null;
    return {
      isAdmin,
      isHr,
      isManager,
      isEmployee,
      isStaff: isAdmin || isHr || isManager || isEmployee,
      departmentId,
    };
  });
