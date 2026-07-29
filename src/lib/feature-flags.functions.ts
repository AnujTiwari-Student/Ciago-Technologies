import { createServerFn } from "@tanstack/react-start";
import { getAllFeatureFlags, getDefaultCapabilities, isFlagOn } from "@/lib/feature-flags.server";
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
    const { data: roleRows, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) {
      throw new Error(`getMyFeatureFlags role lookup failed: ${error.message}`);
    }

    const roles = new Set((roleRows ?? []).map((r) => (r as { role: string }).role));
    const role =
      (roles.has("admin") && "admin") ||
      (roles.has("hr") && "hr") ||
      (roles.has("manager") && "manager") ||
      (roles.has("employee") && "employee") ||
      "user";

    const claims = context.claims as { email?: string } | undefined;
    return getAllFeatureFlags({
      identifier: context.userId,
      email: claims?.email,
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
