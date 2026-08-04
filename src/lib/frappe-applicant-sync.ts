/**
 * Frappe Job Applicant Sync - Stage 2
 *
 * Syncs job applications to Frappe HR Job Applicant doctype
 * Called after a job application is submitted
 *
 * FLOW:
 * 1. Load job application from database
 * 2. Map to Frappe Job Applicant payload
 * 3. If frappeJobApplicantName exists, update; else create
 * 4. Store the Frappe Job Applicant name in the database
 * 5. Link to Job Opening if the job posting has frappeJobOpeningName
 */

import { PrismaClient } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";

export interface SyncJobApplicationResult {
  success: boolean;
  applicantName?: string;
  action?: "created" | "updated" | "skipped";
  error?: string;
}

/**
 * Sync a job application to Frappe Job Applicant
 *
 * @param db Prisma database client
 * @param client Frappe API client
 * @param applicationId Job application ID
 * @returns Sync result with applicant name and action
 */
export async function syncJobApplicationToFrappe(
  db: PrismaClient,
  client: FrappeClient,
  applicationId: string
): Promise<SyncJobApplicationResult> {
  const logPrefix = `[frappe-applicant-sync:${applicationId.slice(0, 8)}]`;

  console.log(`${logPrefix} Starting Job Applicant sync`);

  try {
    // Step 1: Load job application with job posting relation
    const application = await db.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        jobPosting: {
          select: {
            frappeJobOpeningName: true,
          },
        },
      },
    });

    if (!application) {
      console.error(`${logPrefix} Application not found`);
      return {
        success: false,
        error: "Application not found",
      };
    }

    console.log(`${logPrefix} Loaded application`, {
      fullName: application.fullName,
      email: application.email,
      roleTitle: application.roleTitle,
    });

    // Step 2: Map to Frappe Job Applicant payload
    const payload = mapApplicationToFrappePayload(application);

    console.log(`${logPrefix} Mapped payload`, {
      applicant_name: payload.applicant_name,
      email_id: payload.email_id,
      job_title: payload.job_title,
      status: payload.status,
    });

    // Step 3: Create or update Job Applicant
    let applicantName: string;
    let action: "created" | "updated";

    if (application.frappeJobApplicantName) {
      // Update existing Job Applicant
      console.log(`${logPrefix} Updating existing Job Applicant`, {
        name: application.frappeJobApplicantName,
      });

      await client.updateJobApplicant(application.frappeJobApplicantName, payload);
      applicantName = application.frappeJobApplicantName;
      action = "updated";

      console.log(`${logPrefix} Updated Job Applicant successfully`, { name: applicantName });
    } else {
      // Create new Job Applicant
      console.log(`${logPrefix} Creating new Job Applicant`);

      const created = await client.createJobApplicant(payload);
      applicantName = created.name;
      action = "created";

      console.log(`${logPrefix} Created Job Applicant successfully`, { name: applicantName });

      // Step 4: Store the Frappe Job Applicant name in database
      await db.jobApplication.update({
        where: { id: applicationId },
        data: { frappeJobApplicantName: applicantName },
      });

      console.log(`${logPrefix} Stored Job Applicant name in database`);
    }

    // Step 5: Link to Job Opening if available
    if (application.jobPosting?.frappeJobOpeningName) {
      console.log(`${logPrefix} Linking to Job Opening`, {
        jobOpening: application.jobPosting.frappeJobOpeningName,
      });

      try {
        await client.updateJobApplicant(applicantName, {
          job_title: application.jobPosting.frappeJobOpeningName,
        });

        console.log(`${logPrefix} Linked to Job Opening successfully`);
      } catch (linkError) {
        console.warn(`${logPrefix} Failed to link to Job Opening`, {
          error: linkError instanceof Error ? linkError.message : String(linkError),
        });
        // Non-fatal: continue even if linking fails
      }
    }

    return {
      success: true,
      applicantName,
      action,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Sync failed`, { error: message });

    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Map job application to Frappe Job Applicant payload
 *
 * Field mapping:
 * - applicant_name: Full name
 * - email_id: Email
 * - phone_number: Phone number
 * - country: Country
 * - cover_letter: Cover letter
 * - resume_link: Resume link (storage path or direct link)
 * - currency: Expected salary currency
 * - lower_range: Expected salary min
 * - upper_range: Expected salary max
 * - status: Always "Open" for new applications
 */
function mapApplicationToFrappePayload(application: any): any {
  const payload: any = {
    applicant_name: application.fullName,
    email_id: application.email,
    status: "Open",
  };

  // Optional fields
  if (application.phoneNumber) {
    payload.phone_number = application.phoneNumber;
  }

  if (application.country) {
    payload.country = application.country;
  }

  if (application.coverLetter) {
    payload.cover_letter = application.coverLetter;
  }

  // Resume link: prefer direct link, fallback to storage path
  if (application.resumeLink) {
    payload.resume_link = application.resumeLink;
  } else if (application.resumeStoragePath) {
    // For storage path, we could generate a signed URL here,
    // but for now just store the path as-is
    payload.resume_link = application.resumeStoragePath;
  }

  // Salary expectations
  if (application.expectedSalaryCurrency) {
    payload.currency = application.expectedSalaryCurrency;
  }

  if (application.expectedSalaryMin) {
    payload.lower_range = Number(application.expectedSalaryMin);
  }

  if (application.expectedSalaryMax) {
    payload.upper_range = Number(application.expectedSalaryMax);
  }

  return payload;
}
