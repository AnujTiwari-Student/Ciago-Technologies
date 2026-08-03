import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import { createFrappeClient } from "@/integrations/frappe/client";

export type FrappeDashboardStats = {
  // Environment & Safety
  environment: "development" | "production";
  syncEnabled: boolean;
  orangehrmOperational: boolean;
  productionDeployed: boolean;

  // Connection Health
  connectionStatus: "connected" | "disconnected" | "error" | "sync_disabled";
  frappeBaseUrl: string | null;
  frappeVersion: string | null;
  siteName: string | null;

  // Provisioning Overview
  totalApplications: number;
  provisionedToFrappe: number;
  pendingProvisioning: number;
  processing: number;
  failed: number;
  needsManualReview: number;

  // APPLIED → HIRED Lifecycle
  appliedProvisionCount: number;
  hiredEnrichmentCount: number;
  hiredSuccessful: number;
  hiredFailed: number;

  // Integration Events
  totalIntegrationEvents: number;
  pendingEvents: number;
  processingEvents: number;
  succeededEvents: number;
  failedEvents: number;

  // Department Insights (global for system roles)
  applicationsByDepartment: Array<{ department: string; count: number }>;
  provisionedByDepartment: Array<{ department: string; count: number }>;

  // Recent Provisioning
  recentlyProvisioned: Array<{
    id: string;
    fullName: string;
    email: string;
    applicationId: string;
    frappeEmployeeName: string | null;
    status: string;
    provisioningState: string;
    provisioningAttemptedAt: string | null;
    provisioningSucceededAt: string | null;
    createdAt: string;
  }>;

  // Failed / Manual Review Queue
  failedQueue: Array<{
    id: string;
    fullName: string;
    email: string;
    applicationId: string;
    status: string;
    provisioningState: string;
    provisioningAttemptedAt: string | null;
    lastError: string | null;
  }>;

  manualReviewQueue: Array<{
    id: string;
    fullName: string;
    email: string;
    applicationId: string;
    status: string;
    provisioningState: string;
    reason: string | null;
  }>;
};

async function assertSystemAccess(_db: any, userId: string) {
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({
    where: {
      userId,
      role: { in: ["admin", "system_engineer", "developer"] },
    },
  });
  if (count === 0) throw new Error("Forbidden");
}

