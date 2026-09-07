import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const coreInfoSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  email: z.string().email().max(200).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  country: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  linkedin: z.string().trim().max(500).optional(),
  portfolioUrl: z.string().trim().max(500).optional(),
  totalYearsExperience: z.number().int().min(0).max(60).nullable().optional(),
  highestEducationLevel: z.string().trim().max(100).optional(),
  educationalQualifications: z.array(z.any()).max(10).optional(),
  previousWorkExperiences: z.array(z.any()).max(10).optional(),
  resumeStoragePath: z.string().trim().max(500).optional(),
  resumeFileName: z.string().trim().max(300).optional(),
  expectedSalaryCurrency: z.string().trim().max(10).optional(),
  expectedSalaryMin: z.number().int().nullable().optional(),
  expectedSalaryMax: z.number().int().nullable().optional(),
  gender: z.string().trim().max(50).optional(),
  veteranStatus: z.string().trim().max(50).optional(),
  disabilityStatus: z.string().trim().max(50).optional(),
  workAuthorization: z.string().trim().max(100).optional(),
});

export type CoreInfoInput = z.infer<typeof coreInfoSchema>;

export const getMyCoreInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminDb } = await import("@/lib/db/admin");
    const db = getAdminDb();
    const userId = context.userId;

    const info = await db.applicantCoreInfo.findUnique({
      where: { userId },
    });

    if (!info) return null;

    return {
      fullName: info.fullName,
      email: info.email,
      phoneNumber: info.phoneNumber,
      country: info.country,
      city: info.city,
      address: info.address,
      linkedin: info.linkedin,
      portfolioUrl: info.portfolioUrl,
      totalYearsExperience: info.totalYearsExperience,
      highestEducationLevel: info.highestEducationLevel,
      educationalQualifications: info.educationalQualifications as any[] | null,
      previousWorkExperiences: info.previousWorkExperiences as any[] | null,
      resumeStoragePath: info.resumeStoragePath,
      resumeFileName: info.resumeFileName,
      expectedSalaryCurrency: info.expectedSalaryCurrency,
      expectedSalaryMin: info.expectedSalaryMin ? Number(info.expectedSalaryMin) : null,
      expectedSalaryMax: info.expectedSalaryMax ? Number(info.expectedSalaryMax) : null,
      gender: info.gender,
      veteranStatus: info.veteranStatus,
      disabilityStatus: info.disabilityStatus,
      workAuthorization: info.workAuthorization,
      updatedAt: info.updatedAt.toISOString(),
    };
  });

export const upsertMyCoreInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(coreInfoSchema)
  .handler(async ({ context, data }) => {
    try {
      const { getAdminDb } = await import("@/lib/db/admin");
      const db = getAdminDb();

      if (!db) {
        console.error("[upsertMyCoreInfo] getAdminDb() returned undefined");
        throw new Error("Database connection not available");
      }

      if (!db.applicantCoreInfo) {
        console.error("[upsertMyCoreInfo] db.applicantCoreInfo is undefined");
        console.error("[upsertMyCoreInfo] Available models:", Object.keys(db));
        throw new Error("ApplicantCoreInfo model not found in Prisma client");
      }

      const userId = context.userId;

      const payload: any = { ...data };
      if (data.expectedSalaryMin !== undefined) {
        payload.expectedSalaryMin = data.expectedSalaryMin != null ? BigInt(data.expectedSalaryMin) : null;
      }
      if (data.expectedSalaryMax !== undefined) {
        payload.expectedSalaryMax = data.expectedSalaryMax != null ? BigInt(data.expectedSalaryMax) : null;
      }

      await db.applicantCoreInfo.upsert({
        where: { userId },
        create: { userId, ...payload },
        update: payload,
      });

      return { success: true };
    } catch (error) {
      console.error("[upsertMyCoreInfo] Error:", error);
      throw error;
    }
  });

export const getJobPostingById = createServerFn({ method: "GET" })
  .validator(z.object({ jobId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { getAdminDb } = await import("@/lib/db/admin");
    const db = getAdminDb();
    const posting = await db.jobPosting.findUnique({
      where: { id: data.jobId, status: "published" },
    });

    if (!posting) return null;

    return {
      id: posting.id,
      title: posting.title,
      jobCode: posting.jobCode,
      department: posting.department,
      location: posting.location,
      isRemote: posting.isRemote,
      employmentType: posting.employmentType,
      summary: posting.summary,
      description: posting.description,
      requirements: posting.requirements,
      tags: posting.tags,
      currency: posting.currency,
      salaryPaidPer: posting.salaryPaidPer,
      salaryMinInr: posting.salaryMinInr ? Number(posting.salaryMinInr) : null,
      salaryMaxInr: posting.salaryMaxInr ? Number(posting.salaryMaxInr) : null,
      publishSalaryRange: posting.publishSalaryRange,
      designation: posting.designation,
      closesOn: posting.closesOn?.toISOString() ?? null,
      createdAt: posting.createdAt.toISOString(),
    };
  });
