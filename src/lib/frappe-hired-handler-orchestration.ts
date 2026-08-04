/**
 * Phase 3: Frappe HR Employee Enrichment at HIRED State - Orchestration
 *
 * Handles the transition: Application status → "hired" → Frappe employee enrichment
 *
 * FLOW:
 * 1. Check feature flag (frappe_employee_sync_enabled)
 * 2. Extract onboarding data from application/onboarding/employee/posting
 * 3. Create integration event (idempotent)
 * 4. Atomically claim event (race protection)
 * 5. Call upsertFrappeEmployeeAtHired() (existing service)
 * 6. Update integration event status (succeeded/failed)
 *
 * IDEMPOTENCY:
 * - Same application HIRED 2x/10x/100x → exactly ONE enrichment
 * - Integration event with idempotency_key prevents duplicate processing
 * - Completed events safely ignored on duplicate delivery
 * - upsertFrappeEmployeeAtHired() is internally idempotent
 *
 * CONCURRENCY:
 * - Atomic event claiming prevents two workers from both processing
 * - lifecycle_version in upsertFrappeEmployeeAtHired() prevents race conditions
 * - Status validation prevents HIRED vs REJECTED races
 * - Only one worker successfully enriches employee
 *
 * CRASH RECOVERY:
 * - If enrichment succeeds but DB persist fails, retry reconciles
 * - Reconciliation finds existing enriched employee and persists state
 * - Never creates duplicate employee
 * - Stale processing state → manual review (safe fallback)
 */

import { PrismaClient } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";
import {
  createIntegrationEvent,
  claimEvent,
  updateEventStatus,
  markEventSucceeded,
  markEventFailed,
  generateIdempotencyKey,
} from "@/lib/integration-events";
import {
  upsertFrappeEmployeeAtHired,
  extractFrappeOnboardingData,
  type FrappeHiredResult,
  type FrappeOnboardingDataSources,
} from "@/lib/frappe-hired-handler";
import type {
  EducationalQualificationInput,
  PreviousWorkExperienceInput,
} from "@/lib/job-application-fields";
import { classifyFrappeError, isFrappeRetryable } from "@/lib/frappe-provisioning";

export interface HandleFrappeApplicationHiredOptions {
  db: PrismaClient;
  client: FrappeClient;
  applicationId: string;
  candidateId: string;
  correlationId?: string;
  workerId?: string;
}

export interface FrappeApplicationHiredResult {
  triggered: boolean;
  reason?: string;
  eventId?: string;
  upsertResult?: FrappeHiredResult;
}

/**
 * Check if Frappe employee sync is enabled
 *
 * Uses feature-flags.server.ts for consistent flag evaluation
 * Independent of OrangeHRM flag - allows parallel operation during migration
 */
async function isFrappeEmployeeSyncEnabled(): Promise<boolean> {
  const { isFrappeEmployeeSyncEnabled: checkFlag } = await import("@/lib/feature-flags.server");
  return checkFlag();
}

/**
 * Handle application status change to "hired"
 *
 * This is the entry point triggered by the application status update flow.
 * It orchestrates: feature flag check → onboarding data extraction → event creation → event claiming → upsert/enrichment
 *
 * SAFE TO CALL MULTIPLE TIMES:
 * - Feature flag OFF → no-op
 * - Event already completed → no-op
 * - Event already claimed → no-op
 * - Already upserted/enriched → no-op (handled by upsertFrappeEmployeeAtHired)
 */
