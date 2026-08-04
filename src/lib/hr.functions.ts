import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import { docLabel } from "@/lib/onboarding.functions";

export type OnboardingQueueRow = {
  onboarding_id: string;
  user_id: string;
  application_id: string;
  role_title: string;
  department: string | null;
  job_code: string | null;
  track_type: "standard" | "manager_track" | "hr_track" | null;
  employment_type: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  status: string;
  verification_status: string;
  current_step: number;
  doj: string | null;
  submitted_at: string | null;
  updated_at: string;
  docs_total: number;
  docs_approved: number;
  docs_pending: number;
  docs_issues: number;
};

export type OnboardingAuditEntry = {
  id: string;
  timestamp: string;
  actor_email: string | null;
  action: string;
  target_resource: string | null;
  details: any;
};

export type OnboardingDocDetail = {
  id: string;
  doc_key: string;
  status: "pending" | "approved" | "changes_requested" | "rejected";
  feedback: string | null;
  storage_path: string;
  original_filename: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  signed_url: string | null;
  version: number;
  is_reupload: boolean; // true if this is a newer version after changes requested/rejected
};

export type OnboardingDetail = {
  onboarding: {
    id: string;
    user_id: string;
    application_id: string;
    role_title: string;
    department: string | null;
    status: string;
    verification_status: string;
    current_step: number;
    doj: string | null;
    submitted_at: string | null;
    emergency_contact: any;
    id_ack: boolean;
    code_of_conduct_ack: boolean;
    rejection_feedback: string | null;
    verified_by: string | null;
    verified_at: string | null;
    form_state: Record<string, any> | null;
    created_at: string;
    updated_at: string;
  };
  candidate: {
    email: string | null;
    full_name: string | null;
    job_code: string | null;
  };
  required_docs: string[];
  documents: OnboardingDocDetail[];
  audit: OnboardingAuditEntry[];
};

async function assertHrOrAdmin(_db: any, userId: string): Promise<void> {
  // Bypass RLS for role checks — roles must always be readable
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({ where: { userId, role: "admin" } });
  if (count === 0) throw new Error("Forbidden");
}

