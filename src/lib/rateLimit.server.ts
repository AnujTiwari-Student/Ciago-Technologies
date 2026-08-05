import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { getAdminDb } from "@/lib/db/admin";

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

export async function enforceRateLimit(opts: {
  bucket: string;
  key: string;
  max: number;
  windowSeconds: number;
}): Promise<void> {
  const adminDb = getAdminDb();
  const since = new Date(Date.now() - opts.windowSeconds * 1000);

  try {
    const count = await adminDb.rateLimit.count({
      where: {
        bucket: opts.bucket,
        key: opts.key,
        occurredAt: { gte: since },
      },
    });

    if (count >= opts.max) {
      throw new Error("Too many requests — please try again in a few minutes.");
    }

    await adminDb.rateLimit.create({
      data: { bucket: opts.bucket, key: opts.key },
    });

    // Best-effort prune of expired rows (~1% of calls)
    if (Math.random() < 0.01) {
      const cutoff = new Date(Date.now() - 3600 * 1000);
      await adminDb.rateLimit
        .deleteMany({
          where: { occurredAt: { lt: cutoff } },
        })
        .catch(() => {});
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Too many requests")) throw e;
    console.error("[rate-limit] error", e);
  }
}
