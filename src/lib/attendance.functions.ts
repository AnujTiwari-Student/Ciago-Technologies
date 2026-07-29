import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const { data, error } = await context.supabase
      .from("attendance_records")
      .upsert(
        { user_id: context.userId, work_date: today, check_in: now, status: "present" },
        { onConflict: "user_id,work_date", ignoreDuplicates: false },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as AttendanceRecord;
  });

export const checkOutToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await context.supabase
      .from("attendance_records")
      .select("*")
      .eq("user_id", context.userId)
      .eq("work_date", today)
      .maybeSingle();
    if (!existing || !existing.check_in) throw new Error("You have not checked in today.");
    const now = new Date();
    const hours = Math.max(0, (now.getTime() - new Date(existing.check_in).getTime()) / 3_600_000);
    const { data, error } = await context.supabase
      .from("attendance_records")
      .update({ check_out: now.toISOString(), hours: Number(hours.toFixed(2)) })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as AttendanceRecord;
  });

export const listMyAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z.object({ from: isoDate.optional(), to: isoDate.optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<AttendanceRecord[]> => {
    let q = context.supabase.from("attendance_records").select("*").eq("user_id", context.userId);
    if (data.from) q = q.gte("work_date", data.from);
    if (data.to) q = q.lte("work_date", data.to);
    const { data: rows, error } = await q.order("work_date", { ascending: false }).limit(400);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AttendanceRecord[];
  });

export const requestRegularization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        work_date: isoDate,
        reason: z.string().min(4).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("attendance_records")
      .upsert(
        {
          user_id: context.userId,
          work_date: data.work_date,
          status: "pending_regularization",
          regularization_reason: data.reason,
        },
        { onConflict: "user_id,work_date", ignoreDuplicates: false },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AttendanceRecord;
  });

export const decideRegularization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("attendance_records")
      .update({
        status: data.approve ? "regularized" : "absent",
        regularized_by: context.userId,
        regularized_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as AttendanceRecord;
  });

export const listPendingRegularizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("attendance_records")
      .select("*")
      .eq("status", "pending_regularization")
      .order("work_date", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    let byId = new Map<string, any>();
    if (ids.length) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      byId = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      applicant_name: byId.get(r.user_id)?.full_name ?? null,
      applicant_email: null,
    }));
  });
