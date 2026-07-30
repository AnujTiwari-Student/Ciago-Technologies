import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isClerkAuthEnabledFn } from "@/lib/feature-flags.functions";

declare global {
  interface Window {
    __clerkAuthToken?: string;
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const clerkAuthEnabled = await isClerkAuthEnabledFn();
    if (!clerkAuthEnabled) {
      throw redirect({ to: "/forbidden", search: { reason: "clerk_auth_disabled" } });
    }

    const token = typeof window !== "undefined" ? window.__clerkAuthToken : "";
    if (!token) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    return { user: { id: "", email: "", app_metadata: {}, user_metadata: {} } };
  },
  component: () => <Outlet />,
});
