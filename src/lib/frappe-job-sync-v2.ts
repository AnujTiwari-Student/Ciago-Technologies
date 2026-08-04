/**
 * Frappe Job Opening Sync V2
 *
 * Hybrid approach: Fetches real Frappe master data, uses intelligent matching,
 * stores audit trail, never silently mislabels jobs.
 */

import type { PrismaClient } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";
import { getFrappeMasterData } from "./frappe-master-cache";
import { matchDesignation, matchDepartment, matchEmploymentType } from "./frappe-field-matcher";

export async function syncJobPostingToFrappe(
  db: PrismaClient,
  client: FrappeClient,
  jobPostingId: string
): Promise<void> {
  const logPrefix = `[frappe-job-sync-v2:${jobPostingId.slice(0, 8)}]`;

  // Load the job posting
  const posting = await db.jobPosting.findUnique({
    where: { id: jobPostingId },
  });

  if (!posting) {
    throw new Error(`Job posting ${jobPostingId} not found`);
  }

  console.log(`${logPrefix} Syncing to Frappe:`, {
    title: posting.title,
    designation: posting.designation,
    department: posting.department,
    employmentType: posting.employmentType,
    existingFrappeId: posting.frappeJobOpeningName,
  });

  // Check if auto-create is enabled
  const autoCreateRecords = process.env.AUTO_CREATE_RECORDS !== 'false';
  console.log(`${logPrefix} AUTO_CREATE_RECORDS=${autoCreateRecords}`);

  // Fetch real Frappe master data
  const masterData = await getFrappeMasterData(client);

  console.log(`${logPrefix} Available in Frappe:`, {
    designations: masterData.designations.length,
    departments: masterData.departments.length,
    employmentTypes: masterData.employmentTypes.length,
  });

  // Match fields using intelligent matching
  let designationResult, departmentResult, employmentTypeResult;

  try {
    designationResult = await matchDesignation(
      posting.designation || posting.title,
      masterData.designations,
      client,
      autoCreateRecords,
      logPrefix
    );

    departmentResult = await matchDepartment(
      posting.department,
      masterData.departments,
      client,
      'Ciago Technologies',
      autoCreateRecords,
      logPrefix
    );

    employmentTypeResult = matchEmploymentType(
      posting.employmentType,
      masterData.employmentTypes,
      logPrefix
    );
  } catch (error) {
    console.error(`${logPrefix} Field matching failed:`, error);
    throw error;
  }

  // Check if any field is held for review
  if (
    designationResult.confidence === 'held_for_review' ||
    departmentResult.confidence === 'held_for_review'
  ) {
    console.warn(`${logPrefix} Job Opening held for review - manual mapping required`);

    // TODO: Send alert to HR admin (Slack/email)
    // For now, just throw an error
    throw new Error(
      `Job posting held for review: Designation "${posting.designation}" or Department "${posting.department}" requires manual mapping. AUTO_CREATE_RECORDS is disabled.`
    );
  }

  // Determine overall mapping confidence (use the lowest confidence level)
  const confidencePriority = { exact_match: 3, fuzzy_match: 2, auto_created: 1, held_for_review: 0 };
  const overallConfidence = [designationResult, departmentResult].reduce((lowest, result) => {
    return confidencePriority[result.confidence] < confidencePriority[lowest.confidence]
      ? result
      : lowest;
  }).confidence;

  // Map status
  let frappeStatus: "Open" | "Closed" = "Open";
  if (posting.status === "closed" || posting.status === "archived") {
    frappeStatus = "Closed";
  }

  const publishOnWebsite = posting.status === "published" ? 1 : 0;

  // Build payload with audit trail fields
  const payload = {
    job_title: posting.title,
    designation: designationResult.mappedValue,
    department: departmentResult.mappedValue,
    employment_type: employmentTypeResult.mappedValue,
    status: frappeStatus,
    company: "Ciago Technologies",
    description: `<p><strong>Summary:</strong></p><p>${posting.summary}</p><p><strong>Description:</strong></p><p>${posting.description.replace(/\n/g, "<br>")}</p>`,
    publish_on_website: publishOnWebsite,
    currency: "INR",
    salary_paid_per: "Month",
    lower_range: posting.salaryMinInr ? Number(posting.salaryMinInr) : null,
    upper_range: posting.salaryMaxInr ? Number(posting.salaryMaxInr) : null,
    publish_salary_range: posting.publishSalaryRange ? 1 : 0,
    closes_on: posting.closesOn ? posting.closesOn.toISOString().split("T")[0] : null,

    // AUDIT TRAIL: Store original values and mapping confidence
    external_designation_raw: posting.designation || posting.title,
    external_department_raw: posting.department,
    external_employment_type_raw: posting.employmentType,
    mapping_confidence: overallConfidence,
  };

  console.log(`${logPrefix} Final mapping:`, {
    designation: `"${posting.designation}" → "${designationResult.mappedValue}" (${designationResult.confidence})`,
    department: `"${posting.department}" → "${departmentResult.mappedValue}" (${departmentResult.confidence})`,
    employmentType: `"${posting.employmentType}" → "${employmentTypeResult.mappedValue}" (${employmentTypeResult.confidence})`,
    overallConfidence,
  });

  if (posting.frappeJobOpeningName) {
    // Update existing
    console.log(`${logPrefix} Updating existing Job Opening ${posting.frappeJobOpeningName}`);
    try {
      await client.updateJobOpening(posting.frappeJobOpeningName, payload);
      console.log(`${logPrefix} ✅ Updated successfully`);
    } catch (err) {
      console.error(`${logPrefix} ❌ Failed to update:`, err);
      throw err;
    }
  } else {
    // Create new
    console.log(`${logPrefix} Creating new Job Opening`);
    try {
      const created = await client.createJobOpening(payload);
      console.log(`${logPrefix} ✅ Created: ${created.name}`);

      // Store the Frappe ID back
      await db.jobPosting.update({
        where: { id: jobPostingId },
        data: { frappeJobOpeningName: created.name },
      });
    } catch (err) {
      console.error(`${logPrefix} ❌ Failed to create:`, err);
      throw err;
    }
  }
}
