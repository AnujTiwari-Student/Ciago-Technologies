import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FLAGS } from "@/lib/feature-flags";
import { getMyRoles, type MyRolesPayload } from "@/lib/roles.functions";

export type MyRoles = {
  isAdmin: boolean;
  isHr: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isStaff: boolean; // admin || hr || manager || employee
  departmentId: string | null;
  checked: boolean;
  loading: boolean;
};

/**
 * Canonical role hook. Reads all roles for the current user.
 *
 * - Flag off: queries `user_roles` directly via the browser Supabase
 *   client (RLS-protected by the Supabase-issued session).
 * - Flag on: defers to the `getMyRoles()` server fn, which uses the Clerk
 *   branch's per-user Supabase client (whose `auth.uid()` is the mapped
 *   auth.users.id). Same RLS enforcement, same Postgres source of truth;
 *   the only difference is one extra round trip to a server fn, which keeps
 *   the hook synchronous-with-await shape and lets us share the auth
 *   middleware with the rest of the server-fn pipeline.
 */
export function useMyRoles(): MyRoles {
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [payload, setPayload] = useState<MyRolesPayload | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRoles(new Set());
      setPayload(null);
      setDepartmentId(null);
      setChecked(true);
      return;
    }
    let cancelled = false;

    async function run() {
      try {
        if (!FLAGS.USE_CLERK_AUTH) {
          // Legacy path — direct Supabase query scoped by the user-id filter.
          // (RLS is also in place; the explicit filter keeps the SQL obvious.)
          const { data } = await supabase
            .from("user_roles")
            .select("role, department_id")
            .eq("user_id", user.id);
          if (cancelled) return;
          const rows = (data ?? []) as Array<{ role: string; department_id: string | null }>;
          setRoles(new Set(rows.map((r) => r.role)));
          const priority: Record<string, number> = {
            admin: 4,
            hr: 3,
            manager: 2,
            employee: 1,
          };
          const best = rows
            .filter((r) => r.department_id)
            .sort((a, b) => (priority[b.role] ?? 0) - (priority[a.role] ?? 0))[0];
          setDepartmentId(best?.department_id ?? null);
          setChecked(true);
          return;
        }

        // Clerk path — go via the server fn so we share requireSupabaseAuth
        // and thus the mapped auth.users.id scope.
        const serverPayload = await getMyRoles();
        if (cancelled) return;
        setPayload(serverPayload);
        setRoles(
          new Set(
            [
              serverPayload.isAdmin && "admin",
              serverPayload.isHr && "hr",
              serverPayload.isManager && "manager",
              serverPayload.isEmployee && "employee",
            ].filter(Boolean) as string[],
          ),
        );
        setDepartmentId(serverPayload.departmentId);
        setChecked(true);
      } catch {
        if (cancelled) return;
        // Surface as "no roles" rather than letting the hook throw — consumers
        // already treat !checked as "loading" and !isStaff as "no privilege".
        setRoles(new Set());
        setPayload(null);
        setDepartmentId(null);
        setChecked(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const isAdmin = payload?.isAdmin ?? roles.has("admin");
  const isHr = payload?.isHr ?? roles.has("hr");
  const isManager = payload?.isManager ?? roles.has("manager");
  const isEmployee = payload?.isEmployee ?? roles.has("employee");
  return {
    isAdmin,
    isHr,
    isManager,
    isEmployee,
    isStaff: isAdmin || isHr || isManager || isEmployee,
    departmentId: payload?.departmentId ?? departmentId,
    checked,
    loading,
  };
}
