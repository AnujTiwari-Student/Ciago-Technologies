import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit, getClientIp, getClientHost } from "@/lib/rateLimit.server";
import { verifyTurnstile } from "@/lib/turnstile.server";
import { getAdminDb } from "@/lib/db/admin";

const inputSchema = z.object({
  email: z.string().trim().email().max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "Invalid resource"),
  turnstileToken: z.string().max(4096).optional().or(z.literal("")),
  hp: z.string().max(200).optional().or(z.literal("")),
});

export const requestResource = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.hp && data.hp.trim().length > 0) return { ok: true };
    const ip = getClientIp();
    await enforceRateLimit({
      bucket: "resource",
      key: ip,
      max: 20,
      windowSeconds: 60 * 60,
    });
    await verifyTurnstile(data.turnstileToken || undefined, ip, getClientHost());

    const adminDb = getAdminDb();
    await adminDb.resourceDownload.create({
      data: { email: data.email, resourceSlug: data.slug },
    });
    return { ok: true };
  });
