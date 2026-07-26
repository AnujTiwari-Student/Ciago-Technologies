// Auth middleware — hand-maintained since Step 4 of the Clerk migration.
// The legacy branch preserves the original pre-migration implementation
// (Supabase-only auth path) verbatim in `legacySupabaseAuthBranch`.
//
// Behaviour toggles on FLAGS.USE_CLERK_AUTH — see the top-of-file comment.
//
// When USE_CLERK_AUTH is false (the default at this stage of the migration):
//   the codepath is the original pre-migration path — the Bearer token is
//   a Supabase-issued JWT, validated via supabase.auth.getClaims, and the
//   per-user Supabase client is constructed from that token.
//
// When USE_CLERK_AUTH is true:
//   the Bearer token is a Clerk Session JWT. We verify it with Clerk's
//   verifyToken, look up / create the mapped Supabase auth.users row via
//   provisionClerkUser (Step 2), mint a GoTrue JWT for that auth_user_id via
//   issueSupabaseTokenForAuthUser (Step 3), and construct the per-user
//   Supabase client using the GoTrue JWT as Bearer.
//
// Either way, the injected context has the same shape as required by the 28
// server fns that consume `requireSupabaseAuth`:
//   { supabase: SupabaseClient<Database>, userId: string, claims: Record<…> }
//
// The Clerk-only code is dynamically imported inside the branch so the
// existing bundle, build, and lint pass unchanged when the flag is off.

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { FLAGS } from "@/lib/feature-flags";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    const message = `Missing environment variable: ${name}. Check Supabase configuration in environment variables.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }
  return value;
}

// Build a per-user Supabase client that carries `token` as its Bearer.
// Identical pattern to the legacy implementation; kept here so both branches
// share it.
function buildUserClient(token: string) {
  const SUPABASE_URL = requireEnv("SUPABASE_URL");
  const SUPABASE_PUBLISHABLE_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (FLAGS.USE_CLERK_AUTH) {
      return clerkAuthBranch(next);
    }
    return legacySupabaseAuthBranch(next);
  },
);

// ---------------------------------------------------------------------------
// Legacy branch — USE_CLERK_AUTH is false. Identical behaviour to the
// implementation we replaced here; preserved verbatim so rollback equals
// flipping the flag back to false.
// ---------------------------------------------------------------------------
async function legacySupabaseAuthBranch(
  next: (args: { context: Record<string, unknown> }) => Promise<unknown> | unknown,
): Promise<unknown> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Check Supabase configuration in environment variables.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const request = getRequest();
  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Unauthorized: No authorization header provided");
  }
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }
  if (token.split(".").length !== 3) {
    throw new Error("Unauthorized: Invalid token");
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("Unauthorized: Invalid token");
  }
  if (!data.claims.sub) {
    throw new Error("Unauthorized: No user ID found in token");
  }
  return next({
    context: {
      supabase,
      userId: data.claims.sub,
      claims: data.claims,
    },
  });
}

// ---------------------------------------------------------------------------
// Clerk branch — USE_CLERK_AUTH is true.
//
// Flow:
//   1. Read Bearer + verify with verifyToken.
//   2. Resolve Clerk user (email + first_name + email_verified) via createClerkClient.
//   3. Lazy-import supabase admin/anon clients and our provisioner/issuer.
//   4. provisionClerkUser → auth_user_id.
//   5. issueSupabaseTokenForAuthUser → GoTrue JWT bound to auth_user_id.
//   6. Build per-user Supabase client carrying that JWT.
//   7. Inject { supabase, userId: auth_user_id, claims } — same shape as legacy.
// ---------------------------------------------------------------------------
async function clerkAuthBranch(
  next: (args: { context: Record<string, unknown> }) => Promise<unknown> | unknown,
): Promise<unknown> {
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
  if (!CLERK_SECRET_KEY) {
    throw new Error("Unauthorized: CLERK_SECRET_KEY is not configured");
  }

  const request = getRequest();
  if (!request?.headers) {
    throw new Error("Unauthorized: No request headers available");
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new Error("Unauthorized: No token provided");
  }

  // Lazy imports keep the Clerk bundle from entering the cold path's build
  // output when the flag is off (and they group cleanly when it's on).
  const { verifyToken, createClerkClient } = await import("@clerk/backend");
  const { provisionClerkUser } = await import("@/integrations/clerk/provision.server");
  const { issueSupabaseTokenForAuthUser } = await import("@/integrations/clerk/issue-token.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // `anonSupabase` is the anonymous GoTrue client used only by the
  // issuer module to exchange the hashed_token for a session.
  const { supabase: anonSupabase } = await import("@/integrations/supabase/client");

  // 1. Verify the Clerk Session JWT (networkless if CLERK_SECRET_KEY is set
  //    and the JWT header key is derived from it; otherwise fetches JWKS).
  let clerkClaims: Record<string, unknown>;
  try {
    clerkClaims = (await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    })) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : "verifyToken failed";
    console.error("[clerk] token verification failed", message);
    throw new Error(`Unauthorized: ${message}`);
  }
  const clerkUserId = clerkClaims.sub as string | undefined;
  if (!clerkUserId) {
    throw new Error("Unauthorized: Clerk token has no subject");
  }

  // 2. Resolve the Clerk user object to read email + verification state +
  //    full_name. (Clerk JWTs include `email` and `email_verified` standard-ish
  //    claims but we canonicalize by hitting the user record so we don't
  //    rely on token-level email claim shape.)
  const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const user = await clerkClient.users.getUser(clerkUserId);
  const primaryEmailObj = user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId);
  const email = primaryEmailObj?.emailAddress ?? null;
  const emailVerified = Boolean(primaryEmailObj?.verification?.status === "verified");
  if (!email) {
    throw new Error("Unauthorized: Clerk user has no verified primary email address");
  }
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  // 3. Provision the sidecar mapping (idempotent).
  const prov = await provisionClerkUser(supabaseAdmin, {
    clerkUserId,
    email,
    emailVerified,
    fullName,
  });
  if (!("authUserId" in prov)) {
    const message = "kind" in prov ? (prov.message ?? prov.kind) : "provision failed";
    console.error("[clerk] provisioning failed", message);
    throw new Error(`Unauthorized: ${message}`);
  }
  const authUserId = prov.authUserId;
  // 4. Mint a GoTrue JWT bound to auth_user_id (cached per user).
  const issued = await issueSupabaseTokenForAuthUser({
    supabaseAdmin,
    supabaseAnon: anonSupabase,
    authUserId,
    email,
  });
  if (!("access_token" in issued)) {
    const message = "kind" in issued ? (issued.message ?? issued.kind) : "token issuance failed";
    console.error("[clerk] token issuance failed", message);
    throw new Error(`Unauthorized: ${message}`);
  }

  // 5. Build the per-user Supabase client — RLS sees auth.uid() = authUserId.
  const userSupabase = buildUserClient(issued.access_token);

  // 6. Inject context in the same shape legacy branch does. `claims` carries
  //    the Clerk JWT's payload so handlers that read claims.email (e.g.
  //    audit_logs.actor_email population) keep working.
  return next({
    context: {
      supabase: userSupabase,
      userId: authUserId,
      claims: clerkClaims,
    },
  });
}
