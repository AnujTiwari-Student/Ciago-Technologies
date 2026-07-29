import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuditLog = {
  id: string;
  timestamp: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_resource: string | null;
  details: any;
};

const filterSchema = z
  .object({
    action: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().min(1).max(500).optional(),
  })
  .optional();

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filterSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    // admin-only via RLS policy; verify explicitly for a clean 403 message
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    let q = context.supabase
      .from("audit_logs")
      .select("id, timestamp, actor_id, actor_email, action, target_resource, details")
      .order("timestamp", { ascending: false })
      .limit(data?.limit ?? 200);
    if (data?.action) q = q.eq("action", data.action);
    if (data?.from) q = q.gte("timestamp", data.from);
    if (data?.to) q = q.lte("timestamp", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AuditLog[];
  });
