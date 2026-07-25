import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
    relation?: string;
    phone?: string;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  /** Legacy: mandatory doc keys only. Use `doc_requirements` for the full list with optional docs. */
  required_docs: string[];
  doc_requirements: DocRequirement[];
  documents: OnboardingDocument[];
};

// Canonical labels for document keys HR can require on a posting.
export const ONBOARDING_DOC_LABELS: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  bank_details: "Bank Account Details",
  photo: "Passport-size Photograph",
  marksheet_10: "10th Marksheet",
  marksheet_12: "12th / Diploma Marksheet",
  degree_provisional: "Provisional Degree Certificate",
  degree_final: "Final Degree Certificate",
  offer_letter_previous: "Previous Offer Letter",
  relieving_letter: "Relieving Letter / Experience Letter",
  address_proof: "Address Proof",
  passport: "Passport",
  ...CONDITIONAL_DOC_LABELS,
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

// Return the *latest* offered application for the signed-in user

export const getMyOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingOffer | null> => {
    const { data: app, error } = await context.supabase
      .from("job_applications")
      .select("id, role_id, role_title, status, created_at, is_soft_deleted")
      .eq("user_id", context.userId)
      .eq("status", "offered")
      .eq("is_soft_deleted", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app) return null;

    const { data: posting } = await context.supabase
      .from("job_postings")
      .select("job_code, department, required_onboarding_docs, employment_type, track_type")
      .eq("id", app.role_id)
      .maybeSingle();

    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("*")
      .eq("application_id", app.id)
      .maybeSingle();

    let documents: OnboardingDocument[] = [];
    if (rec) {
      const { data: docs } = await (context.supabase as any)
        .from("onboarding_documents")
        .select("*")
        .eq("onboarding_id", (rec as any).id)
        .is("superseded_at", null)
        .order("created_at", { ascending: true });
      documents = (docs ?? []) as OnboardingDocument[];
    }

    const employmentType = ((posting as any)?.employment_type ?? null) as string | null;
    const trackType = ((posting as any)?.track_type ?? null) as OnboardingOffer["track_type"];
    const postingRequired =
      ((posting as any)?.required_onboarding_docs as string[] | null) ??
      ["aadhaar", "pan", "bank_details"];
    const docRequirements = computeDocRequirements(employmentType, postingRequired);

    return {
      application_id: app.id,
      role_title: app.role_title,
      job_code: (posting as any)?.job_code ?? null,
      department: (posting as any)?.department ?? null,
      employment_type: employmentType,
      track_type: trackType,
      status: app.status,
      created_at: app.created_at,
      onboarding: (rec as OnboardingRecord | null) ?? null,
      required_docs: docRequirements.filter((d) => d.mandatory).map((d) => d.key),
      doc_requirements: docRequirements,
      documents,
    };
  });

const acceptSchema = z.object({ application_id: z.string().uuid() });

export const acceptOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: app, error } = await context.supabase
      .from("job_applications")
      .select("id, user_id, role_title, role_id, status")
      .eq("id", data.application_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app || app.user_id !== context.userId) throw new Error("Not found");
    if (app.status !== "offered") throw new Error("Offer not available");

    const { data: posting } = await context.supabase
      .from("job_postings")
      .select("department")
      .eq("id", app.role_id)
      .maybeSingle();

    const { data: rec, error: upErr } = await context.supabase
      .from("onboarding_records")
      .upsert(
        {
          user_id: context.userId,
          application_id: app.id,
          role_title: app.role_title,
          department: (posting as any)?.department ?? null,
          status: "accepted",
          offer_accepted_at: new Date().toISOString(),
          offer_declined_at: null,
          current_step: 2,
        },
        { onConflict: "application_id" },
      )
      .select("*")
      .maybeSingle();
    if (upErr) throw new Error(upErr.message);
    return rec as OnboardingRecord;
  });

