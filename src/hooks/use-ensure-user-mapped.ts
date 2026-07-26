// useEnsureUserMapped — client-side hook mounted in __root.tsx that ensures
// a Clerk user's Supabase mapping is present before any authenticated route
// touches the database.
//
// Background: in the Clerk branch, `requireSupabaseAuth` (the server-fn
// middleware) provisions the clerk_user_map row on every authenticated
// server-fn invocation. So *most* flows are self-provisioning. But there are
// two situations where the client does not yet speak to a server fn before
// reading data:
//
//   1. First page mount after Clerk session initialisation. The Clerk JS
//      runtime publishes the session token via window.__clerkAuthToken
//      (Step 6's boundary); the database has not yet been touched. If the
//      user then *reads* data via the existing per-page beforeLoad (which
//      runs `requireSupabaseAuth`), we're covered because the attacher
//      provisions on first invocation.
//   2. Public pages that never call a server fn — they don't touch the
//      database, so they don't need a mapping.
//
// This hook is the fallback for case (1) — it explicitly invokes the
// `ensureClerkMapping` server fn on first load when the user is signed in
// via Clerk, so the mapping is guaranteed before the user interacts with
// any authenticated surface. We mount it inside `<AuthProvider>` so it
// reads from the useAuth() adapter (Step 7) and only invokes the server fn
// when `user` is non-null and the flag is on.
//
// The hook is fire-and-forget. Errors are logged but never block rendering.
// Throttle: subsequent remounts within `THROTTLE_MS` reuse the previous
// result so navigating across the SPA doesn't ping the server fn repeatedly.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { FLAGS } from "@/lib/feature-flags";
import { ensureClerkMapping } from "@/integrations/clerk/ensure-mapping.server";

const THROTTLE_MS = 30_000; // once per 30s while on the same session.

export function useEnsureUserMapped() {
  const { user, loading } = useAuth();
  const lastInvokedRef = useRef<number>(0);
  const lastSessionSubjectRef = useRef<string | null>(null);
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!FLAGS.USE_CLERK_AUTH) {
      // Cold path: nothing to do — the legacy Supabase path has no Clerk
      // identity to map.
      return;
    }
    if (loading || !user) return;

    // Only run when the user id changes, or once per THROTTLE_MS while the
    // same user id persists. Both guards keep the server fn from firing on
    // every route transition.
    const subject = user.id;
    const now = Date.now();
    const withinThrottle = now - lastInvokedRef.current < THROTTLE_MS;
    const sameSubject = lastSessionSubjectRef.current === subject;
    if (withinThrottle && sameSubject) return;

    lastInvokedRef.current = now;
    lastSessionSubjectRef.current = subject;

    let cancelled = false;
    (async () => {
      try {
        await ensureClerkMapping();
        if (!cancelled) setReady(true);
      } catch (err) {
        // Surface runtime errors to console but never block UI refresh.
        console.warn(
          "[clerk] ensureClerkMapping failed:",
          err instanceof Error ? err.message : err,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);
}
