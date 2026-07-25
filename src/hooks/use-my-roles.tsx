import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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
 * Canonical role hook. Reads all roles for the current user in a single query.
 * Prefer this over the older single-role hooks in new code.
 */
export function useMyRoles(): MyRoles {
  const { user, loading } = useAuth();
  const [roles, setRoles] = useState<Set<string>>(new Set());
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setRoles(new Set());
      setDepartmentId(null);
      setChecked(true);
      return;
    }
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role, department_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as Array<{ role: string; department_id: string | null }>;
        setRoles(new Set(rows.map((r) => r.role)));
        // Prefer department attached to the highest-priority staff role.
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
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const isAdmin = roles.has("admin");
  const isHr = roles.has("hr");
  const isManager = roles.has("manager");
  const isEmployee = roles.has("employee");
  return {
    isAdmin,
    isHr,
    isManager,
    isEmployee,
    isStaff: isAdmin || isHr || isManager || isEmployee,
    departmentId,
    checked,
    loading,
  };
}
