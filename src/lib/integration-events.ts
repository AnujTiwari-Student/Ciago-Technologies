/**
 * Integration Event Utilities — Phase 2
 *
 * Provides atomic event claiming, idempotent event handling, and retry logic
 * for integration_events table. Prevents duplicate processing by concurrent workers.
 *
 * Key Features:
 * - Deterministic event identity via idempotency_key
 * - Atomic event claiming (claimed_at + claimed_by)
 * - Completed events safely ignored on duplicate delivery
 * - Retryable vs non-retryable failure classification
 * - Audit trail preservation
 * - No secrets in logs or stored data
 */

import { PrismaClient, IntegrationEventStatus } from "@prisma/client";
import crypto from "crypto";

export interface CreateIntegrationEventPayload {
  eventType: string;
  entityType: string;
  entityId: string;
  idempotencyKey?: string; // Optional: auto-generated if not provided
  correlationId?: string;
  source?: string;
  payload?: unknown;
  maxAttempts?: number;
}

export interface IntegrationEventResult {
  id: string;
  status: IntegrationEventStatus;
  alreadyExists: boolean;
  alreadyCompleted: boolean;
}

export interface ClaimEventResult {
  claimed: boolean;
  event: {
    id: string;
    status: IntegrationEventStatus;
    attemptCount: number;
    claimedBy: string | null;
  } | null;
  reason?: string;
}

export interface UpdateEventStatusPayload {
  status: IntegrationEventStatus;
  resultData?: unknown;
  errorMessage?: string;
  errorCode?: string;
  nextRetryAt?: Date;
}

/**
 * Generate deterministic idempotency key for an event
 */
export function generateIdempotencyKey(
  eventType: string,
  entityType: string,
  entityId: string,
  suffix?: string,
): string {
  const parts = [eventType, entityType, entityId];
  if (suffix) parts.push(suffix);
  return parts.join(":");
}

/**
 * Generate unique worker ID for event claiming
 */
export function getWorkerId(): string {
  // Use process PID + random string for uniqueness
  const pid = typeof process !== "undefined" ? process.pid : 0;
  const random = crypto.randomBytes(4).toString("hex");
  return `worker-${pid}-${random}`;
}

/**
 * Create or get existing integration event (idempotent)
 *
 * If an event with the same idempotency_key already exists:
 * - If completed (succeeded) → return existing, alreadyCompleted=true
 * - If failed/pending → return existing, alreadyExists=true
 * - Otherwise → create new event
 *
 * IDEMPOTENCY: Safe to call multiple times with same idempotency_key
 */
export async function createIntegrationEvent(
  db: PrismaClient,
  payload: CreateIntegrationEventPayload,
): Promise<IntegrationEventResult> {
  const idempotencyKey =
    payload.idempotencyKey ||
    generateIdempotencyKey(payload.eventType, payload.entityType, payload.entityId);

  const logPrefix = `[integration-event:${idempotencyKey}]`;

  // Check if event already exists
  const existing = await db.integrationEvent.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      status: true,
      succeededAt: true,
      completedAt: true,
    },
  });

  if (existing) {
    const alreadyCompleted = existing.status === "succeeded" && !!existing.succeededAt;

    console.log(`${logPrefix} Event already exists`, {
      eventId: existing.id,
      status: existing.status,
      alreadyCompleted,
    });

    return {
      id: existing.id,
      status: existing.status,
      alreadyExists: true,
      alreadyCompleted,
    };
  }

  // Create new event
  const event = await db.integrationEvent.create({
    data: {
      eventType: payload.eventType,
      idempotencyKey,
      correlationId: payload.correlationId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      status: "pending",
      source: payload.source,
      payload: payload.payload as any,
      maxAttempts: payload.maxAttempts || 3,
      attemptCount: 0,
    },
    select: {
      id: true,
      status: true,
    },
  });

  console.log(`${logPrefix} Event created`, { eventId: event.id });

  return {
    id: event.id,
    status: event.status,
    alreadyExists: false,
    alreadyCompleted: false,
  };
}

/**
 * Get integration event by ID
 */
export async function getEvent(db: PrismaClient, eventId: string) {
  return db.integrationEvent.findUnique({
    where: { id: eventId },
  });
}

/**
 * Get integration event by idempotency key
 */
export async function getEventByIdempotencyKey(db: PrismaClient, idempotencyKey: string) {
  return db.integrationEvent.findUnique({
    where: { idempotencyKey },
  });
}

/**
 * Atomically claim an integration event for processing
 *
 * CONCURRENCY PROTECTION:
 * - Uses updateMany with WHERE status = 'pending' (atomic)
 * - Only one worker can successfully claim
 * - Returns claimed=false if another worker claimed first
 * - Returns claimed=false if event already completed
 * - Returns claimed=false if max attempts exceeded
 *
 * IDEMPOTENCY: Safe to call multiple times - only first succeeds
 */
