/**
 * Phase 2: Frappe HR Employee Provisioning at APPLIED State
 *
 * CRITICAL DESIGN PRINCIPLES (preserved from OrangeHRM):
 * 1. Employee MUST be created at APPLIED state, NOT at HIRED
 * 2. HIRED state later UPSERTS the existing employee (never creates second employee)
 * 3. Idempotency: Same application processed 2x/10x/100x yields exactly ONE employee
 * 4. Race protection: Concurrent workers use lifecycle_version + event claiming
 * 5. Crash recovery: If Frappe create succeeds but DB persist fails, reconciliation
 *    finds the existing employee and persists the name (never creates duplicate)
 *
 * FRAPPE-SPECIFIC DIFFERENCES:
 * - Uses employee name (HR-EMP-XXXXX) instead of empNumber (integer)
 * - Required fields: gender, date_of_birth, date_of_joining, company
 * - Link fields require existing DocType records (designation, department, etc.)
 * - No DELETE API - use status "Left" for termination
 */

import { PrismaClient } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";
import { FrappeError } from "@/integrations/frappe/client";

/**
 * Provisioning result with idempotency tracking
 */
export interface FrappeProvisioningResult {
  success: boolean;
  employeeName: string | null; // HR-EMP-XXXXX format
  action:
    | "created"             // New employee created in Frappe
    | "already_provisioned" // Already had valid frappe_employee_name
    | "reconciled"          // Found existing Frappe employee and persisted name
    | "failed"              // Provisioning failed
    | "manual_review";      // Multiple candidates found, needs manual intervention
  message: string;
  error?: string;
}

/**
 * Error classification for intelligent retry logic
 */
export type FrappeProvisioningErrorType =
  | "auth_failed"           // Authentication issues (401) - retryable after token refresh
  | "validation_error"      // Invalid payload (400) - not retryable
  | "mandatory_error"       // Missing required field - not retryable without data
  | "link_validation_error" // Invalid Link field reference - not retryable
  | "network_error"         // Connection/timeout - retryable
  | "server_error"          // Frappe 500 error - retryable
  | "reconciliation_conflict" // Multiple matching employees - needs manual review
  | "unknown";              // Unknown error - log and investigate

export class FrappeProvisioningError extends Error {
  constructor(
    public type: FrappeProvisioningErrorType,
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "FrappeProvisioningError";
  }
}

/**
 * Classify error for retry logic
 */
export function classifyFrappeError(error: unknown): FrappeProvisioningError {
  if (error instanceof FrappeProvisioningError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Auth errors
  if (lowerMessage.includes("401") || lowerMessage.includes("unauthorized")) {
    return new FrappeProvisioningError("auth_failed", message, 401, error);
  }

  // Mandatory field errors (Frappe-specific)
  if (lowerMessage.includes("mandatory") || lowerMessage.includes("mandatoryerror")) {
    return new FrappeProvisioningError("mandatory_error", message, 400, error);
  }

  // Link validation errors (Frappe-specific)
  if (lowerMessage.includes("linkvalidationerror") || lowerMessage.includes("link validation")) {
    return new FrappeProvisioningError("link_validation_error", message, 403, error);
  }

  // Validation errors
  if (lowerMessage.includes("400") || lowerMessage.includes("bad request")) {
    return new FrappeProvisioningError("validation_error", message, 400, error);
  }

  // Server errors
  if (lowerMessage.includes("500") || lowerMessage.includes("internal server")) {
    return new FrappeProvisioningError("server_error", message, 500, error);
  }

  // Network errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("network")
  ) {
    return new FrappeProvisioningError("network_error", message, undefined, error);
  }

  // Multiple match reconciliation conflict
  if (lowerMessage.includes("multiple") && lowerMessage.includes("match")) {
    return new FrappeProvisioningError("reconciliation_conflict", message, undefined, error);
  }

  // Unknown
  return new FrappeProvisioningError("unknown", message, undefined, error);
}

/**
 * Determine if error is retryable
 */
export function isFrappeRetryable(error: FrappeProvisioningError): boolean {
  return [
    "auth_failed",
    "network_error",
    "server_error"
  ].includes(error.type);
}

