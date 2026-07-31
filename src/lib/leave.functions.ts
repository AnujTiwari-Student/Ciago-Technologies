import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

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

async function assertApprover(db: any, userId: string) {
  const count = await db.withRLS((tx: any) =>
    tx.userRole.count({ where: { userId, role: "admin" } }),
  );
  if (count === 0) throw new Error("Forbidden");
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
  .validator((d: z.infer<typeof submitSchema>) => submitSchema.parse(d))
  .handler(async ({ data, context }): Promise<LeaveRequest> => {
    const row = await context.db.withRLS((tx) =>
      tx.leaveRequest.create({
        data: {
          userId: context.userId,
          leaveType: data.leave_type,
          startDate: data.start_date,
          endDate: data.end_date,
          reason: data.reason ?? null,
          status: "pending",
        },
      }),
    );
    return row as unknown as LeaveRequest;
  });

export const listMyLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaveRequest[]> => {
    const rows = await context.db.withRLS((tx) =>
      tx.leaveRequest.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
      }),
    );
    return rows as unknown as LeaveRequest[];
  });

export const cancelMyLeaveRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.db.withRLS((tx) =>
      tx.leaveRequest.updateMany({
        where: { id: data.id, userId: context.userId, status: "pending" },
        data: { status: "cancelled" },
      }),
    );
    return { ok: true };
  });

// ============================================================
// Approver actions (manager / hr / admin)
// ============================================================
export const listPendingLeaveRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingLeaveRow[]> => {
    await assertApprover(context.db, context.userId);
    const adminDb = getAdminDb();

    const rows = await adminDb.leaveRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    if (rows.length === 0) return [];

    const ids = Array.from(new Set(rows.map((r) => r.userId)));
    const profiles = await adminDb.profile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, fullName: true },
    });
    const byId = new Map(profiles.map((p) => [p.userId, p.fullName]));

    return rows.map((r) => ({
      ...(r as unknown as LeaveRequest),
      applicant_name: byId.get(r.userId) ?? null,
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
  .validator((d: z.infer<typeof decisionSchema>) => decisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertApprover(context.db, context.userId);
    const adminDb = getAdminDb();

    const updated = await adminDb.leaveRequest.update({
      where: { id: data.id },
      data: {
        status: data.decision,
        decisionNote: data.decision_note ?? null,
        decidedBy: context.userId,
        decidedAt: new Date(),
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        action: `leave.${data.decision}`,
        targetResource: data.id,
        details: {
          applicant_id: updated.userId,
          start_date: updated.startDate,
          end_date: updated.endDate,
          note: data.decision_note ?? null,
        },
      },
    });

    await adminDb.inAppNotification.create({
      data: {
        userId: updated.userId,
        title: data.decision === "approved" ? "Leave approved" : "Leave rejected",
        body: `${updated.startDate} → ${updated.endDate}${
          data.decision_note ? ` — ${data.decision_note}` : ""
        }`,
        link: "/my-applications", // Leave management moved to user view
      },
    });

    return { ok: true };
  });
