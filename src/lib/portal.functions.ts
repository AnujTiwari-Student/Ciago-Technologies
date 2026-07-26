// Server-side resolver that picks the post-login destination based on the
// authenticated user's roles. Replaces the inline client-side
// `resolvePostLoginDestination()` in `src/routes/auth.tsx` for the Clerk
// branch.
//
// Why a server fn: in the Clerk branch the *server* is the only thing that
// can safely map a Clerk session to a Supabase `auth.users.id`. The mapping
// happens via `requireSupabaseAuth`/`provisionClerkUser`, so the per-request
// Supabase client we receive here already has `auth.uid()` = mapped id and
// RLS treats us as the user in question. This keeps the strict-MNC-isolation
// gate (corporate emails vs candidate emails) enforced on the server, not
// client-trustable.
//
// Throws the same `__FORBIDDEN_CORPORATE__` / `__STAFF_ON_CANDIDATE__` markers
// the original client resolver did; the auth route catches those and renders
// the same UX as today.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalKind = "candidate" | "employee";

export const FORBIDDEN_CORPORATE_ERROR = "__FORBIDDEN_CORPORATE__";
export const STAFF_ON_CANDIDATE_ERROR = "__STAFF_ON_CANDIDATE__";

/**
 * Returns the path the caller should land on after sign-in. The requested
 * redirect is preserved for candidate tab use; staff tab always lands on
 * the staff portal that matches their highest-priority role.
 *
 * Throws:
 *   - FORBIDDEN_CORPORATE_ERROR: a candidate tried to log in via the
 *     Employee tab.
 *   - STAFF_ON_CANDIDATE_ERROR: a staff member tried to log in via the
 *     Candidate tab.
 */
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
    const sb = context.supabase;
    const { data: roleRows, error } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) {
      throw new Error(`resolveMyPortal: ${error.message}`);
    }
    const roleSet = new Set((roleRows ?? []).map((r) => (r as { role: string }).role));
    const isStaff =
      roleSet.has("employee") ||
      roleSet.has("manager") ||
      roleSet.has("admin") ||
      roleSet.has("hr");

    const { portal, requested } = data;
    if (portal === "employee") {
      if (!isStaff) {
        throw new Error(FORBIDDEN_CORPORATE_ERROR);
      }
      if (roleSet.has("admin")) return "/admin";
      if (roleSet.has("hr")) return "/hr";
      if (roleSet.has("manager")) return "/manager";
      return "/employee";
    }
    // Candidate tab.
    if (isStaff) {
      throw new Error(STAFF_ON_CANDIDATE_ERROR);
    }
    if (requested === "/") return "/my-applications";
    return requested;
  });

// Match the client's safePath so a malicious redirect param can't escalate.
function safePath(p: string): string {
  if (!p) return "/";
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  return p;
}
