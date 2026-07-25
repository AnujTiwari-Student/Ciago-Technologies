// Lazy-loaded Clerk provider + token-bridge fragment.
//
// This file is dynamically imported via React.lazy from
// @/integrations/clerk/client.tsx only when USE_CLERK_AUTH is true. When
// the flag is off, this chunk is never loaded — bundlers tree-shake it
// from the entry. That keeps the production client bundle byte-identical
// until cutover.
//
// <ClerkProvider /> is mounted with the publishable key from
// VITE_CLERK_PUBLISHABLE_KEY (already populated in .env but not yet
// activated by the feature flag).
//
// <ClerkTokenBridge /> is mounted inside the provider so it can call the
// useAuth() hook. It keeps window.__clerkAuthToken in sync with the
// active Clerk Session JWT:
//   - When signed out (or before Clerk has loaded): publishes "" (sentinel)
//   - When signed in: publishes the latest useAuth().getToken() result.
//
// Server-fn attacher (Step 5) reads window.__clerkAuthToken and forwards
// it as Bearer. With the sentinel we avoid the race where first render
// and the attacher's first tick disagree on "no token" vs. "token not
// yet published".
//
// CRITICAL: <ClerkTokenBridge /> must live INSIDE <ClerkProvider /> — it
// calls useAuth(), which reads from Clerk's React context.

import { ClerkProvider, useAuth } from "@clerk/tanstack-start";
import { useEffect, type ReactNode } from "react";

declare global {
  interface Window {
    // Published by <ClerkTokenBridge />; consumed by the auth attacher
    // (src/integrations/supabase/auth-attacher.ts).
    __clerkAuthToken?: string;
  }
}

function readPublishableKey(): string | undefined {
  // Vite-injected browser key first; fall back to process.env for SSR.
  // Both pins identify the same logical value (env contract).
  const fromVite = (
    typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env as unknown as Record<string, string | undefined>)
          .VITE_CLERK_PUBLISHABLE_KEY
      : undefined
  ) as string | undefined;
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? ((process.env as unknown as Record<string, string | undefined>)
          .VITE_CLERK_PUBLISHABLE_KEY ??
        (process.env as unknown as Record<string, string | undefined>).CLERK_PUBLISHABLE_KEY)
      : undefined;
  return fromVite ?? fromEnv ?? undefined;
}

function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  useEffect(() => {
    let cancelled = false;
    // Always publish something immediately so the attacher can distinguish
    // "bridge not mounted" from "bridge mounted, signed out".
    if (!isLoaded || !isSignedIn) {
      window.__clerkAuthToken = "";
      return;
    }
    getToken()
      .then((token) => {
        if (cancelled) return;
        window.__clerkAuthToken = token ?? "";
      })
      .catch(() => {
        if (cancelled) return;
        window.__clerkAuthToken = "";
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);
  return null;
}

export function ClerkProviderFragment({ children }: { children: ReactNode }) {
  const publishableKey = readPublishableKey();
  // Misconfiguration guard — flag is on but no publishable key. Surface
  // the rendered children (so the rest of the app doesn't crash) and let
  // a downstream error boundary report the missing config.
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkTokenBridge />
      {children}
    </ClerkProvider>
  );
}
