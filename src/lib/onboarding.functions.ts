import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import {
  CONDITIONAL_DOC_LABELS,
  computeDocRequirements,
  mandatoryDocKeys,
  type DocRequirement,
} from "@/lib/onboarding-docs";

export type OnboardingRecord = {
  id: string;
  user_id: string;
  application_id: string;
  role_title: string;
  department: string | null;
  start_date: string | null;
  compensation_inr: number | null;
  offer_accepted_at: string | null;
  offer_declined_at: string | null;
  emergency_contact: {
    name?: string;
    relationship?: string;
    relation?: string; // Legacy field, kept for backwards compatibility
    phone?: string;
    alternate_phone?: string;
    email?: string;
    address?: string;
  } | null;
  id_ack: boolean;
  code_of_conduct_ack: boolean;
  submitted_at: string | null;
  status: "pending" | "accepted" | "submitted" | "declined";
  doj: string | null;
  verification_status: "not_submitted" | "pending" | "approved" | "changes_requested" | "rejected";
  current_step: number;
  rejection_feedback: string | null;
  verified_by: string | null;
  verified_at: string | null;
  form_state: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingDocument = {
  id: string;
  onboarding_id: string;
  user_id: string;
  doc_key: string;
  storage_path: string;
  original_filename: string | null;
  status: "pending" | "approved" | "changes_requested" | "rejected";
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingOffer = {
  application_id: string;
  role_title: string;
  job_code: string | null;
  department: string | null;
  employment_type: string | null;
  track_type: "standard" | "manager_track" | "hr_track" | null;
  status: string;
  created_at: string;
  onboarding: OnboardingRecord | null;
  required_docs: string[];
  doc_requirements: DocRequirement[];
  documents: OnboardingDocument[];
  salary_min_inr: number | null;
  salary_max_inr: number | null;
};

export const ONBOARDING_DOC_LABELS: Record<string, string> = {
  ...CONDITIONAL_DOC_LABELS,
  degree_provisional: "Provisional Degree Certificate",
  degree_final: "Final Degree Certificate",
  passport: "Passport",
};

export function docLabel(key: string): string {
  return (
    ONBOARDING_DOC_LABELS[key] ??
    key
      .split(/[_\s]+/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ")
  );
}

function toOnboardingRecord(r: any): OnboardingRecord {
  return {
    id: r.id,
    user_id: r.userId,
    application_id: r.applicationId,
    role_title: r.roleTitle,
    department: r.department,
    start_date: r.startDate,
    compensation_inr: r.compensationInr != null ? Number(r.compensationInr) : null,
    offer_accepted_at: r.offerAcceptedAt?.toISOString() ?? null,
    offer_declined_at: r.offerDeclinedAt?.toISOString() ?? null,
    emergency_contact: r.emergencyContact as OnboardingRecord["emergency_contact"],
    id_ack: r.idAck,
    code_of_conduct_ack: r.codeOfConductAck,
    submitted_at: r.submittedAt?.toISOString() ?? null,
    status: r.status as OnboardingRecord["status"],
    doj: r.doj,
    verification_status: r.verificationStatus as OnboardingRecord["verification_status"],
    current_step: r.currentStep,
    rejection_feedback: r.rejectionFeedback,
    verified_by: r.verifiedBy,
    verified_at: r.verifiedAt?.toISOString() ?? null,
    form_state: (r.formState as Record<string, any>) ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

function toOnboardingDocument(d: any): OnboardingDocument {
  return {
    id: d.id,
    onboarding_id: d.onboardingId,
    user_id: d.userId,
    doc_key: d.docKey,
    storage_path: d.storagePath,
    original_filename: d.originalFilename,
    status: d.status as OnboardingDocument["status"],
    feedback: d.feedback,
    created_at: d.createdAt.toISOString(),
    updated_at: d.updatedAt.toISOString(),
  };
}

export const getMyOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingOffer | null> => {
    const app = await context.db.withRLS((tx) =>
      tx.jobApplication.findFirst({
        where: { userId: context.userId, status: "offered", isSoftDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { id: true, roleId: true, roleTitle: true, status: true, createdAt: true },
      }),
    );
    if (!app) return null;

    const adminDb = getAdminDb();
    const posting = await adminDb.jobPosting.findUnique({
      where: { id: app.roleId },
      select: { jobCode: true, department: true, requiredOnboardingDocs: true, employmentType: true, trackType: true, salaryMinInr: true, salaryMaxInr: true },
    });

    const rec = await adminDb.onboardingRecord.findUnique({
      where: { applicationId: app.id },
    });

    let documents: OnboardingDocument[] = [];
    if (rec) {
      const docs = await adminDb.onboardingDocument.findMany({
        where: { onboardingId: rec.id, supersededAt: null },
        orderBy: { createdAt: "asc" },
      });
      documents = docs.map(toOnboardingDocument);
    }

    const employmentType = posting?.employmentType ?? null;
    const trackType = (posting?.trackType ?? null) as OnboardingOffer["track_type"];
    const postingRequired = posting?.requiredOnboardingDocs ?? [
      "pan",
      "aadhaar",
      "marksheet_10",
      "marksheet_12",
      "bank_details",
    ];
    const docRequirements = computeDocRequirements(employmentType, postingRequired, "ug");

    return {
      application_id: app.id,
      role_title: app.roleTitle,
      job_code: posting?.jobCode ?? null,
      department: posting?.department ?? null,
      employment_type: employmentType,
      track_type: trackType,
      status: app.status,
      created_at: app.createdAt.toISOString(),
      onboarding: rec ? toOnboardingRecord(rec) : null,
      required_docs: docRequirements.filter((d) => d.mandatory).map((d) => d.key),
      doc_requirements: docRequirements,
      documents,
      salary_min_inr: posting?.salaryMinInr != null ? Number(posting.salaryMinInr) : null,
      salary_max_inr: posting?.salaryMaxInr != null ? Number(posting.salaryMaxInr) : null,
    };
  });

const acceptSchema = z.object({ application_id: z.string().uuid() });

export const acceptOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const app = await context.db.withRLS((tx) =>
      tx.jobApplication.findFirst({
        where: { id: data.application_id, userId: context.userId },
        select: { id: true, userId: true, roleTitle: true, roleId: true, status: true },
      }),
    );
    if (!app) throw new Error("Not found");
    if (app.status !== "offered") throw new Error("Offer not available");

    const adminDb = getAdminDb();
    const posting = await adminDb.jobPosting.findUnique({
      where: { id: app.roleId },
      select: { department: true, salaryMinInr: true, salaryMaxInr: true },
    });

    // Use midpoint of salary range, or min if max not set
    // BigInt arithmetic: cannot use Math.round with BigInt
    const compensationInr = posting?.salaryMaxInr && posting?.salaryMinInr
      ? (posting.salaryMinInr + posting.salaryMaxInr) / BigInt(2)
      : posting?.salaryMinInr ?? null;

    const rec = await adminDb.onboardingRecord.upsert({
      where: { applicationId: app.id },
      create: {
        userId: context.userId,
        applicationId: app.id,
        roleTitle: app.roleTitle,
        department: posting?.department ?? null,
        compensationInr,
        status: "accepted",
        offerAcceptedAt: new Date(),
        currentStep: 2,
      },
      update: {
        status: "accepted",
        compensationInr,
        offerAcceptedAt: new Date(),
        offerDeclinedAt: null,
        currentStep: 2,
      },
    });
    return toOnboardingRecord(rec);
  });

export const declineOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const app = await context.db.withRLS((tx) =>
      tx.jobApplication.findFirst({
        where: { id: data.application_id, userId: context.userId },
        select: { id: true, roleTitle: true },
      }),
    );
    if (!app) throw new Error("Not found");

    const adminDb = getAdminDb();
    await adminDb.onboardingRecord.upsert({
      where: { applicationId: app.id },
      create: {
        userId: context.userId,
        applicationId: app.id,
        roleTitle: app.roleTitle,
        status: "declined",
        offerDeclinedAt: new Date(),
      },
      update: {
        status: "declined",
        offerDeclinedAt: new Date(),
      },
    });
    return { ok: true };
  });

const draftSchema = z.object({
  onboarding_id: z.string().uuid(),
  form_state: z.record(z.string(), z.any()).optional(),
  emergency_contact: z
    .object({
      name: z.string().trim().max(120).optional(),
      relationship: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(30).optional(),
      alternate_phone: z.string().trim().max(30).optional(),
      email: z.string().trim().max(120).optional(),
      address: z.string().trim().max(500).optional(),
    })
    .optional(),
  id_ack: z.boolean().optional(),
  code_of_conduct_ack: z.boolean().optional(),
  current_step: z.number().int().min(1).max(4).optional(),
});

export const saveOnboardingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => draftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.form_state !== undefined) patch.formState = data.form_state;
    if (data.emergency_contact !== undefined) patch.emergencyContact = data.emergency_contact;
    if (data.id_ack !== undefined) patch.idAck = data.id_ack;
    if (data.code_of_conduct_ack !== undefined) patch.codeOfConductAck = data.code_of_conduct_ack;
    if (data.current_step !== undefined) patch.currentStep = data.current_step;
    if (Object.keys(patch).length === 0) return { ok: true };

    await context.db.withRLS((tx) =>
      tx.onboardingRecord.updateMany({
        where: { id: data.onboarding_id, userId: context.userId },
        data: patch,
      }),
    );
    return { ok: true };
  });

