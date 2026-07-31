import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FLAGS } from "@/lib/feature-flags";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";
import { resolveMyPortal } from "@/lib/portal.functions";
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

function SsoCallbackPage() {
  const navigate = useNavigate();
  const clerk = useClerk();
  const { user: clerkUser, isLoaded } = useUser();
  const [redirecting, setRedirecting] = useState(false);
  const [attemptedRedirect, setAttemptedRedirect] = useState(false);

  useEffect(() => {
    // Don't run if already redirecting or if we've already tried
    if (redirecting || attemptedRedirect) return;

    // Wait for Clerk to fully load
    if (!isLoaded) return;

    // If we have a signed-in user, handle the OAuth callback
    if (clerkUser) {
      setAttemptedRedirect(true);
      setRedirecting(true);

      // Give the session a moment to fully establish
      setTimeout(() => {
        resolveMyPortal({ data: { portal: "candidate", requested: "/" } })
          .then((dest) => {
            toast.success("Signed in successfully.");
            navigate({ to: dest });
          })
          .catch((err) => {
            console.error("[sso-callback] Failed to resolve portal:", err);
            // Fallback to /my-applications on error
            toast.success("Signed in successfully.");
            navigate({ to: "/my-applications" });
          });
      }, 100);
      return;
    }

    // If loaded but no user, check if there's an active session being created
    // Clerk might still be processing the OAuth callback
    if (clerk.session) {
      // Session exists, wait a bit more for user to populate
      return;
    }

    // No user and no session after loading - something went wrong
    // But give it a few seconds before giving up
    const giveUpTimer = setTimeout(() => {
      if (!attemptedRedirect && isLoaded && !clerkUser && !clerk.session) {
        console.error("[sso-callback] No user after OAuth redirect");
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
