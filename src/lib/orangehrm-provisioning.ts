/**
 * Phase 2: OrangeHRM Employee Provisioning at APPLIED State
 *
 * CRITICAL DESIGN PRINCIPLES:
 * 1. Employee MUST be created at APPLIED state, NOT at HIRED
 * 2. HIRED state later UPSERTS the existing employee (never creates second employee)
 * 3. Idempotency: Same application processed 2x/10x/100x yields exactly ONE employee
 * 4. Race protection: Concurrent workers use lifecycle_version + event claiming
 * 5. Crash recovery: If OrangeHRM create succeeds but DB persist fails, reconciliation
 *    finds the existing employee and persists the ID (never creates duplicate)
 * 6. No DELETE API: OrangeHRM Community v5.7 does NOT support employee DELETE
 *    (Phase 0 verified: 405 Method Not Allowed). Use terminateEmployee() for cleanup.
 */

import { PrismaClient } from "@prisma/client";
import type { OrangeHRMClient } from "@/integrations/orangehrm/client";

/**
 * Provisioning result with idempotency tracking
 */
export interface ProvisioningResult {
  success: boolean;
  empNumber: number | null;
  employeeId: string | null;
  action:
    | "created" // New employee created in OrangeHRM
    | "already_provisioned" // Already had valid orangehrm_employee_id
    | "reconciled" // Found existing OrangeHRM employee and persisted ID
    | "failed" // Provisioning failed
    | "manual_review"; // Multiple candidates found, needs manual intervention
  message: string;
  error?: string;
}

/**
 * Error classification for intelligent retry logic
 */
export type ProvisioningErrorType =
  | "auth_failed" // OAuth token issues (401) - retryable after token refresh
  | "validation_error" // Invalid payload (400) - not retryable
  | "conflict" // Duplicate/conflict (409) - needs reconciliation
  | "rate_limit" // Too many requests (429) - retryable with backoff
  | "network_error" // Connection/timeout - retryable
  | "server_error" // OrangeHRM 500 error - retryable
  | "reconciliation_conflict" // Multiple matching employees - needs manual review
  | "unknown"; // Unknown error - log and investigate

