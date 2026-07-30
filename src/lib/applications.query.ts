import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

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
    const apps = await context.db.withRLS((tx) =>
      tx.jobApplication.findMany({
        where: { userId: context.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          roleId: true,
          roleTitle: true,
          fullName: true,
          email: true,
          status: true,
          createdAt: true,
          portfolioUrl: true,
          resumeLink: true,
          isSoftDeleted: true,
          deletedAt: true,
        },
      }),
    );

    const roleIds = Array.from(new Set(apps.map((r) => r.roleId))).filter(Boolean);
    const codeByRole = new Map<string, string | null>();
    if (roleIds.length > 0) {
      const adminDb = getAdminDb();
      const postings = await adminDb.jobPosting.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, jobCode: true },
      });
      for (const p of postings) codeByRole.set(p.id, p.jobCode ?? null);
    }

    const now = Date.now();
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    return apps
      .filter((r) => {
        if (!r.isSoftDeleted) return true;
        if (!r.deletedAt) return true;
        return now - r.deletedAt.getTime() < NINETY_DAYS;
      })
      .map<MyApplication>((r) => ({
        id: r.id,
        role_id: r.roleId,
        role_title: r.roleTitle,
        full_name: r.fullName,
        email: r.email,
        status: r.status,
        created_at: r.createdAt.toISOString(),
        portfolio_url: r.portfolioUrl,
        resume_link: r.resumeLink,
        is_soft_deleted: r.isSoftDeleted,
        deleted_at: r.deletedAt?.toISOString() ?? null,
        job_code: codeByRole.get(r.roleId) ?? null,
        next_eligible_at: new Date(r.createdAt.getTime() + NINETY_DAYS).toISOString(),
      }));
  });
