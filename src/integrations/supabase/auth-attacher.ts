import { createMiddleware } from "@tanstack/react-start";

declare global {
  interface Window {
    __clerkAuthToken?: string;
  }
}

function readClerkToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const v = window.__clerkAuthToken;
  if (!v) return undefined;
  return v;
}

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client((async ({
  next,
}: any) => {
  const token = readClerkToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}) as any);
