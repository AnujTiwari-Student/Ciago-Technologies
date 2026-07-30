import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

export type Resignation = {
  id: string;
  user_id: string;
  submitted_on: string;
  last_working_day: string;
  reason: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const submitResignation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z.object({ last_working_day: isoDate, reason: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const adminDb = getAdminDb();
    const row = await context.db.withRLS((tx) =>
      tx.resignation.create({
        data: {
          userId: context.userId,
          lastWorkingDay: data.last_working_day,
          reason: data.reason ?? null,
        },
      }),
    );
    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        action: "resignation.submitted",
        targetResource: row.id,
        details: { last_working_day: data.last_working_day },
      },
    });
    return row as unknown as Resignation;
  });

export const withdrawResignation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.db.withRLS((tx) =>
      tx.resignation.updateMany({
        where: { id: data.id, userId: context.userId },
        data: { status: "withdrawn" },
      }),
    );
    return { ok: true };
  });

export const listMyResignation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Resignation | null> => {
    const row = await context.db.withRLS((tx) =>
      tx.resignation.findFirst({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
      }),
    );
    return (row as unknown as Resignation) ?? null;
  });

export const listAllResignations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminDb = getAdminDb();
    const rows = await adminDb.resignation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const ids = Array.from(new Set(rows.map((r) => r.userId)));
    const profileMap: Record<string, string | null> = {};
    if (ids.length) {
      const profiles = await adminDb.profile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, fullName: true },
      });
      for (const p of profiles) profileMap[p.userId] = p.fullName;
    }
    return rows.map((r) => ({
      ...(r as any),
      applicant_name: profileMap[r.userId] ?? null,
    }));
  });

export const decideResignation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
        decision_note: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const adminDb = getAdminDb();
    const row = await adminDb.resignation.update({
      where: { id: data.id },
      data: {
        status: data.decision,
        decidedBy: context.userId,
        decidedAt: new Date(),
        decisionNote: data.decision_note ?? null,
      },
    });
    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        action: `resignation.${data.decision}`,
        targetResource: row.id,
        details: { decision_note: data.decision_note ?? null },
      },
    });
    return row as unknown as Resignation;
  });
