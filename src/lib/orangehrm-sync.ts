/**
 * OrangeHRM data synchronization helpers
 * Maps our data to OrangeHRM entities (job titles, departments, etc.)
 */

import type { OrangeHRMClient } from "@/integrations/orangehrm/client";

type OrangeHRMJobTitle = { id: number; title: string; deleted: boolean };
type OrangeHRMSubunit = { id: number; name: string; unitId: string };
type OrangeHRMEmploymentStatus = { id: number; name: string };

/**
 * Find or create a job title in OrangeHRM by name
 * Returns the job title ID
 */
export async function findOrCreateJobTitle(
  client: OrangeHRMClient,
  titleName: string,
): Promise<number | null> {
  try {
    const jobTitles = await client.getJobTitles();
    console.log(`[orangehrm-sync] Found ${jobTitles.length} job titles in OrangeHRM`);
    console.log(
      "[orangehrm-sync] Available job titles:",
      jobTitles.map((jt) => jt.title),
    );
    console.log(`[orangehrm-sync] Looking for job title: "${titleName}"`);

    // Try exact match first
    const exactMatch = jobTitles.find(
      (jt) => !jt.deleted && jt.title.toLowerCase() === titleName.toLowerCase(),
    );
    if (exactMatch) {
      console.log(`[orangehrm-sync] Exact match found: ${exactMatch.title} (ID: ${exactMatch.id})`);
      return exactMatch.id;
    }

    // Try partial match
    const partialMatch = jobTitles.find(
      (jt) => !jt.deleted && jt.title.toLowerCase().includes(titleName.toLowerCase()),
    );
    if (partialMatch) {
      console.log(
        `[orangehrm-sync] Partial match found: ${partialMatch.title} (ID: ${partialMatch.id})`,
      );
      return partialMatch.id;
    }

    // No match found - try to create it
    console.log(`[orangehrm-sync] No match found, creating job title: "${titleName}"`);
    try {
      const newJobTitle = await client.createJobTitle(titleName);
      console.log(
        `[orangehrm-sync] ✅ Created job title: ${newJobTitle.title} (ID: ${newJobTitle.id})`,
      );
      return newJobTitle.id;
    } catch (createError: any) {
      console.error(`[orangehrm-sync] ❌ Failed to create job title:`, createError?.message);
      console.warn(
        "[orangehrm-sync] Please add this job title manually in OrangeHRM Admin → Job Titles",
      );
      return null;
    }
  } catch (error: any) {
    console.error("[orangehrm-sync] Failed to get job titles:", error?.message || error);
    return null;
  }
}

/**
 * Find a department/subunit in OrangeHRM by name
 * Returns the subunit ID
 */
export async function findSubunit(
  client: OrangeHRMClient,
  departmentName: string,
): Promise<number | null> {
  try {
    const subunits = await client.getSubunits();
    console.log(`[orangehrm-sync] Found ${subunits.length} sub-units in OrangeHRM`);
    console.log(
      "[orangehrm-sync] Available sub-units:",
      subunits.map((su) => su.name),
    );
    console.log(`[orangehrm-sync] Looking for sub-unit: "${departmentName}"`);

    // Try exact match first
    const exactMatch = subunits.find(
      (su) => su.name.toLowerCase() === departmentName.toLowerCase(),
    );
    if (exactMatch) {
      console.log(`[orangehrm-sync] Exact match found: ${exactMatch.name} (ID: ${exactMatch.id})`);
      return exactMatch.id;
    }

    // Try partial match
    const partialMatch = subunits.find((su) =>
      su.name.toLowerCase().includes(departmentName.toLowerCase()),
    );
    if (partialMatch) {
      console.log(
        `[orangehrm-sync] Partial match found: ${partialMatch.name} (ID: ${partialMatch.id})`,
      );
      return partialMatch.id;
    }

    // No match found - try to create it
    console.log(`[orangehrm-sync] No match found, creating sub-unit: "${departmentName}"`);
    try {
      const newSubunit = await client.createSubunit(departmentName);
      console.log(
        `[orangehrm-sync] ✅ Created sub-unit: ${newSubunit.name} (ID: ${newSubunit.id})`,
      );
      return newSubunit.id;
    } catch (createError: any) {
      console.error(`[orangehrm-sync] ❌ Failed to create sub-unit:`, createError?.message);
      console.warn(
        "[orangehrm-sync] Please add this department manually in OrangeHRM Admin → Organization Structure",
      );
      return null;
    }
  } catch (error: any) {
    console.error("[orangehrm-sync] Failed to get subunits:", error?.message || error);
    return null;
  }
}

/**
 * Find employment status by name
 * Common values: "Full-Time Permanent", "Full-Time Contract", "Part-Time", "Intern"
 */
