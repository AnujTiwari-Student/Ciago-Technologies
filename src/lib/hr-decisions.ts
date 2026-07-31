/**
 * Pure, injectable helpers for HR onboarding document decisions and
 * signed-URL access. Extracted so we can unit-test the decision path
 * (RBAC gate, status update, audit + notification writes, storage TTL)
 * without a live Supabase instance.
 *
 * The production server functions in `hr.functions.ts` can (and should)
 * delegate to these helpers; existing production code keeps working
 * because these are additive.
 */

export type DecisionStatus = "approved" | "changes_requested" | "rejected";

export type DecisionInput = {
  document_id: string;
  status: DecisionStatus;
  feedback?: string | null;
  email_subject?: string | null;
  email_html?: string | null;
};

export type DecisionDeps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  storage?: any;
  actorId: string;
  actorEmail?: string | null;
  roles: Set<string>;
  now?: () => Date;
};

export type DecisionResult = {
  document_id: string;
  status: DecisionStatus;
  audit_action: "ONBOARDING_DOC_REVIEWED";
  notified_user_id: string;
};

export function assertHrOrAdmin(roles: Set<string>): void {
  if (!roles.has("admin")) {
    throw new Error("Forbidden");
  }
}

export function validateDecisionInput(input: DecisionInput): void {
  if (!input.document_id) throw new Error("document_id required");
  if (!["approved", "changes_requested", "rejected"].includes(input.status)) {
    throw new Error("Invalid status");
  }
  if (
    (input.status === "changes_requested" || input.status === "rejected") &&
    !(input.feedback && input.feedback.trim().length > 0)
  ) {
    throw new Error("Feedback is required when requesting changes or rejecting a document.");
  }
}

/**
 * Applies a single HR document decision:
 *   1. Verifies caller has hr|admin role.
 *   2. Loads the document row (must exist).
 *   3. Updates status/feedback/reviewer.
 *   4. Writes an audit_logs row.
 *   5. Writes an in_app_notifications row for the candidate.
 */
export async function applyDocumentDecision(
  deps: DecisionDeps,
  input: DecisionInput,
): Promise<DecisionResult> {
  assertHrOrAdmin(deps.roles);
  validateDecisionInput(input);
  const now = (deps.now ?? (() => new Date()))().toISOString();

  const { data: doc, error: loadErr } = await deps.supabase
    .from("onboarding_documents")
    .select("id, onboarding_id, user_id, doc_key, status")
    .eq("id", input.document_id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!doc) throw new Error("Document not found");

  const { error: upErr } = await deps.supabase
    .from("onboarding_documents")
    .update({
      status: input.status,
      feedback: input.feedback ?? null,
      reviewed_by: deps.actorId,
      reviewed_at: now,
    })
    .eq("id", input.document_id);
  if (upErr) throw new Error(upErr.message);

  await deps.supabase.from("audit_logs").insert({
    actor_id: deps.actorId,
    actor_email: deps.actorEmail ?? null,
    action: "ONBOARDING_DOC_REVIEWED",
    target_resource: `onboarding_records/${doc.onboarding_id}`,
    details: {
      document_id: input.document_id,
      doc_key: doc.doc_key,
      from: doc.status,
      to: input.status,
      feedback: input.feedback ?? null,
    },
  });

  await deps.supabase.from("in_app_notifications").insert({
    user_id: doc.user_id,
    title: `Document ${input.status.replace("_", " ")}`,
    body: input.feedback ?? `Your ${doc.doc_key} has been ${input.status}.`,
    link: "/onboarding",
  });

  return {
    document_id: input.document_id,
    status: input.status,
    audit_action: "ONBOARDING_DOC_REVIEWED",
    notified_user_id: doc.user_id,
  };
}

/**
 * Applies decisions for many documents in one call.
 * Returns per-document results; failures do not stop the batch.
 */
export async function applyBulkDocumentDecisions(
  deps: DecisionDeps,
  inputs: DecisionInput[],
): Promise<Array<{ document_id: string; ok: boolean; error?: string }>> {
  assertHrOrAdmin(deps.roles);
  const out: Array<{ document_id: string; ok: boolean; error?: string }> = [];
  for (const input of inputs) {
    try {
      await applyDocumentDecision(deps, input);
      out.push({ document_id: input.document_id, ok: true });
    } catch (e) {
      out.push({
        document_id: input.document_id,
        ok: false,
        error: (e as Error).message,
      });
    }
  }
  return out;
}

/**
 * Signed-URL access to onboarding documents. Restricted to hr|admin.
 * Uses a short TTL (default 15 minutes) so links do not become
 * long-lived public references.
 */
export async function buildOnboardingDocSignedUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: { supabase: any; storage?: any; roles: Set<string> },
  args: { storage_path: string; ttl_seconds?: number },
): Promise<string> {
  assertHrOrAdmin(deps.roles);
  const ttl = args.ttl_seconds ?? 60 * 15;
  if (ttl <= 0 || ttl > 60 * 60) {
    throw new Error("TTL must be between 1 second and 1 hour");
  }
  if ("storage" in deps && deps.storage) {
    const storage = deps.storage as any;
    const result = await storage.createSignedUrl("onboarding-docs", args.storage_path, ttl);
    if (result.error) throw new Error(result.error);
    if (!result.signedUrl) throw new Error("No signed URL returned");
    return result.signedUrl;
  }
  // Fallback for tests with mock Supabase client
  const { data, error } = await deps.supabase.storage
    .from("onboarding-docs")
    .createSignedUrl(args.storage_path, ttl);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("No signed URL returned");
  return data.signedUrl as string;
}
