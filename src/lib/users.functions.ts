import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

export const DEPT_TYPES = [
  "engineering",
  "operations",
  "human_resource",
  "management",
  "product",
  "design",
  "finance",
  "sales",
  "marketing",
  "customer_support",
  "legal",
  "it_infrastructure",
] as const;
export type DeptType = (typeof DEPT_TYPES)[number];

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contractor",
  "intern",
  "probation",
] as const;
export const WORK_MODELS = ["onsite", "remote", "hybrid"] as const;
export const PROBATION_STATUSES = ["under_review", "confirmed", "extended"] as const;
export const BG_CHECK_STATUSES = ["not_started", "in_progress", "cleared", "flagged"] as const;
export const DOC_VERIFY_STATUSES = ["pending", "verified", "rejected"] as const;
export const ID_DOC_TYPES = ["pan", "aadhaar", "passport"] as const;

export type AppRole = "admin" | "user";

export type DirectoryRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole;
  is_admin: boolean;
  department: DeptType | null;
  designation: string | null;
  team_name: string | null;
  doj: string | null;
  employment_type: string | null;
  work_model: string | null;
  work_location: string | null;
  base_salary: number | null;
  salary_currency: string;
  probation_status: string;
  background_check_status: string;
  doc_verification_status: string;
  reporting_manager_id: string | null;
  reporting_hr_id: string | null;
  job_id: string | null;
  job_title: string | null;
  docs_approved_count: number;
  docs_total_count: number;
  created_at: string;
};

async function getActorRoles(_db: any, userId: string) {
  // Use adminDb to bypass RLS for role checks — the user's own role
  // must be readable regardless of RLS policies on user_roles table.
  const adminDb = getAdminDb();
  const roles = await adminDb.userRole.findMany({
    where: { userId },
    select: { role: true },
  });
  const set = new Set(roles.map((r: any) => r.role));
  const isAdmin = set.has("admin");
  return { isAdmin, isHr: isAdmin };
}