const paperworkSchema = z.object({
  onboarding_id: z.string().uuid(),
  emergency_contact: z.object({
    name: z.string().trim().min(2).max(120),
    relationship: z.string().trim().min(2).max(60),
    phone: z.string().trim().min(6).max(30),
    alternate_phone: z.string().trim().max(30).optional(),
    email: z.string().trim().email().max(120).optional().or(z.literal("")),
    address: z.string().trim().max(500).optional(),
  }),
  id_ack: z.literal(true),
  code_of_conduct_ack: z.literal(true),
});

export const savePaperwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => paperworkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await context.db.withRLS((tx) =>
      tx.onboardingRecord.updateMany({
        where: { id: data.onboarding_id, userId: context.userId },
        data: {
          emergencyContact: data.emergency_contact,
          idAck: data.id_ack,
          codeOfConductAck: data.code_of_conduct_ack,
          currentStep: 3,
        },
      }),
    );
    return { ok: true };
  });

export const updateOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        onboarding_id: z.string().uuid(),
        current_step: z.number().int().min(1).max(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await context.db.withRLS((tx) =>
      tx.onboardingRecord.updateMany({
        where: { id: data.onboarding_id, userId: context.userId },
        data: { currentStep: data.current_step },
      }),
    );
    return { ok: true };
  });

