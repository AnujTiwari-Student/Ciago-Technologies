import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import {
  educationalQualificationsSchema,
  normalizeEducationalQualifications,
  normalizePreviousWorkExperiences,
  previousWorkExperiencesSchema,
} from "@/lib/job-application-fields";
import { enforceRateLimit, getClientIp, getClientHost } from "@/lib/rateLimit.server";
import { verifyTurnstile } from "@/lib/turnstile.server";

const inputSchema = z.object({
  roleId: z.string().min(1).max(64),
  roleTitle: z.string().trim().min(1).max(200),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phoneNumber: z.string().trim().max(50).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  coverLetter: z.string().trim().max(10000).optional().or(z.literal("")),
  portfolioUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  resumeStoragePath: z.string().trim().max(500).optional().or(z.literal("")),
  resumeLink: z.string().trim().url().max(500).optional().or(z.literal("")),
  expectedSalaryCurrency: z.string().trim().max(10).optional().or(z.literal("")),
  expectedSalaryMin: z.string().trim().max(20).optional().or(z.literal("")),
  expectedSalaryMax: z.string().trim().max(20).optional().or(z.literal("")),
  educationalQualifications: educationalQualificationsSchema,
  previousWorkExperiences: previousWorkExperiencesSchema,
  turnstileToken: z.string().max(4096).optional().or(z.literal("")),
  hp: z.string().max(200).optional().or(z.literal("")),
});

const HIRING_EMAIL = "career@ciagotech.com";
const FROM_EMAIL = "Ciago Careers <onboarding@resend.dev>";

export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (data.hp && data.hp.trim().length > 0) {
      return { ok: true, applicationId: "spam", emailSent: false };
    }
    const ip = getClientIp();
    await enforceRateLimit({
      bucket: "apply",
      key: `${context.userId}:${ip}`,
      max: 10,
      windowSeconds: 60 * 60,
    });
    await verifyTurnstile(data.turnstileToken || undefined, ip, getClientHost());

    if (!data.resumeStoragePath && !data.resumeLink) {
      throw new Error("Provide a resume file or a resume link.");
    }

    const adminDb = getAdminDb();
    const educationalQualifications = normalizeEducationalQualifications(
      data.educationalQualifications,
    );
    const previousWorkExperiences = normalizePreviousWorkExperiences(data.previousWorkExperiences);

    // 90-day cooldown check + insert (replaces apply_for_role RPC)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recent = await adminDb.jobApplication.findFirst({
      where: {
        userId: context.userId,
        roleId: data.roleId,
        createdAt: { gte: ninetyDaysAgo },
      },
    });
    if (recent) {
      throw new Error("You have already applied for this role within the last 90 days.");
    }

    const inserted = await adminDb.jobApplication.create({
      data: {
        userId: context.userId,
        roleId: data.roleId,
        roleTitle: data.roleTitle,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber || null,
        country: data.country || null,
        coverLetter: data.coverLetter || null,
        portfolioUrl: data.portfolioUrl || null,
        resumeStoragePath: data.resumeStoragePath || null,
        resumeLink: data.resumeLink || null,
        expectedSalaryCurrency: data.expectedSalaryCurrency || "INR",
        expectedSalaryMin: data.expectedSalaryMin ? BigInt(data.expectedSalaryMin) : null,
        expectedSalaryMax: data.expectedSalaryMax ? BigInt(data.expectedSalaryMax) : null,
        educationalQualifications:
          educationalQualifications.length > 0 ? educationalQualifications : null,
        previousWorkExperiences:
          previousWorkExperiences.length > 0 ? previousWorkExperiences : null,
        status: "applied",
      },
    });

    let resumeAccessUrl: string | null = data.resumeLink || null;
    if (data.resumeStoragePath) {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      const result = await storage.createSignedUrl(
        "resumes",
        data.resumeStoragePath,
        60 * 60 * 24 * 7,
      );
      if (result.signedUrl) resumeAccessUrl = result.signedUrl;
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
          applicationId: inserted.id,
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

    // Trigger Frappe HR provisioning (non-blocking)
    try {
      const { isFrappeEmployeeSyncEnabled } = await import("@/lib/feature-flags.server");
      const frappeEnabled = await isFrappeEmployeeSyncEnabled();
      if (frappeEnabled) {
        const { handleFrappeApplicationApplied } = await import("@/lib/frappe-applied-handler");
        const { createFrappeClient } = await import("@/integrations/frappe/client");
        const client = createFrappeClient();
        handleFrappeApplicationApplied({
          db: adminDb,
          client,
          applicationId: inserted.id,
          correlationId: `new-application-${inserted.id}`,
        }).catch((e) => {
          console.error("[apply-frappe] provisioning failed", {
            applicationId: inserted.id,
            error: e.message,
          });
        });
      }
    } catch (e) {
      console.error("[apply-frappe] trigger failed", e instanceof Error ? e.message : e);
    }

    // Trigger Frappe Job Applicant sync (non-blocking, Stage 2)
    try {
      const { isFrappeEmployeeSyncEnabled } = await import("@/lib/feature-flags.server");
      const frappeEnabled = await isFrappeEmployeeSyncEnabled();
      if (frappeEnabled) {
        const { syncJobApplicationToFrappe } = await import("@/lib/frappe-applicant-sync");
        const { createFrappeClient } = await import("@/integrations/frappe/client");
        const client = createFrappeClient();
        syncJobApplicationToFrappe(adminDb, client, inserted.id).catch((e) => {
          console.error("[apply-frappe-applicant] sync failed", {
            applicationId: inserted.id,
            error: e.message,
          });
        });
      }
    } catch (e) {
      console.error("[apply-frappe-applicant] trigger failed", e instanceof Error ? e.message : e);
    }

    return { ok: true, applicationId: inserted.id, emailSent };
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
    s.replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
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