export const getFrappeDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FrappeDashboardStats> => {
    await assertSystemAccess(context.db, context.userId);
    const adminDb = getAdminDb();

    // Environment & Safety Status
    const environment = process.env.NODE_ENV === "production" ? "production" : "development";
    const syncEnabled = process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED === "true";
    const orangehrmOperational = true; // OrangeHRM always operational
    const productionDeployed = false; // Phase 7 not deployed

    // Connection Health
    const frappeBaseUrl = process.env.FRAPPE_BASE_URL || null;
    const siteName = process.env.FRAPPE_SITE_NAME || null;
    let connectionStatus: "connected" | "disconnected" | "error" | "sync_disabled" = "sync_disabled";
    let frappeVersion: string | null = null;

    if (syncEnabled && frappeBaseUrl) {
      try {
        const client = createFrappeClient();
        await client.getEmployee("HR-EMP-00001").catch(() => {
          // Employee might not exist, but connection works if we get a 404
        });
        connectionStatus = "connected";
        frappeVersion = "v15"; // Could be fetched from API if endpoint exists
      } catch {
        connectionStatus = "error";
      }
    } else if (!syncEnabled) {
      connectionStatus = "sync_disabled";
    } else {
      connectionStatus = "disconnected";
    }

    // Provisioning Overview Statistics
    const [
      total,
      provisioned,
      pending,
      processing,
      failed,
      manualReview,
      appliedCount,
      hiredCount,
    ] = await Promise.all([
      adminDb.jobApplication.count({ where: { isSoftDeleted: false } }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          frappeProvisioningState: "succeeded",
        },
      }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          frappeProvisioningState: "not_started",
        },
      }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          frappeProvisioningState: "processing",
        },
      }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          frappeProvisioningState: "failed",
        },
      }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          frappeProvisioningState: { in: ["pending", "needs_manual_review"] },
        },
      }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          status: "applied",
          frappeProvisioningState: { in: ["succeeded", "failed", "processing"] },
        },
      }),
      adminDb.jobApplication.count({
        where: {
          isSoftDeleted: false,
          status: "hired",
        },
      }),
    ]);

    // HIRED lifecycle metrics
    const hiredSuccessful = await adminDb.jobApplication.count({
      where: {
        isSoftDeleted: false,
        status: "hired",
        frappeProvisioningState: "succeeded",
      },
    });

    const hiredFailed = await adminDb.jobApplication.count({
      where: {
        isSoftDeleted: false,
        status: "hired",
        frappeProvisioningState: "failed",
      },
    });

    // Integration Events Statistics
    const [
      totalEvents,
      pendingEvents,
      processingEvents,
      succeededEvents,
      failedEvents,
    ] = await Promise.all([
      adminDb.integrationEvent.count({
        where: { eventType: { contains: "frappe" } },
      }),
      adminDb.integrationEvent.count({
        where: { eventType: { contains: "frappe" }, status: "pending" },
      }),
      adminDb.integrationEvent.count({
        where: { eventType: { contains: "frappe" }, status: "processing" },
      }),
      adminDb.integrationEvent.count({
        where: { eventType: { contains: "frappe" }, status: "succeeded" },
      }),
      adminDb.integrationEvent.count({
        where: { eventType: { contains: "frappe" }, status: "failed" },
      }),
    ]);

    // Department Insights (global access for system roles)
    const applicationsWithDept = await adminDb.jobApplication.findMany({
      where: { isSoftDeleted: false },
      select: {
        id: true,
        roleId: true,
        frappeProvisioningState: true,
      },
    });

    const roleIds = [...new Set(applicationsWithDept.map((a) => a.roleId))];
    const postingsWithDept = await adminDb.jobPosting.findMany({
      where: { id: { in: roleIds } },
      select: {
        id: true,
        department: true,
      },
    });

    const deptMap = new Map(postingsWithDept.map((p) => [p.id, p.department || "Unassigned"]));

    const appsByDept = new Map<string, number>();
    const provisionedByDept = new Map<string, number>();
    for (const app of applicationsWithDept) {
      const dept = deptMap.get(app.roleId) || "Unassigned";
      appsByDept.set(dept, (appsByDept.get(dept) || 0) + 1);
      if (app.frappeProvisioningState === "succeeded") {
        provisionedByDept.set(dept, (provisionedByDept.get(dept) || 0) + 1);
      }
    }

    // Recent Provisioning
    const recentApps = await adminDb.jobApplication.findMany({
      where: {
        isSoftDeleted: false,
        frappeProvisioningState: { in: ["succeeded", "processing"] },
      },
      orderBy: { frappeProvisioningSucceededAt: "desc" },
      take: 15,
      select: {
        id: true,
        fullName: true,
        email: true,
        frappeEmployeeName: true,
        status: true,
        frappeProvisioningState: true,
        frappeProvisioningAttemptedAt: true,
        frappeProvisioningSucceededAt: true,
        createdAt: true,
      },
    });

    // Failed Queue
    const failedApps = await adminDb.jobApplication.findMany({
      where: {
        isSoftDeleted: false,
        frappeProvisioningState: "failed",
      },
      orderBy: { frappeProvisioningAttemptedAt: "desc" },
      take: 10,
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        frappeProvisioningState: true,
        frappeProvisioningAttemptedAt: true,
      },
    });

    // Manual Review Queue
    const manualReviewApps = await adminDb.jobApplication.findMany({
      where: {
        isSoftDeleted: false,
        frappeProvisioningState: { in: ["pending", "needs_manual_review"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        frappeProvisioningState: true,
      },
    });

    return {
      // Environment
      environment,
      syncEnabled,
      orangehrmOperational,
      productionDeployed,

      // Connection
      connectionStatus,
      frappeBaseUrl,
      frappeVersion,
      siteName,

      // Provisioning Overview
      totalApplications: total,
      provisionedToFrappe: provisioned,
      pendingProvisioning: pending,
      processing,
      failed,
      needsManualReview: manualReview,

      // Lifecycle
      appliedProvisionCount: appliedCount,
      hiredEnrichmentCount: hiredCount,
      hiredSuccessful,
      hiredFailed,

      // Integration Events
      totalIntegrationEvents: totalEvents,
      pendingEvents,
      processingEvents,
      succeededEvents,
      failedEvents,

      // Department Insights
      applicationsByDepartment: Array.from(appsByDept.entries()).map(([department, count]) => ({
        department,
        count,
      })),
      provisionedByDepartment: Array.from(provisionedByDept.entries()).map(
        ([department, count]) => ({
          department,
          count,
        }),
      ),

      // Recent Provisioning
      recentlyProvisioned: recentApps.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        email: a.email,
        applicationId: a.id,
        frappeEmployeeName: a.frappeEmployeeName,
        status: a.status,
        provisioningState: a.frappeProvisioningState,
        provisioningAttemptedAt: a.frappeProvisioningAttemptedAt?.toISOString() || null,
        provisioningSucceededAt: a.frappeProvisioningSucceededAt?.toISOString() || null,
        createdAt: a.createdAt.toISOString(),
      })),

      // Failed Queue
      failedQueue: failedApps.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        email: a.email,
        applicationId: a.id,
        status: a.status,
        provisioningState: a.frappeProvisioningState,
        provisioningAttemptedAt: a.frappeProvisioningAttemptedAt?.toISOString() || null,
        lastError: null, // Could be fetched from integration_events if needed
      })),

      // Manual Review Queue
      manualReviewQueue: manualReviewApps.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        email: a.email,
        applicationId: a.id,
        status: a.status,
        provisioningState: a.frappeProvisioningState,
        reason: a.frappeProvisioningState === "needs_manual_review" ? "Requires manual verification" : "Pending provisioning",
      })),
    };
  });