export const listDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DirectoryRow[]> => {
    // First check actor is admin
    const actor = await getActorRoles(null, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();
    // Build directory from clerk_user_map + profiles + employees + user_roles
    const users = await adminDb.clerkUserMap.findMany({
      select: { authUserId: true, email: true },
    });

    const userIds = users.map((u) => u.authUserId);
    const [profiles, employees, roles, onboardingRecords] = await Promise.all([
      adminDb.profile.findMany({ where: { userId: { in: userIds } } }),
      adminDb.employee.findMany({ where: { userId: { in: userIds } } }),
      adminDb.userRole.findMany({ where: { userId: { in: userIds } } }),
      adminDb.onboardingRecord.findMany({
        where: { userId: { in: userIds } },
      }),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const empMap = new Map(employees.map((e) => [e.userId, e]));
    const roleMap = new Map(roles.map((r) => [r.userId, r]));
    const onboardingMap = new Map(onboardingRecords.map((o) => [o.userId, o]));

    // Fetch document counts for all onboarding records
    const onboardingIds = onboardingRecords.map((o) => o.id);
    const documents = onboardingIds.length > 0
      ? await adminDb.onboardingDocument.findMany({
          where: {
            onboardingId: { in: onboardingIds },
            supersededAt: null, // Only current versions (not superseded)
          },
          select: {
            onboardingId: true,
            status: true,
          },
        })
      : [];

    // Group documents by onboarding ID
    const docsByOnboarding = documents.reduce((acc, doc) => {
      if (!acc[doc.onboardingId]) {
        acc[doc.onboardingId] = { total: 0, approved: 0 };
      }
      acc[doc.onboardingId].total++;
      if (doc.status === "approved") {
        acc[doc.onboardingId].approved++;
      }
      return acc;
    }, {} as Record<string, { total: number; approved: number }>);

    const rows: DirectoryRow[] = users.map((u) => {
      const profile = profileMap.get(u.authUserId);
      const emp = empMap.get(u.authUserId);
      const role = roleMap.get(u.authUserId);
      const onboarding = onboardingMap.get(u.authUserId);

      // Get doc counts from onboarding
      const docCounts = onboarding ? docsByOnboarding[onboarding.id] : null;

      // Use onboarding data first, fall back to employee table
      const department = onboarding?.department ?? emp?.department ?? null;
      const designation = onboarding?.roleTitle ?? emp?.designation ?? null;
      const rawDoj = onboarding?.doj ?? emp?.doj ?? null;
      const doj = rawDoj instanceof Date ? rawDoj.toISOString().split("T")[0] : rawDoj;

      // Doc verification status from onboarding
      let docVerificationStatus = emp?.docVerificationStatus ?? "pending";
      if (onboarding?.verificationStatus === "approved") {
        docVerificationStatus = "verified";
      } else if (onboarding?.verificationStatus === "rejected") {
        docVerificationStatus = "rejected";
      } else if (onboarding?.verificationStatus === "pending" || onboarding?.verificationStatus === "changes_requested") {
        docVerificationStatus = "pending";
      }

      return {
        user_id: u.authUserId,
        email: u.email,
        full_name: profile?.fullName ?? null,
        role: (role?.role as any) ?? "user",
        is_admin: role?.role === "admin",
        department: (department as any) ?? null,
        designation: designation ?? null,
        team_name: emp?.teamName ?? null,
        employment_type: emp?.employmentType ?? null,
        work_model: emp?.workModel ?? null,
        work_location: emp?.workLocation ?? null,
        base_salary: emp?.baseSalary != null ? Number(emp.baseSalary) : null,
        salary_currency: emp?.salaryCurrency ?? "INR",
        doj: doj ?? null,
        probation_status: emp?.probationStatus ?? "under_review",
        background_check_status: emp?.backgroundCheckStatus ?? "not_started",
        doc_verification_status: docVerificationStatus,
        reporting_manager_id: emp?.reportingManagerId ?? null,
        reporting_hr_id: emp?.reportingHrId ?? null,
        job_id: null,
        job_title: null,
        docs_approved_count: docCounts?.approved ?? 0,
        docs_total_count: docCounts?.total ?? 0,
        created_at: new Date().toISOString(),
      };
    });

    return rows;
  });

export const updateBgCheckStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      status: z.enum(["not_started", "in_progress", "cleared", "flagged"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const actor = await getActorRoles(null, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();

    await adminDb.employee.upsert({
      where: { userId: data.user_id },
      create: {
        userId: data.user_id,
        backgroundCheckStatus: data.status,
      },
      update: {
        backgroundCheckStatus: data.status,
      },
    });

    return { success: true };
  });

export const getUserDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = await getActorRoles(context.db, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();

    const targetAdminRole = await adminDb.userRole.findFirst({
      where: { userId: data.user_id, role: "admin" },
    });
    if (actor.isHr && !actor.isAdmin && targetAdminRole) {
      throw new Error("HR users cannot modify System Admin accounts");
    }

    const [emp, profile, roles, docs] = await Promise.all([
      adminDb.employee.findUnique({ where: { userId: data.user_id } }),
      adminDb.profile.findUnique({
        where: { userId: data.user_id },
        select: { userId: true, fullName: true, publicEmail: true },
      }),
      adminDb.userRole.findMany({
        where: { userId: data.user_id },
        select: { role: true },
      }),
      adminDb.identityDocument.findMany({
        where: { userId: data.user_id },
        orderBy: { docType: "asc" },
      }),
    ]);

    // Storage: signed URLs for identity docs (R2) — non-fatal if storage fails
    let signedDocs: Array<typeof docs[number] & { signed_url: string | null }> = [];
    try {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      signedDocs = await Promise.all(
        docs.map(async (d) => {
          let signed_url: string | null = null;
          if (d.storagePath) {
            try {
              const result = await storage.createSignedUrl("identity-docs", d.storagePath, 60 * 60);
              signed_url = result.signedUrl;
            } catch {}
          }
          return { ...d, signed_url };
        }),
      );
    } catch {
      signedDocs = docs.map((d) => ({ ...d, signed_url: null }));
    }

    return {
      employee: emp,
      profile: profile
        ? { user_id: profile.userId, full_name: profile.fullName, public_email: profile.publicEmail }
        : null,
      roles: roles.map((r) => r.role as AppRole),
      is_admin_target: !!targetAdminRole,
      documents: signedDocs,
    };
  });

const employeeSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().max(120).optional().nullable(),
  work_email: z.string().trim().email().max(200).or(z.literal("")).optional().nullable(),
  personal_email: z.string().trim().email().max(200).or(z.literal("")).optional().nullable(),
  contact_number: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  department: z.enum(DEPT_TYPES).optional().nullable(),
  team_name: z.string().trim().max(120).optional().nullable(),
  designation: z.string().trim().max(160).optional().nullable(),
  reporting_manager_id: z.string().uuid().optional().nullable(),
  reporting_hr_id: z.string().uuid().optional().nullable(),
  doj: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  employment_type: z.enum(EMPLOYMENT_TYPES).optional().nullable(),
  base_salary: z.number().nonnegative().max(999999999).optional().nullable(),
  salary_currency: z.string().trim().min(1).max(6).default("INR").optional(),
  work_model: z.enum(WORK_MODELS).optional().nullable(),
  work_location: z.string().trim().max(160).optional().nullable(),
  probation_months: z.number().int().min(0).max(24).optional().nullable(),
  probation_status: z.enum(PROBATION_STATUSES).optional(),
  background_check_status: z.enum(BG_CHECK_STATUSES).optional(),
  doc_verification_status: z.enum(DOC_VERIFY_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => employeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await getActorRoles(context.db, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();
    const targetAdminRole = await adminDb.userRole.findFirst({
      where: { userId: data.user_id, role: "admin" },
    });
    if (actor.isHr && !actor.isAdmin && targetAdminRole) {
      throw new Error("HR users cannot modify System Admin accounts");
    }

    if (data.full_name !== undefined) {
      await adminDb.profile.upsert({
        where: { userId: data.user_id },
        create: { userId: data.user_id, fullName: data.full_name || null },
        update: { fullName: data.full_name || null },
      });
    }

    const empData: Record<string, any> = {};
    const fieldMap: Record<string, string> = {
      work_email: "workEmail",
      personal_email: "personalEmail",
      contact_number: "contactNumber",
      address: "address",
      department: "department",
      team_name: "teamName",
      designation: "designation",
      reporting_manager_id: "reportingManagerId",
      reporting_hr_id: "reportingHrId",
      doj: "doj",
      employment_type: "employmentType",
      base_salary: "baseSalary",
      salary_currency: "salaryCurrency",
      work_model: "workModel",
      work_location: "workLocation",
      probation_months: "probationMonths",
      probation_status: "probationStatus",
      background_check_status: "backgroundCheckStatus",
      doc_verification_status: "docVerificationStatus",
      notes: "notes",
    };
    for (const [snake, camel] of Object.entries(fieldMap)) {
      const v = (data as any)[snake];
      if (v !== undefined) empData[camel] = v === "" ? null : v;
    }

    await adminDb.employee.upsert({
      where: { userId: data.user_id },
      create: { userId: data.user_id, ...empData },
      update: empData,
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        action: "user.employee_upsert",
        targetResource: data.user_id,
        details: { fields: Object.keys(empData) },
      },
    });

    return { ok: true };
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "user"]),
  department_id: z.string().uuid().optional().nullable(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await getActorRoles(context.db, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();
    const targetAdminRole = await adminDb.userRole.findFirst({
      where: { userId: data.user_id, role: "admin" },
    });
    if (actor.isHr && !actor.isAdmin) {
      if (targetAdminRole) throw new Error("HR users cannot modify System Admin accounts");
      if (data.role === "admin") throw new Error("Only Admins can grant the Admin role");
    }

    await adminDb.userRole.deleteMany({
      where: { userId: data.user_id },
    });
    await adminDb.userRole.create({
      data: {
        userId: data.user_id,
        role: data.role as any,
        departmentId: data.department_id ?? null,
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        action: "role.set",
        targetResource: data.user_id,
        details: { role: data.role, department_id: data.department_id ?? null },
      },
    });
    return { ok: true };
  });

const idDocSchema = z.object({
  user_id: z.string().uuid(),
  doc_type: z.enum(ID_DOC_TYPES),
  doc_number: z.string().trim().max(60).optional().nullable(),
  storage_path: z.string().trim().max(300).optional().nullable(),
});

export const upsertIdentityDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => idDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.user_id !== context.userId) {
      const actor = await getActorRoles(context.db, context.userId);
      if (!actor.isAdmin) throw new Error("Only the owner or admin can upload identity documents");
    }
    const adminDb = getAdminDb();
    const existing = await adminDb.identityDocument.findFirst({
      where: { userId: data.user_id, docType: data.doc_type },
    });
    if (existing) {
      await adminDb.identityDocument.update({
        where: { id: existing.id },
        data: {
          docNumber: data.doc_number || null,
          storagePath: data.storage_path || null,
          status: "pending",
          feedback: null,
          verifiedBy: null,
          verifiedAt: null,
        },
      });
    } else {
      await adminDb.identityDocument.create({
        data: {
          userId: data.user_id,
          docType: data.doc_type,
          docNumber: data.doc_number || null,
          storagePath: data.storage_path || null,
          status: "pending",
        },
      });
    }
    return { ok: true };
  });