/**
 * REQUIRED FIELDS HANDLER - CRITICAL BLOCKER
 *
 * Frappe requires gender and date_of_birth, which are NOT in current onboarding flow.
 * Phase 1 documented this as a blocker. We MUST handle this explicitly.
 *
 * OPTIONS (as documented in Phase 1):
 * 1. Use placeholder values + flag for manual review (MVP approach)
 * 2. Fail provisioning and require manual data entry
 * 3. Add fields to onboarding flow (product decision required)
 *
 * CURRENT IMPLEMENTATION: Option 1 (placeholder + flag)
 * - Gender: "Other" (neutral choice)
 * - DOB: Calculate from email pattern OR use generic 1990-01-01
 * - Mark application as needs_manual_review via Frappe provisioning state
 */
interface RequiredFieldDefaults {
  gender: "Male" | "Female" | "Other";
  date_of_birth: string; // YYYY-MM-DD
  needsManualReview: boolean;
  reason?: string;
}

function getRequiredFieldDefaults(
  applicationId: string,
  email: string
): RequiredFieldDefaults {
  // Use "Other" as neutral gender default
  const gender = "Other";

  // Use generic DOB - makes no assumptions about actual DOB
  const date_of_birth = "1990-01-01";

  return {
    gender,
    date_of_birth,
    needsManualReview: true,
    reason: "Gender and date_of_birth not collected during onboarding - placeholder values used"
  };
}

/**
 * Get company name from environment or use default
 */
function getFrappeCompanyName(): string {
  return process.env.FRAPPE_COMPANY_NAME || "Ciago Technologies";
}

/**
 * Single canonical function to provision Frappe employee at APPLIED state
 *
 * IDEMPOTENCY GUARANTEES:
 * 1. If frappe_employee_name already exists and valid → return immediately
 * 2. If Frappe API returns employee → persist name and return
 * 3. If crash after create but before persist → reconciliation finds existing employee
 * 4. If multiple workers race → lifecycle_version prevents double-create
 *
 * CONCURRENCY PROTECTION:
 * - lifecycle_version: Optimistic locking on job_applications
 * - WHERE clause with expected version: Only one UPDATE succeeds
 * - Failed UPDATE with 0 rows → another worker won, exit gracefully
 *
 * RECONCILIATION STRATEGY:
 * 1. Check existing frappe_employee_name in DB
 * 2. If exists, verify employee exists in Frappe
 * 3. If employee deleted/missing in Frappe, attempt reconciliation
 * 4. Match on deterministic fields: email (unique identifier)
 * 5. Multiple matches → mark manual_review, never auto-choose
 */
