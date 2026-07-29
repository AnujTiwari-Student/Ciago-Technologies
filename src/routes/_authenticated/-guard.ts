import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FLAGS } from "@/lib/feature-flags";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";
import { getMyAuthUserId, getMyRoles, type MyRolesPayload } from "@/lib/roles.functions";
import { isDashboardEnabled } from "@/lib/feature-flags.server";

declare global {
  interface Window {
    __clerkAuthToken?: string;
  }
}

function readClerkToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__clerkAuthToken || undefined;
}

function roleSetFromPayload(payload: MyRolesPayload): Set<string> {
  return new Set(
    [
      payload.isAdmin && "admin",
      payload.isHr && "hr",
      payload.isManager && "manager",
      payload.isEmployee && "employee",
    ].filter(Boolean) as string[],
  );
}

export async function requireAuthenticated(
  redirectPath: string,
): Promise<{ userId: string | null }> {
  if (!FLAGS.USE_CLERK_AUTH) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: redirectPath } });
    return { userId: data.user.id };
  }

  const clerkAuthEnabled = await isClerkAuthEnabledFn();
  if (!clerkAuthEnabled) {
    throw redirect({ to: "/forbidden", search: { reason: "clerk_auth_disabled" } });
  }

  if (!readClerkToken()) {
    throw redirect({ to: "/auth", search: { redirect: redirectPath } });
  }

  const userId = await getMyAuthUserId();
  return { userId };
}

export async function requireRoles(
  redirectPath: string,
): Promise<{ userId: string; roles: Set<string> }> {
  const auth = await requireAuthenticated(redirectPath);

  if (!FLAGS.USE_CLERK_AUTH) {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.userId!);
    return {
      userId: auth.userId!,
      roles: new Set((roleRows ?? []).map((r) => (r as { role: string }).role)),
    };
  }

  const payload = await getMyRoles();
  return {
    userId: auth.userId!,
    roles: roleSetFromPayload(payload),
  };
}

/**
 * Guards any dashboard route.
 * If the `dashboardEnabled` ConfigCat flag is OFF, redirects to /forbidden.
 * Call this AFTER requireAuthenticated / requireRoles in beforeLoad.
 */
export async function requireDashboardEnabled(): Promise<void> {
  const enabled = await isDashboardEnabled();
  if (!enabled) {
    throw redirect({ to: "/forbidden", search: { reason: "dashboard_disabled" } });
  }
}
