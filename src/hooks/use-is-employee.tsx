import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyRoles } from "@/lib/roles.functions";

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
    return () => { cancelled = true; };
  }, [user, loading]);

  return { isEmployee, checked, loading };
}
