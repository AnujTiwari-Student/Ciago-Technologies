// Server-only sliding-window rate limiter backed by public.rate_limits.
// Use inside createServerFn handlers.
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export function getClientIp(): string {
  try {
    const fwd = getRequestHeader("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) return cf.trim();
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function getClientHost(): string | null {
  try {
    return getRequestHeader("host") ?? null;
  } catch {
    return null;
  }
}

/**
 * Enforce a sliding window: at most `max` events per `windowSeconds` for the
 * given (bucket, key) pair. Throws a user-facing Error when exceeded.
 */
export async function enforceRateLimit(opts: {
  bucket: string;
  key: string;
  max: number;
  windowSeconds: number;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("rate_limits")
    .select("id", { head: true, count: "exact" })
    .eq("bucket", opts.bucket)
    .eq("key", opts.key)
    .gte("occurred_at", since);

  if (error) {
    // Fail open on limiter infra errors so a DB blip doesn't take forms down.
    console.error("[rate-limit] count failed", error.message);
    return;
  }

  if ((count ?? 0) >= opts.max) {
    throw new Error("Too many requests — please try again in a few minutes.");
  }

  const { error: insErr } = await supabaseAdmin
    .from("rate_limits")
    .insert({ bucket: opts.bucket, key: opts.key });
  if (insErr) console.error("[rate-limit] record failed", insErr.message);

  // Best-effort prune of expired rows (~1% of calls).
  if (Math.random() < 0.01) {
    try {
      await supabaseAdmin.rpc("prune_rate_limits" as any);
    } catch {
      /* ignore */
    }
  }
}
