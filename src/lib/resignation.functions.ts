import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  .inputValidator((d: any) =>
    z.object({ last_working_day: isoDate, reason: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("resignations")
      .insert({
        user_id: context.userId,
        last_working_day: data.last_working_day,
        reason: data.reason ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "resignation.submitted",
      target_resource: row.id,
      details: { last_working_day: data.last_working_day },
    });
    return row as Resignation;
  });

export const withdrawResignation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("resignations")
      .update({ status: "withdrawn" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Resignation;
  });

export const listMyResignation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Resignation | null> => {
    const { data, error } = await context.supabase
      .from("resignations")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as Resignation | null;
  });

export const listAllResignations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("resignations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const profileMap: Record<string, { full_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      for (const p of profs ?? []) profileMap[p.user_id] = { full_name: p.full_name };
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      applicant_name: profileMap[r.user_id]?.full_name ?? null,
    }));
  });

export const decideResignation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
        decision_note: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("resignations")
      .update({
        status: data.decision,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
        decision_note: data.decision_note ?? null,
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: `resignation.${data.decision}`,
      target_resource: row.id,
      details: { decision_note: data.decision_note ?? null },
    });
    return row as Resignation;
  });