const verifyDocSchema = z.object({
  doc_id: z.string().uuid(),
  status: z.enum(["pending", "verified", "rejected"]),
  feedback: z.string().trim().max(500).optional().nullable(),
});

export const verifyIdentityDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => verifyDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const actor = await getActorRoles(context.db, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();
    const doc = await adminDb.identityDocument.findUnique({
      where: { id: data.doc_id },
      select: { id: true, userId: true },
    });
    if (!doc) throw new Error("Document not found");
    if (doc.userId === context.userId) throw new Error("Cannot verify your own documents");

    const targetAdminRole = await adminDb.userRole.findFirst({
      where: { userId: doc.userId, role: "admin" },
    });
    if (actor.isHr && !actor.isAdmin && targetAdminRole) {
      throw new Error("HR users cannot modify System Admin accounts");
    }

    await adminDb.identityDocument.update({
      where: { id: data.doc_id },
      data: {
        status: data.status,
        feedback: data.feedback || null,
        verifiedBy: context.userId,
        verifiedAt: new Date(),
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        action: `idoc.${data.status}`,
        targetResource: doc.userId,
        details: { doc_id: data.doc_id },
      },
    });
    return { ok: true };
  });

export const listAssignables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const actor = await getActorRoles(null, context.userId);
    if (!actor.isAdmin) throw new Error("Forbidden");

    const adminDb = getAdminDb();
    const users = await adminDb.clerkUserMap.findMany({
      select: { authUserId: true, email: true },
    });
    const userIds = users.map((u) => u.authUserId);
    const [profiles, roles] = await Promise.all([
      adminDb.profile.findMany({ where: { userId: { in: userIds } } }),
      adminDb.userRole.findMany({ where: { userId: { in: userIds } } }),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const roleMap = new Map(roles.map((r) => [r.userId, r]));

    const admins = users
      .filter((u) => roleMap.get(u.authUserId)?.role === "admin")
      .map((u) => ({
        user_id: u.authUserId,
        email: u.email,
        full_name: profileMap.get(u.authUserId)?.fullName ?? null,
        role: "admin" as AppRole,
        is_admin: true,
      }));

    return { managers: admins, hrs: admins };
  });
