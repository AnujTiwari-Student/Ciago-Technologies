import { describe, it, expect, vi } from "vitest";
import {
  applyDocumentDecision,
  applyBulkDocumentDecisions,
  assertHrOrAdmin,
  buildOnboardingDocSignedUrl,
  validateDecisionInput,
} from "@/lib/hr-decisions";

// -------- mock supabase builder --------

type Table = "onboarding_documents" | "audit_logs" | "in_app_notifications";

function makeMockSupabase(
  opts: {
    document?: {
      id: string;
      onboarding_id: string;
      user_id: string;
      doc_key: string;
      status: string;
    } | null;
    loadError?: string;
    updateError?: string;
  } = {},
) {
  const calls: Record<string, unknown[]> = {
    updates: [],
    audits: [],
    notifications: [],
    signedUrls: [],
  };

  const from = vi.fn((table: Table) => {
    if (table === "onboarding_documents") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              opts.loadError
                ? { data: null, error: { message: opts.loadError } }
                : { data: opts.document ?? null, error: null },
          }),
        }),
        update: (payload: unknown) => ({
          eq: async () => {
            calls.updates.push(payload);
            return opts.updateError ? { error: { message: opts.updateError } } : { error: null };
          },
        }),
      };
    }
    if (table === "audit_logs") {
      return {
        insert: async (payload: unknown) => {
          calls.audits.push(payload);
          return { error: null };
        },
      };
    }
    if (table === "in_app_notifications") {
      return {
        insert: async (payload: unknown) => {
          calls.notifications.push(payload);
          return { error: null };
        },
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  const storage = {
    from: vi.fn((_bucket: string) => ({
      createSignedUrl: async (path: string, ttl: number) => {
        calls.signedUrls.push({ path, ttl, bucket: _bucket });
        return { data: { signedUrl: `https://signed.example/${path}?ttl=${ttl}` }, error: null };
      },
    })),
  };

  return { supabase: { from, storage }, calls };
}

// -------- RBAC gate --------

describe("assertHrOrAdmin", () => {
  it("allows hr role", () => {
    expect(() => assertHrOrAdmin(new Set(["hr"]))).not.toThrow();
  });
  it("allows admin role", () => {
    expect(() => assertHrOrAdmin(new Set(["admin"]))).not.toThrow();
  });
  it("rejects manager/employee/user roles", () => {
    for (const r of ["manager", "employee", "user"]) {
      expect(() => assertHrOrAdmin(new Set([r]))).toThrow(/Forbidden/);
    }
    expect(() => assertHrOrAdmin(new Set())).toThrow(/Forbidden/);
  });
});

// -------- validation --------

describe("validateDecisionInput", () => {
  it("requires feedback for changes_requested", () => {
    expect(() => validateDecisionInput({ document_id: "d", status: "changes_requested" })).toThrow(
      /Feedback is required/,
    );
  });
  it("requires feedback for rejected", () => {
    expect(() =>
      validateDecisionInput({ document_id: "d", status: "rejected", feedback: "  " }),
    ).toThrow(/Feedback is required/);
  });
  it("allows approve with no feedback", () => {
    expect(() => validateDecisionInput({ document_id: "d", status: "approved" })).not.toThrow();
  });
});

// -------- single decision --------

describe("applyDocumentDecision", () => {
  const doc = {
    id: "doc-1",
    onboarding_id: "onb-1",
    user_id: "candidate-1",
    doc_key: "aadhaar",
    status: "pending",
  };

  it("approves and writes update + audit + notification", async () => {
    const { supabase, calls } = makeMockSupabase({ document: doc });
    const res = await applyDocumentDecision(
      { supabase, actorId: "hr-1", actorEmail: "hr@x.com", roles: new Set(["hr"]) },
      { document_id: "doc-1", status: "approved" },
    );
    expect(res.status).toBe("approved");
    expect(res.notified_user_id).toBe("candidate-1");
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0]).toMatchObject({ status: "approved", reviewed_by: "hr-1" });
    expect(calls.audits).toHaveLength(1);
    expect(calls.audits[0]).toMatchObject({
      actor_id: "hr-1",
      actor_email: "hr@x.com",
      action: "ONBOARDING_DOC_REVIEWED",
      target_resource: "onboarding_records/onb-1",
    });
    expect(calls.notifications).toHaveLength(1);
    expect(calls.notifications[0]).toMatchObject({
      user_id: "candidate-1",
      link: "/onboarding",
    });
  });

  it("rejects request from non-HR caller before touching storage", async () => {
    const { supabase, calls } = makeMockSupabase({ document: doc });
    await expect(
      applyDocumentDecision(
        { supabase, actorId: "u", roles: new Set(["employee"]) },
        { document_id: "doc-1", status: "approved" },
      ),
    ).rejects.toThrow(/Forbidden/);
    expect(calls.updates).toHaveLength(0);
    expect(calls.audits).toHaveLength(0);
  });

  it("requires feedback for a rejection", async () => {
    const { supabase } = makeMockSupabase({ document: doc });
    await expect(
      applyDocumentDecision(
        { supabase, actorId: "hr-1", roles: new Set(["hr"]) },
        { document_id: "doc-1", status: "rejected" },
      ),
    ).rejects.toThrow(/Feedback is required/);
  });

  it("throws when document does not exist", async () => {
    const { supabase } = makeMockSupabase({ document: null });
    await expect(
      applyDocumentDecision(
        { supabase, actorId: "hr-1", roles: new Set(["hr"]) },
        { document_id: "missing", status: "approved" },
      ),
    ).rejects.toThrow(/not found/);
  });

  it("records the from → to transition in audit details", async () => {
    const { supabase, calls } = makeMockSupabase({ document: doc });
    await applyDocumentDecision(
      { supabase, actorId: "hr-1", roles: new Set(["hr"]) },
      { document_id: "doc-1", status: "changes_requested", feedback: "please re-scan" },
    );
    expect(calls.audits[0]).toMatchObject({
      details: { from: "pending", to: "changes_requested", feedback: "please re-scan" },
    });
  });
});