export const listOnboardingQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingQueueRow[]> => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const adminRoleCount = await adminDb.userRole.count({
      where: { userId: context.userId, role: "admin" },
    });
    const isAdmin = adminRoleCount > 0;

    const recs = await adminDb.onboardingRecord.findMany({
      where: { status: { in: ["accepted", "submitted"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (recs.length === 0) return [];

    const selfFiltered = recs.filter((r) => r.userId !== context.userId);
    if (selfFiltered.length === 0) return [];

    const appIds = selfFiltered.map((r) => r.applicationId);
    const apps = await adminDb.jobApplication.findMany({
      where: { id: { in: appIds } },
      select: { id: true, email: true, fullName: true, roleId: true },
    });
    const appMap = new Map(apps.map((a) => [a.id, a]));

    const roleIds = Array.from(new Set(apps.map((a) => a.roleId).filter(Boolean)));
    const postings = roleIds.length
      ? await adminDb.jobPosting.findMany({
          where: { id: { in: roleIds } },
          select: { id: true, jobCode: true, trackType: true, employmentType: true },
        })
      : [];
    const postingMap = new Map(postings.map((p) => [p.id, p]));

    const ids = selfFiltered.map((r) => r.id);
    const docs = await adminDb.onboardingDocument.findMany({
      where: { onboardingId: { in: ids }, supersededAt: null },
      select: { onboardingId: true, status: true },
    });
    const docsAgg = new Map<
      string,
      { total: number; approved: number; pending: number; issues: number }
    >();
    for (const d of docs) {
      const agg = docsAgg.get(d.onboardingId) ?? { total: 0, approved: 0, pending: 0, issues: 0 };
      agg.total++;
      if (d.status === "approved") agg.approved++;
      else if (d.status === "pending") agg.pending++;
      else agg.issues++;
      docsAgg.set(d.onboardingId, agg);
    }

    const out: OnboardingQueueRow[] = [];
    for (const r of selfFiltered) {
      const app = appMap.get(r.applicationId);
      const posting = app ? postingMap.get(app.roleId) : null;
      const track = (posting?.trackType ?? null) as OnboardingQueueRow["track_type"];
      if (!isAdmin && track === "hr_track") continue;
      const agg = docsAgg.get(r.id) ?? { total: 0, approved: 0, pending: 0, issues: 0 };
      out.push({
        onboarding_id: r.id,
        user_id: r.userId,
        application_id: r.applicationId,
        role_title: r.roleTitle,
        department: r.department,
        job_code: posting?.jobCode ?? null,
        track_type: track,
        employment_type: posting?.employmentType ?? null,
        candidate_name: app?.fullName ?? null,
        candidate_email: app?.email ?? null,
        status: r.status,
        verification_status: r.verificationStatus,
        current_step: r.currentStep,
        doj: r.doj,
        submitted_at: r.submittedAt?.toISOString() ?? null,
        updated_at: r.updatedAt.toISOString(),
        docs_total: agg.total,
        docs_approved: agg.approved,
        docs_pending: agg.pending,
        docs_issues: agg.issues,
      });
    }
    return out;
  });

export const getOnboardingDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ onboarding_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<OnboardingDetail> => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { id: data.onboarding_id },
    });
    if (!rec) throw new Error("Onboarding not found");

    const app = await adminDb.jobApplication.findUnique({
      where: { id: rec.applicationId },
      select: { email: true, fullName: true, roleId: true },
    });
    const posting = app
      ? await adminDb.jobPosting.findUnique({
          where: { id: app.roleId },
          select: { jobCode: true, requiredOnboardingDocs: true },
        })
      : null;

    const docs = await adminDb.onboardingDocument.findMany({
      where: { onboardingId: data.onboarding_id, supersededAt: null },
      orderBy: { createdAt: "asc" },
    });

    // Signed URLs for HR review (private bucket, valid 15 minutes) — R2
    const { getStorage } = await import("@/lib/storage");
    const storage = getStorage();
    const documents: OnboardingDocDetail[] = [];
    for (const d of docs) {
      let signed: string | null = null;
      try {
        const result = await storage.createSignedUrl("onboarding-docs", d.storagePath, 60 * 15);
        signed = result.signedUrl;
      } catch {
        signed = null;
      }

      // Check if this is a re-upload (version > 1 AND status changed from changes_requested/rejected to pending)
      const isReupload = (d.version ?? 1) > 1 &&
                        d.status === "pending" &&
                        d.reviewedAt !== null; // has been reviewed before

      documents.push({
        id: d.id,
        doc_key: d.docKey,
        status: d.status as OnboardingDocDetail["status"],
        feedback: d.feedback,
        storage_path: d.storagePath,
        original_filename: d.originalFilename,
        reviewed_by: d.reviewedBy,
        reviewed_at: d.reviewedAt?.toISOString() ?? null,
        created_at: d.createdAt.toISOString(),
        updated_at: d.updatedAt.toISOString(),
        signed_url: signed,
        version: d.version ?? 1,
        is_reupload: isReupload,
      });
    }

    const auditRows = await adminDb.auditLog.findMany({
      where: { targetResource: `onboarding_records/${data.onboarding_id}` },
      orderBy: { timestamp: "desc" },
      take: 200,
    });

    return {
      onboarding: {
        id: rec.id,
        user_id: rec.userId,
        application_id: rec.applicationId,
        role_title: rec.roleTitle,
        department: rec.department,
        status: rec.status,
        verification_status: rec.verificationStatus,
        current_step: rec.currentStep,
        doj: rec.doj,
        submitted_at: rec.submittedAt?.toISOString() ?? null,
        emergency_contact: rec.emergencyContact,
        id_ack: rec.idAck,
        code_of_conduct_ack: rec.codeOfConductAck,
        rejection_feedback: rec.rejectionFeedback,
        verified_by: rec.verifiedBy,
        verified_at: rec.verifiedAt?.toISOString() ?? null,
        form_state: (rec.formState as Record<string, any>) ?? null,
        created_at: rec.createdAt.toISOString(),
        updated_at: rec.updatedAt.toISOString(),
      },
      candidate: {
        email: app?.email ?? null,
        full_name: app?.fullName ?? null,
        job_code: posting?.jobCode ?? null,
      },
      required_docs: posting?.requiredOnboardingDocs ?? [],
      documents,
      audit: auditRows.map((a) => ({
        id: a.id,
        timestamp: a.timestamp.toISOString(),
        actor_email: a.actorEmail,
        action: a.action,
        target_resource: a.targetResource,
        details: a.details,
      })),
    };
  });

// -------------- helpers: side-effects for HR actions --------------

