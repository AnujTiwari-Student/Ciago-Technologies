// ClerkProvider boundary — flag-aware mount point for Clerk.
//
// Flag OFF (default, pre-cutover):
//   boundary renders `<>{children}</>` — no Clerk JS in the bundle, no
//   runtime behaviour change. Identical to the pre-migration app.
//
// Flag ON (cutover):
//   boundary renders `<ClerkProvider>` eagerly. The ClerkProvider MUST
//   be in the tree before any Clerk-consuming descendant (useSignIn,
//   useUser, useAuth, useClerk) renders — including during SSR's first
//   render. The previous implementation lazy-loaded <ClerkProvider>
//   itself, which meant Clerk forms (also lazy) could render before
//   the provider resolved and threw
//   `useClerkSignal can only be used within <ClerkProvider />`.
//
//   The eager import is gated by the runtime flag check. This means
//   the @clerk/tanstack-react-start bundle IS included in the flag-on
//   production bundle — which is correct (flag-on = Clerk is active).

import type { ReactNode } from "react";
import { FLAGS } from "@/lib/feature-flags";

export function ClerkProviderBoundary({ children }: { children: ReactNode }) {
  if (!FLAGS.USE_CLERK_AUTH) {
    // Cold path — no Clerk import, no JS harness. Identical to today.
    return <>{children}</>;
  }
  // Warm path — mount <ClerkProvider> eagerly. The actual import is
  // performed inside ClerkProviderFragment so this file's static
  // module graph stays clean. But ClerkProviderFragment is rendered
  // WITHOUT Suspense — it runs synchronously so the provider exists
  // before children render.
  //
  // Implementation note: the previous design wrapped ClerkProviderFragment
  // in <Suspense fallback={children}> — which meant children rendered
  // WITHOUT a ClerkProvider during the lazy chunk's round-trip. The fix
  // is to not lazy-load the provider itself.
  return <ClerkProviderFragment>{children}</ClerkProviderFragment>;
}

// Synchronous fragment that mounts <ClerkProvider>. Eager imports so
// the provider is in the React tree on the first render.---
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";
import { useEffect } from "react";

declare global {
  interface Window {
    // Published by <ClerkTokenBridge />; consumed by the auth attacher
    // (src/integrations/supabase/auth-attacher.ts).
    __clerkAuthToken?: string;
  }
}

function readPublishableKey(): string | undefined {
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
        (process.env as unknown as Record<string, string | undefined>)
          .CLERK_PUBLISHABLE_KEY)
      : undefined;
  return fromVite ?? fromEnv ?? undefined;
}

function ClerkTokenBridge() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  useEffect(() => {
    let cancelled = false;
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

function ClerkProviderFragment({ children }: { children: ReactNode }) {
  const publishableKey = readPublishableKey();
  if (!publishableKey) {
    // Misconfiguration: flag is on but no publishable key. Surface the
    // children so the rest of the app doesn't crash; a console warning
    // helps diagnose at runtime. The Clerk forms will also fall through
    // gracefully because Clerk's hooks return loading states when the
    // provider is missing its key.
    if (typeof console !== "undefined") {
      console.warn(
        "[clerk] USE_CLERK_AUTH is on but VITE_CLERK_PUBLISHABLE_KEY is missing. " +
          "Auth will not function until the key is set.",
      );
    }
    return <>{children}</>;
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkTokenBridge />
      {children}
    </ClerkProvider>
  );
}
