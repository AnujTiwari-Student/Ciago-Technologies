import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_STATUSES = [
  "applied",
  "screening",
  "interviewing",
  "offered",
  "hired",
  "rejected",
] as const;

export type AdminApplication = {
  id: string;
  user_id: string;
  role_id: string;
  role_title: string;
  full_name: string;
  email: string;
  status: string;
  portfolio_url: string | null;
  resume_link: string | null;
  resume_storage_path: string | null;
  created_at: string;
  track_type: "standard" | "manager_track" | "hr_track" | null;
};

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
  full_name: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function assertHrOrAdmin(supabase: any, userId: string) {
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

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });

export const listAllApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("job_applications")
      .select(
        "id, user_id, role_id, role_title, full_name, email, status, portfolio_url, resume_link, resume_storage_path, created_at",
      )
      .eq("is_soft_deleted", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as AdminApplication[];
    // Attach track_type from job_postings so Admin/HR can see HR-track / Manager-track badges.
    const roleIds = Array.from(new Set(rows.map((r) => r.role_id).filter(Boolean)));
    if (roleIds.length > 0) {
      const { data: postings } = await context.supabase
        .from("job_postings")
        .select("id, track_type")
        .in("id", roleIds);
      const trackByRole = new Map(
        ((postings ?? []) as any[]).map((p) => [p.id, p.track_type ?? null]),
      );
      for (const r of rows) r.track_type = trackByRole.get(r.role_id) ?? null;
    } else {
      for (const r of rows) r.track_type = null;
    }

    const withPaths = rows.filter((r) => r.resume_storage_path);
    if (withPaths.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await Promise.all(
        withPaths.map(async (r) => {
          const { data: signed } = await supabaseAdmin.storage
            .from("resumes")
            .createSignedUrl(r.resume_storage_path!, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) r.resume_link = signed.signedUrl;
        }),
      );
    }
    return rows;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(ALLOWED_STATUSES),
});

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.supabase, context.userId);

    // Fetch prior state so we can log + notify only on real change
    const { data: prior } = await context.supabase
      .from("job_applications")
      .select("id, user_id, email, full_name, role_title, status")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase
      .from("job_applications")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (prior && prior.status !== data.status) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { getStatusEmailContent, sendResendEmail } = await import("@/lib/notifications.server");
      const content = getStatusEmailContent(data.status, prior.role_title, prior.full_name);

      // 1) audit log
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: context.userId,
        actor_email: (context.claims as any)?.email ?? null,
        action: "APPLICATION_STATUS_UPDATED",
        target_resource: `job_applications/${data.id}`,
        details: {
          from: prior.status,
          to: data.status,
          candidate_email: prior.email,
          role_title: prior.role_title,
        } as any,
      });

      // 2) in-app notification (only if candidate has an auth user_id)
      if (prior.user_id) {
        await supabaseAdmin.from("in_app_notifications").insert({
          user_id: prior.user_id,
          application_id: prior.id,
          title: content.inAppTitle,
          body: content.inAppBody,
          link: "/my-applications",
        });
      }

      // 3) email (best-effort — never fail the status update)
      try {
        await sendResendEmail({
          to: prior.email,
          subject: content.subject,
          html: content.html,
        });
      } catch (e) {
        console.error("[status-email] send failed", e);
      }
    }

    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteRejectedApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Fetch resume path first so we can purge storage immediately
    const { data: row, error: fetchErr } = await context.supabase
      .from("job_applications")
      .select("id, status, resume_storage_path, is_soft_deleted")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Application not found");
    if (row.status !== "rejected") throw new Error("Only rejected applications can be deleted");

    // Purge resume file from storage immediately for privacy + space
    if (row.resume_storage_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("resumes").remove([row.resume_storage_path]);
    }

    // Soft-delete: candidate keeps visibility for 5 days, then pg_cron hard-deletes.
    const { error: updErr } = await context.supabase
      .from("job_applications")
      .update({
        is_soft_deleted: true,
        deleted_at: new Date().toISOString(),
        status: "rejected",
        resume_storage_path: null,
        resume_link: null,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const adminSet = new Set(
      (roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
    );

    return usersData.users.map(
      (u): AdminUser => ({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_admin: adminSet.has(u.id),
        full_name: (u.user_metadata as any)?.full_name || (u.user_metadata as any)?.name || null,
      }),
    );
  });

const roleSchema = z.object({
  userId: z.string().uuid(),
  makeAdmin: z.boolean(),
});

export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => roleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You cannot revoke your own admin role.");
    }
    if (data.makeAdmin) {
      const { error } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" as any });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      actor_email: (context.claims as any)?.email ?? null,
      action: data.makeAdmin ? "ROLE_GRANTED" : "ROLE_REVOKED",
      target_resource: `user_roles/${data.userId}`,
      details: { role: "admin", target_user_id: data.userId } as any,
    });
    return { ok: true };
  });

// ============ Applicants grouped by role ============

export type ApplicantByRole = {
  application_id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  is_soft_deleted: boolean;
  next_eligible_at: string;
  cooldown_days_left: number;
};

export type RoleApplicantsGroup = {
  role_id: string;
  role_title: string;
  job_code: string | null;
  status: string;
  total: number;
  active: number;
  rejected: number;
  applicants: ApplicantByRole[];
};

export const listApplicantsByRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RoleApplicantsGroup[]> => {
    await assertHrOrAdmin(context.supabase, context.userId);
    const { data: apps, error } = await context.supabase
      .from("job_applications")
      .select(
        "id, user_id, role_id, role_title, full_name, email, status, created_at, is_soft_deleted",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (apps ?? []) as any[];
    const roleIds = Array.from(new Set(rows.map((r) => r.role_id))).filter(Boolean);
    const codeByRole = new Map<string, { code: string | null; status: string; title: string }>();
    if (roleIds.length > 0) {
      const { data: postings } = await context.supabase
        .from("job_postings")
        .select("id, job_code, status, title")
        .in("id", roleIds);
      for (const p of (postings ?? []) as any[]) {
        codeByRole.set(p.id, { code: p.job_code ?? null, status: p.status, title: p.title });
      }
    }

    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    const groups = new Map<string, RoleApplicantsGroup>();
    for (const r of rows) {
      const nextEligible = new Date(new Date(r.created_at).getTime() + NINETY_DAYS);
      const cooldownDaysLeft = Math.max(
        0,
        Math.ceil((nextEligible.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      );
      const meta = codeByRole.get(r.role_id);
      let g = groups.get(r.role_id);
      if (!g) {
        g = {
          role_id: r.role_id,
          role_title: meta?.title || r.role_title,
          job_code: meta?.code ?? null,
          status: meta?.status ?? "unknown",
          total: 0,
          active: 0,
          rejected: 0,
          applicants: [],
        };
        groups.set(r.role_id, g);
      }
      g.total += 1;
      if (["applied", "screening", "interviewing", "offered"].includes(r.status)) g.active += 1;
      if (r.status === "rejected" || r.is_soft_deleted) g.rejected += 1;
      g.applicants.push({
        application_id: r.id,
        user_id: r.user_id,
        full_name: r.full_name,
        email: r.email,
        status: r.is_soft_deleted ? "rejected" : r.status,
        created_at: r.created_at,
        is_soft_deleted: r.is_soft_deleted,
        next_eligible_at: nextEligible.toISOString(),
        cooldown_days_left: cooldownDaysLeft,
      });
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  });
