import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FLAGS } from "@/lib/feature-flags";
import { getMyRoles } from "@/lib/roles.functions";

/**
 * Returns true if the signed-in user has the 'employee' OR 'admin' role.
 * Admins can access every employee surface.
 *
 * Flag off: direct Supabase query. Flag on: defers to the `getMyRoles()`
 * server fn; both answers resolve to the same Postgres-scoped result.
 */
export function useIsEmployee() {
  const { user, loading } = useAuth();
  const [isEmployee, setIsEmployee] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsEmployee(false);
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!FLAGS.USE_CLERK_AUTH) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .in("role", ["employee", "admin"]);
          if (!cancelled) {
            setIsEmployee((data ?? []).length > 0);
            setChecked(true);
          }
          return;
        }
        const payload = await getMyRoles();
        if (!cancelled) {
          setIsEmployee(payload.isAdmin || payload.isEmployee);
          setChecked(true);
        }
      } catch {
        if (!cancelled) {
          setIsEmployee(false);
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isEmployee, checked, loading };
}