// -------- bulk --------

describe("applyBulkDocumentDecisions", () => {
  it("applies each decision and reports per-doc outcomes", async () => {
    const { supabase, calls } = makeMockSupabase({
      document: {
        id: "d",
        onboarding_id: "o",
        user_id: "u",
        doc_key: "pan",
        status: "pending",
      },
    });
    const res = await applyBulkDocumentDecisions(
      { supabase, actorId: "hr-1", roles: new Set(["hr"]) },
      [
        { document_id: "d1", status: "approved" },
        { document_id: "d2", status: "approved" },
        { document_id: "d3", status: "rejected" }, // missing feedback → per-item failure
      ],
    );
    expect(res).toHaveLength(3);
    expect(res[0].ok).toBe(true);
    expect(res[1].ok).toBe(true);
    expect(res[2].ok).toBe(false);
    expect(res[2].error).toMatch(/Feedback is required/);
    // 2 successful updates & audits (the 3rd failed validation before update)
    expect(calls.updates).toHaveLength(2);
    expect(calls.audits).toHaveLength(2);
  });

  it("rejects the whole batch when caller is not HR", async () => {
    const { supabase } = makeMockSupabase();
    await expect(
      applyBulkDocumentDecisions({ supabase, actorId: "u", roles: new Set(["user"]) }, [
        { document_id: "d1", status: "approved" },
      ]),
    ).rejects.toThrow(/Forbidden/);
  });
});

// -------- signed URL --------

describe("buildOnboardingDocSignedUrl", () => {
  it("uses the onboarding-docs bucket and a short TTL", async () => {
    const { supabase, calls } = makeMockSupabase();
    const url = await buildOnboardingDocSignedUrl(
      { supabase, roles: new Set(["hr"]) },
      { storage_path: "user-1/aadhaar.pdf" },
    );
    expect(url).toContain("signed.example");
    expect(calls.signedUrls).toEqual([
      { bucket: "onboarding-docs", path: "user-1/aadhaar.pdf", ttl: 900 },
    ]);
  });

  it("rejects non-HR callers before hitting storage", async () => {
    const { supabase, calls } = makeMockSupabase();
    await expect(
      buildOnboardingDocSignedUrl(
        { supabase, roles: new Set(["employee"]) },
        { storage_path: "x" },
      ),
    ).rejects.toThrow(/Forbidden/);
    expect(calls.signedUrls).toHaveLength(0);
  });

  it("rejects TTLs above 1 hour", async () => {
    const { supabase } = makeMockSupabase();
    await expect(
      buildOnboardingDocSignedUrl(
        { supabase, roles: new Set(["hr"]) },
        { storage_path: "x", ttl_seconds: 60 * 60 * 24 },
      ),
    ).rejects.toThrow(/TTL/);
  });

  it("rejects non-positive TTL", async () => {
    const { supabase } = makeMockSupabase();
    await expect(
      buildOnboardingDocSignedUrl(
        { supabase, roles: new Set(["hr"]) },
        { storage_path: "x", ttl_seconds: 0 },
      ),
    ).rejects.toThrow(/TTL/);
  });
});
