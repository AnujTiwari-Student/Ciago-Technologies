// Client function middleware — attaches an Authorization: Bearer token to every
// server-fn RPC, so the server-side `requireSupabaseAuth` middleware (Step 4)
// can identify the caller.
//
// When USE_CLERK_AUTH is false (current default):
//   the attacher reads the existing Supabase session from localStorage and
//   forwards its access_token. This is the Lovable-generated behaviour,
//   preserved verbatim except for the small refactor into a branch.
//
// When USE_CLERK_AUTH is true:
//   the attacher reads `window.__clerkAuthToken`, which is published by a
//   small React bridge component (`<ClerkTokenBridge />`, mounted in
//   `__root.tsx` immediately under <ClerkProvider> in Step 6). The bridge
//   uses Clerk's `useAuth().getToken()` hook to keep the token fresh on
//   every session tick. This keeps this module free of hook calls (so it
//   stays bundle-tree-shakable and synchronous-friendly), while still
//   allowing the server-fn middleware to verify a Bearer.
//
//   If the bridge has not yet mounted (first render), `window.__clerkAuthToken`
//   is undefined and we forward no Authorization header — identical to the
//   signed-out behaviour in the legacy branch.

import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";
import { FLAGS } from "@/lib/feature-flags";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (FLAGS.USE_CLERK_AUTH) return clerkTokenBranch(next);
    return legacySupabaseAuthBranch(next);
  },
);

// ---------------------------------------------------------------------------
// Legacy branch — USE_CLERK_AUTH is false.  Verbatim from the
// Lovable-generated implementation.
// ---------------------------------------------------------------------------
async function legacySupabaseAuthBranch(
  next: (args: { headers?: HeadersInit }) => Promise<unknown>,
): Promise<unknown> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

// ---------------------------------------------------------------------------
// Clerk branch — USE_CLERK_AUTH is true.
//
// Reads a Clerk Session token published by the <ClerkTokenBridge /> component
// in src/integrations/clerk/client.tsx (Step 6). `window.__clerkAuthToken` is
// updated every Clerk auth state change; when there is no active Clerk
// session, the bridge publishes a special empty-string sentinel which we
// translate into "no Authorization header".
//
// Why a window-stored sentinel? TanStack Start functionMiddleware client
// callbacks aren't React components; they cannot call hooks directly. The
// bridge component bridges that gap by keeping window.__clerkAuthToken in
// sync with the Clerk session.
//
// Why the empty-string sentinel rather than `undefined`? A window-stored
// undefined is indistinguishable from "the bridge hasn't mounted yet" during
// the first render. The explicit sentinel means even on first paint, we
// know the bridge is alive and the user is signed out.
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    // Published by <ClerkTokenBridge />. When the bridge has not yet mounted,
    // this is undefined. Once it mounts, it is always either a non-empty
    // string (the active Clerk Session JWT) or "" (signed out).
    __clerkAuthToken?: string;
  }
}

function readClerkToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = window.__clerkAuthToken;
  // Treat both undefined (bridge not mounted) and empty string (signed out)
  // as "no token to forward".
  if (!v) return undefined;
  return v;
}

async function clerkTokenBranch(
  next: (args: { headers?: HeadersInit }) => Promise<unknown>,
): Promise<unknown> {
  const token = readClerkToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