function docStatusEmail(
  candidateName: string,
  roleTitle: string,
  docName: string,
  status: "approved" | "changes_requested" | "rejected",
  feedback: string | null,
) {
  const label =
    status === "approved"
      ? "Approved"
      : status === "changes_requested"
        ? "Changes requested"
        : "Rejected";
  const intro =
    status === "approved"
      ? `Good news — your <strong>${docName}</strong> has been approved by our HR team.`
      : status === "changes_requested"
        ? `Our HR team has asked for changes to your <strong>${docName}</strong>. Please review the feedback below and re-upload the document.`
        : `Your <strong>${docName}</strong> has been rejected. Please review the feedback below and re-upload a corrected version.`;
  const feedbackBlock = feedback
    ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #0d9488;border-radius:6px;font-size:14px;color:#334155">${feedback.replace(/</g, "&lt;")}</div>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">
      <div style="font-weight:800;font-size:18px;letter-spacing:-0.01em">Ciago <span style="color:#0d9488">Technologies</span></div>
    </td></tr>
    <tr><td style="padding:32px">
      <p style="margin:0 0 12px;font-size:14px;color:#64748b">Onboarding · ${roleTitle}</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${docName}: ${label}</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#334155">Hi ${candidateName?.split(" ")[0] || "there"},</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">${intro}</p>
      ${feedbackBlock}
      <a href="https://ciagotech.com/onboarding" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;margin-top:8px">Open onboarding</a>
      <p style="margin:32px 0 0;font-size:13px;color:#64748b">— HR, Ciago Technologies</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
  return {
    subject: `[${roleTitle}] ${docName} — ${label}`,
    html,
    inAppTitle: `${docName}: ${label}`,
    inAppBody: feedback ? `${label} — ${feedback}` : `${docName} has been ${label.toLowerCase()}.`,
  };
}

function dojEmail(candidateName: string, roleTitle: string, doj: string) {
  const label = new Date(doj).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
    <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">
      <div style="font-weight:800;font-size:18px;letter-spacing:-0.01em">Ciago <span style="color:#0d9488">Technologies</span></div>
    </td></tr>
    <tr><td style="padding:32px">
      <p style="margin:0 0 12px;font-size:14px;color:#64748b">Welcome to the team · ${roleTitle}</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Your Date of Joining is set</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#334155">Hi ${candidateName?.split(" ")[0] || "there"},</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">
        We're excited to have you join Ciago Technologies. Your first day will be
        <strong>${label}</strong>. You'll receive your workstation, credentials, and Day-1 schedule on that morning.
      </p>
      <a href="https://ciagotech.com/my-applications" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">View My Applications</a>
      <p style="margin:32px 0 0;font-size:13px;color:#64748b">— Admin, Ciago Technologies</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
  return {
    subject: `Welcome to Ciago — Date of Joining: ${label}`,
    html,
    inAppTitle: `Date of Joining: ${label}`,
    inAppBody: `Your first day at Ciago is ${label}. You'll receive credentials and a Day-1 schedule on that morning.`,
  };
}

const reviewDocSchema = z.object({
  document_id: z.string().uuid(),
  status: z.enum(["approved", "changes_requested", "rejected"]),
  feedback: z.string().trim().max(1000).optional(),
  email_subject: z.string().trim().max(200).optional(),
  email_html: z.string().trim().max(20000).optional(),
});

