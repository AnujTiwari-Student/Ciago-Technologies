import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { resolveMyPortal } from "@/lib/portal.functions";
import { ensureClerkMapping } from "@/integrations/clerk/ensure-mapping.server";

export const Route = createFileRoute("/auth/sso-callback")({
  component: SsoCallbackPage,
});

function SsoCallbackPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      // Clerk loaded but no session — user not authenticated
      // Wait a bit longer in case session is still being established
      const timeout = setTimeout(() => {
        if (!done) {
          window.location.href = "/auth";
        }
      }, 5000);
      return () => clearTimeout(timeout);
    }

    // User is signed in — finish the flow
    setDone(true);

    (async () => {
      try {
        await ensureClerkMapping();
        const dest = await resolveMyPortal({ data: { portal: "candidate", requested: "/" } });
        window.location.href = dest;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Authentication failed";
        setError(msg);
        setTimeout(() => {
          window.location.href = "/auth";
        }, 3000);
      }
    })();
  }, [isLoaded, isSignedIn, user, done]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-center">
          <p className="text-sm font-semibold text-destructive">Authentication Error</p>
          <p className="mt-2 text-xs text-destructive/80">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">Redirecting to login...</p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Completing sign-in...</p>
        </div>
      )}
    </main>
  );
}
