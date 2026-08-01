/**
 * Sync job postings to OrangeHRM job vacancies
 * Includes: title, description, requirements, salary range, status, location, etc.
 */

import type { OrangeHRMClient } from "@/integrations/orangehrm/client";
import { getAdminDb } from "@/lib/db/admin";
import { findOrCreateJobTitle } from "@/lib/orangehrm-sync";

type JobPostingData = {
  id: string;
  title: string;
  summary: string;
  description: string;
  department: string;
  employmentType: string;
  location: string;
  isRemote: boolean;
  internalOnly: boolean;
  jobCode: string | null;
  status: string;
  tags: string[];
  requirements: string[];
  salaryMinInr: number | null;
  salaryMaxInr: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Build comprehensive job description for OrangeHRM from our job posting
 */
function buildJobDescription(posting: JobPostingData): string {
  const sections: string[] = [];

  // Summary
  sections.push(`**Summary**\n${posting.summary}\n`);

  // Description
  sections.push(`**Description**\n${posting.description}\n`);

  // Requirements
  if (posting.requirements && posting.requirements.length > 0) {
    sections.push(`**Requirements**`);
    posting.requirements.forEach((req) => {
      sections.push(`• ${req}`);
    });
    sections.push("");
  }

  // Job Details
  sections.push(`**Job Details**`);
  sections.push(`• Department: ${posting.department}`);
  sections.push(`• Employment Type: ${posting.employmentType}`);
  sections.push(`• Location: ${posting.location}${posting.isRemote ? " (Remote)" : ""}`);

  if (posting.salaryMinInr || posting.salaryMaxInr) {
    const salaryRange = posting.salaryMinInr && posting.salaryMaxInr
      ? `₹${posting.salaryMinInr.toLocaleString("en-IN")} - ₹${posting.salaryMaxInr.toLocaleString("en-IN")}`
      : posting.salaryMinInr
        ? `Starting from ₹${posting.salaryMinInr.toLocaleString("en-IN")}`
        : `Up to ₹${posting.salaryMaxInr?.toLocaleString("en-IN")}`;
    sections.push(`• Salary Range: ${salaryRange}`);
  }

  // Tags
  if (posting.tags && posting.tags.length > 0) {
    sections.push(`\n**Skills & Tags**`);
    sections.push(posting.tags.join(", "));
  }

  // Internal Only indicator
  if (posting.internalOnly) {
    sections.push(`\n*Note: Internal candidates only*`);
  }

  return sections.join("\n");
}

/**
 * Determine if job should be published based on status
 */
function shouldPublishJob(status: string, internalOnly: boolean): {
  isPublished: boolean;
  status: boolean;
} {
  const statusLower = status.toLowerCase();

  if (statusLower === "published") {
    return {
      isPublished: true,
      status: true, // active
    };
  }

  if (statusLower === "internal_only") {
    return {
      isPublished: true,
      status: true,
    };
  }

  if (statusLower === "closed" || statusLower === "archived") {
    return {
      isPublished: false,
      status: false, // closed
    };
  }

  // Draft or unknown - not published
  return {
    isPublished: false,
    status: false,
  };
}

/**
 * Sync a single job posting to OrangeHRM
 */
export async function syncJobPostingToOrangeHRM(
  client: OrangeHRMClient,
  posting: JobPostingData
): Promise<{
  vacancyId: number;
  action: "created" | "updated" | "skipped";
}> {
  console.log(`[orangehrm-job-sync] 📋 Syncing job: "${posting.title}"`);

  // Step 1: Ensure job title exists
  const jobTitleId = await findOrCreateJobTitle(client, posting.title);
  if (!jobTitleId) {
    throw new Error(`Failed to create/find job title for: ${posting.title}`);
  }

  // Step 2: Build comprehensive description
  const description = buildJobDescription(posting);

  // Step 3: Determine publish status
  const publishSettings = shouldPublishJob(posting.status, posting.internalOnly);

  // Step 4: Check if vacancy already exists (by job title and name)
  const existingVacancies = await client.getJobVacancies();
  const existingVacancy = existingVacancies.find(
    (v) => v.jobTitleId === jobTitleId && v.name === posting.title
  );

  const payload = {
    jobTitleId,
    name: posting.title,
    description,
    numOfPositions: 1, // Default, can be customized
    ...publishSettings,
  };

  if (existingVacancy) {
    // Update existing vacancy
    console.log(`[orangehrm-job-sync] 🔄 Updating existing vacancy (ID: ${existingVacancy.id})`);
    await client.updateJobVacancy(existingVacancy.id, payload);
    return { vacancyId: existingVacancy.id, action: "updated" };
  } else {
    // Create new vacancy
    console.log(`[orangehrm-job-sync] ✨ Creating new vacancy`);
    const newVacancy = await client.createJobVacancy(payload);
    return { vacancyId: newVacancy.id, action: "created" };
  }
}

/**
 * Sync all job postings from our system to OrangeHRM
 */
export async function syncAllJobPostingsToOrangeHRM(
  client: OrangeHRMClient,
  options: {
    includeArchived?: boolean;
    includeDraft?: boolean;
  } = {}
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  failed: Array<{ title: string; error: string }>;
}> {
  console.log("\n" + "=".repeat(60));
  console.log("📋 SYNCING JOB POSTINGS TO ORANGEHRM");
  console.log("=".repeat(60) + "\n");

  const adminDb = getAdminDb();

  // Build filter based on options
  const statusFilter: string[] = ["published", "internal_only"];
  if (options.includeDraft) statusFilter.push("draft");
  if (options.includeArchived) statusFilter.push("archived", "closed");

  const postings = await adminDb.jobPosting.findMany({
    where: {
      status: { in: statusFilter as any },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${postings.length} job postings to sync\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const failed: Array<{ title: string; error: string }> = [];

  for (const posting of postings) {
    try {
      const result = await syncJobPostingToOrangeHRM(client, posting);

      if (result.action === "created") {
        console.log(`✅ Created vacancy: "${posting.title}" (ID: ${result.vacancyId})\n`);
        created++;
      } else if (result.action === "updated") {
        console.log(`✅ Updated vacancy: "${posting.title}" (ID: ${result.vacancyId})\n`);
        updated++;
      } else {
        skipped++;
      }
    } catch (error: any) {
      console.error(`❌ Failed to sync "${posting.title}":`, error?.message || error);
      failed.push({
        title: posting.title,
        error: error?.message || String(error),
      });
    }
  }

  console.log("=".repeat(60));
  console.log("✅ JOB POSTING SYNC COMPLETE");
  console.log("=".repeat(60));
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\n❌ Failed job postings:");
    failed.forEach((f) => {
      console.log(`   - ${f.title}: ${f.error}`);
    });
  }

  console.log("=".repeat(60) + "\n");

  return { created, updated, skipped, failed };
}
