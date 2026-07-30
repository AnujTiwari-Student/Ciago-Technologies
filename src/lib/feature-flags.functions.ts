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

export const getFeatureFlags = createServerFn({ method: "GET" }).handler(
  async (): Promise<Capabilities> => {
    return getAllFeatureFlags();
  },
);

export const getMyFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Capabilities> => {
    const roleRows = await context.db.withRLS((tx) =>
      tx.userRole.findMany({
        where: { userId: context.userId },
        select: { role: true },
      }),
    );

    const roles = new Set(roleRows.map((r) => r.role));
    const role =
      (roles.has("admin") && "admin") ||
      (roles.has("hr") && "hr") ||
      (roles.has("manager") && "manager") ||
      (roles.has("employee") && "employee") ||
      "user";

    return getAllFeatureFlags({
      identifier: context.userId,
      email: (context.claims?.email as string | undefined),
      role,
      custom: { hasStaffAccess: role !== "user" },
    });
  });

export const isMaintenanceModeOn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const defaults = getDefaultCapabilities();
    return isFlagOn(FEATURE_FLAGS.maintenanceMode, undefined, defaults.maintenanceMode);
  },
);

export const isDashboardEnabledFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    return isDashboardEnabled();
  },
);

export const isClerkAuthEnabledFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    return isClerkAuthenticationEnabled();
  },
);

export const isAuthButtonEnabledFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    return isAuthenticationButtonEnabled();
  },
);
