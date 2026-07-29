import { createServerFn } from "@tanstack/react-start";
import {
  getAllFeatureFlags,
  getDefaultCapabilities,
  isAuthenticationButtonEnabled,
  isClerkAuthenticationEnabled,
  isDashboardEnabled,
  isFlagOn,
} from "@/lib/feature-flags.server";
import { FEATURE_FLAGS, type Capabilities } from "@/lib/feature-flags";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupabaseClient } from "@supabase/supabase-js";

/** Public � returns flags evaluated without a user context (global defaults + targeting). */
export const getFeatureFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<Capabilities> => {
    return getAllFeatureFlags();
  },
);

/**
 * Authenticated � evaluates flags with the current user's identity and role.
 * Clients should call this once per session and cache the result in React Query.
 */
export const getMyFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Capabilities> => {
    const ctx = context as unknown as
      | {
          supabase: SupabaseClient;
          userId: string;
          claims?: { email?: string };
        }
      | undefined;

    if (!ctx) {
      throw new Error("getMyFeatureFlags: missing auth context — middleware did not run");
    }

    const { data: roleRows, error } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId);
    if (error) {
      throw new Error(`getMyFeatureFlags role lookup failed: ${error.message}`);
    }

    const roles = new Set((roleRows ?? []).map((r: { role: string }) => r.role));
    const role =
      (roles.has("admin") && "admin") ||
      (roles.has("hr") && "hr") ||
      (roles.has("manager") && "manager") ||
      (roles.has("employee") && "employee") ||
      "user";

    return getAllFeatureFlags({
      identifier: ctx.userId,
      email: ctx.claims?.email,
      role,
      custom: { hasStaffAccess: role !== "user" },
    });
  });

/** Check if maintenance mode is on (unauthenticated � safe to call in public routes). */
export const isMaintenanceModeOn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const defaults = getDefaultCapabilities();
    return isFlagOn(FEATURE_FLAGS.maintenanceMode, undefined, defaults.maintenanceMode);
  },
);

/**
 * Check if the dashboard is enabled for the current session.
 * Used by beforeLoad guards on all role portals (/admin, /hr, /manager, /employee).
 * Returns true when the dashboardEnabled ConfigCat flag is ON.
 */
export const isDashboardEnabledFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    return isDashboardEnabled();
  },
);

/** Security-critical runtime gate for Clerk auth paths. */
export const isClerkAuthEnabledFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    return isClerkAuthenticationEnabled();
  },
);

/** Public server-side evaluation for the sign-in entry point. */
export const isAuthButtonEnabledFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    return isAuthenticationButtonEnabled();
  },
);
