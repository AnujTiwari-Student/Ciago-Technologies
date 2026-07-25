// Clerk client-side provider wrapper (Step 6).
//
// When USE_CLERK_AUTH is false (the default at this stage of the migration):
//   the boundary passes its children through untouched — no Clerk JS is
//   imported, no Clerk scripts are loaded, so the client bundle size and
//   runtime behaviour are byte-identical to the pre-migration app.
//
// When USE_CLERK_AUTH is true:
//   the boundary renders a `<ClerkProvider>` (from @clerk/tanstack-start)
//   that loads Clerk's JS via the standard publishable-key flow. It also
//   mounts <ClerkTokenBridge /> inside the provider, which keeps
//   window.__clerkAuthToken in sync with useAuth().getToken() so that the
//   server-fn attacher (Step 5) can forward a Clerk Session JWT to
//   Step 4's server middleware.
//
// Lazy-loading the Clerk fragment via React.lazy keeps Clerk JS out of the
// initial bundle when the flag is off — the import path is only reached
// after a flag-aware <Suspense> parent triggers the load. We keep a null
// placeholder while the lazy chunk is in flight.
//
// IMPORTANT setup notes for the project owner:
//   1. USAGE — no manual config is needed to ship the flag-off path.
//   2. WHEN ENABLING Clerk — populate these environment variables:
//        VITE_CLERK_PUBLISHABLE_KEY=pk_test_*** …              (browser-safe)
//        CLERK_SECRET_KEY=sk_test_*** …                       (server-only)
//      and set USE_CLERK_AUTH=***
//   3. APPLE OAUTH — Clerk's Apple strategy requires an Apple Developer
//      ID in the Clerk Dashboard under Configure → SSO Connections → Apple.
//      Until that is set, the Apple button on the /auth page (Step 10)
//      will show a Clerk-side configuration error. Google does not require
//      any external setup for the Clerk development instance.
//   4. BUNDLE COST — flipping USE_CLERK_AUTH on pulls the Clerk React SDK
//      (~60 kB gzipped, including the Clerk JS script) into the client
//      bundle. Reverting requires flipping the flag and re-deploying.

import { Suspense, lazy, type ReactNode } from "react";
import { FLAGS } from "@/lib/feature-flags";

// Lazy-load the Clerk-using fragment so the Clerk React SDK only enters
// the client bundle after the boundary resolves to its active branch.
const ClerkProviderFragment = lazy(async () => {
  const mod = await import("@/integrations/clerk/client-fragment");
  return { default: mod.ClerkProviderFragment };
});

export function ClerkProviderBoundary({ children }: { children: ReactNode }) {
  if (!FLAGS.USE_CLERK_AUTH) {
    // Cold path — no Clerk import, no JS harness. Identical to today.
    return <>{children}</>;
  }
  // Warm path — render the lazy-loaded Clerk fragment behind a small
  // Suspense fallback. The fragment itself mounts <ClerkProvider> with
  // the publishable key, plus <ClerkTokenBridge /> inside the provider.
  return (
    <Suspense fallback={<>{children}</>}>
      <ClerkProviderFragment>{children}</ClerkProviderFragment>
    </Suspense>
  );
}