export async function handleFrappeApplicationHired(
  options: HandleFrappeApplicationHiredOptions,
): Promise<FrappeApplicationHiredResult> {
  const { db, client, applicationId, candidateId, correlationId, workerId } = options;
  const logPrefix = `[frappe-hired-handler:${applicationId.slice(0, 8)}]`;

  console.log(`${logPrefix} Starting Frappe HR employee upsert/enrichment handler`, {
    correlationId,
  });

  try {
    // Step 1: Check feature flag
    const featureEnabled = await isFrappeEmployeeSyncEnabled();

    if (!featureEnabled) {
      console.log(`${logPrefix} Feature flag OFF, skipping Frappe upsert/enrichment`);
      return {
        triggered: false,
        reason: "feature_flag_disabled",
      };
    }

    console.log(`${logPrefix} Feature flag ON, proceeding with upsert/enrichment`);

    // Step 2: Extract onboarding data from database
    console.log(`${logPrefix} Extracting onboarding data`);

    const application = await db.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        roleTitle: true,
        status: true,
        roleId: true,
        coverLetter: true,
        offeredAt: true,
        hiredAt: true,
        frappeJobApplicantName: true,
        educationalQualifications: true,
        previousWorkExperiences: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // Verify status is HIRED (early check before expensive queries)
    if (application.status !== "hired") {
      console.warn(
        `${logPrefix} Application status is ${application.status}, not hired - aborting handler`,
      );
      return {
        triggered: false,
        reason: "status_not_hired",
      };
    }

    const onboardingRecord = await db.onboardingRecord.findUnique({
      where: { applicationId },
      select: {
        id: true,
        roleTitle: true,
        department: true,
        doj: true,
        startDate: true,
        compensationInr: true,
        formState: true,
        emergencyContact: true,
      },
    });

    const employee = await db.employee.findUnique({
      where: { userId: candidateId },
      select: {
        department: true,
        designation: true,
        employmentType: true,
        workLocation: true,
        workModel: true,
        personalEmail: true,
        workEmail: true,
        contactNumber: true,
        address: true,
        baseSalary: true,
        salaryCurrency: true,
        reportingManagerId: true,
        reportingHrId: true,
        teamName: true,
        notes: true,
        doj: true,
        frappeEmployeeName: true,
      },
    });

    const reportingManager = employee?.reportingManagerId
      ? await db.employee.findUnique({
          where: { userId: employee.reportingManagerId },
          select: { frappeEmployeeName: true },
        })
      : null;

    const jobPosting = await db.jobPosting.findUnique({
      where: { id: application.roleId },
      select: {
        id: true,
        employmentType: true,
        department: true,
        location: true,
        isRemote: true,
      },
    });

    const sources: FrappeOnboardingDataSources = {
      application: {
        id: application.id,
        userId: application.userId,
        fullName: application.fullName,
        email: application.email,
        roleTitle: application.roleTitle,
        status: application.status,
        coverLetter: application.coverLetter,
        offeredAt: application.offeredAt,
        hiredAt: application.hiredAt,
        frappeJobApplicantName: application.frappeJobApplicantName,
        educationalQualifications: Array.isArray(application.educationalQualifications)
          ? (application.educationalQualifications as EducationalQualificationInput[])
          : [],
        previousWorkExperiences: Array.isArray(application.previousWorkExperiences)
          ? (application.previousWorkExperiences as PreviousWorkExperienceInput[])
          : [],
      },
      onboardingRecord: onboardingRecord
        ? {
            id: onboardingRecord.id,
            roleTitle: onboardingRecord.roleTitle,
            department: onboardingRecord.department,
            doj: onboardingRecord.doj,
            startDate: onboardingRecord.startDate,
            compensationInr: onboardingRecord.compensationInr,
            formState: onboardingRecord.formState as Record<string, unknown>,
            emergencyContact: onboardingRecord.emergencyContact as Record<string, unknown> | null,
          }
        : null,
      employee: employee
        ? {
            department: employee.department,
            designation: employee.designation,
            employmentType: employee.employmentType,
            workLocation: employee.workLocation,
            workModel: employee.workModel,
            personalEmail: employee.personalEmail,
            workEmail: employee.workEmail,
            contactNumber: employee.contactNumber,
            address: employee.address,
            baseSalary: employee.baseSalary,
            salaryCurrency: employee.salaryCurrency,
            reportingManagerId: employee.reportingManagerId,
            reportingManagerEmployeeName: reportingManager?.frappeEmployeeName || null,
            reportingHrId: employee.reportingHrId,
            teamName: employee.teamName,
            notes: employee.notes,
            doj: employee.doj,
          }
        : null,
      jobPosting: jobPosting
        ? {
            id: jobPosting.id,
            employmentType: jobPosting.employmentType,
            department: jobPosting.department,
            location: jobPosting.location,
            isRemote: jobPosting.isRemote,
          }
        : null,
    };

    const onboardingData = extractFrappeOnboardingData(sources);

    console.log(`${logPrefix} Onboarding data extracted`, {
      joiningDate: onboardingData.joiningDate,
      department: onboardingData.department,
      employmentType: onboardingData.employmentType,
    });

    // Step 3: Create integration event (idempotent)
    const idempotencyKey = generateIdempotencyKey(
      "frappe_employee_upsert",
      "job_application",
      applicationId,
    );

    const eventResult = await createIntegrationEvent(db, {
      eventType: "frappe_employee_upsert_at_hired",
      entityType: "job_application",
      entityId: applicationId,
      idempotencyKey,
      correlationId,
      source: "application_status_hired",
      maxAttempts: 3,
    });

    const eventId = eventResult.id;

    // Step 3a: If event already completed, return immediately
    if (eventResult.alreadyCompleted) {
      console.log(`${logPrefix} Event already completed, skipping`, { eventId });
      return {
        triggered: false,
        reason: "already_completed",
        eventId,
      };
    }

    // Step 4: Atomically claim event (race protection)
    const claimResult = await claimEvent(db, eventId, workerId);

    if (!claimResult.claimed) {
      console.log(`${logPrefix} Event claim failed: ${claimResult.reason}`, { eventId });
      return {
        triggered: false,
        reason: claimResult.reason || "claim_failed",
        eventId,
      };
    }

    console.log(`${logPrefix} Event claimed successfully`, { eventId });

    // Step 5: Mark event as processing
    await updateEventStatus(db, eventId, { status: "processing" });

    // Step 6: Call upsert service
    console.log(`${logPrefix} Calling upsertFrappeEmployeeAtHired`, { eventId });

    const upsertResult = await upsertFrappeEmployeeAtHired(
      applicationId,
      candidateId,
      onboardingData,
      db,
      client,
      correlationId || eventId,
    );

    console.log(`${logPrefix} Upsert completed`, {
      success: upsertResult.success,
      action: upsertResult.action,
      employeeName: upsertResult.employeeName,
    });

    // Step 7: Update event status based on result
    if (upsertResult.success) {
      await markEventSucceeded(db, eventId, {
        employeeName: upsertResult.employeeName,
        action: upsertResult.action,
        message: upsertResult.message,
      });

      console.log(`${logPrefix} Event marked as succeeded`, { eventId });

      return {
        triggered: true,
        eventId,
        upsertResult,
      };
    } else {
      // Upsert failed
      const errorClassified = upsertResult.error
        ? classifyFrappeError(new Error(upsertResult.error))
        : null;

      const retryable = errorClassified ? isFrappeRetryable(errorClassified) : false;

      await markEventFailed(db, eventId, {
        message: upsertResult.error || "Unknown upsert failure",
        code: errorClassified?.type,
        retryable,
      });

      console.error(`${logPrefix} Event marked as failed`, {
        eventId,
        retryable,
        error: upsertResult.error,
      });

      return {
        triggered: true,
        eventId,
        upsertResult,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Handler failed unexpectedly`, error);

    // Re-throw so caller knows it failed
    throw error;
  }
}