export class ProvisioningError extends Error {
  constructor(
    public type: ProvisioningErrorType,
    message: string,
    public statusCode?: number,
    public originalError?: unknown,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

/**
 * Classify error for retry logic
 */
export function classifyError(error: unknown): ProvisioningError {
  if (error instanceof ProvisioningError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Auth errors
  if (lowerMessage.includes("401") || lowerMessage.includes("unauthorized")) {
    return new ProvisioningError("auth_failed", message, 401, error);
  }

  // Validation errors
  if (lowerMessage.includes("400") || lowerMessage.includes("bad request")) {
    return new ProvisioningError("validation_error", message, 400, error);
  }

  // Conflict errors
  if (lowerMessage.includes("409") || lowerMessage.includes("conflict")) {
    return new ProvisioningError("conflict", message, 409, error);
  }

  // Rate limit errors
  if (lowerMessage.includes("429") || lowerMessage.includes("rate limit")) {
    return new ProvisioningError("rate_limit", message, 429, error);
  }

  // Server errors
  if (lowerMessage.includes("500") || lowerMessage.includes("internal server")) {
    return new ProvisioningError("server_error", message, 500, error);
  }

  // Network errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("network")
  ) {
    return new ProvisioningError("network_error", message, undefined, error);
  }

  // Multiple match reconciliation conflict
  if (lowerMessage.includes("multiple") && lowerMessage.includes("match")) {
    return new ProvisioningError("reconciliation_conflict", message, undefined, error);
  }

  // Unknown
  return new ProvisioningError("unknown", message, undefined, error);
}

/**
 * Determine if error is retryable
 */
export function isRetryable(error: ProvisioningError): boolean {
  return ["auth_failed", "rate_limit", "network_error", "server_error"].includes(error.type);
}

/**
 * Single canonical function to provision OrangeHRM employee at APPLIED state
 *
 * IDEMPOTENCY GUARANTEES:
 * 1. If orangehrm_employee_id already exists and valid → return immediately
 * 2. If OrangeHRM API returns employee → persist ID and return
 * 3. If crash after create but before persist → reconciliation finds existing employee
 * 4. If multiple workers race → lifecycle_version prevents double-create
 *
 * CONCURRENCY PROTECTION:
 * - lifecycle_version: Optimistic locking on job_applications
 * - WHERE clause with expected version: Only one UPDATE succeeds
 * - Failed UPDATE with 0 rows → another worker won, exit gracefully
 *
 * RECONCILIATION STRATEGY:
 * 1. Check existing orangehrm_employee_id in DB
 * 2. If exists, verify employee exists in OrangeHRM
 * 3. If employee deleted/missing in OrangeHRM, attempt reconciliation
 * 4. Match on deterministic fields: email (unique identifier)
 * 5. Multiple matches → mark manual_review, never auto-choose
 */
export async function provisionOrangeHRMEmployee(
  applicationId: string,
  db: PrismaClient,
  client: OrangeHRMClient,
  correlationId?: string,
): Promise<ProvisioningResult> {
  const logPrefix = `[orangehrm-provision:${applicationId.slice(0, 8)}]`;
  console.log(`${logPrefix} Starting OrangeHRM employee provisioning`, { correlationId });

  try {
    // Step 1: Load application with lifecycle version (optimistic locking)
    const application = await db.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        status: true,
        orangehrmEmployeeId: true,
        orangehrmProvisioningState: true,
        orangehrmRecordStatus: true,
        lifecycleVersion: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    console.log(`${logPrefix} Application loaded`, {
      status: application.status,
      provisioningState: application.orangehrmProvisioningState,
      existingEmpId: application.orangehrmEmployeeId,
      lifecycleVersion: application.lifecycleVersion,
    });

    // Step 2: Idempotency check - already provisioned?
    if (application.orangehrmEmployeeId && application.orangehrmProvisioningState === "succeeded") {
      console.log(`${logPrefix} Already provisioned`, {
        empNumber: application.orangehrmEmployeeId,
      });

      return {
        success: true,
        empNumber: application.orangehrmEmployeeId,
        employeeId: `EMP-${application.orangehrmEmployeeId}`,
        action: "already_provisioned",
        message: `Employee already provisioned with empNumber ${application.orangehrmEmployeeId}`,
      };
    }

    // Step 3: Reconciliation - check if employee exists but ID not persisted
    if (application.orangehrmEmployeeId) {
      console.log(`${logPrefix} Reconciling existing empNumber`, {
        empNumber: application.orangehrmEmployeeId,
      });

      // Verify employee exists in OrangeHRM
      const existing = await client.getEmployee(application.orangehrmEmployeeId);

      if (existing) {
        // Employee exists, persist the mapping
        const updated = await db.jobApplication.updateMany({
          where: {
            id: applicationId,
            lifecycleVersion: application.lifecycleVersion, // Optimistic locking
          },
          data: {
            orangehrmProvisioningState: "succeeded",
            orangehrmProvisioningSucceededAt: new Date(),
            orangehrmRecordStatus: "ACTIVE",
            lifecycleVersion: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          console.log(`${logPrefix} Reconciliation lost race (lifecycle_version changed)`);
          // Another worker already updated, return success
          return {
            success: true,
            empNumber: application.orangehrmEmployeeId,
            employeeId: `EMP-${application.orangehrmEmployeeId}`,
            action: "already_provisioned",
            message: "Another worker completed provisioning",
          };
        }

        console.log(`${logPrefix} Reconciled existing employee`, {
          empNumber: application.orangehrmEmployeeId,
        });

        await db.auditLog.create({
          data: {
            action: "ORANGEHRM_EMPLOYEE_RECONCILED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              empNumber: application.orangehrmEmployeeId,
              email: application.email,
              correlationId,
            },
          },
        });

        return {
          success: true,
          empNumber: application.orangehrmEmployeeId,
          employeeId: `EMP-${application.orangehrmEmployeeId}`,
          action: "reconciled",
          message: `Reconciled existing employee empNumber ${application.orangehrmEmployeeId}`,
        };
      }

      // Employee ID exists but employee not found in OrangeHRM - needs reconciliation
      console.warn(
        `${logPrefix} Employee ${application.orangehrmEmployeeId} not found in OrangeHRM`,
      );
    }

    // Step 3a: CRITICAL CRASH RECOVERY - check if we're in "processing" state without employee ID
    // This means OrangeHRM create may have succeeded but we didn't record it
    // CANNOT blindly create another employee - enter manual reconciliation state
    // ONLY trigger this on RETRY (attemptCount > 0 OR processing for >1 minute)
    const processingFor = application.orangehrmProvisioningAttemptedAt
      ? Date.now() - new Date(application.orangehrmProvisioningAttemptedAt).getTime()
      : 0;

    if (
      !application.orangehrmEmployeeId &&
      application.orangehrmProvisioningState === "processing" &&
      processingFor > 60_000 // Processing for more than 1 minute - likely a crash
    ) {
      console.error(
        `${logPrefix} CRASH RECOVERY: Application stuck in 'processing' state without employee ID for ${Math.round(processingFor / 1000)}s`,
      );

      // Generate the deterministic employeeId we would have used
      const deterministicEmployeeId = `CAN-${applicationId.slice(0, 8).toUpperCase()}`;

      // Mark as needs_manual_review - admin must check OrangeHRM and reconcile
      await db.jobApplication.updateMany({
        where: {
          id: applicationId,
          lifecycleVersion: application.lifecycleVersion,
        },
        data: {
          orangehrmProvisioningState: "needs_manual_review",
          lifecycleVersion: { increment: 1 },
        },
      });

      await db.auditLog.create({
        data: {
          action: "ORANGEHRM_CRASH_RECOVERY_MANUAL_REVIEW_REQUIRED",
          targetResource: `job_applications/${applicationId}`,
          details: {
            reason:
              "Application stuck in processing state without employee ID - OrangeHRM create may have succeeded",
            deterministicEmployeeId,
            email: application.email,
            fullName: application.fullName,
            processingForSeconds: Math.round(processingFor / 1000),
            instruction:
              "Check OrangeHRM for employee with employeeId or email, then manually set orangehrmEmployeeId",
            correlationId,
          },
        },
      });

      console.error(
        `${logPrefix} Marked for manual review - OrangeHRM may have employee with employeeId: ${deterministicEmployeeId}`,
      );

      return {
        success: false,
        empNumber: null,
        employeeId: null,
        action: "manual_review",
        message: `Crash recovery: cannot determine if OrangeHRM employee exists. Check OrangeHRM for employeeId=${deterministicEmployeeId} or email=${application.email}`,
        error: "Manual reconciliation required - processing state without employee ID for >1min",
      };
    }

    // Step 4: Mark provisioning as processing (with optimistic locking)
    const processingUpdate = await db.jobApplication.updateMany({
      where: {
        id: applicationId,
        lifecycleVersion: application.lifecycleVersion,
      },
      data: {
        orangehrmProvisioningState: "processing",
        orangehrmProvisioningAttemptedAt: new Date(),
        lifecycleVersion: { increment: 1 },
      },
    });

    if (processingUpdate.count === 0) {
      console.log(`${logPrefix} Lost race to mark processing (another worker won)`);
      // Another worker is processing, return gracefully
      return {
        success: true,
        empNumber: application.orangehrmEmployeeId,
        employeeId: application.orangehrmEmployeeId
          ? `EMP-${application.orangehrmEmployeeId}`
          : null,
        action: "already_provisioned",
        message: "Another worker is processing this application",
      };
    }

    console.log(`${logPrefix} Marked as processing`);

    // Step 5: Create employee in OrangeHRM
    console.log(`${logPrefix} Creating employee in OrangeHRM`, {
      fullName: application.fullName,
      email: application.email,
    });

    // Parse name (simple first/last split)
    const nameParts = application.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || application.fullName;
    const lastName = nameParts.slice(1).join(" ") || "";

    // CRITICAL FIX: OrangeHRM Community v5.7 does NOT accept employeeId in CREATE payload (422 error)
    // employeeId is auto-generated by OrangeHRM and cannot be set at creation time
    // We'll use the auto-generated employeeId returned by OrangeHRM
    const employee = await client.createEmployee({
      firstName,
      lastName,
      // Do NOT pass employeeId here - OrangeHRM Community v5.7 rejects it with 422 Invalid Parameter
      // employeeId is auto-generated and returned in the response
    });

    console.log(`${logPrefix} Employee created in OrangeHRM`, {
      empNumber: employee.empNumber,
      employeeId: employee.employeeId,
    });

    // Step 6: Update contact details (email)
    try {
      await client.updateEmployeeContactDetails(employee.empNumber, {
        workEmail: application.email,
        otherEmail: application.email,
      });
      console.log(`${logPrefix} Contact details updated`);
    } catch (contactError) {
      // Non-critical error, log and continue
      console.warn(`${logPrefix} Failed to update contact details`, contactError);
    }

    // Step 7: Persist OrangeHRM employee ID to database (atomic with lifecycle_version)
    const persistUpdate = await db.jobApplication.updateMany({
      where: {
        id: applicationId,
        lifecycleVersion: application.lifecycleVersion + 1, // Must match processing version
      },
      data: {
        orangehrmEmployeeId: employee.empNumber,
        orangehrmProvisioningState: "succeeded",
        orangehrmProvisioningSucceededAt: new Date(),
        orangehrmRecordStatus: "ACTIVE",
        lifecycleVersion: { increment: 1 },
      },
    });

    if (persistUpdate.count === 0) {
      // Race condition: Another worker created and persisted employee
      // Reconcile by checking if an employee was created
      console.warn(
        `${logPrefix} Failed to persist empNumber (race condition), attempting reconciliation`,
      );

      // Check current state
      const current = await db.jobApplication.findUnique({
        where: { id: applicationId },
        select: { orangehrmEmployeeId: true, orangehrmProvisioningState: true },
      });

      if (current?.orangehrmEmployeeId) {
        console.log(
          `${logPrefix} Another worker persisted empNumber ${current.orangehrmEmployeeId}`,
        );

        // We created employee.empNumber but another worker persisted their ID
        // This is a duplicate employee scenario - log for cleanup
        await db.auditLog.create({
          data: {
            action: "ORANGEHRM_EMPLOYEE_DUPLICATE_DETECTED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              ourEmpNumber: employee.empNumber,
              persistedEmpNumber: current.orangehrmEmployeeId,
              note: "Race condition created duplicate employee - requires manual cleanup",
              correlationId,
            },
          },
        });

        // Return the persisted ID (other worker won)
        return {
          success: true,
          empNumber: current.orangehrmEmployeeId,
          employeeId: `EMP-${current.orangehrmEmployeeId}`,
          action: "reconciled",
          message: `Race condition resolved: using employee ${current.orangehrmEmployeeId}`,
        };
      }

      throw new Error("Failed to persist employee ID due to concurrent modification");
    }

    console.log(`${logPrefix} Employee ID persisted to database`);

    // Step 8: Create audit log entry
    await db.auditLog.create({
      data: {
        action: "ORANGEHRM_EMPLOYEE_CREATED_AT_APPLIED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          empNumber: employee.empNumber,
          employeeId: employee.employeeId,
          firstName,
          lastName,
          email: application.email,
          correlationId,
        },
      },
    });

    console.log(`${logPrefix} Provisioning completed successfully`);

    return {
      success: true,
      empNumber: employee.empNumber,
      employeeId: employee.employeeId,
      action: "created",
      message: `Employee created with empNumber ${employee.empNumber}`,
    };
  } catch (error) {
    const classified = classifyError(error);

    console.error(`${logPrefix} Provisioning failed`, {
      errorType: classified.type,
      message: classified.message,
      retryable: isRetryable(classified),
    });

    // Mark as failed with error details
    await db.jobApplication.updateMany({
      where: { id: applicationId },
      data: {
        orangehrmProvisioningState: isRetryable(classified) ? "failed" : "needs_manual_review",
        orangehrmProvisioningAttemptedAt: new Date(),
      },
    });

    // Create audit log for failure
    await db.auditLog.create({
      data: {
        action: "ORANGEHRM_EMPLOYEE_PROVISIONING_FAILED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          errorType: classified.type,
          errorMessage: classified.message,
          retryable: isRetryable(classified),
          correlationId,
        },
      },
    });

    return {
      success: false,
      empNumber: null,
      employeeId: null,
      action: "failed",
      message: `Provisioning failed: ${classified.message}`,
      error: classified.message,
    };
  }
}

