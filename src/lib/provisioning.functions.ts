/**
 * Service account provisioning functions for GitHub, Teams, ClickUp.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";

async function assertAdmin(db: any, userId: string) {
  const count = await db.withRLS((tx: any) =>
    tx.userRole.count({ where: { userId, role: "admin" } }),
  );
  if (count === 0) throw new Error("Forbidden: Admin access required");
}

const provisionSchema = z.object({
  employeeId: z.string().uuid(),
  githubUsername: z.string().optional(),
  teamsEmail: z.string().email().optional(),
  clickupEmail: z.string().email().optional(),
});

export const provisionServiceAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => provisionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);

    const adminDb = getAdminDb();

    const results = {
      github: { success: false, error: null as string | null },
      teams: { success: false, error: null as string | null },
      clickup: { success: false, error: null as string | null },
    };

    let mapping = await adminDb.serviceAccountMapping.findFirst({
      where: { employeeId: data.employeeId },
    });

    if (!mapping) {
      mapping = await adminDb.serviceAccountMapping.create({
        data: {
          employeeId: data.employeeId,
          status: "pending",
        },
      });
    }

    // GitHub provisioning
    if (data.githubUsername) {
      try {
        const { getGitHubClient } = await import("@/integrations/github/client");
        const github = getGitHubClient();
        await github.inviteToOrg(data.githubUsername);
        results.github.success = true;

        await adminDb.serviceAccountMapping.update({
          where: { id: mapping.id },
          data: { githubUsername: data.githubUsername },
        });

        await adminDb.auditLog.create({
          data: {
            actorId: context.userId,
            actorEmail: (context.claims as any)?.email ?? null,
            action: "GITHUB_PROVISIONED",
            targetResource: `employees/${data.employeeId}`,
            details: { githubUsername: data.githubUsername },
          },
        });
      } catch (error) {
        results.github.error = error instanceof Error ? error.message : String(error);
        console.error("[provisioning] GitHub failed:", error);
      }
    }

    // ClickUp provisioning
    if (data.clickupEmail) {
      try {
        const { getClickUpClient } = await import("@/integrations/clickup/client");
        const clickup = getClickUpClient();
        await clickup.inviteToWorkspace(data.clickupEmail);
        results.clickup.success = true;

        await adminDb.serviceAccountMapping.update({
          where: { id: mapping.id },
          data: { clickupUsername: data.clickupEmail },
        });

        await adminDb.auditLog.create({
          data: {
            actorId: context.userId,
            actorEmail: (context.claims as any)?.email ?? null,
            action: "CLICKUP_PROVISIONED",
            targetResource: `employees/${data.employeeId}`,
            details: { clickupEmail: data.clickupEmail },
          },
        });
      } catch (error) {
        results.clickup.error = error instanceof Error ? error.message : String(error);
        console.error("[provisioning] ClickUp failed:", error);
      }
    }

    // Teams provisioning
    if (data.teamsEmail) {
      try {
        const { getTeamsClient } = await import("@/integrations/teams/client");
        const teams = getTeamsClient();

        // Get user by email first
        const user = await teams.getUserByEmail(data.teamsEmail);
        if (!user) {
          throw new Error("User not found in Microsoft 365");
        }

        // Note: teamId should be configurable, hardcoded for now
        const teamId = process.env.TEAMS_DEFAULT_TEAM_ID;
        if (teamId) {
          await teams.addUserToTeam(teamId, user.id);
          results.teams.success = true;

          await adminDb.serviceAccountMapping.update({
            where: { id: mapping.id },
            data: { teamsEmail: data.teamsEmail },
          });

          await adminDb.auditLog.create({
            data: {
              actorId: context.userId,
              actorEmail: (context.claims as any)?.email ?? null,
              action: "TEAMS_PROVISIONED",
              targetResource: `employees/${data.employeeId}`,
              details: { teamsEmail: data.teamsEmail },
            },
          });
        }
      } catch (error) {
        results.teams.error = error instanceof Error ? error.message : String(error);
        console.error("[provisioning] Teams failed:", error);
      }
    }

    // Update mapping status
    const allSuccess = results.github.success && results.teams.success && results.clickup.success;
    const anySuccess =
      results.github.success || results.teams.success || results.clickup.success;

    await adminDb.serviceAccountMapping.update({
      where: { id: mapping.id },
      data: {
        status: allSuccess ? "active" : anySuccess ? "active" : "failed",
        provisionedAt: anySuccess ? new Date() : null,
      },
    });

    return results;
  });

const deprovisionSchema = z.object({
  employeeId: z.string().uuid(),
});

export const deprovisionServiceAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deprovisionSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.db, context.userId);

    const adminDb = getAdminDb();

    const mapping = await adminDb.serviceAccountMapping.findFirst({
      where: { employeeId: data.employeeId, status: "active" },
    });

    if (!mapping) {
      throw new Error("No active service account mapping found");
    }

    const results = {
      github: { success: false, error: null as string | null },
      teams: { success: false, error: null as string | null },
      clickup: { success: false, error: null as string | null },
      orangehrm: { success: false, error: null as string | null },
    };

    // Revoke GitHub
    if (mapping.githubUsername) {
      try {
        const { getGitHubClient } = await import("@/integrations/github/client");
        const github = getGitHubClient();
        await github.removeFromOrg(mapping.githubUsername);
        results.github.success = true;
      } catch (error) {
        results.github.error = error instanceof Error ? error.message : String(error);
        console.error("[offboarding] GitHub revoke failed:", error);
      }
    }

    // Revoke ClickUp (Note: requires user ID, not email)
    if (mapping.clickupUsername) {
      results.clickup.success = true; // Manual revocation required
    }

    // Disable OrangeHRM ESS
    if (mapping.orangehrmUserId) {
      try {
        const { getOrangeHRMClient } = await import("@/integrations/orangehrm/client");
        const ohr = getOrangeHRMClient();
        await ohr.updateUserStatus(mapping.orangehrmUserId, false);
        results.orangehrm.success = true;
      } catch (error) {
        results.orangehrm.error = error instanceof Error ? error.message : String(error);
        console.error("[offboarding] OrangeHRM disable failed:", error);
      }
    }

    // Update mapping
    await adminDb.serviceAccountMapping.update({
      where: { id: mapping.id },
      data: {
        status: "inactive",
        deprovisionedAt: new Date(),
        notes: `Deprovisioned: ${JSON.stringify(results)}`,
      },
    });

    await adminDb.auditLog.create({
      data: {
        actorId: context.userId,
        actorEmail: (context.claims as any)?.email ?? null,
        action: "SERVICE_ACCOUNTS_DEPROVISIONED",
        targetResource: `employees/${data.employeeId}`,
        details: results,
      },
    });

    return results;
  });