export const declineOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => acceptSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: app } = await context.supabase
      .from("job_applications")
      .select("id, user_id, role_title")
      .eq("id", data.application_id)
      .maybeSingle();
    if (!app || (app as any).user_id !== context.userId) throw new Error("Not found");
    const { error } = await context.supabase.from("onboarding_records").upsert(
      {
        user_id: context.userId,
        application_id: (app as any).id,
        role_title: (app as any).role_title,
        status: "declined",
        offer_declined_at: new Date().toISOString(),
      },
      { onConflict: "application_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Auto-save partial wizard state (called from onChange, debounced client-side).
const draftSchema = z.object({
  onboarding_id: z.string().uuid(),
  form_state: z.record(z.string(), z.any()).optional(),
  emergency_contact: z
    .object({
      name: z.string().trim().max(120).optional(),
      relation: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(30).optional(),
    })
    .optional(),
  id_ack: z.boolean().optional(),
  code_of_conduct_ack: z.boolean().optional(),
  current_step: z.number().int().min(1).max(4).optional(),
});

export const saveOnboardingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => draftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.form_state !== undefined) patch.form_state = data.form_state;
    if (data.emergency_contact !== undefined) patch.emergency_contact = data.emergency_contact;
    if (data.id_ack !== undefined) patch.id_ack = data.id_ack;
    if (data.code_of_conduct_ack !== undefined) patch.code_of_conduct_ack = data.code_of_conduct_ack;
    if (data.current_step !== undefined) patch.current_step = data.current_step;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await (context.supabase as any)
      .from("onboarding_records")
      .update(patch)
      .eq("id", data.onboarding_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const paperworkSchema = z.object({
  onboarding_id: z.string().uuid(),
  emergency_contact: z.object({
    name: z.string().trim().min(2).max(120),
    relation: z.string().trim().min(2).max(60),
    phone: z.string().trim().min(6).max(30),
  }),
  id_ack: z.literal(true),
  code_of_conduct_ack: z.literal(true),
});

export const savePaperwork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paperworkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("onboarding_records")
      .update({
        emergency_contact: data.emergency_contact,
        id_ack: data.id_ack,
        code_of_conduct_ack: data.code_of_conduct_ack,
        current_step: 3,
      })
      .eq("id", data.onboarding_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Persist the wizard's current step so users can resume where they left off.
export const updateOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        onboarding_id: z.string().uuid(),
        current_step: z.number().int().min(1).max(4),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("onboarding_records")
      .update({ current_step: data.current_step })
      .eq("id", data.onboarding_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Record a document that was just uploaded to storage into onboarding_documents.
const recordDocSchema = z.object({
  onboarding_id: z.string().uuid(),
  doc_key: z.string().trim().min(1).max(60),
  storage_path: z.string().trim().min(1).max(500),
  original_filename: z.string().trim().max(200).optional(),
});

export const recordUploadedDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verify onboarding row belongs to caller
    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("id, user_id")
      .eq("id", data.onboarding_id)
      .maybeSingle();
    if (!rec || (rec as any).user_id !== context.userId) throw new Error("Not found");

    // Versioning: mark any current version as superseded (keep the file + row for HR history).
    const { data: existing } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("id, version")
      .eq("onboarding_id", data.onboarding_id)
      .eq("doc_key", data.doc_key)
      .is("superseded_at", null)
      .maybeSingle();
    const nextVersion = existing ? ((existing as any).version ?? 1) + 1 : 1;
    if (existing) {
      await (context.supabase as any)
        .from("onboarding_documents")
        .update({ superseded_at: new Date().toISOString() })
        .eq("id", (existing as any).id);
    }

    const { data: row, error } = await (context.supabase as any)
      .from("onboarding_documents")
      .insert({
        user_id: context.userId,
        onboarding_id: data.onboarding_id,
        doc_key: data.doc_key,
        storage_path: data.storage_path,
        original_filename: data.original_filename ?? null,
        status: "pending",
        feedback: null,
        version: nextVersion,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as OnboardingDocument;
  });

export const deleteUploadedDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await (context.supabase as any)
      .from("onboarding_documents")
      .select("id, user_id, storage_path, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc || (doc as any).user_id !== context.userId) throw new Error("Not found");
    if (!["pending", "changes_requested"].includes((doc as any).status)) {
      throw new Error("This document is locked by HR and can no longer be replaced.");
    }
    await context.supabase.storage.from("onboarding-docs").remove([(doc as any).storage_path]);
    const { error } = await (context.supabase as any)
      .from("onboarding_documents")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const submitSchema = z.object({ onboarding_id: z.string().uuid() });

export const submitOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verify every required document is uploaded before allowing submission.
    const { data: rec } = await context.supabase
      .from("onboarding_records")
      .select("id, user_id, application_id")
      .eq("id", data.onboarding_id)
      .maybeSingle();
    if (!rec || (rec as any).user_id !== context.userId) throw new Error("Not found");

    const { data: app } = await context.supabase
      .from("job_applications")
      .select("role_id")
      .eq("id", (rec as any).application_id)
      .maybeSingle();
    const { data: posting } = await context.supabase
      .from("job_postings")
      .select("required_onboarding_docs, employment_type")
      .eq("id", (app as any)?.role_id)
      .maybeSingle();
    const required: string[] = mandatoryDocKeys(
      (posting as any)?.employment_type ?? null,
      ((posting as any)?.required_onboarding_docs as string[] | null) ?? [],
    );

    if (required.length > 0) {
      const { data: docs } = await (context.supabase as any)
        .from("onboarding_documents")
        .select("doc_key")
        .eq("onboarding_id", data.onboarding_id)
        .is("superseded_at", null);
      const have = new Set(((docs ?? []) as any[]).map((d) => d.doc_key));
      const missing = required.filter((k) => !have.has(k));
      if (missing.length > 0) {
        throw new Error(
          `Missing required documents: ${missing.map((k) => docLabel(k)).join(", ")}`,
        );
      }
    }

    // SECURITY DEFINER RPC validates paperwork and marks the record as submitted.
    // It does NOT grant any staff role — HR must approve documents AND set a DOJ
    // before `finalize_onboarding_role` grants the appropriate role.
    const { error } = await context.supabase.rpc("complete_onboarding", {
      _onboarding_id: data.onboarding_id,
    });
    if (error) throw new Error(error.message);

    // Mark verification as pending (HR still needs to review documents & set DOJ).
    await context.supabase
      .from("onboarding_records")
      .update({ verification_status: "pending", current_step: 4 })
      .eq("id", data.onboarding_id)
      .eq("user_id", context.userId);

    return { ok: true };
  });
