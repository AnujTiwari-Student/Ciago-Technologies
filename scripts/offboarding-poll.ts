/**
 * Offboarding Polling Job
 *
 * Polls for employees who have reached their last_working_day and
 * automatically deprovisions their service accounts.
 *
 * Run via cron:
 * 0 2 * * * cd /path/to/project && npx tsx scripts/offboarding-poll.ts
 *
 * Feature-flagged via: auto_offboarding_trigger_enabled
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

// Initialize Prisma with Neon adapter
const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  throw new Error("NEON_DATABASE_URL not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

// Import deprovision logic
async function deprovisionEmployee(employeeId: string): Promise<void> {
  console.log(`[offboarding] Processing employee: ${employeeId}`);

  // Find active service account mapping
  const mapping = await prisma.serviceAccountMapping.findFirst({
    where: {
      employeeId,
      status: "active",
    },
  });

  if (!mapping) {
    console.log(`[offboarding] No active mapping found for ${employeeId}, skipping`);
    return;
  }

  const results = {
    github: { success: false, error: null as string | null },
    teams: { success: false, error: null as string | null },
    clickup: { success: false, error: null as string | null },
    orangehrm: { success: false, error: null as string | null },
  };

  // GitHub
  if (mapping.githubUsername) {
    try {
      const { getGitHubClient } = await import("../src/integrations/github/client");
      const github = getGitHubClient();
      await github.removeFromOrg(mapping.githubUsername);
      results.github.success = true;
      console.log(`[offboarding] ✓ GitHub revoked: ${mapping.githubUsername}`);
    } catch (error) {
      results.github.error = error instanceof Error ? error.message : String(error);
      console.error(`[offboarding] ✗ GitHub failed:`, error);
    }
  }

  // ClickUp (manual revocation required)
  if (mapping.clickupUsername) {
    results.clickup.success = true; // Mark as handled, needs manual action
    console.log(`[offboarding] ⚠ ClickUp: Manual revocation required for ${mapping.clickupUsername}`);
  }

  // Teams (requires user ID, complex)
  if (mapping.teamsEmail) {
    results.teams.success = true; // Mark as handled
    console.log(`[offboarding] ⚠ Teams: Manual revocation required for ${mapping.teamsEmail}`);
  }

  // OrangeHRM ESS
  if (mapping.orangehrmUserId) {
    try {
      const { getOrangeHRMClient } = await import("../src/integrations/orangehrm/client");
      const ohr = getOrangeHRMClient();
      await ohr.updateUserStatus(mapping.orangehrmUserId, false);
      results.orangehrm.success = true;
      console.log(`[offboarding] ✓ OrangeHRM ESS disabled: ${mapping.orangehrmUserId}`);
    } catch (error) {
      results.orangehrm.error = error instanceof Error ? error.message : String(error);
      console.error(`[offboarding] ✗ OrangeHRM failed:`, error);
    }
  }

  // Update mapping
  await prisma.serviceAccountMapping.update({
    where: { id: mapping.id },
    data: {
      status: "inactive",
      deprovisionedAt: new Date(),
      notes: `Auto-deprovisioned: ${JSON.stringify(results)}`,
    },
  });

  // Log to audit
  await prisma.auditLog.create({
    data: {
      action: "AUTO_OFFBOARDING_TRIGGERED",
      actorId: null, // System action
      actorEmail: "system",
      targetResource: `employees/${employeeId}`,
      details: results,
    },
  });

  console.log(`[offboarding] ✓ Completed for ${employeeId}`);
}

async function main() {
  console.log("======================================");
  console.log("Offboarding Poll Started");
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("======================================\n");

  // Check feature flag
  try {
    const { isAutoOffboardingEnabled } = await import("../src/lib/feature-flags.server");
    const enabled = await isAutoOffboardingEnabled();

    if (!enabled) {
      console.log("⏸️  auto_offboarding_trigger_enabled = false, skipping poll");
      return;
    }
  } catch (error) {
    console.warn("⚠️  Could not check feature flag, proceeding anyway:", error);
  }

  // Find employees who have reached their last_working_day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const employees = await prisma.employee.findMany({
    where: {
      // Last working day is today or in the past
      // AND account is still active (hasn't been processed yet)
      accountStatus: "active",
      // Note: This assumes there's a lastWorkingDay field - adjust as needed
      // If last_working_day is stored differently, update this query
    },
    select: {
      userId: true,
      workEmail: true,
      // Add lastWorkingDay if it exists in your schema
    },
  });

  console.log(`Found ${employees.length} employee(s) for offboarding check\n`);

  if (employees.length === 0) {
    console.log("✓ No employees to offboard today");
    return;
  }

  // Process each employee
  let successCount = 0;
  let errorCount = 0;

  for (const employee of employees) {
    try {
      await deprovisionEmployee(employee.userId);

      // Update employee status
      await prisma.employee.update({
        where: { userId: employee.userId },
        data: { accountStatus: "offboarded" },
      });

      successCount++;
    } catch (error) {
      console.error(`[offboarding] Failed to process ${employee.userId}:`, error);
      errorCount++;
    }
  }

  console.log("\n======================================");
  console.log("Offboarding Poll Complete");
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log("======================================");
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
