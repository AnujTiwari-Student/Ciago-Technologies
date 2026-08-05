import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getMyRoles } from "@/lib/roles.functions";

export function useIsAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = await getMyRoles();
        if (!cancelled) {
          setIsAdmin(payload.isAdmin);
          setChecked(true);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isAdmin, checked, loading };
}