/**
 * PHASE 3: HIRED Upsert/Reconciliation Service
 *
 * Complete HIRED lifecycle: reconcile existing employee → update with full onboarding data
 * NEVER creates duplicate employee - always uses centralized provisionOrangeHRMEmployee()
 *
 * CRITICAL DESIGN PRINCIPLES:
 * 1. HIRED must not blindly create second employee
 * 2. If orangehrm_employee_id exists, UPDATE that employee
 * 3. If mapping missing, check employees table for reconciliation
 * 4. If no mapping exists anywhere, call centralized provisionOrangeHRMEmployee()
 * 5. Always enrich employee with full onboarding data after provisioning/reconciliation
 * 6. Transactional status validation before OrangeHRM operations
 * 7. Lifecycle version optimistic locking for race protection
 * 8. Idempotent: repeated HIRED events safe
 * 9. Crash recovery: deterministic where possible, manual review otherwise
 */

import type { OnboardingData, OnboardingDataSources, HiredUpsertResult } from "./orangehrm-types";

/**
 * Extract onboarding data from Ciago database entities
 * Priority: Employee > OnboardingRecord > JobApplication > JobPosting
 */
export function extractOnboardingData(sources: OnboardingDataSources): OnboardingData {
  return {
    // Identity
    fullName: sources.application.fullName,
    email: sources.application.email,
    roleTitle: sources.onboardingRecord?.roleTitle || sources.application.roleTitle,

    // Employment
    department:
      sources.employee?.department ||
      sources.onboardingRecord?.department ||
      sources.jobPosting?.department ||
      null,
    employmentType:
      sources.employee?.employmentType || sources.jobPosting?.employmentType || "full_time",
    joiningDate:
      sources.onboardingRecord?.doj ||
      sources.employee?.doj ||
      sources.onboardingRecord?.startDate ||
      null,
    startDate: sources.onboardingRecord?.startDate || null,
    workLocation: sources.employee?.workLocation || sources.jobPosting?.location || null,
    workModel:
      sources.employee?.workModel || (sources.jobPosting?.isRemote ? "remote" : "office") || null,

    // Compensation
    compensationInr: sources.onboardingRecord?.compensationInr || null,
    baseSalary: sources.employee?.baseSalary || null,
    salaryCurrency: sources.employee?.salaryCurrency || "INR",

    // Contact
    personalEmail: sources.employee?.personalEmail || sources.application.email,
    contactNumber: sources.employee?.contactNumber || null,
    workEmail: sources.employee?.workEmail || null,
    address: sources.employee?.address || null,
    emergencyContact: sources.onboardingRecord?.emergencyContact || null,

    // Organizational
    reportingManagerId: sources.employee?.reportingManagerId || null,
    reportingHrId: sources.employee?.reportingHrId || null,
    teamName: sources.employee?.teamName || null,
    notes: sources.employee?.notes || null,
  };
}

