// Clerk→Supabase identity provisioning. SERVER-ONLY.
//
// Maintains the public.clerk_user_map sidecar table introduced in:
//   supabase/migrations/20260724201018_26f2d3a1-9c47-4f91-b6d3-7a0e6f1c9b25.sql
//
// Responsibilities (in this order, all idempotent):
//   1. Find an existing mapping for the Clerk user id.
//   2. If none, find an existing mapping by verified email — the Clerk user
//      may have previously signed in via a different provider on the same
//      email address; reuse the linked auth.users row in that case.
//   3. If still none and an auth.users row already exists with that email,
//      link the Clerk id to it (atomic single insert).
//   4. Otherwise, mint a new auth.users row via supabase.auth.admin.createUser
//      (no email sent — email_verified=*** direct), then insert the mapping.
//
// All writes go through the service-role `supabaseAdmin` client, which is
// the only role permitted by the clerk_user_map RLS policies.
//
// This module MUST NOT be imported from client code. The `.server.ts`
// suffix plus the dynamic import of client.server.ts ensures bundlers
// keep it out of the client bundle.
//
// Returns the canonical Supabase auth_user_id (UUID) for the given Clerk
// identity. Callers use this value as the RLS-context user id in any
// subsequent per-user Supabase query path.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ClerkIdentity = {
  clerkUserId: string;
  email: string | null;
  emailVerified: boolean | null;
  fullName?: string | null;
};

export type ProvisionResult = {
  authUserId: string;
  /** True if we created a brand-new auth.users row this call. */
  created: boolean;
  /** True if an existing mapping was reused (by clerk_user_id or by email). */
  reused: boolean;
};

export type ProvisionError =
  | { kind: "missing_clerk_user_id" }
  | { kind: "missing_email" }
  | { kind: "create_user_failed"; message: string }
  | { kind: "link_failed"; message: string };

function ok(authUserId: string, created: boolean, reused: boolean): ProvisionResult {
  return { authUserId, created, reused };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  // PostgREST surfaces Postgres errors as { code: "23505", ... }.
  const maybe = error as { code?: string; message?: string };
  if (maybe.code === "23505") return true;
  if (typeof maybe.message === "string" && /duplicate key value/i.test(maybe.message)) return true;
  return false;
}

/**
 * Map a Clerk identity to a Supabase auth.users row, creating the auth.users
 * row and/or the clerk_user_map row as needed. Idempotent — repeated calls
 * with the same identity return the same authUserId.
 *
 * Callers MUST pass the service-role admin client. Reusing the admin client
 * is required because the clerk_user_map RLS policies default-deny the
 * authenticated and anon roles.
 */
export async function provisionClerkUser(
  supabaseAdmin: SupabaseClient<Database>,
  identity: ClerkIdentity,
): Promise<ProvisionResult | ProvisionError> {
  if (!identity.clerkUserId) return { kind: "missing_clerk_user_id" };
  if (!identity.email) return { kind: "missing_email" };
  const email = identity.email.trim().toLowerCase();
  if (!email) return { kind: "missing_email" };

  // (1) Direct lookup by Clerk user id.
  const { data: direct, error: directErr } = await supabaseAdmin
    .from("clerk_user_map")
    .select("auth_user_id")
    .eq("clerk_user_id", identity.clerkUserId)
    .maybeSingle();

  // A concurrent insert between SELECT and the caller's next query can race;
  // we catch the unique-violation later and re-select rather than relying on
  // this initial SELECT being authoritative.
  if (directErr && !isUniqueViolation(directErr)) {
    return { kind: "link_failed", message: directErr.message ?? String(directErr) };
  }
  if (direct) {
    return ok(String(direct.auth_user_id), false, true);
  }

  // (2) Lookup by verified email — a Clerk user re-authenticating with a
  // different provider on the same address should reuse the existing row.
  if (identity.emailVerified) {
    const { data: byEmail, error: byEmailErr } = await supabaseAdmin
      .from("clerk_user_map")
      .select("auth_user_id")
      .eq("email", email)
      .maybeSingle();
    if (byEmailErr && !isUniqueViolation(byEmailErr)) {
      return { kind: "link_failed", message: byEmailErr.message ?? String(byEmailErr) };
    }
    if (byEmail) {
      // Link this Clerk user id to the existing auth.users row.
      const { error: linkErr } = await supabaseAdmin.from("clerk_user_map").upsert(
        {
          clerk_user_id: identity.clerkUserId,
          auth_user_id: String(byEmail.auth_user_id),
          email,
          primary_email_verified: true,
        },
        { onConflict: "clerk_user_id" },
      );
      if (linkErr && !isUniqueViolation(linkErr)) {
        return { kind: "link_failed", message: linkErr.message ?? String(linkErr) };
      }
      return ok(String(byEmail.auth_user_id), false, true);
    }
  }

  // (3) No mapping yet. Mint an auth.users row with the service-role admin
  // API. We confirm the email directly (email_confirm: true) because Clerk
  // has already verified it — we don't want Supabase to send its own email.
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: identity.fullName ? { full_name: identity.fullName } : undefined,
  });
  if (createErr || !created?.user?.id) {
    return {
      kind: "create_user_failed",
      message: createErr?.message ?? "createUser returned no user id",
    };
  }
  const authUserId = String(created.user.id);

  // (4) Insert the mapping row. On unique-violation, another concurrent
  // provision beat us — re-read and return that mapping instead.
  const { error: mapErr } = await supabaseAdmin.from("clerk_user_map").insert({
    clerk_user_id: identity.clerkUserId,
    auth_user_id: authUserId,
    email,
    primary_email_verified: Boolean(identity.emailVerified),
  });
  if (mapErr) {
    if (isUniqueViolation(mapErr)) {
      const { data: tieBreak, error: tieBreakErr } = await supabaseAdmin
        .from("clerk_user_map")
        .select("auth_user_id")
        .eq("clerk_user_id", identity.clerkUserId)
        .maybeSingle();
      if (tieBreakErr || !tieBreak) {
        // The conflict was on auth_user_id (auth.users row already linked to
        // a *different* clerk_user_id). That shouldn't happen because we hold
        // the email uniqueness — but if it does, surface a clear error.
        return {
          kind: "link_failed",
          message: tieBreakErr?.message ?? "concurrent provision collision not resolvable",
        };
      }
      return ok(String(tieBreak.auth_user_id), false, true);
    }
    return { kind: "link_failed", message: mapErr.message ?? String(mapErr) };
  }

  return ok(authUserId, true, false);
}

/**
 * Reverse lookup — given a Supabase auth_user_id, return the Clerk user id
 * if one is mapped. Used by admin/staff directory renders (Step 11+).
 */
export async function lookupClerkIdByAuthUserId(
  supabaseAdmin: SupabaseClient<Database>,
  authUserId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("clerk_user_map")
    .select("clerk_user_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) {
    console.error("[clerk] reverse lookup failed", error.message);
    return null;
  }
  return data?.clerk_user_id ?? null;
}
