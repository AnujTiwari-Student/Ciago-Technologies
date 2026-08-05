import { redirect } from "@tanstack/react-router";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";
import { getMyAuthUserId, getMyRoles, type MyRolesPayload } from "@/lib/roles.functions";
import { isDashboardEnabled } from "@/lib/feature-flags.server";
import {
  canAccessDashboard,
  canAccessSurface,
  type DashboardSurface,
} from "@/lib/dashboard-access";
import type { AppRole } from "@prisma/client";

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
  return new Set(payload.roles as string[]);
}

export async function requireAuthenticated(
  redirectPath: string,
): Promise<{ userId: string | null }> {
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

export async function requireRoles(redirectPath: string): Promise<{
  userId: string;
  roles: Set<string>;
  appRoles: AppRole[];
  departmentId: string | null;
}> {
  const auth = await requireAuthenticated(redirectPath);

  const payload = await getMyRoles();
  return {
    userId: auth.userId!,
    roles: roleSetFromPayload(payload),
    appRoles: payload.roles,
    departmentId: payload.departmentId,
  };
}

export async function requireDashboardAccess(
  redirectPath: string,
  surface?: DashboardSurface,
): Promise<{
  userId: string;
  roles: Set<string>;
  appRoles: AppRole[];
  departmentId: string | null;
}> {
  const enabled = await isDashboardEnabled();
  if (!enabled) {
    throw redirect({ to: "/forbidden", search: { reason: "dashboard_disabled" } });
  }

  const result = await requireRoles(redirectPath);

  if (!canAccessDashboard(result.appRoles)) {
    throw redirect({ to: "/forbidden" });
  }

  if (surface && !canAccessSurface(result.appRoles, surface)) {
    throw redirect({ to: "/forbidden" });
  }

  return result;
}

export async function requireDashboardEnabled(): Promise<void> {
  const enabled = await isDashboardEnabled();
  if (!enabled) {
    throw redirect({ to: "/forbidden", search: { reason: "dashboard_disabled" } });
  }
}
