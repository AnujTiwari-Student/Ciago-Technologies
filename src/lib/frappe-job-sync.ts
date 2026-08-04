/**
 * Frappe Job Opening Sync
 *
 * Syncs job_postings table to Frappe Job Opening doctype.
 * Called from jobPostings.functions.ts after upsert.
 */

import type { PrismaClient } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";

export async function syncJobPostingToFrappe(
  db: PrismaClient,
  client: FrappeClient,
  jobPostingId: string
): Promise<void> {
  const logPrefix = `[frappe-job-sync:${jobPostingId.slice(0, 8)}]`;

  // Load the job posting
  const posting = await db.jobPosting.findUnique({
    where: { id: jobPostingId },
  });

  if (!posting) {
    throw new Error(`Job posting ${jobPostingId} not found`);
  }

  console.log(`${logPrefix} Syncing to Frappe`, {
    title: posting.title,
    existingFrappeId: posting.frappeJobOpeningName,
  });

  // Map status: published → Open, closed/archived → Closed, draft/internal_only → Open (but not published on website)
  let frappeStatus: "Open" | "Closed" = "Open";
  if (posting.status === "closed" || posting.status === "archived") {
    frappeStatus = "Closed";
  }

  // Publish on website only if status = published
  const publishOnWebsite = posting.status === "published" ? 1 : 0;

  // DYNAMIC EMPLOYMENT TYPE MAPPING
  // Map to exact Frappe HR employment types: Apprentice, Commission, Contract, Full-time, Intern, Internship, Part-time, Piecework, Probation
  function normalizeEmploymentType(type: string): string {
    const normalized = type.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();

    // Map to Frappe exact employment types
    if (normalized.includes('apprentice')) return 'Apprentice';
    if (normalized.includes('intern')) return 'Internship';  // Use 'Internship' not 'Intern'
    if (normalized.includes('full') || normalized.includes('permanent')) return 'Full-time';
    if (normalized.includes('part')) return 'Part-time';
    if (normalized.includes('contract') || normalized.includes('contractor')) return 'Contract';
    if (normalized.includes('freelance')) return 'Contract';
    if (normalized.includes('temporary') || normalized.includes('temp')) return 'Contract';
    if (normalized.includes('probation') || normalized.includes('probationary')) return 'Probation';
    if (normalized.includes('commission')) return 'Commission';
    if (normalized.includes('piece') || normalized.includes('piecework')) return 'Piecework';

    // Fallback: Use 'Contract' for unknown types (safest option)
    console.log(`${logPrefix} Unknown employment type "${type}", using fallback: Contract`);
    return 'Contract';
  }
  const mappedEmploymentType = normalizeEmploymentType(posting.employmentType);

  // SMART DEPARTMENT MAPPING
  // Map common department names to Frappe standard departments
  function normalizeDepartment(dept: string): string {
    if (dept.includes(' - CT')) return dept; // Already formatted

    const lower = dept.toLowerCase().trim();

    // Map common variations to standard Frappe departments
    const deptMap: Record<string, string> = {
      'engineering': 'Engineering - CT',
      'tech': 'Engineering - CT',
      'technology': 'Engineering - CT',
      'development': 'Engineering - CT',
      'it': 'Engineering - CT',
      'hr': 'Human Resources - CT',
      'human resources': 'Human Resources - CT',
      'people': 'Human Resources - CT',
      'sales': 'Sales - CT',
      'business development': 'Sales - CT',
      'marketing': 'Marketing - CT',
      'finance': 'Accounts - CT',
      'accounting': 'Accounts - CT',
      'accounts': 'Accounts - CT',
      'operations': 'Operations - CT',
      'ops': 'Operations - CT',
      'customer service': 'Customer Service - CT',
      'support': 'Customer Service - CT',
      'legal': 'Legal - CT',
      'management': 'Management - CT',
      'admin': 'Management - CT',
      'administration': 'Management - CT',
      'research': 'Research & Development - CT',
      'r&d': 'Research & Development - CT',
      'quality': 'Quality Management - CT',
      'qa': 'Quality Management - CT',
      'production': 'Production - CT',
      'manufacturing': 'Production - CT',
      'purchase': 'Purchase - CT',
      'procurement': 'Purchase - CT',
      'dispatch': 'Dispatch - CT',
      'logistics': 'Dispatch - CT',
    };

    // Try to find exact match
    if (deptMap[lower]) return deptMap[lower];

    // Try to find partial match
    for (const [key, value] of Object.entries(deptMap)) {
      if (lower.includes(key)) return value;
    }

    // Fallback: Add - CT suffix to original name
    return `${dept} - CT`;
  }
  const mappedDepartment = normalizeDepartment(posting.department);

  console.log(`${logPrefix} Employment Type: ${posting.employmentType} → ${mappedEmploymentType}`);
  console.log(`${logPrefix} Department: ${posting.department} → ${mappedDepartment}`);

  // SMART DESIGNATION MAPPING - Keyword-based matching
  function findBestDesignation(title: string | null | undefined): string {
    if (!title) return 'Manager';

    const lower = title.toLowerCase();

    // Keyword-based matching for common roles
    if (lower.includes('engineer') || lower.includes('developer') || lower.includes('programmer')) return 'Engineer';
    if (lower.includes('analyst') || lower.includes('data scientist')) return 'Analyst';
    if (lower.includes('designer') || lower.includes('ui') || lower.includes('ux')) return 'Designer';
    if (lower.includes('hr') || lower.includes('human resource') || lower.includes('recruiter')) return 'HR Manager';
    if (lower.includes('accountant') || lower.includes('finance') && !lower.includes('manager')) return 'Accountant';
    if (lower.includes('sales') || lower.includes('business development')) return 'Business Development Manager';
    if (lower.includes('marketing')) return 'Head of Marketing and Sales';
    if (lower.includes('manager') || lower.includes('lead') || lower.includes('head')) return 'Manager';
    if (lower.includes('executive') || lower.includes('specialist') || lower.includes('officer')) return 'Executive Assistant';
    if (lower.includes('consultant')) return 'Consultant';
    if (lower.includes('assistant')) return 'Administrative Assistant';
    if (lower.includes('intern')) return 'Engineer'; // Interns default to Engineer

    // Fallback: Use generic "Manager" for unknown roles
    console.log(`${logPrefix} No designation match for "${title}", using fallback: Manager`);
    return 'Manager';
  }
  const mappedDesignation = findBestDesignation(posting.designation || posting.title);

  console.log(`${logPrefix} Designation: ${posting.designation || posting.title} → ${mappedDesignation}`);
  console.log(`${logPrefix} Mapped payload ready for Frappe`);

  const payload = {
    job_title: posting.title,
    designation: mappedDesignation,
    status: frappeStatus,
    company: "Ciago Technologies",
    employment_type: mappedEmploymentType,
    department: mappedDepartment,
    // location: posting.location, // Skipped - Frappe Location link validation is strict
    description: `<p><strong>Summary:</strong></p><p>${posting.summary}</p><p><strong>Description:</strong></p><p>${posting.description.replace(/\n/g, "<br>")}</p>`,
    publish_on_website: publishOnWebsite,
    currency: "INR",
    salary_paid_per: "Month",
    lower_range: posting.salaryMinInr ? Number(posting.salaryMinInr) : null,
    upper_range: posting.salaryMaxInr ? Number(posting.salaryMaxInr) : null,
    publish_salary_range: posting.publishSalaryRange ? 1 : 0,
    closes_on: posting.closesOn ? posting.closesOn.toISOString().split("T")[0] : null,
  };

  if (posting.frappeJobOpeningName) {
    // Update existing
    console.log(`${logPrefix} Updating existing Job Opening ${posting.frappeJobOpeningName}`);
    try {
      await client.updateJobOpening(posting.frappeJobOpeningName, payload);
      console.log(`${logPrefix} Updated successfully`);
    } catch (err) {
      console.error(`${logPrefix} Failed to update:`, err);
      throw err;
    }
  } else {
    // Create new
    console.log(`${logPrefix} Creating new Job Opening`);
    try {
      const created = await client.createJobOpening(payload);
      console.log(`${logPrefix} Created: ${created.name}`);

      // Store the Frappe ID back
      await db.jobPosting.update({
        where: { id: jobPostingId },
        data: { frappeJobOpeningName: created.name },
      });
    } catch (err) {
      console.error(`${logPrefix} Failed to create:`, err);
      throw err;
    }
  }
}
