import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/use-is-admin";

/**
 * Client-side guard: redirect admins away from public marketing routes.
 * Admins have their own Command Center and should not see lead-gen surfaces.
 */
export function useAdminRedirect() {
  const { isAdmin, checked } = useIsAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (checked && isAdmin) navigate({ to: "/admin", replace: true });
  }, [checked, isAdmin, navigate]);
  return { isAdmin, checked };
}
