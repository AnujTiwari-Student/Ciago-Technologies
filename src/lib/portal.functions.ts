import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalKind = "candidate" | "employee";

export const FORBIDDEN_CORPORATE_ERROR = "__FORBIDDEN_CORPORATE__";
export const STAFF_ON_CANDIDATE_ERROR = "__STAFF_ON_CANDIDATE__";

export const resolveMyPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input): { portal: PortalKind; requested: string } => {
    if (typeof input !== "object" || input === null) {
      throw new TypeError("invalid payload");
    }
    const i = input as { portal?: unknown; requested?: unknown };
    if (i.portal !== "candidate" && i.portal !== "employee") {
      throw new TypeError("portal must be 'candidate' or 'employee'");
    }
    if (typeof i.requested !== "string") {
      throw new TypeError("requested must be a string");
    }
    const requested = safePath(i.requested);
    return { portal: i.portal, requested };
  })
  .handler(async ({ context, data }): Promise<string> => {
    const { getAdminDb } = await import("@/lib/db/admin");
    const adminDb = getAdminDb();
    const roleRows = await adminDb.userRole.findMany({
      where: { userId: context.userId },
      select: { role: true },
    });

    const roleSet = new Set(roleRows.map((r: any) => r.role));
    const isAdmin = roleSet.has("admin");
    const isStaff = roleSet.has("user") || isAdmin;

    // Route based on roles, not portal parameter
    // Admin → /admin
    // Staff/User (including hired/offered) → /my-applications
    // No role → /my-applications (candidate)
    if (isAdmin) return "/admin";

    const { requested } = data;
    if (requested === "/") return "/my-applications";
    return requested;
  });

function safePath(p: string): string {
  if (!p) return "/";
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}
