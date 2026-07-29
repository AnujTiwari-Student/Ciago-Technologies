import { createFileRoute, redirect } from "@tanstack/react-router";
import { FLAGS } from "@/lib/feature-flags";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";

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
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </main>
  );
}
