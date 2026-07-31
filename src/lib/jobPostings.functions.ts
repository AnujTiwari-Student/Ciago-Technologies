import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

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

export const listActiveJobPostings = createServerFn({ method: "GET" }).handler(async () => {
  const adminDb = getAdminDb();
  const rows = await adminDb.jobPosting.findMany({
    where: { status: "published" },
    orderBy: { createdAt: "desc" },
  });
  return rows as unknown as JobPosting[];
});

export const listEmploymentTypes = createServerFn({ method: "GET" }).handler(async () => {
  const adminDb = getAdminDb();
  const data = await adminDb.employmentType.findMany({
    select: { code: true, label: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  return data.map((e) => ({ code: e.code, label: e.label, sort_order: e.sortOrder }));
});

async function assertAdminOrHr(_db: any, userId: string) {
  const { getAdminDb } = await import("@/lib/db/admin");
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({ where: { userId, role: "admin" } });
  if (count === 0) throw new Error("Forbidden");
}

export const listAllJobPostings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrHr(context.db, context.userId);
    const adminDb = getAdminDb();
    const rows = await adminDb.jobPosting.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows as unknown as JobPosting[];
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
  .validator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.db, context.userId);
    const adminDb = getAdminDb();

    const result = await adminDb.jobPosting.upsert({
      where: { id: data.id || "00000000-0000-0000-0000-000000000000" },
      create: {
        title: data.title,
        department: data.department,
        location: data.location,
        isRemote: data.is_remote,
        employmentType: data.employment_type,
        summary: data.summary,
        description: data.description,
        requirements: data.requirements,
        tags: data.tags,
        salaryMinInr: data.salary_min_inr,
        salaryMaxInr: data.salary_max_inr,
        status: data.status as any,
        createdBy: context.userId,
      },
      update: {
        title: data.title,
        department: data.department,
        location: data.location,
        isRemote: data.is_remote,
        employmentType: data.employment_type,
        summary: data.summary,
        description: data.description,
        requirements: data.requirements,
        tags: data.tags,
        salaryMinInr: data.salary_min_inr,
        salaryMaxInr: data.salary_max_inr,
        status: data.status as any,
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims?.email as string | null) ?? null,
        action: data.id ? "JOB_POSTING_UPDATED" : "JOB_POSTING_CREATED",
        targetResource: `job_postings/${result.id}`,
        details: { title: data.title, status: data.status },
      },
    });

    return { id: result.id, title: result.title, status: result.status };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteJobPosting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrHr(context.db, context.userId);
    const adminDb = getAdminDb();

    const row = await adminDb.jobPosting.findUnique({
      where: { id: data.id },
      select: { title: true },
    });
    await adminDb.jobPosting.delete({ where: { id: data.id } });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims?.email as string | null) ?? null,
        action: "JOB_POSTING_DELETED",
        targetResource: `job_postings/${data.id}`,
        details: { title: row?.title },
      },
    });
    return { ok: true };
  });
