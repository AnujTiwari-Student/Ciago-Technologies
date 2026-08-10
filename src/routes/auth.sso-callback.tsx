import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AuthenticateWithRedirectCallback, useUser } from "@clerk/tanstack-react-start";
import { resolveMyPortal } from "@/lib/portal.functions";
import { ensureClerkMapping } from "@/integrations/clerk/ensure-mapping.server";

declare global {
  interface Window {
    __clerkAuthToken?: string;
  }
}

export const Route = createFileRoute("/auth/sso-callback")({
  component: SsoCallbackPage,
});

function waitForClerkToken(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.__clerkAuthToken) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error("Timed out waiting for auth token"));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function SsoCallbackPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [error, setError] = useState<string | null>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (hasNavigated.current) return;
    if (!isLoaded || !isSignedIn) return;

    hasNavigated.current = true;

    (async () => {
      try {
        // Wait for ClerkTokenBridge to populate the auth token
        await waitForClerkToken();
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
  }, [isLoaded, isSignedIn]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/auth/sso-callback"
        signUpFallbackRedirectUrl="/auth/sso-callback"
      />
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
