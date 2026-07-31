import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

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
  .validator((d: any) => z.object({ q: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<InternalJob[]> => {
    const search = data.q?.trim();
    const rows = await context.db.withRLS((tx) =>
      tx.jobPosting.findMany({
        where: {
          status: { in: ["published", "internal_only"] },
          ...(search && {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { department: { contains: search, mode: "insensitive" as const } },
              { jobCode: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        },
        orderBy: { createdAt: "desc" },
        take: 120,
      }),
    );
    return rows as unknown as InternalJob[];
  });

export const listMyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return context.db.withRLS(async (tx) => {
      const myRoles = await tx.userRole.findMany({
        where: { userId: context.userId },
        select: { role: true, departmentId: true },
      });
      const deptIds = [...new Set(myRoles.map((r) => r.departmentId).filter(Boolean))] as string[];
      if (deptIds.length === 0) return [];

      const roles = await tx.userRole.findMany({
        where: {
          departmentId: { in: deptIds },
          role: "user",
          userId: { not: context.userId },
        },
        select: { userId: true, role: true, departmentId: true },
      });
      const ids = [...new Set(roles.map((r) => r.userId))];
      const profiles = ids.length
        ? await tx.profile.findMany({
            where: { userId: { in: ids } },
            select: { userId: true, fullName: true },
          })
        : [];
      const profileMap = Object.fromEntries(profiles.map((p) => [p.userId, p.fullName]));

      return roles.map((r) => ({
        user_id: r.userId,
        role: r.role,
        department_id: r.departmentId,
        full_name: profileMap[r.userId] ?? null,
      }));
    });
  });
