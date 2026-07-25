import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Returns true if the signed-in user has the 'employee' OR 'admin' role.
 * Admins can access every employee surface.
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
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["employee", "admin"] as any)
      .then(({ data }) => {
        if (!cancelled) {
          setIsEmployee((data ?? []).length > 0);
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isEmployee, checked, loading };
}
