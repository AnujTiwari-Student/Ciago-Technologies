import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyApplication = {
  id: string;
  role_id: string;
  role_title: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  portfolio_url: string | null;
  resume_link: string | null;
  is_soft_deleted: boolean;
  deleted_at: string | null;
  job_code: string | null;
  next_eligible_at: string;
};

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_applications")
      .select(
        "id, role_id, role_title, full_name, email, status, created_at, portfolio_url, resume_link, is_soft_deleted, deleted_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<Omit<MyApplication, "job_code" | "next_eligible_at">>;
    const roleIds = Array.from(new Set(rows.map((r) => r.role_id))).filter(Boolean);
    const codeByRole = new Map<string, string | null>();
    if (roleIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: postings } = await supabaseAdmin
        .from("job_postings")
        .select("id, job_code")
        .in("id", roleIds);
      for (const p of postings ?? []) codeByRole.set((p as any).id, (p as any).job_code ?? null);
    }

    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    return rows
      .filter((r) => {
        if (!r.is_soft_deleted) return true;
        if (!r.deleted_at) return true;
        return now - new Date(r.deleted_at).getTime() < NINETY_DAYS;
      })
      .map<MyApplication>((r) => ({
        ...r,
        job_code: codeByRole.get(r.role_id) ?? null,
        next_eligible_at: new Date(new Date(r.created_at).getTime() + NINETY_DAYS).toISOString(),
      }));
  });