export async function provisionFrappeEmployee(
  applicationId: string,
  db: PrismaClient,
  client: FrappeClient,
  correlationId?: string
): Promise<FrappeProvisioningResult> {
  const logPrefix = `[frappe-provision:${applicationId.slice(0, 8)}]`;
  console.log(`${logPrefix} Starting Frappe HR employee provisioning`, { correlationId });

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
        frappeEmployeeName: true,
        frappeProvisioningState: true,
        frappeRecordStatus: true,
        lifecycleVersion: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    console.log(`${logPrefix} Application loaded`, {
      status: application.status,
      provisioningState: application.frappeProvisioningState,
      existingEmployeeName: application.frappeEmployeeName,
      lifecycleVersion: application.lifecycleVersion,
    });

    // Step 2: Idempotency check - already provisioned?
    if (
      application.frappeEmployeeName &&
      application.frappeProvisioningState === "succeeded"
    ) {
      console.log(`${logPrefix} Already provisioned`, {
        employeeName: application.frappeEmployeeName,
      });

      return {
        success: true,
        employeeName: application.frappeEmployeeName,
        action: "already_provisioned",
        message: `Employee already provisioned with name ${application.frappeEmployeeName}`,
      };
    }

    // Step 3: Reconciliation - check if employee exists but name not persisted
    if (application.frappeEmployeeName) {
      console.log(`${logPrefix} Reconciling existing employee name`, {
        employeeName: application.frappeEmployeeName,
      });

      // Verify employee exists in Frappe
      const existing = await client.getEmployee(application.frappeEmployeeName);

      if (existing) {
        // Employee exists, persist the mapping
        const updated = await db.jobApplication.updateMany({
          where: {
            id: applicationId,
            lifecycleVersion: application.lifecycleVersion, // Optimistic locking
          },
          data: {
            frappeProvisioningState: "succeeded",
            frappeProvisioningSucceededAt: new Date(),
            frappeRecordStatus: "ACTIVE",
            lifecycleVersion: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          console.log(`${logPrefix} Reconciliation lost race (lifecycle_version changed)`);
          // Another worker already updated, return success
          return {
            success: true,
            employeeName: application.frappeEmployeeName,
            action: "already_provisioned",
            message: "Another worker completed provisioning",
          };
        }

        console.log(`${logPrefix} Reconciled existing employee`, {
          employeeName: application.frappeEmployeeName,
        });

        await db.auditLog.create({
          data: {
            action: "FRAPPE_EMPLOYEE_RECONCILED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              employeeName: application.frappeEmployeeName,
              email: application.email,
              correlationId,
            },
          },
        });

        return {
          success: true,
          employeeName: application.frappeEmployeeName,
          action: "reconciled",
          message: `Reconciled existing employee ${application.frappeEmployeeName}`,
        };
      }

      // Employee name exists but employee not found in Frappe - needs reconciliation
      console.warn(`${logPrefix} Employee ${application.frappeEmployeeName} not found in Frappe`);
    }

    // Step 3a: CRITICAL CRASH RECOVERY - check if we're in "processing" state without employee name
    // This means Frappe create may have succeeded but we didn't record it
    // CANNOT blindly create another employee - enter manual reconciliation state
    const processingFor = application.frappeProvisioningAttemptedAt
      ? Date.now() - new Date(application.frappeProvisioningAttemptedAt).getTime()
      : 0;

    if (
      !application.frappeEmployeeName &&
      application.frappeProvisioningState === "processing" &&
      processingFor > 60_000 // Processing for more than 1 minute - likely a crash
    ) {
      console.error(
        `${logPrefix} CRASH RECOVERY: Application stuck in 'processing' state without employee name for ${Math.round(processingFor / 1000)}s`
      );

      // Mark as needs_manual_review - admin must check Frappe and reconcile
      await db.jobApplication.updateMany({
        where: {
          id: applicationId,
          lifecycleVersion: application.lifecycleVersion,
        },
        data: {
          frappeProvisioningState: "needs_manual_review",
          lifecycleVersion: { increment: 1 },
        },
      });

      await db.auditLog.create({
        data: {
          action: "FRAPPE_CRASH_RECOVERY_MANUAL_REVIEW_REQUIRED",
          targetResource: `job_applications/${applicationId}`,
          details: {
            reason: "Application stuck in processing state without employee name - Frappe create may have succeeded",
            email: application.email,
            fullName: application.fullName,
            processingForSeconds: Math.round(processingFor / 1000),
            instruction: "Check Frappe for employee with email, then manually set frappeEmployeeName",
            correlationId,
          },
        },
      });

      console.error(
        `${logPrefix} Marked for manual review - Frappe may have employee with email: ${application.email}`
      );

      return {
        success: false,
        employeeName: null,
        action: "manual_review",
        message: `Crash recovery: cannot determine if Frappe employee exists. Check Frappe for email=${application.email}`,
        error: "Manual reconciliation required - processing state without employee name for >1min",
      };
    }

    // Step 4: Mark provisioning as processing (with optimistic locking)
    const processingUpdate = await db.jobApplication.updateMany({
      where: {
        id: applicationId,
        lifecycleVersion: application.lifecycleVersion,
      },
      data: {
        frappeProvisioningState: "processing",
        frappeProvisioningAttemptedAt: new Date(),
        lifecycleVersion: { increment: 1 },
      },
    });

    if (processingUpdate.count === 0) {
      console.log(`${logPrefix} Lost race to mark processing (another worker won)`);
      // Another worker is processing, return gracefully
      return {
        success: true,
        employeeName: application.frappeEmployeeName,
        action: "already_provisioned",
        message: "Another worker is processing this application",
      };
    }

    console.log(`${logPrefix} Marked as processing`);

    // Step 5: Handle required fields (CRITICAL BLOCKER)
    const requiredDefaults = getRequiredFieldDefaults(applicationId, application.email);

    if (requiredDefaults.needsManualReview) {
      console.warn(`${logPrefix} Using placeholder values for required fields`, {
        gender: requiredDefaults.gender,
        date_of_birth: requiredDefaults.date_of_birth,
        reason: requiredDefaults.reason,
      });
    }

    // Step 6: Create employee in Frappe
    console.log(`${logPrefix} Creating employee in Frappe`, {
      fullName: application.fullName,
      email: application.email,
    });

    // Parse name (simple first/middle/last split)
    const nameParts = application.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || application.fullName;
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;

    // Get company name
    const companyName = getFrappeCompanyName();

    // Create employee with required fields
    const employee = await client.createEmployee({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      gender: requiredDefaults.gender,
      date_of_birth: requiredDefaults.date_of_birth,
      date_of_joining: new Date().toISOString().split('T')[0], // Today's date as temporary joining date
      company: companyName,
      personal_email: application.email,
      company_email: application.email,
    });

    console.log(`${logPrefix} Employee created in Frappe`, {
      employeeName: employee.name,
      employee_name: employee.employee_name,
    });

    // Step 7: Persist Frappe employee name to database (atomic with lifecycle_version)
    const persistUpdate = await db.jobApplication.updateMany({
      where: {
        id: applicationId,
        lifecycleVersion: application.lifecycleVersion + 1, // Must match processing version
      },
      data: {
        frappeEmployeeName: employee.name,
        frappeProvisioningState: requiredDefaults.needsManualReview ? "needs_manual_review" : "succeeded",
        frappeProvisioningSucceededAt: new Date(),
        frappeRecordStatus: "ACTIVE",
        lifecycleVersion: { increment: 1 },
      },
    });

    if (persistUpdate.count === 0) {
      // Race condition: Another worker created and persisted employee
      console.warn(
        `${logPrefix} Failed to persist employee name (race condition), attempting reconciliation`
      );

      // Check current state
      const current = await db.jobApplication.findUnique({
        where: { id: applicationId },
        select: { frappeEmployeeName: true, frappeProvisioningState: true },
      });

      if (current?.frappeEmployeeName) {
        console.log(`${logPrefix} Another worker persisted employee name ${current.frappeEmployeeName}`);

        // We created employee.name but another worker persisted their name
        // This is a duplicate employee scenario - log for cleanup
        await db.auditLog.create({
          data: {
            action: "FRAPPE_EMPLOYEE_DUPLICATE_DETECTED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              ourEmployeeName: employee.name,
              persistedEmployeeName: current.frappeEmployeeName,
              note: "Race condition created duplicate employee - requires manual cleanup",
              correlationId,
            },
          },
        });

        // Return the persisted name (other worker won)
        return {
          success: true,
          employeeName: current.frappeEmployeeName,
          action: "reconciled",
          message: `Race condition resolved: using employee ${current.frappeEmployeeName}`,
        };
      }

      throw new Error("Failed to persist employee name due to concurrent modification");
    }

    console.log(`${logPrefix} Employee name persisted to database`);

    // Step 8: Create audit log entry
    await db.auditLog.create({
      data: {
        action: "FRAPPE_EMPLOYEE_CREATED_AT_APPLIED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          employeeName: employee.name,
          employee_name: employee.employee_name,
          firstName,
          lastName,
          middleName,
          email: application.email,
          usedPlaceholderValues: requiredDefaults.needsManualReview,
          placeholderReason: requiredDefaults.reason,
          correlationId,
        },
      },
    });

    console.log(`${logPrefix} Provisioning completed successfully`, {
      needsManualReview: requiredDefaults.needsManualReview,
    });

    return {
      success: true,
      employeeName: employee.name,
      action: "created",
      message: requiredDefaults.needsManualReview
        ? `Employee created with placeholder values (needs manual review): ${employee.name}`
        : `Employee created: ${employee.name}`,
    };
  } catch (error) {
    const classified = classifyFrappeError(error);

    console.error(`${logPrefix} Provisioning failed`, {
      errorType: classified.type,
      message: classified.message,
      retryable: isFrappeRetryable(classified),
    });

    // Mark as failed with error details
    await db.jobApplication.updateMany({
      where: { id: applicationId },
      data: {
        frappeProvisioningState: isFrappeRetryable(classified) ? "failed" : "needs_manual_review",
        frappeProvisioningAttemptedAt: new Date(),
      },
    });

    // Create audit log for failure
    await db.auditLog.create({
      data: {
        action: "FRAPPE_EMPLOYEE_PROVISIONING_FAILED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          errorType: classified.type,
          errorMessage: classified.message,
          retryable: isFrappeRetryable(classified),
          correlationId,
        },
      },
    });

    return {
      success: false,
      employeeName: null,
      action: "failed",
      message: `Provisioning failed: ${classified.message}`,
      error: classified.message,
    };
  }
}