export async function claimEvent(
  db: PrismaClient,
  eventId: string,
  workerId?: string,
): Promise<ClaimEventResult> {
  const actualWorkerId = workerId || getWorkerId();
  const logPrefix = `[claim-event:${eventId.slice(0, 8)}]`;

  // Load current event state
  const event = await db.integrationEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      attemptCount: true,
      maxAttempts: true,
      claimedBy: true,
      succeededAt: true,
    },
  });

  if (!event) {
    console.warn(`${logPrefix} Event not found`);
    return { claimed: false, event: null, reason: "event_not_found" };
  }

  // Already completed
  if (event.status === "succeeded" && event.succeededAt) {
    console.log(`${logPrefix} Event already completed, skipping`);
    return {
      claimed: false,
      event: {
        id: event.id,
        status: event.status,
        attemptCount: event.attemptCount,
        claimedBy: event.claimedBy,
      },
      reason: "already_completed",
    };
  }

  // Max attempts exceeded
  if (event.attemptCount >= event.maxAttempts) {
    console.warn(`${logPrefix} Max attempts exceeded`, {
      attemptCount: event.attemptCount,
      maxAttempts: event.maxAttempts,
    });
    return {
      claimed: false,
      event: {
        id: event.id,
        status: event.status,
        attemptCount: event.attemptCount,
        claimedBy: event.claimedBy,
      },
      reason: "max_attempts_exceeded",
    };
  }

  // Atomically claim the event
  // WHERE status IN ('pending', 'failed') ensures only unclaimed events are claimed
  // Allow claiming if: (a) never claimed, OR (b) claimed >5min ago (stale claim recovery)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const updated = await db.integrationEvent.updateMany({
    where: {
      id: eventId,
      status: { in: ["pending", "failed", "claimed"] }, // Allow re-claiming stale "claimed" status
      OR: [
        { claimedAt: null }, // Never claimed
        { claimedAt: { lt: fiveMinutesAgo } }, // Stale claim (crashed worker)
      ],
    },
    data: {
      status: "claimed",
      claimedAt: new Date(),
      claimedBy: actualWorkerId,
      attemptCount: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    // Another worker claimed it, or status changed
    console.log(`${logPrefix} Claim failed (already claimed by another worker)`);

    const current = await db.integrationEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        attemptCount: true,
        claimedBy: true,
      },
    });

    return {
      claimed: false,
      event: current,
      reason: "already_claimed",
    };
  }

  console.log(`${logPrefix} Event claimed successfully`, { workerId: actualWorkerId });

  return {
    claimed: true,
    event: {
      id: event.id,
      status: "claimed",
      attemptCount: event.attemptCount + 1,
      claimedBy: actualWorkerId,
    },
  };
}

/**
 * Update integration event status after processing
 *
 * Supports status transitions:
 * - claimed → processing (when work starts)
 * - processing → succeeded (when work completes successfully)
 * - processing → failed (when work fails but is retryable)
 * - claimed → failed (when claim succeeds but work fails immediately)
 */
export async function updateEventStatus(
  db: PrismaClient,
  eventId: string,
  payload: UpdateEventStatusPayload,
): Promise<void> {
  const logPrefix = `[update-event:${eventId.slice(0, 8)}]`;

  const data: any = {
    status: payload.status,
    updatedAt: new Date(),
  };

  // Set timestamps based on status
  if (payload.status === "processing") {
    data.processingStartedAt = new Date();
  } else if (payload.status === "succeeded") {
    data.succeededAt = new Date();
    data.completedAt = new Date();
    data.resultData = payload.resultData as any;
  } else if (payload.status === "failed") {
    data.failedAt = new Date();
    data.errorMessage = payload.errorMessage;
    data.errorCode = payload.errorCode;
    data.nextRetryAt = payload.nextRetryAt;

    // If no retry scheduled and not at max attempts, event stays retryable
    // If max attempts exceeded, this is terminal failure
  }

  await db.integrationEvent.update({
    where: { id: eventId },
    data,
  });

  console.log(`${logPrefix} Status updated`, {
    status: payload.status,
    hasError: !!payload.errorMessage,
  });
}

/**
 * Mark event as succeeded with result data
 */
export async function markEventSucceeded(
  db: PrismaClient,
  eventId: string,
  resultData?: unknown,
): Promise<void> {
  await updateEventStatus(db, eventId, {
    status: "succeeded",
    resultData,
  });
}

/**
 * Mark event as failed with error details
 */
export async function markEventFailed(
  db: PrismaClient,
  eventId: string,
  error: { message: string; code?: string; retryable?: boolean },
): Promise<void> {
  const nextRetryAt = error.retryable
    ? new Date(Date.now() + 60_000) // Retry in 1 minute
    : undefined;

  await updateEventStatus(db, eventId, {
    status: "failed",
    errorMessage: error.message,
    errorCode: error.code,
    nextRetryAt,
  });
}

/**
 * Reset claimed event back to pending (for crash recovery)
 *
 * Use case: Worker crashes after claiming but before processing
 * Should only be called by a recovery mechanism, not normal flow
 */
export async function releaseClaimedEvent(db: PrismaClient, eventId: string): Promise<void> {
  await db.integrationEvent.update({
    where: { id: eventId },
    data: {
      status: "pending",
      claimedAt: null,
      claimedBy: null,
    },
  });
}

/**
 * Get retryable failed events that are ready to retry
 */
export async function getRetryableEvents(db: PrismaClient, limit = 10) {
  return db.integrationEvent.findMany({
    where: {
      status: "failed",
      nextRetryAt: { lte: new Date() },
      attemptCount: { lt: db.integrationEvent.fields.maxAttempts },
    },
    take: limit,
    orderBy: { nextRetryAt: "asc" },
  });
}
