import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emergency_contact: any;
    id_ack: boolean;
    code_of_conduct_ack: boolean;
    rejection_feedback: string | null;
    verified_by: string | null;
    verified_at: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

async function assertHrOrAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["hr", "admin"])
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listOnboardingQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingQueueRow[]> => {
    await assertHrOrAdmin(context.supabase, context.userId);

    // Admin sees every track. Pure HR (non-admin) never sees HR-track candidates —
    // HR-track finalization is admin-only and HR should not review their own peers.
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!adminRow;

    const { data: recs, error } = await context.supabase
      .from("onboarding_records")
      .select(
        "id, user_id, application_id, role_title, department, status, verification_status, current_step, doj, submitted_at, updated_at",
      )
      .in("status", ["accepted", "submitted"])
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = recs ?? [];
    if (rows.length === 0) return [];

    // Never surface the caller's own onboarding to themselves — HR must not
    // review their own paperwork (or Admin theirs). Track isolation still applies below.
    const selfFiltered = rows.filter((r: any) => r.user_id !== context.userId);
    const appIds = selfFiltered.map((r: any) => r.application_id);
    const { data: apps } = appIds.length
      ? await context.supabase
          .from("job_applications")
          .select("id, email, full_name, role_id")
          .in("id", appIds)
      : { data: [] as any[] };
    const appMap = new Map((apps ?? []).map((a: any) => [a.id, a]));
    const roleIds = Array.from(new Set((apps ?? []).map((a: any) => a.role_id).filter(Boolean)));
    const postings = roleIds.length
      ? ((
          await context.supabase
            .from("job_postings")
            .select("id, job_code, track_type, employment_type")
            .in("id", roleIds)
        ).data ?? [])
      : [];
    const postingMap = new Map(postings.map((p: any) => [p.id, p]));

    const ids = selfFiltered.map((r: any) => r.id);
    if (ids.length === 0) return [];
    const { data: docs } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("onboarding_id, status")
      .in("onboarding_id", ids)
      .is("superseded_at", null);
    const docsAgg = new Map<
      string,
      { total: number; approved: number; pending: number; issues: number }
    >();
    for (const d of (docs ?? []) as any[]) {
      const agg = docsAgg.get(d.onboarding_id) ?? { total: 0, approved: 0, pending: 0, issues: 0 };
      agg.total++;
      if (d.status === "approved") agg.approved++;
      else if (d.status === "pending") agg.pending++;
      else agg.issues++;
      docsAgg.set(d.onboarding_id, agg);
    }

    const out: OnboardingQueueRow[] = [];
    for (const r of selfFiltered as any[]) {
      const app = appMap.get(r.application_id) as any;
      const posting = app ? (postingMap.get(app.role_id) as any) : null;
      const track = (posting?.track_type ?? null) as OnboardingQueueRow["track_type"];
      // Track isolation: HR-only users don't see HR-track candidates.
      if (!isAdmin && track === "hr_track") continue;
      const agg = docsAgg.get(r.id) ?? { total: 0, approved: 0, pending: 0, issues: 0 };
      out.push({
        onboarding_id: r.id,
        user_id: r.user_id,
        application_id: r.application_id,
        role_title: r.role_title,
        department: r.department,
        job_code: posting?.job_code ?? null,
        track_type: track,
        employment_type: posting?.employment_type ?? null,
        candidate_name: app?.full_name ?? null,
        candidate_email: app?.email ?? null,
        status: r.status,
        verification_status: r.verification_status,
        current_step: r.current_step,
        doj: r.doj,
        submitted_at: r.submitted_at,
        updated_at: r.updated_at,
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
  .inputValidator((d: unknown) => z.object({ onboarding_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<OnboardingDetail> => {
    await assertHrOrAdmin(context.supabase, context.userId);

    const { data: rec, error } = await context.supabase
      .from("onboarding_records")
      .select("*")
      .eq("id", data.onboarding_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rec) throw new Error("Onboarding not found");

    const { data: app } = await context.supabase
      .from("job_applications")
      .select("email, full_name, role_id")
      .eq("id", (rec as any).application_id)
      .maybeSingle();
    const { data: posting } = app
      ? await context.supabase
          .from("job_postings")
          .select("job_code, required_onboarding_docs")
          .eq("id", (app as any).role_id)
          .maybeSingle()
      : { data: null };

    const { data: docs } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("*")
      .eq("onboarding_id", data.onboarding_id)
      .order("created_at", { ascending: true });

    // Signed URLs for HR review (private bucket, valid 15 minutes).
    const documents: OnboardingDocDetail[] = [];
    for (const d of (docs ?? []) as any[]) {
      let signed: string | null = null;
      try {
        const { data: s } = await context.supabase.storage
          .from("onboarding-docs")
          .createSignedUrl(d.storage_path, 60 * 15);
        signed = s?.signedUrl ?? null;
      } catch {
        signed = null;
      }
      documents.push({
        id: d.id,
        doc_key: d.doc_key,
        status: d.status,
        feedback: d.feedback,
        storage_path: d.storage_path,
        original_filename: d.original_filename,
        reviewed_by: d.reviewed_by,
        reviewed_at: d.reviewed_at,
        created_at: d.created_at,
        updated_at: d.updated_at,
        signed_url: signed,
      });
    }

    const { data: audit } = await context.supabase
      .from("audit_logs")
      .select("id, timestamp, actor_email, action, target_resource, details")
      .eq("target_resource", `onboarding_records/${data.onboarding_id}`)
      .order("timestamp", { ascending: false })
      .limit(200);

    const r = rec as any;
    return {
      onboarding: {
        id: r.id,
        user_id: r.user_id,
        application_id: r.application_id,
        role_title: r.role_title,
        department: r.department,
        status: r.status,
        verification_status: r.verification_status,
        current_step: r.current_step,
        doj: r.doj,
        submitted_at: r.submitted_at,
        emergency_contact: r.emergency_contact,
        id_ack: r.id_ack,
        code_of_conduct_ack: r.code_of_conduct_ack,
        rejection_feedback: r.rejection_feedback,
        verified_by: r.verified_by,
        verified_at: r.verified_at,
        form_state: r.form_state ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      candidate: {
        email: (app as any)?.email ?? null,
        full_name: (app as any)?.full_name ?? null,
        job_code: (posting as any)?.job_code ?? null,
      },
      required_docs: ((posting as any)?.required_onboarding_docs as string[] | null) ?? [],
      documents,
      audit: (audit ?? []) as OnboardingAuditEntry[],
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
      <a href="https://ciagotech.com/employee" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">Open Employee Portal</a>
      <p style="margin:32px 0 0;font-size:13px;color:#64748b">— HR, Ciago Technologies</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
  return {
    subject: `Welcome to Ciago — Date of Joining: ${label}`,
    html,
    inAppTitle: `Date of Joining: ${label}`,
    inAppBody: `Your first day at Ciago is ${label}. The Employee Portal will unlock on your DOJ.`,
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
  .inputValidator((d: unknown) => reviewDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    if ((data.status === "changes_requested" || data.status === "rejected") && !data.feedback) {
      throw new Error("Feedback is required when requesting changes or rejecting a document.");
    }

    const { data: doc } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("id, onboarding_id, user_id, doc_key, status")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");

    const { error: upErr } = await (context.supabase as any)
      .from("onboarding_documents")
      .update({
        status: data.status,
        feedback: data.feedback ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.document_id);
    if (upErr) throw new Error(upErr.message);

    // Pull candidate info & role
    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("id, application_id, role_title, user_id")
      .eq("id", (doc as any).onboarding_id)
      .maybeSingle();
    const { data: app } = rec
      ? await context.supabase
          .from("job_applications")
          .select("email, full_name")
          .eq("id", (rec as any).application_id)
          .maybeSingle()
      : { data: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actor_email: (context.claims as any)?.email ?? null,
      action: "ONBOARDING_DOC_REVIEWED",
      target_resource: `onboarding_records/${(doc as any).onboarding_id}`,
      details: {
        document_id: data.document_id,
        doc_key: (doc as any).doc_key,
        from: (doc as any).status,
        to: data.status,
        feedback: data.feedback ?? null,
        candidate_email: (app as any)?.email ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // In-app notification + email
    const content = docStatusEmail(
      (app as any)?.full_name ?? "",
      (rec as any)?.role_title ?? "your role",
      docLabel((doc as any).doc_key),
      data.status,
      data.feedback ?? null,
    );

    if ((doc as any).user_id) {
      await supabaseAdmin.from("in_app_notifications").insert({
        user_id: (doc as any).user_id,
        application_id: (rec as any)?.application_id ?? null,
        title: content.inAppTitle,
        body: content.inAppBody,
        link: "/onboarding",
      });
    }

    if ((app as any)?.email) {
      try {
        const { sendResendEmail } = await import("@/lib/notifications.server");
        await sendResendEmail({
          to: (app as any).email,
          subject: data.email_subject?.trim() || content.subject,
          html: data.email_html?.trim() || content.html,
        });
      } catch (e) {
        console.error("[hr] doc review email failed", e);
      }
    }

    return { ok: true };
  });

// ---------- Bulk document review across multiple onboardings ----------

const bulkReviewSchema = z.object({
  onboarding_ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["approved", "changes_requested", "rejected"]),
  feedback: z.string().trim().max(1000).optional(),
  // Restrict to pending docs by default; HR can override to also re-review changes/rejected.
  include_statuses: z
    .array(z.enum(["pending", "changes_requested", "rejected", "approved"]))
    .optional(),
});

export const bulkReviewOnboardingDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    if ((data.status === "changes_requested" || data.status === "rejected") && !data.feedback) {
      throw new Error("Feedback is required when requesting changes or rejecting.");
    }
    const targetStatuses = data.include_statuses ?? ["pending"];

    const { data: docs } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("id, onboarding_id, user_id, doc_key, status")
      .in("onboarding_id", data.onboarding_ids)
      .in("status", targetStatuses);

    const rows = ((docs ?? []) as any[]).filter((d) => d.status !== data.status);
    if (rows.length === 0) return { ok: true, reviewed: 0 };

    // Pull candidate context for all affected onboardings (name/email/role) in one round-trip.
    const onbIds = Array.from(new Set(rows.map((r) => r.onboarding_id)));
    const { data: recs } = await context.supabase
      .from("onboarding_records")
      .select("id, application_id, role_title, user_id")
      .in("id", onbIds);
    const recMap = new Map(((recs ?? []) as any[]).map((r) => [r.id, r]));
    const appIds = Array.from(
      new Set(((recs ?? []) as any[]).map((r) => r.application_id).filter(Boolean)),
    );
    const { data: apps } = appIds.length
      ? await context.supabase
          .from("job_applications")
          .select("id, email, full_name")
          .in("id", appIds)
      : { data: [] };
    const appMap = new Map(((apps ?? []) as any[]).map((a) => [a.id, a]));

    const { error: upErr } = await (context.supabase as any)
      .from("onboarding_documents")
      .update({
        status: data.status,
        feedback: data.feedback ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (upErr) throw new Error(upErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendResendEmail } = await import("@/lib/notifications.server");
    const actorEmail = (context.claims as any)?.email ?? null;

    // One audit entry per affected onboarding summarizing the bulk change.
    const perOnb = new Map<string, any[]>();
    for (const r of rows) {
      const arr = perOnb.get(r.onboarding_id) ?? [];
      arr.push(r);
      perOnb.set(r.onboarding_id, arr);
    }
    const auditPayload = Array.from(perOnb.entries()).map(([onbId, list]) => ({
      actor_id: context.userId,
      actor_email: actorEmail,
      action: "ONBOARDING_DOCS_BULK_REVIEWED",
      target_resource: `onboarding_records/${onbId}`,
      details: {
        to: data.status,
        feedback: data.feedback ?? null,
        document_ids: list.map((d) => d.id),
        doc_keys: list.map((d) => d.doc_key),
        candidate_email:
          (appMap.get((recMap.get(onbId) as any)?.application_id) as any)?.email ?? null,
      } as any,
    }));
    if (auditPayload.length > 0) {
      await supabaseAdmin.from("audit_logs").insert(auditPayload);
    }

    // Notify + email each affected candidate (one grouped message per onboarding).
    for (const [onbId, list] of perOnb.entries()) {
      const rec = recMap.get(onbId) as any;
      if (!rec) continue;
      const app = appMap.get(rec.application_id) as any;
      const label =
        data.status === "approved"
          ? "Approved"
          : data.status === "changes_requested"
            ? "Changes requested"
            : "Rejected";
      const docNames = list.map((d) => docLabel(d.doc_key)).join(", ");
      const title = `Documents ${label.toLowerCase()}: ${docNames}`;
      const body = data.feedback
        ? `HR ${label.toLowerCase()} ${list.length} document${list.length > 1 ? "s" : ""}. ${data.feedback}`
        : `HR ${label.toLowerCase()} ${list.length} document${list.length > 1 ? "s" : ""}: ${docNames}.`;

      if (rec.user_id) {
        await supabaseAdmin.from("in_app_notifications").insert({
          user_id: rec.user_id,
          application_id: rec.application_id,
          title,
          body,
          link: "/onboarding",
        });
      }
      if (app?.email) {
        const content = docStatusEmail(
          app.full_name ?? "",
          rec.role_title ?? "your role",
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
  .inputValidator((d: unknown) => dojSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);

    // Validate DOJ >= today (ignoring time zone drift by comparing yyyy-mm-dd strings)
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, "0");
    const d2 = String(today.getUTCDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d2}`;
    if (data.doj < todayStr) {
      throw new Error("Date of Joining cannot be in the past.");
    }

    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("id, application_id, role_title, user_id, doj, verification_status")
      .eq("id", data.onboarding_id)
      .maybeSingle();
    if (!rec) throw new Error("Onboarding not found");
    if ((rec as any).verification_status !== "approved") {
      throw new Error("Approve the candidate's paperwork before assigning a DOJ.");
    }

    const priorDoj = (rec as any).doj as string | null;
    const { error } = await context.supabase
      .from("onboarding_records")
      .update({ doj: data.doj })
      .eq("id", data.onboarding_id);
    if (error) throw new Error(error.message);

    // Grant the correct staff role (employee/manager/hr) based on job track.
    // HR-track finalization is admin-only (enforced inside the RPC).
    const { error: roleErr } = await context.supabase.rpc("finalize_onboarding_role", {
      _onboarding_id: data.onboarding_id,
    });
    if (roleErr) {
      // Do not swallow — HR should know the role grant failed even though DOJ was saved.
      throw new Error(`DOJ saved, but role finalization failed: ${roleErr.message}`);
    }

    const { data: app } = await context.supabase
      .from("job_applications")
      .select("email, full_name")
      .eq("id", (rec as any).application_id)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actor_email: (context.claims as any)?.email ?? null,
      action: "ONBOARDING_DOJ_SET",
      target_resource: `onboarding_records/${data.onboarding_id}`,
      details: {
        from: priorDoj,
        to: data.doj,
        candidate_email: (app as any)?.email ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    const content = dojEmail(
      (app as any)?.full_name ?? "",
      (rec as any).role_title ?? "your role",
      data.doj,
    );
    if ((rec as any).user_id) {
      await supabaseAdmin.from("in_app_notifications").insert({
        user_id: (rec as any).user_id,
        application_id: (rec as any).application_id,
        title: content.inAppTitle,
        body: content.inAppBody,
        link: "/employee",
      });
    }
    if ((app as any)?.email) {
      try {
        const { sendResendEmail } = await import("@/lib/notifications.server");
        await sendResendEmail({
          to: (app as any).email,
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
  .inputValidator((d: unknown) => verifSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    if ((data.status === "changes_requested" || data.status === "rejected") && !data.feedback) {
      throw new Error("Feedback is required when requesting changes or rejecting.");
    }
    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("id, user_id, application_id, role_title, verification_status")
      .eq("id", data.onboarding_id)
      .maybeSingle();
    if (!rec) throw new Error("Not found");

    const { error } = await context.supabase
      .from("onboarding_records")
      .update({
        verification_status: data.status,
        rejection_feedback: data.status === "approved" ? null : (data.feedback ?? null),
        verified_by: data.status === "approved" ? context.userId : null,
        verified_at: data.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", data.onboarding_id);
    if (error) throw new Error(error.message);

    const { data: app } = await context.supabase
      .from("job_applications")
      .select("email, full_name")
      .eq("id", (rec as any).application_id)
      .maybeSingle();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actor_email: (context.claims as any)?.email ?? null,
      action: "ONBOARDING_VERIFICATION_UPDATED",
      target_resource: `onboarding_records/${data.onboarding_id}`,
      details: {
        from: (rec as any).verification_status,
        to: data.status,
        feedback: data.feedback ?? null,
        candidate_email: (app as any)?.email ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // In-app notification for candidate
    if ((rec as any).user_id) {
      const label =
        data.status === "approved"
          ? "Approved"
          : data.status === "changes_requested"
            ? "Changes requested"
            : "Rejected";
      await supabaseAdmin.from("in_app_notifications").insert({
        user_id: (rec as any).user_id,
        application_id: (rec as any).application_id,
        title: `Onboarding paperwork: ${label}`,
        body: data.feedback ?? `HR has ${label.toLowerCase()} your onboarding paperwork.`,
        link: "/onboarding",
      });
    }
    return { ok: true };
  });

// ---------- Preview email + document version history ----------

export const previewDocReviewEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        status: z.enum(["approved", "changes_requested", "rejected"]),
        feedback: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { data: doc } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("doc_key, onboarding_id")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Document not found");
    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("application_id, role_title")
      .eq("id", (doc as any).onboarding_id)
      .maybeSingle();
    const { data: app } = rec
      ? await context.supabase
          .from("job_applications")
          .select("email, full_name")
          .eq("id", (rec as any).application_id)
          .maybeSingle()
      : { data: null };
    return docStatusEmail(
      (app as any)?.full_name ?? "",
      (rec as any)?.role_title ?? "your role",
      docLabel((doc as any).doc_key),
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
  .inputValidator((d: unknown) =>
    z
      .object({ onboarding_id: z.string().uuid(), doc_key: z.string().trim().min(1).max(60) })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<OnboardingDocVersion[]> => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { data: rows } = await (context.supabase as any)
      .from("onboarding_documents")
      .select(
        "id, version, status, feedback, original_filename, storage_path, created_at, superseded_at",
      )
      .eq("onboarding_id", data.onboarding_id)
      .eq("doc_key", data.doc_key)
      .order("version", { ascending: false });
    const out: OnboardingDocVersion[] = [];
    for (const r of (rows ?? []) as any[]) {
      let signed: string | null = null;
      try {
        const { data: s } = await context.supabase.storage
          .from("onboarding-docs")
          .createSignedUrl(r.storage_path, 60 * 15);
        signed = s?.signedUrl ?? null;
      } catch {
        signed = null;
      }
      out.push({ ...r, signed_url: signed });
    }
    return out;
  });