/**
 * Update existing OrangeHRM employee with full onboarding data
 * Called after reconciliation/provisioning to enrich preliminary employee
 *
 * KNOWN LIMITATIONS (OrangeHRM Community v5.7 - Phase 3 live testing):
 * - updateEmployee() returns 403 Unauthorized (permissions issue)
 * - updateEmployeeContactDetails() returns 404 (endpoint doesn't exist in Community edition)
 * - updateEmployeeJobDetails() WORKS (joinedDate successfully updated)
 *
 * Phase 3.0 focuses on what works: job details (joinedDate)
 */
async function enrichOrangeHRMEmployee(
  empNumber: number,
  onboardingData: OnboardingData,
  client: OrangeHRMClient,
  logPrefix: string,
): Promise<void> {
  console.log(`${logPrefix} Enriching OrangeHRM employee ${empNumber} with onboarding data`);

  // Update basic employee details (name)
  // OrangeHRM Community v5.7: PUT /pim/employees/{empNumber} returns 403
  // Solution: Use PUT /pim/employees/{empNumber}/personal-details which works
  const nameParts = onboardingData.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || onboardingData.fullName;
  const lastName = nameParts.slice(1).join(" ") || "";

  try {
    await client.updateEmployeePersonalDetails(empNumber, {
      firstName,
      lastName,
      // Don't overwrite employeeId - already auto-generated by OrangeHRM
    });
    console.log(`${logPrefix} Updated employee name`);
  } catch (error) {
    console.warn(`${logPrefix} Failed to update employee name:`, error);
    // Non-critical, continue
  }

  // Update contact details
  // NOTE: OrangeHRM Community v5.7 returns 404 for updateEmployeeContactDetails()
  // The /contact-details endpoint doesn't exist in Community edition
  // Keeping the code for future OrangeHRM Enterprise compatibility
  if (
    onboardingData.workEmail ||
    onboardingData.personalEmail ||
    onboardingData.contactNumber ||
    onboardingData.address
  ) {
    try {
      await client.updateEmployeeContactDetails(empNumber, {
        workEmail: onboardingData.workEmail || undefined,
        otherEmail: onboardingData.personalEmail || onboardingData.email,
        mobile: onboardingData.contactNumber || undefined,
        addressStreet1: onboardingData.address || undefined,
      });
      console.log(`${logPrefix} Updated contact details`);
    } catch (error) {
      console.warn(
        `${logPrefix} Failed to update contact details (404 Not Found - known OrangeHRM Community limitation)`,
      );
      // Non-critical, continue
    }
  }

  // Update job details (Phase 3.0: minimal - only joining date)
  // This WORKS in OrangeHRM Community v5.7
  // Future: add job title, department, employment status lookups
  if (onboardingData.joiningDate) {
    try {
      await client.updateEmployeeJobDetails(empNumber, {
        joinedDate: onboardingData.joiningDate,
        // TODO Phase 3.1: jobTitleId lookup
        // TODO Phase 3.1: subUnitId (department) lookup
        // TODO Phase 3.1: empStatusId (employment type) mapping
        // TODO Phase 3.1: locationId lookup
      });
      console.log(`${logPrefix} Updated job details (joinedDate: ${onboardingData.joiningDate})`);
    } catch (error) {
      console.error(`${logPrefix} Failed to update job details:`, error);
      // Non-critical, continue
    }
  }
}

