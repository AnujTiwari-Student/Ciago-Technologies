import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InternalJob = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  is_remote: boolean;
  employment_type: string | null;
  summary: string | null;
  description: string | null;
  requirements: string[] | null;
  tags: string[] | null;
  job_code: string | null;
  track_type: string | null;
  internal_only: boolean;
  status: string;
  created_at: string;
};

export const listInternalJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ q: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<InternalJob[]> => {
    let q = context.supabase
      .from("job_postings")
      .select("*")
      .in("status", ["published", "internal_only"]);
    if (data.q && data.q.trim()) {
      const t = `%${data.q.trim()}%`;
      q = q.or(`title.ilike.${t},department.ilike.${t},job_code.ilike.${t}`);
    }
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(120);
    if (error) throw new Error(error.message);
    return (rows ?? []) as InternalJob[];
  });

export const listMyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Managers see peers/reports in their department. RLS on user_roles allows
    // reading other members in the same department when the caller has manager+ role.
    const { data: myRoles } = await context.supabase
      .from("user_roles")
      .select("role, department_id")
      .eq("user_id", context.userId);
    const deptIds = Array.from(
      new Set((myRoles ?? []).map((r: any) => r.department_id).filter(Boolean)),
    );
    if (deptIds.length === 0) return [];
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id, role, department_id")
      .in("department_id", deptIds)
      .in("role", ["employee", "manager"])
      .neq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    const profileMap: Record<string, { full_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      for (const p of profs ?? []) profileMap[p.user_id] = { full_name: p.full_name };
    }
    return (roles ?? []).map((r: any) => ({
      user_id: r.user_id,
      role: r.role,
      department_id: r.department_id,
      full_name: profileMap[r.user_id]?.full_name ?? null,
    }));
  });
