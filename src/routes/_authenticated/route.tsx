// Authenticated layout guard — runs only on the client (`ssr: false`).
//
// Toggles source based on FLAGS.USE_CLERK_AUTH:
//   - Flag off: original Supabase `getUser()` check, byte-equivalent to the
//     pre-migration implementation. Net behaviour is identical to today.
//   - Flag on: Clerk branch. We read `window.__clerkAuthToken`, which is
//     published by <ClerkTokenBridge /> (Step 6). The bridge writes `""` when
//     signed out (or before Clerk has resolved the session) and the active
//     Clerk Session JWT when signed in. There is a brief first-paint race
//     while the bridge useEffect is about to run; for that window we err on
//     the side of `loading=true` rather than prematurely redirecting, so an
//     already-signed-in user whose token hasn't been published yet isn't
//     bounced to /auth mid-flight.
//
// If `window.__clerkAuthToken` is undefined (the flag is on but the bridge
// has never run, e.g. some non-React entry point), we still treat that as
// "not signed in" rather than crashing — the safest default.

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FLAGS } from "@/lib/feature-flags";

declare global {
  interface Window {
    // Published by the Clerk token bridge in client.tsx.
    __clerkAuthToken?: string;
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (!FLAGS.USE_CLERK_AUTH) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw redirect({ to: "/auth", search: { redirect: location.pathname } });
      }
      return { user: data.user };
    }

    // Clerk branch: read the published token.
    const token = typeof window !== "undefined" ? window.__clerkAuthToken : "";
    // Undefined / empty → signed out (or bridge hasn't run yet). Redirect.
    if (!token) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: { id: "", email: "", app_metadata: {}, user_metadata: {} } };
  },
  component: () => <Outlet />,
});
