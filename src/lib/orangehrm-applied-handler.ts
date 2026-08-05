/**
 * Phase 2: OrangeHRM Employee Provisioning at APPLIED State
 *
 * Handles the transition: Application status → "applied" → OrangeHRM employee creation
 *
 * FLOW:
 * 1. Check feature flag (orangehrm_employee_sync_enabled)
 * 2. Create integration event (idempotent)
 * 3. Atomically claim event (race protection)
 * 4. Call provisionOrangeHRMEmployee() (existing service)
 * 5. Update integration event status (succeeded/failed)
 *
 * IDEMPOTENCY:
 * - Same application processed 2x/10x/100x → exactly ONE employee
 * - Integration event with idempotency_key prevents duplicate processing
 * - Completed events safely ignored on duplicate delivery
 *
 * CONCURRENCY:
 * - Atomic event claiming prevents two workers from both processing
 * - lifecycle_version in provisionOrangeHRMEmployee() prevents race conditions
 * - Only one worker successfully creates employee
 *
 * CRASH RECOVERY:
 * - If OrangeHRM create succeeds but DB persist fails, retry reconciles
 * - Reconciliation finds existing employee and persists ID
 * - Never creates duplicate employee
 */

import { PrismaClient } from "@prisma/client";
import type { OrangeHRMClient } from "@/integrations/orangehrm/client";
import { isOrangeHRMEmployeeSyncEnabled } from "@/lib/feature-flags.server";
import {
  createIntegrationEvent,
  claimEvent,
  updateEventStatus,
  markEventSucceeded,
  markEventFailed,
  generateIdempotencyKey,
} from "@/lib/integration-events";
import {
  provisionOrangeHRMEmployee,
  classifyError,
  isRetryable,
  type ProvisioningResult,
} from "@/lib/orangehrm-provisioning";

export interface HandleApplicationAppliedOptions {
  db: PrismaClient;
  client: OrangeHRMClient;
  applicationId: string;
  correlationId?: string;
  workerId?: string;
}

export interface ApplicationAppliedResult {
  triggered: boolean;
  reason?: string;
  eventId?: string;
  provisioningResult?: ProvisioningResult;
}

/**
 * Handle application status change to "applied"
 *
 * This is the entry point triggered by the application status update flow.
 * It orchestrates: feature flag check → event creation → event claiming → provisioning
 *
 * SAFE TO CALL MULTIPLE TIMES:
 * - Feature flag OFF → no-op
 * - Event already completed → no-op
 * - Event already claimed → no-op
 * - Already provisioned → no-op (handled by provisionOrangeHRMEmployee)
 */
export async function handleApplicationApplied(
  options: HandleApplicationAppliedOptions,
): Promise<ApplicationAppliedResult> {
  const { db, client, applicationId, correlationId, workerId } = options;
  const logPrefix = `[applied-handler:${applicationId.slice(0, 8)}]`;

  console.log(`${logPrefix} Starting OrangeHRM employee provisioning handler`, {
    correlationId,
  });

  try {
    // Step 1: Check feature flag
    const featureEnabled = await isOrangeHRMEmployeeSyncEnabled();

    if (!featureEnabled) {
      console.log(`${logPrefix} Feature flag OFF, skipping OrangeHRM provisioning`);
      return {
        triggered: false,
        reason: "feature_flag_disabled",
      };
    }

    console.log(`${logPrefix} Feature flag ON, proceeding with provisioning`);

    // Step 2: Create integration event (idempotent)
    const idempotencyKey = generateIdempotencyKey(
      "orangehrm_employee_provision",
      "job_application",
      applicationId,
    );

    const eventResult = await createIntegrationEvent(db, {
      eventType: "orangehrm_employee_provision",
      entityType: "job_application",
      entityId: applicationId,
      idempotencyKey,
      correlationId,
      source: "application_status_update",
      maxAttempts: 3,
    });

    const eventId = eventResult.id;

    // Step 2a: If event already completed, return immediately
    if (eventResult.alreadyCompleted) {
      console.log(`${logPrefix} Event already completed, skipping`, { eventId });
      return {
        triggered: false,
        reason: "already_completed",
        eventId,
      };
    }

    // Step 3: Atomically claim event (race protection)
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

    // Step 4: Mark event as processing
    await updateEventStatus(db, eventId, { status: "processing" });

    // Step 5: Call provisioning service
    console.log(`${logPrefix} Calling provisionOrangeHRMEmployee`, { eventId });

    const provisioningResult = await provisionOrangeHRMEmployee(
      applicationId,
      db,
      client,
      correlationId || eventId,
    );

    console.log(`${logPrefix} Provisioning completed`, {
      success: provisioningResult.success,
      action: provisioningResult.action,
      empNumber: provisioningResult.empNumber,
    });

    // Step 6: Update event status based on result
    if (provisioningResult.success) {
      await markEventSucceeded(db, eventId, {
        empNumber: provisioningResult.empNumber,
        employeeId: provisioningResult.employeeId,
        action: provisioningResult.action,
        message: provisioningResult.message,
      });

      console.log(`${logPrefix} Event marked as succeeded`, { eventId });

      return {
        triggered: true,
        eventId,
        provisioningResult,
      };
    } else {
      // Provisioning failed
      const errorClassified = provisioningResult.error
        ? classifyError(new Error(provisioningResult.error))
        : null;

      const retryable = errorClassified ? isRetryable(errorClassified) : false;

      await markEventFailed(db, eventId, {
        message: provisioningResult.error || "Unknown provisioning failure",
        code: errorClassified?.type,
        retryable,
      });

      console.error(`${logPrefix} Event marked as failed`, {
        eventId,
        retryable,
        error: provisioningResult.error,
      });

      return {
        triggered: true,
        eventId,
        provisioningResult,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Handler failed unexpectedly`, error);

    // If we have an event ID, mark it as failed
    // Otherwise, this is a pre-event-creation failure (feature flag check, etc.)
    throw error; // Re-throw so caller knows it failed
  }
}

/**
 * Re-check application status before processing
 *
 * RACE CONDITION PROTECTION:
 * - Verify status is still "applied" at execution time
 * - Prevents processing if status changed between queue and execution
 *
 * Use case: Status changed from "applied" to "rejected" between
 * triggering the handler and the handler executing.
 */
export async function verifyApplicationStatusApplied(
  db: PrismaClient,
  applicationId: string,
): Promise<boolean> {
  const application = await db.jobApplication.findUnique({
    where: { id: applicationId },
    select: { status: true },
  });

  return application?.status === "applied";
}

/**
 * Check if application already has OrangeHRM employee provisioned
 *
 * Quick pre-check before creating integration event.
 * Not a replacement for full idempotency in provisionOrangeHRMEmployee.
 */
export async function isApplicationProvisioned(
  db: PrismaClient,
  applicationId: string,
): Promise<boolean> {
  const application = await db.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      orangehrmEmployeeId: true,
      orangehrmProvisioningState: true,
    },
  });

  return (
    !!application?.orangehrmEmployeeId && application.orangehrmProvisioningState === "succeeded"
  );
}
