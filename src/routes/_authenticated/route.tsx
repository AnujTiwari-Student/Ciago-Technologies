import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";

declare global {
  interface Window {
    __clerkAuthToken?: string;
    __clerkReady?: boolean;
  }
}

function waitForClerkToken(timeoutMs = 5000): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const token = window.__clerkAuthToken;
  if (token) return Promise.resolve(token);
  if (window.__clerkReady) return Promise.resolve(null);

  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      const t = window.__clerkAuthToken;
      if (t) {
        clearInterval(interval);
        resolve(t);
      } else if (window.__clerkReady || Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const clerkAuthEnabled = await isClerkAuthEnabledFn();
    if (!clerkAuthEnabled) {
      throw redirect({ to: "/forbidden", search: { reason: "clerk_auth_disabled" } });
    }

    const token = await waitForClerkToken();
    if (!token) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: { id: "", email: "", app_metadata: {}, user_metadata: {} } };
  },
  component: () => <Outlet />,
});
