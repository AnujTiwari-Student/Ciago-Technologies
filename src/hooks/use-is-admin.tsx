import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FLAGS } from "@/lib/feature-flags";
import { getMyRoles } from "@/lib/roles.functions";

/**
 * Returns true if the signed-in user has the 'admin' role.
 *
 * Flag off: direct Supabase query (as before). Flag on: defers to the
 * `getMyRoles()` server fn which uses the Clerk-issued anonymous Supabase
 * client scoped to the mapped auth.users.id (RLS still applies).
 */
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
        if (!FLAGS.USE_CLERK_AUTH) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (!cancelled) {
            setIsAdmin(!!data);
            setChecked(true);
          }
          return;
        }
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