export const reviewOnboardingDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => reviewDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    if ((data.status === "changes_requested" || data.status === "rejected") && !data.feedback) {
      throw new Error("Feedback is required when requesting changes or rejecting a document.");
    }
    const adminDb = getAdminDb();

    const doc = await adminDb.onboardingDocument.findUnique({
      where: { id: data.document_id },
      select: { id: true, onboardingId: true, userId: true, docKey: true, status: true },
    });
    if (!doc) throw new Error("Document not found");

    await adminDb.onboardingDocument.update({
      where: { id: data.document_id },
      data: {
        status: data.status,
        feedback: data.feedback ?? null,
        reviewedBy: context.userId,
        reviewedAt: new Date(),
      },
    });

    // If document is rejected or changes_requested, update overall verification_status too
    // This ensures user can edit even on subsequent rounds of changes
    if (data.status === "changes_requested" || data.status === "rejected") {
      await adminDb.onboardingRecord.update({
        where: { id: doc.onboardingId },
        data: {
          verificationStatus: "changes_requested",
        },
      });
    }

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { id: doc.onboardingId },
      select: { id: true, applicationId: true, roleTitle: true, userId: true },
    });
    const app = rec
      ? await adminDb.jobApplication.findUnique({
          where: { id: rec.applicationId },
          select: { email: true, fullName: true },
        })
      : null;

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "ONBOARDING_DOC_REVIEWED",
        targetResource: `onboarding_records/${doc.onboardingId}`,
        details: {
          document_id: data.document_id,
          doc_key: doc.docKey,
          from: doc.status,
          to: data.status,
          feedback: data.feedback ?? null,
          candidate_email: app?.email ?? null,
        },
      },
    });

    // Send notifications ONLY for changes_requested or rejected documents
    // This way users know which specific documents need attention
    if (data.status === "changes_requested" || data.status === "rejected") {
      const content = docStatusEmail(
        app?.fullName ?? "",
        rec?.roleTitle ?? "your role",
        docLabel(doc.docKey),
        data.status,
        data.feedback ?? null,
      );

      if (doc.userId) {
        await adminDb.inAppNotification.create({
          data: {
            userId: doc.userId,
            applicationId: rec?.applicationId ?? null,
            title: content.inAppTitle,
            body: content.inAppBody,
            link: "/onboarding",
          },
        });
      }

      if (app?.email) {
        try {
          const { sendResendEmail } = await import("@/lib/notifications.server");
          await sendResendEmail({
            to: app.email,
            subject: data.email_subject?.trim() || content.subject,
            html: data.email_html?.trim() || content.html,
          });
        } catch (e) {
          console.error("[hr] doc review email failed", e);
        }
      }
    }

    return { ok: true };
  });

const updateVerificationStatusSchema = z.object({
  onboarding_id: z.string().uuid(),
  verification_status: z.enum(["pending", "approved", "changes_requested", "rejected"]),
  rejection_feedback: z.string().trim().max(1000).optional(),
});

