import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit, getClientIp, getClientHost } from "@/lib/rateLimit.server";
import { verifyTurnstile } from "@/lib/turnstile.server";

const inputSchema = z.object({
  roleId: z.string().min(1).max(64),
  roleTitle: z.string().trim().min(1).max(200),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  portfolioUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  resumeStoragePath: z.string().trim().max(500).optional().or(z.literal("")),
  resumeLink: z.string().trim().url().max(500).optional().or(z.literal("")),
  turnstileToken: z.string().max(4096).optional().or(z.literal("")),
  // Honeypot — bots fill hidden fields; legitimate users leave it blank.
  hp: z.string().max(200).optional().or(z.literal("")),
});

const HIRING_EMAIL = "career@ciagotech.com";
const FROM_EMAIL = "Ciago Careers <onboarding@resend.dev>";

export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Bot / spam mitigation.
    if (data.hp && data.hp.trim().length > 0) {
      // Silently drop honeypot hits.
      return { ok: true, applicationId: "spam", emailSent: false };
    }
    const ip = getClientIp();
    await enforceRateLimit({
      bucket: "apply",
      key: `${userId}:${ip}`,
      max: 10,
      windowSeconds: 60 * 60,
    });
    await verifyTurnstile(data.turnstileToken || undefined, ip, getClientHost());

    if (!data.resumeStoragePath && !data.resumeLink) {
      throw new Error("Provide a resume file or a resume link.");
    }

    // Atomic apply via SECURITY DEFINER RPC with advisory-lock + 90-day cooldown re-check.
    // This prevents concurrent duplicate submissions for the same user+role.
    const { data: rpcData, error: rpcErr } = await supabase.rpc("apply_for_role", {
      _role_id: data.roleId,
      _role_title: data.roleTitle,
      _full_name: data.fullName,
      _email: data.email,
      _portfolio_url: data.portfolioUrl || "",
      _resume_storage_path: data.resumeStoragePath || "",
      _resume_link: data.resumeLink || "",
    });
    if (rpcErr) throw new Error(rpcErr.message);
    const insertedId = Array.isArray(rpcData) ? rpcData[0]?.application_id : (rpcData as any)?.application_id;
    if (!insertedId) throw new Error("Failed to record application");
    const inserted = { id: insertedId as string };

    let resumeAccessUrl: string | null = data.resumeLink || null;
    if (data.resumeStoragePath) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from("resumes")
        .createSignedUrl(data.resumeStoragePath, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) resumeAccessUrl = signed.signedUrl;
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    let emailSent = false;
    if (RESEND_API_KEY) {
      try {
        const html = renderEmail({
          fullName: data.fullName,
          email: data.email,
          roleTitle: data.roleTitle,
          portfolioUrl: data.portfolioUrl || null,
          resumeUrl: resumeAccessUrl,
          applicationId: inserted!.id,
        });
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [HIRING_EMAIL],
            reply_to: data.email,
            subject: `New application: ${data.roleTitle} — ${data.fullName}`,
            html,
          }),
        });
        emailSent = res.ok;
        if (!res.ok) console.error("[resend] failed", res.status, await res.text());
      } catch (err) {
        console.error("[resend] error", err);
      }
    } else {
      console.warn("[applications] RESEND_API_KEY not set — skipping notification email.");
    }

    return { ok: true, applicationId: inserted!.id, emailSent };
  });

function renderEmail(a: {
  fullName: string;
  email: string;
  roleTitle: string;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  applicationId: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 4px;font-size:20px;color:#0f172a">New application received</h1>
      <p style="margin:0 0 20px;color:#64748b;font-size:13px">Ciago Careers · application ${esc(a.applicationId)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#0f172a">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Role</td><td style="padding:6px 0;font-weight:600">${esc(a.roleTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Name</td><td style="padding:6px 0">${esc(a.fullName)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0"><a href="mailto:${esc(a.email)}" style="color:#0891b2">${esc(a.email)}</a></td></tr>
        ${a.portfolioUrl ? `<tr><td style="padding:6px 0;color:#64748b">Portfolio</td><td style="padding:6px 0"><a href="${esc(a.portfolioUrl)}" style="color:#0891b2">${esc(a.portfolioUrl)}</a></td></tr>` : ""}
        ${a.resumeUrl ? `<tr><td style="padding:6px 0;color:#64748b">Resume</td><td style="padding:6px 0"><a href="${esc(a.resumeUrl)}" style="color:#0891b2">Download resume</a></td></tr>` : ""}
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Resume link expires in 7 days.</p>
    </div>
  </body></html>`;
}