export async function findEmploymentStatus(
  client: OrangeHRMClient,
  statusName: string,
): Promise<number | null> {
  try {
    const statuses = await client.getEmploymentStatuses();
    console.log(`[orangehrm-sync] Found ${statuses.length} employment statuses in OrangeHRM`);
    console.log(
      "[orangehrm-sync] Available employment statuses:",
      statuses.map((s) => s.name),
    );
    console.log(`[orangehrm-sync] Looking for employment status: "${statusName}"`);

    // Map our employment types to OrangeHRM status names
    const statusMapping: Record<string, string[]> = {
      full_time: ["Full-Time Permanent", "Permanent", "Full Time", "Full-time"],
      contract: ["Full-Time Contract", "Contract", "Contractor"],
      part_time: ["Part-Time", "Part Time"],
      internship: ["Intern", "Internship", "Trainee"],
    };

    const normalized = statusName.toLowerCase().replace(/[\s-_]+/g, "_");
    const searchTerms = statusMapping[normalized] || [statusName];

    // Try exact match
    for (const term of searchTerms) {
      const match = statuses.find((s) => s.name.toLowerCase() === term.toLowerCase());
      if (match) {
        console.log(`[orangehrm-sync] Exact match found: ${match.name} (ID: ${match.id})`);
        return match.id;
      }
    }

    // Try partial match
    for (const term of searchTerms) {
      const match = statuses.find((s) => s.name.toLowerCase().includes(term.toLowerCase()));
      if (match) {
        console.log(`[orangehrm-sync] Partial match found: ${match.name} (ID: ${match.id})`);
        return match.id;
      }
    }

    // No match found - try to create it with a standard name
    const statusToCreate = searchTerms[0]; // Use the first search term
    console.log(`[orangehrm-sync] No match found, creating employment status: "${statusToCreate}"`);
    try {
      const newStatus = await client.createEmploymentStatus(statusToCreate);
      console.log(
        `[orangehrm-sync] ✅ Created employment status: ${newStatus.name} (ID: ${newStatus.id})`,
      );
      return newStatus.id;
    } catch (createError: any) {
      console.error(
        `[orangehrm-sync] ❌ Failed to create employment status:`,
        createError?.message,
      );
      console.warn(
        "[orangehrm-sync] Please add employment status manually in OrangeHRM Admin → Employment Status",
      );
      return null;
    }
  } catch (error: any) {
    console.error("[orangehrm-sync] Failed to get employment statuses:", error?.message || error);
    return null;
  }
}

/**
 * Full employee provisioning with all details
 */
export async function provisionEmployeeInOrangeHRM(
  client: OrangeHRMClient,
  data: {
    fullName: string;
    email: string;
    jobTitle: string;
    employmentType: string;
    department?: string | null;
    startDate?: Date | null;
  },
): Promise<{
  empNumber: number;
  employeeId: string;
  details: {
    jobTitleId?: number;
    empStatusId?: number;
    subUnitId?: number;
  };
}> {
  // Parse name
  const nameParts = data.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || data.fullName;
  const lastName = nameParts.slice(1).join(" ") || "";

  // Step 1: Create basic employee
  const employee = await client.createEmployee({
    firstName,
    lastName,
  });

  const details: {
    jobTitleId?: number;
    empStatusId?: number;
    subUnitId?: number;
  } = {};

  // Step 2: Look up IDs for job title, department, employment status
  console.log("[orangehrm-sync] Looking up IDs for:", {
    jobTitle: data.jobTitle,
    department: data.department,
    employmentType: data.employmentType,
  });

  const [jobTitleId, subUnitId, empStatusId] = await Promise.all([
    findOrCreateJobTitle(client, data.jobTitle),
    data.department ? findSubunit(client, data.department) : null,
    findEmploymentStatus(client, data.employmentType),
  ]);

  console.log("[orangehrm-sync] Found IDs:", {
    jobTitleId,
    subUnitId,
    empStatusId,
  });

  if (jobTitleId) details.jobTitleId = jobTitleId;
  if (subUnitId) details.subUnitId = subUnitId;
  if (empStatusId) details.empStatusId = empStatusId;

  // Step 3: Update job details
  try {
    const joinedDate = data.startDate
      ? data.startDate.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const jobDetailsPayload = {
      jobTitleId: details.jobTitleId,
      empStatusId: details.empStatusId,
      subUnitId: details.subUnitId,
      joinedDate,
    };

    console.log("[orangehrm-sync] Updating job details with:", jobDetailsPayload);

    await client.updateEmployeeJobDetails(employee.empNumber, jobDetailsPayload);
    console.log("[orangehrm-sync] Job details updated successfully");
  } catch (error: any) {
    console.error("[orangehrm-sync] Job details update failed:", error?.message || error);
    console.error("[orangehrm-sync] Full error:", error);
    // Continue - basic employee created
  }

  // Step 4: Update contact details
  try {
    const contactPayload = {
      workEmail: data.email,
      otherEmail: data.email,
    };

    console.log("[orangehrm-sync] Updating contact details with:", contactPayload);

    await client.updateEmployeeContactDetails(employee.empNumber, contactPayload);
    console.log("[orangehrm-sync] Contact details updated successfully");
  } catch (error: any) {
    console.error("[orangehrm-sync] Contact details update failed:", error?.message || error);
    console.error("[orangehrm-sync] Full error:", error);
    // Continue - basic employee created
  }

  return {
    empNumber: employee.empNumber,
    employeeId: employee.employeeId,
    details,
  };
}
