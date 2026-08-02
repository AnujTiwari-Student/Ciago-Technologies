import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

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

async function assertAdmin(_db: any, userId: string) {
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({ where: { userId, role: "admin" } });
  if (count === 0) throw new Error("Forbidden");
}

async function assertHrOrAdmin(_db: any, userId: string) {
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({ where: { userId, role: "admin" } });
  if (count === 0) throw new Error("Forbidden");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminDb = getAdminDb();
    const count = await adminDb.userRole.count({
      where: { userId: context.userId, role: "admin" },
    });
    return { isAdmin: count > 0 };
  });

export const listAllApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const apps = await adminDb.jobApplication.findMany({
      where: { isSoftDeleted: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        roleId: true,
        roleTitle: true,
        fullName: true,
        email: true,
        status: true,
        portfolioUrl: true,
        resumeLink: true,
        resumeStoragePath: true,
        createdAt: true,
      },
    });

    const rows: AdminApplication[] = apps.map((a) => ({
      id: a.id,
      user_id: a.userId,
      role_id: a.roleId,
      role_title: a.roleTitle,
      full_name: a.fullName,
      email: a.email,
      status: a.status,
      portfolio_url: a.portfolioUrl,
      resume_link: a.resumeLink,
      resume_storage_path: a.resumeStoragePath,
      created_at: a.createdAt.toISOString(),
      track_type: null,
    }));

    const roleIds = Array.from(new Set(rows.map((r) => r.role_id).filter(Boolean)));
    if (roleIds.length > 0) {
      const postings = await adminDb.jobPosting.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, trackType: true },
      });
      const trackByRole = new Map(postings.map((p) => [p.id, p.trackType ?? null]));
      for (const r of rows) r.track_type = (trackByRole.get(r.role_id) as any) ?? null;
    }

    // Storage: signed URLs for resumes (stays on Supabase Storage until R2 migration)
    const withPaths = rows.filter((r) => r.resume_storage_path);
    if (withPaths.length > 0) {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      await Promise.all(
        withPaths.map(async (r) => {
          const result = await storage.createSignedUrl("resumes", r.resume_storage_path!, 60 * 60 * 24 * 7);
          if (result.signedUrl) r.resume_link = result.signedUrl;
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
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const prior = await adminDb.jobApplication.findUnique({
      where: { id: data.id },
      select: { id: true, userId: true, email: true, fullName: true, roleTitle: true, status: true, roleId: true },
    });

    if (data.status === "hired" && prior) {
      const onboarding = await adminDb.onboardingRecord.findUnique({
        where: { applicationId: prior.id },
        select: { id: true },
      });

      if (onboarding) {
        const posting = await adminDb.jobPosting.findUnique({
          where: { id: prior.roleId },
          select: { requiredOnboardingDocs: true, employmentType: true },
        });

        const { mandatoryDocKeys } = await import("@/lib/onboarding-docs");
        const requiredDocKeys = mandatoryDocKeys(
          posting?.employmentType ?? null,
          posting?.requiredOnboardingDocs ?? [],
          "ug",
        );

        const documents = await adminDb.onboardingDocument.findMany({
          where: { onboardingId: onboarding.id, supersededAt: null },
          select: { docKey: true, status: true },
        });

        const docStatusMap = new Map(documents.map((d) => [d.docKey, d.status]));
        const unverifiedDocs = requiredDocKeys.filter((key) => {
          const status = docStatusMap.get(key);
          return !status || status !== "approved";
        });

        if (unverifiedDocs.length > 0) {
          await adminDb.auditLog.create({
            data: {
              actorId: context.userId,
              actorEmail: (context.claims as any)?.email ?? null,
              action: "HIRE_ATTEMPT_BLOCKED",
              targetResource: `job_applications/${data.id}`,
              details: {
                reason: "document_verification_incomplete",
                unverified_docs: unverifiedDocs,
                candidate_email: prior.email,
                role_title: prior.roleTitle,
              },
            },
          });

          const { docLabel } = await import("@/lib/onboarding.functions");
          const docNames = unverifiedDocs.map((key) => docLabel(key)).join(", ");
          throw new Error(
            `Cannot mark as hired — ${unverifiedDocs.length} document(s) still pending verification: ${docNames}`,
          );
        }
      }
    }

    // Update application status
    await adminDb.jobApplication.update({
      where: { id: data.id },
      data: { status: data.status },
    });

    // Send notifications and audit log IMMEDIATELY after status update
    // This ensures user gets notified even if employee provisioning fails
    if (prior && prior.status !== data.status) {
      await adminDb.auditLog.create({
        data: {
          actorId: context.userId,
          actorEmail: (context.claims as any)?.email ?? null,
          action: "APPLICATION_STATUS_UPDATED",
          targetResource: `job_applications/${data.id}`,
          details: {
            from: prior.status,
            to: data.status,
            candidate_email: prior.email,
            role_title: prior.roleTitle,
          },
        },
      });

      const { getStatusEmailContent, sendResendEmail } = await import("@/lib/notifications.server");
      const content = getStatusEmailContent(data.status, prior.roleTitle, prior.fullName);

      // Create in-app notification
      if (prior.userId) {
        await adminDb.inAppNotification.create({
          data: {
            userId: prior.userId,
            applicationId: prior.id,
            title: content.inAppTitle,
            body: content.inAppBody,
            link: data.status === "hired" ? "/onboarding" : "/my-applications",
          },
        });
      }

      // Send email notification (non-blocking)
      sendResendEmail({
        to: prior.email,
        subject: content.subject,
        html: content.html,
        userId: prior.userId,
        applicationId: prior.id,
      }).catch((e) => {
        console.error("[status-email] send failed", e);
      });
    }

    // Phase 2: If applied, create durable integration event (non-blocking processing)
    if (data.status === "applied" && prior && prior.status !== "applied") {
      // CRITICAL: Create integration event synchronously to ensure provisioning intent is recorded
      // Processing happens asynchronously, but event creation must succeed
      try {
        const { createIntegrationEvent, generateIdempotencyKey } = await import("@/lib/integration-events");
        const { handleApplicationApplied } = await import("@/lib/orangehrm-applied-handler");
        const { getOrangeHRMClient } = await import("@/integrations/orangehrm/client");

        // Create event SYNCHRONOUSLY - this is the durable record of provisioning intent
        const idempotencyKey = generateIdempotencyKey(
          "orangehrm_employee_provision",
          "job_application",
          data.id
        );

        const eventResult = await createIntegrationEvent(adminDb, {
          eventType: "orangehrm_employee_provision",
          entityType: "job_application",
          entityId: data.id,
          idempotencyKey,
          correlationId: `status-update-${data.id}`,
          source: "application_status_update",
          maxAttempts: 3,
        });

        console.log("[applied-orangehrm] Integration event created", {
          applicationId: data.id,
          eventId: eventResult.id,
          alreadyExists: eventResult.alreadyExists,
        });

        // Process asynchronously ONLY if event was newly created or is pending
        if (!eventResult.alreadyCompleted) {
          const client = getOrangeHRMClient();

          // Non-blocking processing - event is already durably recorded
          handleApplicationApplied({
            db: adminDb,
            client,
            applicationId: data.id,
            correlationId: `status-update-${data.id}`,
          }).catch((e) => {
            console.error("[applied-orangehrm] Async provisioning processing failed", {
              applicationId: data.id,
              eventId: eventResult.id,
              error: e.message,
            });
            // Event exists and can be retried by background worker or manual intervention
          });
        }
      } catch (eventError) {
        // Event creation itself failed - this is a critical error
        console.error("[applied-orangehrm] CRITICAL: Failed to create integration event", {
          applicationId: data.id,
          error: eventError instanceof Error ? eventError.message : String(eventError),
        });
        // Status update still succeeds, but provisioning intent not recorded
        // Admin must manually create event or trigger provisioning
      }
    }

    // If hired, provision employee record and OrangeHRM
    if (data.status === "hired" && prior && prior.status !== "hired") {
      await adminDb.profile.upsert({
        where: { userId: prior.userId },
        create: { userId: prior.userId, fullName: prior.fullName },
        update: { fullName: prior.fullName },
      });

      const posting = await adminDb.jobPosting.findUnique({
        where: { id: prior.roleId },
        select: { department: true, employmentType: true },
      });

      const { DEPT_TYPES } = await import("@/lib/users.functions");
      const validDept = posting?.department && DEPT_TYPES.includes(posting.department as any)
        ? (posting.department as any)
        : null;

      // Phase 3: OrangeHRM employee upsert/enrichment at HIRED
      // Employee was created at APPLIED state (Phase 2)
      // HIRED reconciles/updates the existing employee with full onboarding data
      // NEVER creates duplicate employee - uses centralized provisioning for fallback
      let orangehrmEmployeeId: number | null = null;

      try {
        const { getOrangeHRMClient } = await import("@/integrations/orangehrm/client");
        const { handleApplicationHired } = await import("@/lib/orangehrm-hired-handler");

        const client = getOrangeHRMClient();

        console.log("[hire-flow] Triggering Phase 3 OrangeHRM upsert/enrichment");

        // Non-blocking call: HIRED flow must not fail due to OrangeHRM issues
        handleApplicationHired({
          db: adminDb,
          client,
          applicationId: prior.id,
          candidateId: prior.userId,
          correlationId: `status-update-hired-${prior.id}`,
        }).catch((e) => {
          console.error("[hire-flow] OrangeHRM upsert/enrichment trigger failed", {
            applicationId: prior.id,
            error: e.message,
          });
        });

        // Load orangehrmEmployeeId for local Employee record creation
        // This is best-effort - even if handler hasn't completed yet,
        // we create the Employee row with whatever mapping exists
        const application = await adminDb.jobApplication.findUnique({
          where: { id: prior.id },
          select: {
            orangehrmEmployeeId: true,
            orangehrmProvisioningState: true,
          },
        });

        orangehrmEmployeeId = application?.orangehrmEmployeeId || null;

        if (orangehrmEmployeeId) {
          console.log("[hire-flow] OrangeHRM employee ID available", {
            empNumber: orangehrmEmployeeId,
            provisioningState: application?.orangehrmProvisioningState,
          });
        } else {
          console.warn(
            "[hire-flow] OrangeHRM employee ID not yet available (provisioning may be in progress)"
          );
        }
      } catch (lookupError) {
        console.error("[hire-flow] Failed to trigger OrangeHRM upsert/enrichment", lookupError);
      }

      // Create employee record in our system
      try {
        await adminDb.employee.upsert({
          where: { userId: prior.userId },
          create: {
            userId: prior.userId,
            orangehrmEmployeeId,
            designation: prior.roleTitle,
            employmentType: posting?.employmentType ?? "full_time",
            department: validDept,
            personalEmail: prior.email,
            backgroundCheckStatus: "not_started",
            docVerificationStatus: "pending",
          },
          update: {
            orangehrmEmployeeId,
            designation: prior.roleTitle,
            employmentType: posting?.employmentType ?? "full_time",
            department: validDept,
          },
        });
      } catch (empError: any) {
        console.error("[hire-flow] Employee record creation failed:", empError);
        await adminDb.auditLog.create({
          data: {
            actorId: context.userId,
            actorEmail: (context.claims as any)?.email ?? null,
            action: "EMPLOYEE_CREATION_FAILED",
            targetResource: `employees/${prior.userId}`,
            details: {
              error: empError.message,
              candidate_name: prior.fullName,
              candidate_email: prior.email,
            },
          },
        });
        // Don't throw - we've already notified the user and updated status
        // HR can manually fix the employee record later
      }
    }


    return { ok: true };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteRejectedApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deleteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const row = await adminDb.jobApplication.findUnique({
      where: { id: data.id },
      select: { id: true, status: true, resumeStoragePath: true, isSoftDeleted: true },
    });
    if (!row) throw new Error("Application not found");
    if (row.status !== "rejected") throw new Error("Only rejected applications can be deleted");

    if (row.resumeStoragePath) {
      const { getStorage } = await import("@/lib/storage");
      const storage = getStorage();
      await storage.remove("resumes", [row.resumeStoragePath]);
    }

    await adminDb.jobApplication.update({
      where: { id: data.id },
      data: {
        isSoftDeleted: true,
        deletedAt: new Date(),
        status: "rejected",
        resumeStoragePath: null,
        resumeLink: null,
      },
    });
    return { ok: true };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const mappings = await adminDb.clerkUserMap.findMany({
      select: { authUserId: true, email: true, createdAt: true },
    });

    const roles = await adminDb.userRole.findMany({
      select: { userId: true, role: true },
    });
    const adminSet = new Set(
      roles.filter((r) => r.role === "admin").map((r) => r.userId),
    );

    const profiles = await adminDb.profile.findMany({
      select: { userId: true, fullName: true },
    });
    const nameMap = new Map(profiles.map((p) => [p.userId, p.fullName]));

    return mappings.map(
      (u): AdminUser => ({
        id: u.authUserId,
        email: u.email ?? null,
        created_at: u.createdAt.toISOString(),
        last_sign_in_at: null,
        is_admin: adminSet.has(u.authUserId),
        full_name: nameMap.get(u.authUserId) ?? null,
      }),
    );
  });

const roleSchema = z.object({
  userId: z.string().uuid(),
  makeAdmin: z.boolean(),
});

export const setUserAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => roleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);
    if (data.userId === context.userId && !data.makeAdmin) {
      throw new Error("You cannot revoke your own admin role.");
    }
    const adminDb = getAdminDb();

    if (data.makeAdmin) {
      const existing = await adminDb.userRole.findFirst({
        where: { userId: data.userId, role: "admin" },
      });
      if (!existing) {
        await adminDb.userRole.create({
          data: { userId: data.userId, role: "admin" },
        });
      }
    } else {
      await adminDb.userRole.deleteMany({
        where: { userId: data.userId, role: "admin" },
      });
    }

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: data.makeAdmin ? "ROLE_GRANTED" : "ROLE_REVOKED",
        targetResource: `user_roles/${data.userId}`,
        details: { role: "admin", target_user_id: data.userId },
      },
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
    await assertHrOrAdmin(context.db, context.userId);
    const adminDb = getAdminDb();

    const apps = await adminDb.jobApplication.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        roleId: true,
        roleTitle: true,
        fullName: true,
        email: true,
        status: true,
        createdAt: true,
        isSoftDeleted: true,
      },
    });

    const roleIds = Array.from(new Set(apps.map((r) => r.roleId))).filter(Boolean);
    const codeByRole = new Map<string, { code: string | null; status: string; title: string }>();
    if (roleIds.length > 0) {
      const postings = await adminDb.jobPosting.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, jobCode: true, status: true, title: true },
      });
      for (const p of postings) {
        codeByRole.set(p.id, { code: p.jobCode ?? null, status: p.status, title: p.title });
      }
    }

    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
    const groups = new Map<string, RoleApplicantsGroup>();
    for (const r of apps) {
      const createdMs = r.createdAt.getTime();
      const nextEligible = new Date(createdMs + NINETY_DAYS);
      const cooldownDaysLeft = Math.max(
        0,
        Math.ceil((nextEligible.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      );
      const meta = codeByRole.get(r.roleId);
      let g = groups.get(r.roleId);
      if (!g) {
        g = {
          role_id: r.roleId,
          role_title: meta?.title || r.roleTitle,
          job_code: meta?.code ?? null,
          status: meta?.status ?? "unknown",
          total: 0,
          active: 0,
          rejected: 0,
          applicants: [],
        };
        groups.set(r.roleId, g);
      }
      g.total += 1;
      if (["applied", "screening", "interviewing", "offered"].includes(r.status)) g.active += 1;
      if (r.status === "rejected" || r.isSoftDeleted) g.rejected += 1;
      g.applicants.push({
        application_id: r.id,
        user_id: r.userId,
        full_name: r.fullName,
        email: r.email,
        status: r.isSoftDeleted ? "rejected" : r.status,
        created_at: r.createdAt.toISOString(),
        is_soft_deleted: r.isSoftDeleted,
        next_eligible_at: nextEligible.toISOString(),
        cooldown_days_left: cooldownDaysLeft,
      });
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  });
