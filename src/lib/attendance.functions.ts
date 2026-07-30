import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

export type AttendanceRecord = {
  id: string;
  user_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  hours: number | null;
  status: "present" | "absent" | "leave" | "regularized" | "pending_regularization" | string;
  regularization_reason: string | null;
  regularized_by: string | null;
  regularized_at: string | null;
  created_at: string;
  updated_at: string;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const checkInToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const row = await context.db.withRLS((tx) =>
      tx.attendanceRecord.upsert({
        where: { id: "00000000-0000-0000-0000-000000000000" },
        create: {
          userId: context.userId,
          workDate: today,
          checkIn: now,
          status: "present",
        },
        update: {
          checkIn: now,
          status: "present",
        },
      }),
    );
    return row as unknown as AttendanceRecord;
  });

export const checkOutToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await context.db.withRLS((tx) =>
      tx.attendanceRecord.findFirst({
        where: { userId: context.userId, workDate: today },
      }),
    );
    if (!existing || !existing.checkIn) throw new Error("You have not checked in today.");
    const now = new Date();
    const hours = Math.max(0, (now.getTime() - new Date(existing.checkIn).getTime()) / 3_600_000);
    const row = await context.db.withRLS((tx) =>
      tx.attendanceRecord.update({
        where: { id: existing.id },
        data: { checkOut: now.toISOString(), hours: Number(hours.toFixed(2)) },
      }),
    );
    return row as unknown as AttendanceRecord;
  });

export const listMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z.object({ from: isoDate.optional(), to: isoDate.optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<AttendanceRecord[]> => {
    const rows = await context.db.withRLS((tx) =>
      tx.attendanceRecord.findMany({
        where: {
          userId: context.userId,
          ...(data.from && { workDate: { gte: data.from } }),
          ...(data.to && { workDate: { lte: data.to } }),
        },
        orderBy: { workDate: "desc" },
        take: 400,
      }),
    );
    return rows as unknown as AttendanceRecord[];
  });

export const requestRegularization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z
      .object({
        work_date: isoDate,
        reason: z.string().min(4).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = await context.db.withRLS((tx) =>
      tx.attendanceRecord.upsert({
        where: { id: "00000000-0000-0000-0000-000000000000" },
        create: {
          userId: context.userId,
          workDate: data.work_date,
          status: "pending_regularization",
          regularizationReason: data.reason,
        },
        update: {
          status: "pending_regularization",
          regularizationReason: data.reason,
        },
      }),
    );
    return row as unknown as AttendanceRecord;
  });

export const decideRegularization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: any) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const adminDb = getAdminDb();
    const row = await adminDb.attendanceRecord.update({
      where: { id: data.id },
      data: {
        status: data.approve ? "regularized" : "absent",
        regularizedBy: context.userId,
        regularizedAt: new Date(),
      },
    });
    return row as unknown as AttendanceRecord;
  });

export const listPendingRegularizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminDb = getAdminDb();
    const rows = await adminDb.attendanceRecord.findMany({
      where: { status: "pending_regularization" },
      orderBy: { workDate: "desc" },
      take: 200,
    });
    const ids = Array.from(new Set(rows.map((r) => r.userId)));
    let profileMap = new Map<string, string | null>();
    if (ids.length) {
      const profiles = await adminDb.profile.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, fullName: true },
      });
      profileMap = new Map(profiles.map((p) => [p.userId, p.fullName]));
    }
    return rows.map((r) => ({
      id: r.id,
      user_id: r.userId,
      work_date: r.workDate,
      check_in: r.checkIn,
      check_out: r.checkOut,
      hours: r.hours,
      status: r.status,
      regularization_reason: r.regularizationReason,
      applicant_name: profileMap.get(r.userId) ?? null,
      applicant_email: null,
    }));
  });