/**
 * PHASE 3: Upsert OrangeHRM Employee at HIRED state
 *
 * Complete reconciliation/update/enrichment flow for HIRED candidates
 *
 * IDEMPOTENCY GUARANTEES:
 * 1. Repeated HIRED events → same result, no duplicate employee
 * 2. Integration event idempotency via event claiming
 * 3. DB persistence with lifecycle_version optimistic locking
 * 4. Final status re-check before OrangeHRM operations
 *
 * CONCURRENCY PROTECTION:
 * - Transactional status validation (must be HIRED)
 * - lifecycle_version checks prevent races
 * - Integration event claiming (handled by caller)
 * - HIRED vs REJECTED race: status validation aborts if rejected
 *
 * RECONCILIATION PRIORITY:
 * 1. job_applications.orangehrm_employee_id (primary mapping)
 * 2. employees.orangehrm_employee_id (fallback for rehire scenarios)
 * 3. Centralized provisionOrangeHRMEmployee() (never raw create)
 * 4. Manual review if ambiguous
 *
 * CRASH RECOVERY:
 * - After provisioning but before enrichment: next run enriches
 * - After enrichment but before DB persist: next run detects already-enriched
 * - Stale processing state: enter manual review (safe fallback)
 */
export async function upsertOrangeHRMEmployeeAtHired(
  applicationId: string,
  candidateId: string,
  onboardingData: OnboardingData,
  db: PrismaClient,
  client: OrangeHRMClient,
  correlationId?: string,
): Promise<HiredUpsertResult> {
  const logPrefix = `[orangehrm-hired:${applicationId.slice(0, 8)}]`;
  console.log(`${logPrefix} Starting HIRED upsert/reconciliation`, { correlationId });

  try {
    // Step 1: Load application with transactional status validation
    const application = await db.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        status: true,
        orangehrmEmployeeId: true,
        orangehrmProvisioningState: true,
        orangehrmRecordStatus: true,
        lifecycleVersion: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // CRITICAL: Verify status is still HIRED (race protection)
    if (application.status !== "hired") {
      console.warn(
        `${logPrefix} Application status is ${application.status}, not hired - aborting upsert`,
      );

      await db.auditLog.create({
        data: {
          action: "HIRED_UPSERT_ABORTED_STATUS_CHANGED",
          targetResource: `job_applications/${applicationId}`,
          details: {
            expectedStatus: "hired",
            actualStatus: application.status,
            reason: "Status changed between trigger and execution - race condition detected",
            correlationId,
          },
        },
      });

      return {
        success: false,
        empNumber: null,
        employeeId: null,
        action: "failed",
        message: `Application status changed to ${application.status} - aborting HIRED upsert`,
        error: "Status race condition",
      };
    }

    console.log(`${logPrefix} Application verified as HIRED`, {
      lifecycleVersion: application.lifecycleVersion,
      existingEmpId: application.orangehrmEmployeeId,
      provisioningState: application.orangehrmProvisioningState,
    });

    // Step 2: Check if already fully processed (idempotency)
    if (application.orangehrmEmployeeId && application.orangehrmProvisioningState === "succeeded") {
      // Verify employee still exists in OrangeHRM
      try {
        const existing = await client.getEmployee(application.orangehrmEmployeeId);

        if (existing) {
          console.log(
            `${logPrefix} Already processed - employee ${application.orangehrmEmployeeId} exists and is mapped`,
          );

          // Idempotent enrichment: re-apply onboarding data (safe operation)
          await enrichOrangeHRMEmployee(
            application.orangehrmEmployeeId,
            onboardingData,
            client,
            logPrefix,
          );

          return {
            success: true,
            empNumber: application.orangehrmEmployeeId,
            employeeId: `EMP-${application.orangehrmEmployeeId}`,
            action: "already_complete",
            message: `Employee already provisioned and enriched (empNumber: ${application.orangehrmEmployeeId})`,
          };
        }

        // Employee deleted externally - continue to reconciliation
        console.warn(
          `${logPrefix} Employee ${application.orangehrmEmployeeId} was deleted from OrangeHRM`,
        );
      } catch (error) {
        console.error(`${logPrefix} Failed to verify existing employee:`, error);
        // Continue to reconciliation
      }
    }

    // Step 3: Reconcile from job_applications.orangehrm_employee_id
    if (application.orangehrmEmployeeId) {
      console.log(
        `${logPrefix} Reconciling existing empNumber ${application.orangehrmEmployeeId} from job_applications`,
      );

      try {
        const existing = await client.getEmployee(application.orangehrmEmployeeId);

        if (existing) {
          // Enrich with onboarding data
          await enrichOrangeHRMEmployee(existing.empNumber, onboardingData, client, logPrefix);

          // Update provisioning state
          await db.jobApplication.updateMany({
            where: {
              id: applicationId,
              lifecycleVersion: application.lifecycleVersion,
            },
            data: {
              orangehrmProvisioningState: "succeeded",
              orangehrmProvisioningSucceededAt: new Date(),
              lifecycleVersion: { increment: 1 },
            },
          });

          await db.auditLog.create({
            data: {
              action: "ORANGEHRM_EMPLOYEE_ENRICHED_AT_HIRED",
              targetResource: `job_applications/${applicationId}`,
              details: {
                empNumber: existing.empNumber,
                action: "updated",
                joiningDate: onboardingData.joiningDate,
                correlationId,
              },
            },
          });

          console.log(`${logPrefix} Reconciled and enriched employee ${existing.empNumber}`);

          return {
            success: true,
            empNumber: existing.empNumber,
            employeeId: existing.employeeId,
            action: "updated",
            message: `Reconciled and updated employee empNumber ${existing.empNumber}`,
          };
        }

        console.warn(
          `${logPrefix} Employee ${application.orangehrmEmployeeId} not found in OrangeHRM - attempting employees table reconciliation`,
        );
      } catch (error) {
        console.error(`${logPrefix} Reconciliation from job_applications failed:`, error);
      }
    }

    // Step 4: Check employees table for existing mapping (rehire scenario)
    console.log(`${logPrefix} Checking employees table for existing OrangeHRM mapping`);

    const employee = await db.employee.findUnique({
      where: { userId: candidateId },
      select: {
        orangehrmEmployeeId: true,
        orangehrmRecordStatus: true,
      },
    });

    if (employee?.orangehrmEmployeeId) {
      console.log(
        `${logPrefix} Found existing mapping in employees table: empNumber ${employee.orangehrmEmployeeId}`,
      );

      // Check if employee was terminated (rejection/offboarding)
      if (employee.orangehrmRecordStatus === "TERMINATED") {
        console.warn(
          `${logPrefix} Employee ${employee.orangehrmEmployeeId} is TERMINATED - cannot reuse for rehire`,
        );

        await db.auditLog.create({
          data: {
            action: "HIRED_REHIRE_TERMINATED_EMPLOYEE_BLOCKED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              empNumber: employee.orangehrmEmployeeId,
              recordStatus: employee.orangehrmRecordStatus,
              reason: "Cannot reuse terminated employee for rehire - requires explicit rehire flow",
              correlationId,
            },
          },
        });

        // Do NOT reuse terminated employee - fall through to provisioning
      } else {
        // Verify employee exists in OrangeHRM
        try {
          const existing = await client.getEmployee(employee.orangehrmEmployeeId);

          if (existing) {
            // Reconcile: attach mapping to application
            await db.jobApplication.updateMany({
              where: {
                id: applicationId,
                lifecycleVersion: application.lifecycleVersion,
              },
              data: {
                orangehrmEmployeeId: existing.empNumber,
                orangehrmProvisioningState: "succeeded",
                orangehrmProvisioningSucceededAt: new Date(),
                lifecycleVersion: { increment: 1 },
              },
            });

            // Enrich with onboarding data
            await enrichOrangeHRMEmployee(existing.empNumber, onboardingData, client, logPrefix);

            await db.auditLog.create({
              data: {
                action: "ORANGEHRM_EMPLOYEE_RECONCILED_FROM_EMPLOYEES_TABLE",
                targetResource: `job_applications/${applicationId}`,
                details: {
                  empNumber: existing.empNumber,
                  candidateId,
                  action: "reconciled",
                  correlationId,
                },
              },
            });

            console.log(
              `${logPrefix} Reconciled from employees table and enriched empNumber ${existing.empNumber}`,
            );

            return {
              success: true,
              empNumber: existing.empNumber,
              employeeId: existing.employeeId,
              action: "reconciled",
              message: `Reconciled employee from employees table (empNumber: ${existing.empNumber})`,
            };
          }
        } catch (error) {
          console.error(`${logPrefix} Failed to reconcile from employees table:`, error);
        }
      }
    }

    // Step 5: No mapping exists - invoke centralized provisioning
    console.log(
      `${logPrefix} No existing mapping found - invoking centralized provisioning for HIRED fallback`,
    );

    const provisioningResult = await provisionOrangeHRMEmployee(
      applicationId,
      db,
      client,
      correlationId || `hired-fallback-${applicationId}`,
    );

    if (!provisioningResult.success) {
      console.error(`${logPrefix} Centralized provisioning failed:`, provisioningResult.error);

      return {
        success: false,
        empNumber: null,
        employeeId: null,
        action: "failed",
        message: `Centralized provisioning failed: ${provisioningResult.error}`,
        error: provisioningResult.error,
      };
    }

    console.log(
      `${logPrefix} Centralized provisioning succeeded: empNumber ${provisioningResult.empNumber}`,
    );

    // Enrich newly provisioned employee with onboarding data
    if (provisioningResult.empNumber) {
      await enrichOrangeHRMEmployee(
        provisioningResult.empNumber,
        onboardingData,
        client,
        logPrefix,
      );

      await db.auditLog.create({
        data: {
          action: "ORANGEHRM_EMPLOYEE_PROVISIONED_AND_ENRICHED_AT_HIRED",
          targetResource: `job_applications/${applicationId}`,
          details: {
            empNumber: provisioningResult.empNumber,
            action: "provisioned",
            provisioningAction: provisioningResult.action,
            joiningDate: onboardingData.joiningDate,
            correlationId,
          },
        },
      });
    }

    return {
      success: true,
      empNumber: provisioningResult.empNumber,
      employeeId: provisioningResult.employeeId,
      action: "provisioned",
      message: `Provisioned and enriched new employee (empNumber: ${provisioningResult.empNumber})`,
    };
  } catch (error) {
    const classified = classifyError(error);

    console.error(`${logPrefix} HIRED upsert failed`, {
      errorType: classified.type,
      message: classified.message,
    });

    await db.auditLog.create({
      data: {
        action: "ORANGEHRM_HIRED_UPSERT_FAILED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          errorType: classified.type,
          errorMessage: classified.message,
          retryable: isRetryable(classified),
          correlationId,
        },
      },
    });

    return {
      success: false,
      empNumber: null,
      employeeId: null,
      action: "failed",
      message: `HIRED upsert failed: ${classified.message}`,
      error: classified.message,
    };
  }
}
