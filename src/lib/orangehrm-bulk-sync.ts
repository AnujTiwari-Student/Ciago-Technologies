/**
 * Bulk sync our data to OrangeHRM
 * Syncs departments, employment types, and optionally job titles
 */

import type { OrangeHRMClient } from "@/integrations/orangehrm/client";
import { getAdminDb } from "@/lib/db/admin";

/**
 * Sync all departments from our database to OrangeHRM
 */
export async function syncDepartmentsToOrangeHRM(client: OrangeHRMClient): Promise<{
  created: number;
  existed: number;
  failed: string[];
}> {
  console.log("[orangehrm-bulk-sync] 🔄 Syncing departments to OrangeHRM...");

  const adminDb = getAdminDb();
  const ourDepartments = await adminDb.department.findMany({
    select: { name: true, code: true },
  });

  const ohrSubunits = await client.getSubunits();
  const existingNames = new Set(ohrSubunits.map((su) => su.name.toLowerCase()));

  let created = 0;
  let existed = 0;
  const failed: string[] = [];

  for (const dept of ourDepartments) {
    if (existingNames.has(dept.name.toLowerCase())) {
      console.log(`[orangehrm-bulk-sync] ✓ Department already exists: ${dept.name}`);
      existed++;
      continue;
    }

    try {
      const newSubunit = await client.createSubunit(dept.name);
      console.log(
        `[orangehrm-bulk-sync] ✅ Created department: ${newSubunit.name} (ID: ${newSubunit.id})`,
      );
      created++;
    } catch (error: any) {
      console.error(
        `[orangehrm-bulk-sync] ❌ Failed to create department "${dept.name}":`,
        error?.message,
      );
      failed.push(dept.name);
    }
  }

  return { created, existed, failed };
}

/**
 * Sync standard employment statuses to OrangeHRM
 */
export async function syncEmploymentStatusesToOrangeHRM(client: OrangeHRMClient): Promise<{
  created: number;
  existed: number;
  failed: string[];
}> {
  console.log("[orangehrm-bulk-sync] 🔄 Syncing employment statuses to OrangeHRM...");

  // Standard employment statuses we use
  const standardStatuses = [
    "Full-Time Permanent",
    "Full-Time Contract",
    "Part-Time",
    "Intern",
    "Contract",
  ];

  const ohrStatuses = await client.getEmploymentStatuses();
  const existingNames = new Set(ohrStatuses.map((s) => s.name.toLowerCase()));

  let created = 0;
  let existed = 0;
  const failed: string[] = [];

  for (const statusName of standardStatuses) {
    if (existingNames.has(statusName.toLowerCase())) {
      console.log(`[orangehrm-bulk-sync] ✓ Employment status already exists: ${statusName}`);
      existed++;
      continue;
    }

    try {
      const newStatus = await client.createEmploymentStatus(statusName);
      console.log(
        `[orangehrm-bulk-sync] ✅ Created employment status: ${newStatus.name} (ID: ${newStatus.id})`,
      );
      created++;
    } catch (error: any) {
      console.error(
        `[orangehrm-bulk-sync] ❌ Failed to create status "${statusName}":`,
        error?.message,
      );
      failed.push(statusName);
    }
  }

  return { created, existed, failed };
}

/**
 * Sync all job titles from our job postings to OrangeHRM
 */
export async function syncJobTitlesToOrangeHRM(client: OrangeHRMClient): Promise<{
  created: number;
  existed: number;
  failed: string[];
}> {
  console.log("[orangehrm-bulk-sync] 🔄 Syncing job titles to OrangeHRM...");

  const adminDb = getAdminDb();

  // Get unique job titles from our job postings
  const postings = await adminDb.jobPosting.findMany({
    select: { title: true },
    distinct: ["title"],
  });

  const ohrJobTitles = await client.getJobTitles();
  const existingTitles = new Set(
    ohrJobTitles.filter((jt) => !jt.deleted).map((jt) => jt.title.toLowerCase()),
  );

  let created = 0;
  let existed = 0;
  const failed: string[] = [];

  for (const posting of postings) {
    if (existingTitles.has(posting.title.toLowerCase())) {
      console.log(`[orangehrm-bulk-sync] ✓ Job title already exists: ${posting.title}`);
      existed++;
      continue;
    }

    try {
      const newJobTitle = await client.createJobTitle(posting.title);
      console.log(
        `[orangehrm-bulk-sync] ✅ Created job title: ${newJobTitle.title} (ID: ${newJobTitle.id})`,
      );
      created++;
    } catch (error: any) {
      console.error(
        `[orangehrm-bulk-sync] ❌ Failed to create job title "${posting.title}":`,
        error?.message,
      );
      failed.push(posting.title);
    }
  }

  return { created, existed, failed };
}

/**
 * Full sync - departments, employment statuses, and job titles
 */
export async function fullSyncToOrangeHRM(client: OrangeHRMClient): Promise<{
  departments: { created: number; existed: number; failed: string[] };
  employmentStatuses: { created: number; existed: number; failed: string[] };
  jobTitles: { created: number; existed: number; failed: string[] };
}> {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 FULL SYNC TO ORANGEHRM");
  console.log("=".repeat(60) + "\n");

  const departments = await syncDepartmentsToOrangeHRM(client);
  console.log("\n");

  const employmentStatuses = await syncEmploymentStatusesToOrangeHRM(client);
  console.log("\n");

  const jobTitles = await syncJobTitlesToOrangeHRM(client);
  console.log("\n");

  console.log("=".repeat(60));
  console.log("✅ SYNC COMPLETE");
  console.log("=".repeat(60));
  console.log(
    `Departments: ${departments.created} created, ${departments.existed} existed, ${departments.failed.length} failed`,
  );
  console.log(
    `Employment Statuses: ${employmentStatuses.created} created, ${employmentStatuses.existed} existed, ${employmentStatuses.failed.length} failed`,
  );
  console.log(
    `Job Titles: ${jobTitles.created} created, ${jobTitles.existed} existed, ${jobTitles.failed.length} failed`,
  );
  console.log("=".repeat(60) + "\n");

  return { departments, employmentStatuses, jobTitles };
}