export const updateOnboardingVerificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => updateVerificationStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);

    if (data.verification_status === "rejected" && !data.rejection_feedback) {
      throw new Error("Rejection feedback is required when rejecting onboarding.");
    }

    const adminDb = getAdminDb();

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { id: data.onboarding_id },
      select: {
        id: true,
        applicationId: true,
        userId: true,
        roleTitle: true,
        verificationStatus: true
      },
    });
    if (!rec) throw new Error("Onboarding record not found");

    await adminDb.onboardingRecord.update({
      where: { id: data.onboarding_id },
      data: {
        verificationStatus: data.verification_status,
        verifiedBy: context.userId,
        verifiedAt: new Date(),
        rejectionFeedback: data.rejection_feedback ?? null,
      },
    });

    const app = await adminDb.jobApplication.findUnique({
      where: { id: rec.applicationId },
      select: { email: true, fullName: true },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "ONBOARDING_VERIFICATION_STATUS_UPDATED",
        targetResource: `onboarding_records/${data.onboarding_id}`,
        details: {
          from: rec.verificationStatus,
          to: data.verification_status,
          rejection_feedback: data.rejection_feedback ?? null,
          candidate_email: app?.email ?? null,
        },
      },
    });

    // When approved, auto-start background check
    if (data.verification_status === "approved" && rec.userId) {
      await adminDb.employee.upsert({
        where: { userId: rec.userId },
        create: {
          userId: rec.userId,
          backgroundCheckStatus: "in_progress",
        },
        update: {
          backgroundCheckStatus: "in_progress",
        },
      });
    }

    // Send notification
    const statusLabel = data.verification_status === "approved"
      ? "Approved"
      : data.verification_status === "changes_requested"
      ? "Changes Requested"
      : data.verification_status === "rejected"
      ? "Rejected"
      : "Under Review";

    if (rec.userId) {
      await adminDb.inAppNotification.create({
        data: {
          userId: rec.userId,
          applicationId: rec.applicationId,
          title: `Onboarding Status: ${statusLabel}`,
          body: data.rejection_feedback || `Your onboarding verification status has been updated to ${statusLabel.toLowerCase()}.`,
          link: "/onboarding",
        },
      });
    }

    if (app?.email && (data.verification_status === "approved" || data.verification_status === "rejected" || data.verification_status === "changes_requested")) {
      try {
        const { sendResendEmail } = await import("@/lib/notifications.server");
        const subject = data.verification_status === "approved"
          ? `[${rec.roleTitle}] Onboarding Approved - Welcome to Ciago!`
          : data.verification_status === "rejected"
          ? `[${rec.roleTitle}] Onboarding Rejected - Action Required`
          : `[${rec.roleTitle}] Onboarding Changes Required`;

        const intro = data.verification_status === "approved"
          ? "Great news! Your onboarding documents have been approved by our HR team."
          : data.verification_status === "rejected"
          ? "Our HR team has reviewed your onboarding and unfortunately it has been rejected. Please review the feedback below and re-submit your documents."
          : "Our HR team has reviewed your onboarding submission and requested some changes. Please review the feedback below and re-upload the necessary documents.";

        const actionText = data.verification_status === "approved"
          ? "You're all set! Your Date of Joining will be confirmed shortly."
          : "Please visit your onboarding page to review the specific documents that need attention and re-upload them.";

        const feedbackBlock = data.rejection_feedback
          ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #0d9488;border-radius:6px;font-size:14px;color:#334155">${data.rejection_feedback.replace(/</g, "&lt;")}</div>`
          : "";

        const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
          <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">
            <div style="font-weight:800;font-size:18px;letter-spacing:-0.01em">Ciago <span style="color:#0d9488">Technologies</span></div>
          </td></tr>
          <tr><td style="padding:32px">
            <p style="margin:0 0 12px;font-size:14px;color:#64748b">Onboarding · ${rec.roleTitle}</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Verification ${statusLabel}</h1>
            <p style="margin:0 0 8px;font-size:15px;color:#334155">Hi ${app.fullName?.split(" ")[0] || "there"},</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">${intro}</p>
            ${feedbackBlock}
            ${data.verification_status !== "approved" ? `<p style="margin:18px 0 12px;font-size:15px;line-height:1.6;color:#334155">${actionText}</p>` : ""}
            <a href="https://ciagotech.com/onboarding" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px;margin-top:8px">${data.verification_status === "approved" ? "View Status" : "Review & Re-upload Documents"}</a>
            <p style="margin:32px 0 0;font-size:13px;color:#64748b">— HR, Ciago Technologies</p>
          </td></tr>
        </table></td></tr></table></body></html>`;

        await sendResendEmail({
          to: app.email,
          subject,
          html,
          userId: rec.userId,
          applicationId: rec.applicationId,
        });
      } catch (err) {
        console.error("[verification-status-email] send failed", err);
      }
    }

    return { ok: true };
  });

// ---------- Bulk document review across multiple onboardings ----------

const bulkReviewSchema = z.object({
  onboarding_ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["approved", "changes_requested", "rejected"]),
  feedback: z.string().trim().max(1000).optional(),
  include_statuses: z
    .array(z.enum(["pending", "changes_requested", "rejected", "approved"]))
    .optional(),
});

export const bulkReviewOnboardingDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => bulkReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    if ((data.status === "changes_requested" || data.status === "rejected") && !data.feedback) {
      throw new Error("Feedback is required when requesting changes or rejecting.");
    }
    const adminDb = getAdminDb();
    const targetStatuses = data.include_statuses ?? ["pending"];

    const docs = await adminDb.onboardingDocument.findMany({
      where: {
        onboardingId: { in: data.onboarding_ids },
        status: { in: targetStatuses },
      },
      select: { id: true, onboardingId: true, userId: true, docKey: true, status: true },
    });

    const rows = docs.filter((d) => d.status !== data.status);
    if (rows.length === 0) return { ok: true, reviewed: 0 };

    const onbIds = Array.from(new Set(rows.map((r) => r.onboardingId)));
    const recs = await adminDb.onboardingRecord.findMany({
      where: { id: { in: onbIds } },
      select: { id: true, applicationId: true, roleTitle: true, userId: true },
    });
    const recMap = new Map(recs.map((r) => [r.id, r]));

    const appIds = Array.from(new Set(recs.map((r) => r.applicationId).filter(Boolean)));
    const apps = appIds.length
      ? await adminDb.jobApplication.findMany({
          where: { id: { in: appIds } },
          select: { id: true, email: true, fullName: true },
        })
      : [];
    const appMap = new Map(apps.map((a) => [a.id, a]));

    await adminDb.onboardingDocument.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: {
        status: data.status,
        feedback: data.feedback ?? null,
        reviewedBy: context.userId,
        reviewedAt: new Date(),
      },
    });

    const actorEmail = (context.claims as any)?.email ?? null;

    const perOnb = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = perOnb.get(r.onboardingId) ?? [];
      arr.push(r);
      perOnb.set(r.onboardingId, arr);
    }

    for (const [onbId, list] of perOnb.entries()) {
      await adminDb.auditLog.create({
        data: {
          actorId: context.userId,
          actorEmail: actorEmail,
          action: "ONBOARDING_DOCS_BULK_REVIEWED",
          targetResource: `onboarding_records/${onbId}`,
          details: {
            to: data.status,
            feedback: data.feedback ?? null,
            document_ids: list.map((d) => d.id),
            doc_keys: list.map((d) => d.docKey),
            candidate_email:
              appMap.get(recMap.get(onbId)?.applicationId ?? "")?.email ?? null,
          },
        },
      });
    }

    const { sendResendEmail } = await import("@/lib/notifications.server");
    for (const [onbId, list] of perOnb.entries()) {
      const rec = recMap.get(onbId);
      if (!rec) continue;
      const app = appMap.get(rec.applicationId);
      const label =
        data.status === "approved"
          ? "Approved"
          : data.status === "changes_requested"
            ? "Changes requested"
            : "Rejected";
      const docNames = list.map((d) => docLabel(d.docKey)).join(", ");
      const title = `Documents ${label.toLowerCase()}: ${docNames}`;
      const body = data.feedback
        ? `HR ${label.toLowerCase()} ${list.length} document${list.length > 1 ? "s" : ""}. ${data.feedback}`
        : `HR ${label.toLowerCase()} ${list.length} document${list.length > 1 ? "s" : ""}: ${docNames}.`;

      if (rec.userId) {
        await adminDb.inAppNotification.create({
          data: {
            userId: rec.userId,
            applicationId: rec.applicationId,
            title,
            body,
            link: "/onboarding",
          },
        });
      }
      if (app?.email) {
        const content = docStatusEmail(
          app.fullName ?? "",
          rec.roleTitle ?? "your role",
          docNames,
          data.status,
          data.feedback ?? null,
        );
        try {
          await sendResendEmail({ to: app.email, subject: content.subject, html: content.html });
        } catch (e) {
          console.error("[hr] bulk review email failed", e);
        }
      }
    }

    return { ok: true, reviewed: rows.length };
  });

const dojSchema = z.object({
  onboarding_id: z.string().uuid(),
  doj: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "DOJ must be YYYY-MM-DD"),
});

export const setOnboardingDoj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => dojSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d2 = String(today.getUTCDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d2}`;
    if (data.doj < todayStr) {
      throw new Error("Date of Joining cannot be in the past.");
    }

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { id: data.onboarding_id },
      select: {
        id: true,
        applicationId: true,
        roleTitle: true,
        userId: true,
        doj: true,
        verificationStatus: true,
      },
    });
    if (!rec) throw new Error("Onboarding not found");
    if (rec.verificationStatus !== "approved") {
      throw new Error("Approve the candidate's paperwork before assigning a DOJ.");
    }

    const priorDoj = rec.doj;
    await adminDb.onboardingRecord.update({
      where: { id: data.onboarding_id },
      data: { doj: data.doj },
    });

    // Finalize role: determine track from job posting, grant appropriate staff role.
    const app = await adminDb.jobApplication.findUnique({
      where: { id: rec.applicationId },
      select: { email: true, fullName: true, roleId: true },
    });
    const posting = app
      ? await adminDb.jobPosting.findUnique({
          where: { id: app.roleId },
          select: { trackType: true },
        })
      : null;

    // All hired users get "user" role (track types hr_track/manager_track removed in Phase 1)
    const targetRole = "user";

    await adminDb.userRole.upsert({
      where: { userId_role: { userId: rec.userId, role: targetRole as any } },
      create: { userId: rec.userId, role: targetRole as any },
      update: {},
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "ONBOARDING_DOJ_SET",
        targetResource: `onboarding_records/${data.onboarding_id}`,
        details: {
          from: priorDoj,
          to: data.doj,
          candidate_email: app?.email ?? null,
          role_granted: targetRole,
        },
      },
    });

    const content = dojEmail(
      app?.fullName ?? "",
      rec.roleTitle ?? "your role",
      data.doj,
    );
    if (rec.userId) {
      await adminDb.inAppNotification.create({
        data: {
          userId: rec.userId,
          applicationId: rec.applicationId,
          title: content.inAppTitle,
          body: content.inAppBody,
          link: "/my-applications",
        },
      });
    }
    if (app?.email) {
      try {
        const { sendResendEmail } = await import("@/lib/notifications.server");
        await sendResendEmail({
          to: app.email,
          subject: content.subject,
          html: content.html,
        });
      } catch (e) {
        console.error("[hr] doj email failed", e);
      }
    }

    return { ok: true };
  });

