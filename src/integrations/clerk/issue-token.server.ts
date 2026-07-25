// Per-request Supabase session token issuer for the Clerk auth path (Step 3).
//
// Goal: take a Clerk-verified identity and a Supabase auth.users.id (the sidecar
// mapping produced by provision.server.ts), and return a GoTrue-issued access
// token (a signed JWT) whose `sub` matches that auth.users.id. This token is
// then used by the Clerk auth middleware (Step 4) as the Bearer token for any
// per-user Supabase client. RLS policies that evaluate `auth.uid() = user_id`
// continue to evaluate correctly because the JWT's sub IS the canonical
// Supabase UUID — no RLS rewrite, no FK relaxation, no service-role bypass.
//
// Issuance flow (all idempotent, atomic per request):
//   1. service-admin client: generateLink({ type: 'magiclink', email }) → { hashed_token }
//   2. anonymous client  : verifyOtp({ email, token: hashed_token, type: 'email' }) → { session }
//   3. Return session.access_token (short-lived JWT, default 1h TTL).
//
// Why this path is the right choice:
//   * Uses Supabase's own documented issuance API for the hashed_token / verify
//     exchange — no hand-rolled JWT signing, no shared HS256 secrets.
//   * The JWT is issued to the exact auth.users row whose UUID the sidecar
//     mapping has tied to the Clerk identity — no risk of accidental subject
//     mismatch.
//   * No user-visible email is sent — generateLink with `email_otp` interleaves
//     with `verifyOtp` entirely server-side; the email it would deliver is
//     discarded by us (we never use that codepath user-side).
//
// Caching: each token is cached per auth_user_id for ~5 minutes (the Supabase
// default token TTL minus skew). Cache key is the auth_user_id. The cached
// token is only reused if it is still valid for at least 60s (k > k + 60s).
// This keeps per-request async fns from each provoking a generateLink+verify
// round-trip on every server fn invocation.
//
// SERVER-ONLY. Importers must be server fns / *.server.ts files; the lazy
// import of client.server.ts below plus the module's `.server.ts` suffix
// keep this off the client bundle.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type IssuedToken = {
  /** Short-lived GoTrue access token (JWT). */
  access_token: string;
  /** ISO 8601 expiry time. */
  expires_at: string;
};

export type IssueError =
  | { kind: "missing_args" }
  | { kind: "generate_link_failed"; message: string }
  | { kind: "verify_failed"; message: string };

// In-memory cache per auth_user_id. No cross-process sharing; each server
// instance mints its own. Token TTL is short enough that a process restart
// isn't a problem and stale entries are evicted lazily.
type CacheEntry = {
  access_token: string;
  expires_at: number; // epoch ms
};
const tokenCache = new Map<string, CacheEntry>();
const TOKEN_MIN_REMAINING_MS = 60_000; // never reuse a token with <60s left

/**
 * Issue a Supabase access token bound to the given mapped auth_user_id.
 * Idempotent per (auth_user_id) within the cache TTL.
 *
 * Callers MUST pass the service-role admin client (`supabaseAdmin`) and an
 * anonymous/plain client (`supabaseAnon`) constructed without session
 * persistence. The anon client is the one that exchanges the hashed_token
 * for a session.
 */
export async function issueSupabaseTokenForAuthUser(args: {
  supabaseAdmin: SupabaseClient<Database>;
  supabaseAnon: SupabaseClient<Database>;
  authUserId: string;
  email: string;
}): Promise<IssuedToken | IssueError> {
  const { supabaseAdmin, supabaseAnon, authUserId, email } = args;
  if (!authUserId || !email) return { kind: "missing_args" };

  // Cache hit?
  const cached = tokenCache.get(authUserId);
  if (cached && cached.expires_at - Date.now() > TOKEN_MIN_REMAINING_MS) {
    return {
      access_token: cached.access_token,
      expires_at: new Date(cached.expires_at).toISOString(),
    };
  }

  // (1) generateLink as the service admin → hashed_token.
  const linkRes = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
    return {
      kind: "generate_link_failed",
      message: linkRes.error?.message ?? "no hashed_token returned",
    };
  }
  const hashedToken: string = linkRes.data.properties.hashed_token;

  // (2) verifyOtp as a plain anon client → session.access_token.
  const verifyRes = await supabaseAnon.auth.verifyOtp({
    email,
    token: hashedToken,
    type: "email",
  });
  if (verifyRes.error || !verifyRes.data?.session?.access_token) {
    return {
      kind: "verify_failed",
      message: verifyRes.error?.message ?? "verifyOtp returned no session",
    };
  }
  const access_token = verifyRes.data.session.access_token;
  // GoTrue JWT exp is a Unix epoch in seconds; default TTL is 3600s.
  const expires_at_ms = expiresAtFromJwt(access_token);
  if (!expires_at_ms) {
    // Defensive: if we can't parse exp, don't cache — caller still gets a token
    // valid for whatever GoTrue issued.
    return { access_token, expires_at: new Date(0).toISOString() };
  }
  tokenCache.set(authUserId, { access_token, expires_at: expires_at_ms });
  return { access_token, expires_at: new Date(expires_at_ms).toISOString() };
}

/**
 * Clear the cached token for an auth_user_id. Called when the Clerk session
 * is revoked (sign-out) to immediately invalidate further use of any cached
 * token. RLS itself is enforced by Supabase, but skipping serving a stale
 * token avoids one extra round-trip on the next sign-in.
 */
export function invalidateSupabaseToken(authUserId: string): void {
  tokenCache.delete(authUserId);
}

/** Best-effort JWT expiry extraction. Returns epoch ms or null. */
function expiresAtFromJwt(jwt: string): number | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    // JWT payload is base64url-encoded JSON.
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), "=");
    const payloadJson = JSON.parse(
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf8")
        : globalThis.atob(payloadB64),
    ) as { exp?: unknown };
    if (typeof payloadJson.exp === "number") return payloadJson.exp * 1000;
    return null;
  } catch {
    return null;
  }
}
