import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit, getClientIp, getClientHost } from "@/lib/rateLimit.server";
import { verifyTurnstile } from "@/lib/turnstile.server";

const inputSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(1).max(200),
  projectType: z.string().trim().min(1).max(100),
  scale: z.string().trim().min(1).max(100),
  timeline: z.string().trim().min(1).max(100),
  budgetLow: z.number().int().min(0).max(10_000_000),
  budgetHigh: z.number().int().min(0).max(10_000_000),
  turnstileToken: z.string().max(4096).optional().or(z.literal("")),
  hp: z.string().max(200).optional().or(z.literal("")),
});

export const submitEstimate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.hp && data.hp.trim().length > 0) return { ok: true };
    const ip = getClientIp();
    await enforceRateLimit({
      bucket: "estimate",
      key: ip,
      max: 10,
      windowSeconds: 60 * 60,
    });
    await verifyTurnstile(data.turnstileToken || undefined, ip, getClientHost());

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("project_estimates").insert({
      full_name: data.fullName,
      email: data.email,
      company: data.company,
      project_type: data.projectType,
      scale: data.scale,
      timeline: data.timeline,
      budget_low: data.budgetLow,
      budget_high: data.budgetHigh,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