const verifSchema = z.object({
  onboarding_id: z.string().uuid(),
  status: z.enum(["approved", "changes_requested", "rejected"]),
  feedback: z.string().trim().max(1000).optional(),
});

export const setOnboardingVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => verifSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    if ((data.status === "changes_requested" || data.status === "rejected") && !data.feedback) {
      throw new Error("Feedback is required when requesting changes or rejecting.");
    }
    const adminDb = getAdminDb();

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { id: data.onboarding_id },
      select: { id: true, userId: true, applicationId: true, roleTitle: true, verificationStatus: true },
    });
    if (!rec) throw new Error("Not found");

    await adminDb.onboardingRecord.update({
      where: { id: data.onboarding_id },
      data: {
        verificationStatus: data.status,
        rejectionFeedback: data.status === "approved" ? null : (data.feedback ?? null),
        verifiedBy: data.status === "approved" ? context.userId : null,
        verifiedAt: data.status === "approved" ? new Date() : null,
      },
    });

    const app = await adminDb.jobApplication.findUnique({
      where: { id: rec.applicationId },
      select: { email: true, fullName: true },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "ONBOARDING_VERIFICATION_UPDATED",
        targetResource: `onboarding_records/${data.onboarding_id}`,
        details: {
          from: rec.verificationStatus,
          to: data.status,
          feedback: data.feedback ?? null,
          candidate_email: app?.email ?? null,
        },
      },
    });

    if (rec.userId) {
      const label =
        data.status === "approved"
          ? "Approved"
          : data.status === "changes_requested"
            ? "Changes requested"
            : "Rejected";
      await adminDb.inAppNotification.create({
        data: {
          userId: rec.userId,
          applicationId: rec.applicationId,
          title: `Onboarding paperwork: ${label}`,
          body: data.feedback ?? `HR has ${label.toLowerCase()} your onboarding paperwork.`,
          link: "/onboarding",
        },
      });
    }
    return { ok: true };
  });

