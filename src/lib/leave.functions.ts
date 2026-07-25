import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Types & helpers
// ============================================================
export type LeaveRequest = {
  id: string;
  user_id: string;
  leave_type: "casual" | "sick" | "earned" | "unpaid" | string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingLeaveRow = LeaveRequest & {
  applicant_name: string | null;
  applicant_email: string | null;
};

const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid"] as const;

async function getUserRoles(supabase: any, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return new Set((data ?? []).map((r: any) => r.role as string));
}

// ============================================================
// Employee actions
// ============================================================
const submitSchema = z
  .object({
    leave_type: z.enum(LEAVE_TYPES),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    reason: z.string().max(500).optional().nullable(),
  })
  .refine((v) => v.end_date >= v.start_date, {
    message: "End date cannot be before start date",
    path: ["end_date"],
  });

export const submitLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof submitSchema>) => submitSchema.parse(d))
  .handler(async ({ data, context }): Promise<LeaveRequest> => {
    const { data: row, error } = await context.supabase
      .from("leave_requests")
      .insert({
        user_id: context.userId,
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as LeaveRequest;
  });

export const listMyLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaveRequest[]> => {
    const { data, error } = await context.supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as LeaveRequest[];
  });

export const cancelMyLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leave_requests")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Approver actions (manager / hr / admin)
// ============================================================
async function assertApprover(supabase: any, userId: string) {
  const roles = await getUserRoles(supabase, userId);
  const ok = roles.has("manager") || roles.has("hr") || roles.has("admin");
  if (!ok) throw new Error("Forbidden");
  return roles;
}

export const listPendingLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingLeaveRow[]> => {
    await assertApprover(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LeaveRequest[];
    if (rows.length === 0) return [];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    const byId = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return rows.map((r) => ({
      ...r,
      applicant_name: (byId.get(r.user_id) as any)?.full_name ?? null,
      applicant_email: null,
    }));
  });

const decisionSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  decision_note: z.string().max(500).optional().nullable(),
});

export const decideLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof decisionSchema>) => decisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertApprover(context.supabase, context.userId);

    const { data: updated, error } = await context.supabase
      .from("leave_requests")
      .update({
        status: data.decision,
        decision_note: data.decision_note ?? null,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Audit log (best effort)
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: `leave.${data.decision}`,
      target_resource: data.id,
      details: {
        applicant_id: (updated as any)?.user_id,
        start_date: (updated as any)?.start_date,
        end_date: (updated as any)?.end_date,
        note: data.decision_note ?? null,
      },
    });

    // In-app notification (best effort)
    await context.supabase.from("in_app_notifications").insert({
      user_id: (updated as any).user_id,
      title: data.decision === "approved" ? "Leave approved" : "Leave rejected",
      body: `${(updated as any).start_date} → ${(updated as any).end_date}${
        data.decision_note ? ` — ${data.decision_note}` : ""
      }`,
      link: "/employee?tab=leave",
    });

    return { ok: true };
  });
