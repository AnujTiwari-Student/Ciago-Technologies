/**
 * Phase 2: Frappe HR Employee Provisioning at APPLIED State - Orchestration
 *
 * Handles the transition: Application status → "applied" → Frappe employee creation
 *
 * FLOW:
 * 1. Check feature flag (frappe_employee_sync_enabled or reuse orangehrm flag during migration)
 * 2. Create integration event (idempotent)
 * 3. Atomically claim event (race protection)
 * 4. Call provisionFrappeEmployee() (existing service)
 * 5. Update integration event status (succeeded/failed)
 *
 * IDEMPOTENCY:
 * - Same application processed 2x/10x/100x → exactly ONE employee
 * - Integration event with idempotency_key prevents duplicate processing
 * - Completed events safely ignored on duplicate delivery
 *
 * CONCURRENCY:
 * - Atomic event claiming prevents two workers from both processing
 * - lifecycle_version in provisionFrappeEmployee() prevents race conditions
 * - Only one worker successfully creates employee
 *
 * CRASH RECOVERY:
 * - If Frappe create succeeds but DB persist fails, retry reconciles
 * - Reconciliation finds existing employee and persists name
 * - Never creates duplicate employee
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
  provisionFrappeEmployee,
  classifyFrappeError,
  isFrappeRetryable,
  type FrappeProvisioningResult,
} from "@/lib/frappe-provisioning";

export interface HandleFrappeApplicationAppliedOptions {
  db: PrismaClient;
  client: FrappeClient;
  applicationId: string;
  correlationId?: string;
  workerId?: string;
}

export interface FrappeApplicationAppliedResult {
  triggered: boolean;
  reason?: string;
  eventId?: string;
  provisioningResult?: FrappeProvisioningResult;
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
 * Handle application status change to "applied"
 *
 * This is the entry point triggered by the application status update flow.
 * It orchestrates: feature flag check → event creation → event claiming → provisioning
 *
 * SAFE TO CALL MULTIPLE TIMES:
 * - Feature flag OFF → no-op
 * - Event already completed → no-op
 * - Event already claimed → no-op
 * - Already provisioned → no-op (handled by provisionFrappeEmployee)
 */
export async function handleFrappeApplicationApplied(
  options: HandleFrappeApplicationAppliedOptions,
): Promise<FrappeApplicationAppliedResult> {
  const { db, client, applicationId, correlationId, workerId } = options;
  const logPrefix = `[frappe-applied-handler:${applicationId.slice(0, 8)}]`;

  console.log(`${logPrefix} Starting Frappe HR employee provisioning handler`, {
    correlationId,
  });

  try {
    // Step 1: Check feature flag
    const featureEnabled = await isFrappeEmployeeSyncEnabled();

    if (!featureEnabled) {
      console.log(`${logPrefix} Feature flag OFF, skipping Frappe provisioning`);
      return {
        triggered: false,
        reason: "feature_flag_disabled",
      };
    }

    console.log(`${logPrefix} Feature flag ON, proceeding with provisioning`);

    // Step 2: Create integration event (idempotent)
    const idempotencyKey = generateIdempotencyKey(
      "frappe_employee_provision",
      "job_application",
      applicationId,
    );

    const eventResult = await createIntegrationEvent(db, {
      eventType: "frappe_employee_provision",
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
    console.log(`${logPrefix} Calling provisionFrappeEmployee`, { eventId });

    const provisioningResult = await provisionFrappeEmployee(
      applicationId,
      db,
      client,
      correlationId || eventId,
    );

    console.log(`${logPrefix} Provisioning completed`, {
      success: provisioningResult.success,
      action: provisioningResult.action,
      employeeName: provisioningResult.employeeName,
    });

    // Step 6: Update event status based on result
    if (provisioningResult.success) {
      await markEventSucceeded(db, eventId, {
        employeeName: provisioningResult.employeeName,
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
        ? classifyFrappeError(new Error(provisioningResult.error))
        : null;

      const retryable = errorClassified ? isFrappeRetryable(errorClassified) : false;

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
export async function verifyFrappeApplicationStatusApplied(
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
 * Check if application already has Frappe employee provisioned
 *
 * Quick pre-check before creating integration event.
 * Not a replacement for full idempotency in provisionFrappeEmployee.
 */
export async function isFrappeApplicationProvisioned(
  db: PrismaClient,
  applicationId: string,
): Promise<boolean> {
  const application = await db.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      frappeEmployeeName: true,
      frappeProvisioningState: true,
    },
  });

  return !!application?.frappeEmployeeName && application.frappeProvisioningState === "succeeded";
}
