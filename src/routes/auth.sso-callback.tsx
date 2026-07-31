import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FLAGS } from "@/lib/feature-flags";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";
import { useAuth } from "@/lib/auth";
import { resolveMyPortal } from "@/lib/portal.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

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
  const { user, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (loading || redirecting) return;

    if (user) {
      setRedirecting(true);
      // User is authenticated, redirect to appropriate portal
      resolveMyPortal({ data: { portal: "candidate", requested: "/" } })
        .then((dest) => {
          toast.success("Signed in successfully.");
          navigate({ to: dest });
        })
        .catch((err) => {
          console.error("[sso-callback] Failed to resolve portal:", err);
          // Fallback to /my-applications on error
          navigate({ to: "/my-applications" });
        });
    } else {
      // No user after OAuth flow - redirect back to auth
      setTimeout(() => {
        toast.error("Authentication incomplete. Please try again.");
        navigate({ to: "/auth" });
      }, 2000);
    }
  }, [user, loading, navigate, redirecting]);

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          {loading ? "Completing sign-in…" : redirecting ? "Redirecting…" : "Verifying…"}
        </p>
      </main>
      <Toaster />
    </>
  );
}
