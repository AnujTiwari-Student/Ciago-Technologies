import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

export type JobPosting = {
  id: string;
  job_code: string | null;
  title: string;
  designation: string | null;
  department: string;
  location: string;
  is_remote: boolean;
  employment_type: string;
  summary: string;
  description: string;
  requirements: string[];
  tags: string[];
  currency: string;
  salary_paid_per: string;
  salary_min_inr: number | null;
  salary_max_inr: number | null;
  publish_salary_range: boolean;
  status: "draft" | "published" | "internal_only" | "closed" | "archived";
  closes_on: string | null;
  frappe_job_opening_name: string | null;
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
  const count = await adminDb.userRole.count({
    where: { userId, role: { in: ["admin", "hr"] } },
  });
  if (count === 0) throw new Error("Forbidden");
}

async function shouldScopeToDepartment(userId: string): Promise<string | null> {
  const adminDb = getAdminDb();
  const roles = await adminDb.userRole.findMany({
    where: { userId },
    select: { role: true, departmentId: true },
  });

  const roleSet = new Set(roles.map((r) => r.role));

  // Admin and system roles see everything
  if (roleSet.has("admin") || roleSet.has("system_engineer") || roleSet.has("developer")) {
    return null;
  }

  // HR and manager roles are department-scoped
  if (roleSet.has("hr") || roleSet.has("manager")) {
    const departmentId = roles.find((r) => r.departmentId)?.departmentId;
    return departmentId ?? null;
  }

  return null;
}

export const listAllJobPostings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrHr(context.db, context.userId);
    const adminDb = getAdminDb();

    const scopedDepartmentId = await shouldScopeToDepartment(context.userId);

    const rows = await adminDb.jobPosting.findMany({
      where: scopedDepartmentId ? { departmentId: scopedDepartmentId } : {},
      orderBy: { createdAt: "desc" },
    });
    return rows as unknown as JobPosting[];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  designation: z.string().min(1).max(100).optional().nullable(),
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
  publish_salary_range: z.boolean().optional().default(false),
  closes_on: z.string().date().optional().nullable(),
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
        designation: data.designation,
        department: data.department,
        location: data.location,
        isRemote: data.is_remote,
        employmentType: data.employment_type,
        summary: data.summary,
        description: data.description,
        requirements: data.requirements,
        tags: data.tags,
        currency: "INR",
        salaryPaidPer: "Month",
        salaryMinInr: data.salary_min_inr,
        salaryMaxInr: data.salary_max_inr,
        publishSalaryRange: data.publish_salary_range ?? false,
        closesOn: data.closes_on ? new Date(data.closes_on) : null,
        status: data.status as any,
        createdBy: context.userId,
      },
      update: {
        title: data.title,
        designation: data.designation,
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
        publishSalaryRange: data.publish_salary_range ?? false,
        closesOn: data.closes_on ? new Date(data.closes_on) : null,
        status: data.status as any,
      },
    });

    // Sync to Frappe Job Opening (V2 - Intelligent Matching)
    try {
      const { isFrappeEmployeeSyncEnabled } = await import("@/lib/feature-flags.server");
      const frappeEnabled = await isFrappeEmployeeSyncEnabled();

      if (frappeEnabled) {
        const { syncJobPostingToFrappe } = await import("@/lib/frappe-job-sync-v2");
        const { createFrappeClient } = await import("@/integrations/frappe/client");
        const client = createFrappeClient();

        await syncJobPostingToFrappe(adminDb, client, result.id);
      }
    } catch (err) {
      console.error("[job-posting-frappe-sync] Failed to sync to Frappe:", err);
      // Don't throw — posting saved successfully, Frappe sync is secondary
    }

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
