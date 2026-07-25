import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// Cloudflare Turnstile "always passes" test sitekey — safe for dev/preview
// where the real sitekey's domain allowlist doesn't include the host.
const TEST_SITE_KEY = "1x00000000000000000000AA";

function isPreviewHost(host: string | null): boolean {
  if (!host) return true;
  const h = host.toLowerCase();
  return (
    h.startsWith("localhost") ||
    h.startsWith("127.0.0.1") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com")
  );
}

// Exposes non-secret public config to the browser without VITE_ env plumbing.
// Turnstile *site* keys are meant to be public (they render in the widget).
export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  const host = req?.headers.get("host") ?? null;
  const configured = process.env.TURNSTILE_SITE_KEY ?? "";
  const turnstileSiteKey = isPreviewHost(host) ? TEST_SITE_KEY : configured;
  return { turnstileSiteKey };
});
