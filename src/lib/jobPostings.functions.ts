import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobPosting = {
  id: string;
  job_code: string | null;
  title: string;
  department: string;
  location: string;
  is_remote: boolean;
  employment_type: string;
  summary: string;
  description: string;
  requirements: string[];
  tags: string[];
  salary_min_inr: number | null;
  salary_max_inr: number | null;
  status: "draft" | "published" | "internal_only" | "closed" | "archived";
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, job_code, title, department, location, is_remote, employment_type, summary, description, requirements, tags, salary_min_inr, salary_max_inr, status, created_at, updated_at";

function serverPublicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const url = process.env.SUPABASE_URL!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// Public — published postings only, safe for anon browser use via server fn
export const listActiveJobPostings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("job_postings")
    .select(COLS)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobPosting[];
});

export const listEmploymentTypes = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("employment_types")
    .select("code, label, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { code: string; label: string; sort_order: number }[];
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "hr"])
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}


async function insertAudit(actorId: string, actorEmail: string | null, action: string, target: string, details: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    target_resource: target,
    details: details as any,
  });
}

export const listAllJobPostings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("job_postings")
      .select(COLS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as JobPosting[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  department: z.string().min(1).max(100),
  location: z.string().min(1).max(120),
  is_remote: z.boolean(),
  employment_type: z.string().min(1).max(60),
  summary: z.string().min(10).max(400),
  description: z.string().min(10).max(8000),
  requirements: z.array(z.string().min(1).max(300)).max(30),
  tags: z.array(z.string().min(1).max(40)).max(20),
  salary_min_inr: z.number().int().nonnegative().nullable(),
  salary_max_inr: z.number().int().nonnegative().nullable(),
  status: z.enum(["draft", "published", "internal_only", "closed", "archived"]),
});

export const upsertJobPosting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload = { ...data, created_by: context.userId };
    const { data: row, error } = await context.supabase
      .from("job_postings")
      .upsert(payload as any)
      .select("id, title, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await insertAudit(
      context.userId,
      context.claims?.email ?? null,
      data.id ? "JOB_POSTING_UPDATED" : "JOB_POSTING_CREATED",
      `job_postings/${row?.id ?? data.id ?? ""}`,
      { title: data.title, status: data.status },
    );
    return row;
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteJobPosting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("job_postings")
      .select("title")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("job_postings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await insertAudit(
      context.userId,
      context.claims?.email ?? null,
      "JOB_POSTING_DELETED",
      `job_postings/${data.id}`,
      { title: row?.title },
    );
    return { ok: true };
  });
