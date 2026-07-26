// First-login provisioning server fn (Step 11).
//
// The Clerk branch of `requireSupabaseAuth` (auth-middleware.ts) already
// verifies the Bearer JWT and provisions the clerk_user_map row on every
// per-request invocation — but that's the *server-fn* path. From the React
// client tree, we don't yet have a way to ensure the mapping was created
// when a Clerk session signs in for the first time. So we expose this light
// wrapper server fn that:
//
//   - Reuses `requireSupabaseAuth` to authenticate the request and read the
//     verified Clerk claims (already containing clerkUserId, email,
//     email_verified). This avoids re-doing verification.
//   - Calls `provisionClerkUser` against the service-role admin client.
//   - Returns the mapped `auth_user_id` so the client hook can, in future,
//     stash it for analytics if needed.
//
// Idempotent: re-running on a user who is already mapped is a `reused=true`
// result. We always return `auth_user_id`; no UI distinguishes created vs
// reused because the only caller (`useEnsureUserMapped`) fires-and-forgets
// the mapping on every page mount with zero user-facing effect.

import { createServerFn } from "@tanstack/react-start";
import type { ClerkIdentity } from "@/integrations/clerk/provision.server";
import {
  provisionClerkUser,
  type ProvisionResult,
  type ProvisionError,
} from "@/integrations/clerk/provision.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnsureMappingResult =
  | { ok: true; authUserId: string; created: boolean; reused: boolean }
  | { ok: false; reason: string };

export const ensureClerkMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnsureMappingResult> => {
    // `claims` carries the Clerk JWT payload from requireSupabaseAuth's
    // Clerk branch (sub = Clerk user id, with email / email_verified
    // populated for Clerk-issued JWTs). In the legacy branch claims is the
    // Supabase claims payload, so `clerkUserId` would be the auth.users.id
    // — and provisioning is a no-op because there's no Clerk identity to
    // map. We guard against that below.
    const claims = context.claims as Record<string, unknown> | undefined;
    const clerkUserId = typeof claims?.sub === "string" ? claims.sub : null;
    const email =
      typeof claims?.email === "string"
        ? claims.email
        : ((claims as { email_address?: string } | undefined)?.email_address ?? null);
    const emailVerified = Boolean(
      (typeof claims?.email_verified === "boolean"
        ? claims.email_verified
        : (claims as { v?: number } | undefined)?.v === 2) ||
      (typeof claims?.email_verified === "string" ? claims.email_verified === "true" : false),
    );

    // Legacy branch: there is no Clerk identity to provisioning. `context.userId`
    // is already the auth.users.id from the Supabase JWT — return it directly.
    if (!context || !clerkUserId || !email || (clerkUserId && !email)) {
      if (typeof context?.userId === "string") {
        return { ok: true, authUserId: context.userId, created: false, reused: true };
      }
      return { ok: false, reason: "no authenticated identity available" };
    }

    // Dynamically import client.server so the cold path never imports the
    // admin client. (The requireSupabaseAuth middleware branch may have already
    // done so; the import is cached.)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const identity: ClerkIdentity = {
      clerkUserId,
      email,
      emailVerified,
      fullName: null,
    };
    const result: ProvisionResult | ProvisionError = await provisionClerkUser(
      supabaseAdmin,
      identity,
    );
    if ("authUserId" in result) {
      return {
        ok: true,
        authUserId: result.authUserId,
        created: result.created,
        reused: result.reused,
      };
    }
    return { ok: false, reason: result.kind };
  });
