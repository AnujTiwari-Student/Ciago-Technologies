import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FLAGS } from "@/lib/feature-flags";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";
import { resolveMyPortal } from "@/lib/portal.functions";
import { ensureClerkMapping } from "@/integrations/clerk/ensure-mapping.server";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useClerk, useUser } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/auth/sso-callback")({
  beforeLoad: async () => {
    await enforceSsoCallbackAccess();
  },
  component: SsoCallbackPage,
});

export async function enforceSsoCallbackAccess(): Promise<void> {
  if (!FLAGS.USE_CLERK_AUTH) {
    throw redirect({ to: "/auth" });
  }
  const enabled = await isClerkAuthEnabledFn();
  if (!enabled) {
    throw redirect({ to: "/forbidden", search: { reason: "clerk_auth_disabled" } });
  }
}

declare global {
  interface Window {
    __clerkAuthToken?: string;
    __clerkReady?: boolean;
  }
}

async function waitForClerkToken(timeoutMs = 5000): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (window.__clerkAuthToken) return window.__clerkAuthToken;
  if (window.__clerkReady) return null;

  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.__clerkAuthToken) {
        clearInterval(interval);
        resolve(window.__clerkAuthToken);
      } else if (window.__clerkReady || Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 50);
  });
}

function SsoCallbackPage() {
  const navigate = useNavigate();
  const clerk = useClerk();
  const { user: clerkUser, isLoaded } = useUser();
  const [redirecting, setRedirecting] = useState(false);
  const [attemptedRedirect, setAttemptedRedirect] = useState(false);

  useEffect(() => {
    if (redirecting || attemptedRedirect) return;
    if (!isLoaded) return;

    const finishSignIn = async () => {
      setAttemptedRedirect(true);
      setRedirecting(true);
      try {
        const token = await waitForClerkToken();
        if (!token) {
          throw new Error("Clerk session token is not ready yet");
        }

        const mapping = await ensureClerkMapping();
        if (!mapping.ok) {
          throw new Error(`Failed to ensure user mapping: ${mapping.reason}`);
        }

        const dest = await resolveMyPortal({ data: { portal: "candidate", requested: "/" } });
        toast.success("Signed in successfully.");
        navigate({ to: dest });
      } catch (err) {
        console.error("[sso-callback] Failed to complete OAuth callback:", err);
        toast.error("Authentication incomplete. Please try again.");
        navigate({ to: "/auth" });
      }
    };

    if (clerkUser || clerk.session) {
      void finishSignIn();
      return;
    }

    const giveUpTimer = setTimeout(() => {
      if (!attemptedRedirect && isLoaded && !clerkUser && !clerk.session) {
        console.error("[sso-callback] No Clerk session after OAuth redirect");
        toast.error("Authentication incomplete. Please try again.");
        navigate({ to: "/auth" });
      }
    }, 5000);

    return () => clearTimeout(giveUpTimer);
  }, [clerkUser, isLoaded, clerk.session, navigate, redirecting, attemptedRedirect]);

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          {!isLoaded ? "Completing sign-in…" : redirecting ? "Redirecting…" : "Verifying authentication…"}
        </p>
      </main>
      <Toaster />
    </>
  );
}