// ---------- Preview email + document version history ----------

export const previewDocReviewEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        status: z.enum(["approved", "changes_requested", "rejected"]),
        feedback: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const doc = await adminDb.onboardingDocument.findUnique({
      where: { id: data.document_id },
      select: { docKey: true, onboardingId: true },
    });
    if (!doc) throw new Error("Document not found");

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { id: doc.onboardingId },
      select: { applicationId: true, roleTitle: true },
    });
    const app = rec
      ? await adminDb.jobApplication.findUnique({
          where: { id: rec.applicationId },
          select: { email: true, fullName: true },
        })
      : null;

    return docStatusEmail(
      app?.fullName ?? "",
      rec?.roleTitle ?? "your role",
      docLabel(doc.docKey),
      data.status,
      data.feedback ?? null,
    );
  });

export type OnboardingDocVersion = {
  id: string;
  version: number;
  status: string;
  feedback: string | null;
  original_filename: string | null;
  storage_path: string;
  signed_url: string | null;
  created_at: string;
  superseded_at: string | null;
};

export const listDocumentVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({ onboarding_id: z.string().uuid(), doc_key: z.string().trim().min(1).max(60) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<OnboardingDocVersion[]> => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const rows = await adminDb.onboardingDocument.findMany({
      where: { onboardingId: data.onboarding_id, docKey: data.doc_key },
      orderBy: { version: "desc" },
    });

    // Signed URLs — R2
    const { getStorage } = await import("@/lib/storage");
    const storage = getStorage();
    const out: OnboardingDocVersion[] = [];
    for (const r of rows) {
      let signed: string | null = null;
      try {
        const result = await storage.createSignedUrl("onboarding-docs", r.storagePath, 60 * 15);
        signed = result.signedUrl;
      } catch {
        signed = null;
      }
      out.push({
        id: r.id,
        version: r.version,
        status: r.status,
        feedback: r.feedback,
        original_filename: r.originalFilename,
        storage_path: r.storagePath,
        signed_url: signed,
        created_at: r.createdAt.toISOString(),
        superseded_at: r.supersededAt?.toISOString() ?? null,
      });
    }
    return out;
  });