const recordDocSchema = z.object({
  onboarding_id: z.string().uuid(),
  doc_key: z.string().trim().min(1).max(60),
  storage_path: z.string().trim().min(1).max(500),
  original_filename: z.string().trim().max(200).optional(),
});

export const recordUploadedDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => recordDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const rec = await context.db.withRLS((tx) =>
      tx.onboardingRecord.findFirst({
        where: { id: data.onboarding_id, userId: context.userId },
        select: { id: true },
      }),
    );
    if (!rec) throw new Error("Not found");

    const adminDb = getAdminDb();

    const existing = await adminDb.onboardingDocument.findFirst({
      where: { onboardingId: data.onboarding_id, docKey: data.doc_key, supersededAt: null },
      select: { id: true, version: true },
    });
    const nextVersion = existing ? (existing.version ?? 1) + 1 : 1;
    if (existing) {
      await adminDb.onboardingDocument.update({
        where: { id: existing.id },
        data: { supersededAt: new Date() },
      });
    }

    const row = await adminDb.onboardingDocument.create({
      data: {
        userId: context.userId,
        onboardingId: data.onboarding_id,
        docKey: data.doc_key,
        storagePath: data.storage_path,
        originalFilename: data.original_filename ?? null,
        status: "pending",
        feedback: null,
        version: nextVersion,
      },
    });
    return toOnboardingDocument(row);
  });

export const deleteUploadedDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const adminDb = getAdminDb();

    const doc = await adminDb.onboardingDocument.findUnique({
      where: { id: data.id },
      select: { id: true, userId: true, storagePath: true, status: true },
    });
    if (!doc || doc.userId !== context.userId) throw new Error("Not found");
    if (!["pending", "changes_requested"].includes(doc.status)) {
      throw new Error("This document is locked by HR and can no longer be replaced.");
    }

    // Storage: delete from R2
    const { getStorage } = await import("@/lib/storage");
    const storage = getStorage();
    await storage.remove("onboarding-docs", [doc.storagePath]);

    await adminDb.onboardingDocument.delete({ where: { id: data.id } });
    return { ok: true };
  });

const submitSchema = z.object({ onboarding_id: z.string().uuid() });

export const submitOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const rec = await context.db.withRLS((tx) =>
      tx.onboardingRecord.findFirst({
        where: { id: data.onboarding_id, userId: context.userId },
        select: { id: true, applicationId: true, emergencyContact: true, idAck: true, codeOfConductAck: true, status: true },
      }),
    );
    if (!rec) throw new Error("Not found");
    if (rec.status === "declined") throw new Error("Offer already declined");
    if (!rec.emergencyContact || !rec.idAck || !rec.codeOfConductAck) {
      throw new Error("Onboarding paperwork incomplete");
    }

    const adminDb = getAdminDb();

    const app = await adminDb.jobApplication.findUnique({
      where: { id: rec.applicationId },
      select: { roleId: true },
    });
    const posting = app
      ? await adminDb.jobPosting.findUnique({
          where: { id: app.roleId },
          select: { requiredOnboardingDocs: true, employmentType: true },
        })
      : null;

    const required: string[] = mandatoryDocKeys(
      posting?.employmentType ?? null,
      posting?.requiredOnboardingDocs ?? [],
      "ug",
    );

    if (required.length > 0) {
      const docs = await adminDb.onboardingDocument.findMany({
        where: { onboardingId: data.onboarding_id, supersededAt: null },
        select: { docKey: true },
      });
      const have = new Set(docs.map((d) => d.docKey));
      const missing = required.filter((k) => !have.has(k));
      if (missing.length > 0) {
        throw new Error(
          `Missing required documents: ${missing.map((k) => docLabel(k)).join(", ")}`,
        );
      }
    }

    await context.db.withRLS((tx) =>
      tx.onboardingRecord.updateMany({
        where: { id: data.onboarding_id, userId: context.userId },
        data: {
          status: "submitted",
          submittedAt: new Date(),
          verificationStatus: "pending",
          currentStep: 4,
        },
      }),
    );

    return { ok: true };
  });
