// Server-only Cloudflare Turnstile verification helper.
// Bypasses cleanly in local/dev when TURNSTILE_SECRET_KEY isn't configured.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare "always passes" test secret — pairs with the test sitekey used
// on preview/localhost hosts so bot check succeeds without a domain match.
const TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
  host?: string | null,
): Promise<void> {
  const configured = process.env.TURNSTILE_SECRET_KEY;
  const isPreview =
    !host ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com");
  const secret = isPreview ? TEST_SECRET : configured;
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — skipping bot check.");
    return;
  }
  if (!token || token.length < 10) {
    throw new Error("Bot check required — please complete the security prompt.");
  }
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!json.success) {
      console.error("[turnstile] verification failed", json["error-codes"]);
      throw new Error("Bot check failed — please refresh and try again.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Bot check")) throw err;
    console.error("[turnstile] network error", err);
    throw new Error("Bot check unavailable — please try again shortly.");
  }
}
