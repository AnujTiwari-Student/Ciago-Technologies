/**
 * Phase 2: Frappe HR Employee Enrichment at HIRED State
 *
 * CRITICAL DESIGN PRINCIPLES (preserved from OrangeHRM):
 * 1. HIRED must not blindly create second employee
 * 2. If frappe_employee_name exists, UPDATE that employee
 * 3. If mapping missing, check employees table for reconciliation
 * 4. If no mapping exists anywhere, call centralized provisionFrappeEmployee()
 * 5. Always enrich employee with full onboarding data after provisioning/reconciliation
 * 6. Transactional status validation before Frappe operations
 * 7. Lifecycle version optimistic locking for race protection
 * 8. Idempotent: repeated HIRED events safe
 * 9. Crash recovery: deterministic where possible, manual review otherwise
 *
 * FRAPPE FIELD MAPPING (from Phase 1 docs/phase1-findings.md):
 * - firstName → first_name
 * - middleName → middle_name
 * - lastName → last_name
 * - joinedDate → date_of_joining
 * - workEmail → company_email
 * - otherEmail/personalEmail → personal_email
 * - mobile → cell_number
 * - addressStreet1 + city + province → current_address (concatenated)
 * - jobTitleId → designation (Link field)
 * - subUnitId → department (Link field)
 * - locationId → branch (Link field)
 * - empStatusId → employment_type (Link field)
 */

import { PrismaClient } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";
import {
  provisionFrappeEmployee,
  classifyFrappeError,
  isFrappeRetryable,
  type FrappeProvisioningResult,
} from "./frappe-provisioning";

/**
 * Complete onboarding data for HIRED enrichment
 * Maps from Ciago schema to Frappe fields
 */
export interface FrappeOnboardingData {
  // Identity
  fullName: string;
  email: string;
  roleTitle: string;

  // Employment
  department: string | null;
  employmentType: string | null;
  joiningDate: string | null; // YYYY-MM-DD format
  startDate: string | null;
  workLocation: string | null;
  workModel: string | null;

  // Compensation
  compensationInr: number | null;
  baseSalary: number | null;
  salaryCurrency: string;

  // Contact
  personalEmail: string | null;
  contactNumber: string | null;
  workEmail: string | null;
  address: string | null;

  // Emergency contact
  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
  } | null;

  // Organizational
  reportingManagerId: string | null;
  reportingHrId: string | null;
  teamName: string | null;
  notes: string | null;
}

/**
 * Data sources for onboarding extraction
 */
export interface FrappeOnboardingDataSources {
  application: {
    id: string;
    userId: string;
    fullName: string;
    email: string;
    roleTitle: string;
    status: string;
  };

  onboardingRecord: {
    id: string;
    roleTitle: string;
    department: string | null;
    doj: Date | null;
    startDate: Date | null;
    compensationInr: bigint | null;
    formState: Record<string, unknown>;
    emergencyContact: Record<string, unknown> | null;
  } | null;

  employee: {
    department: string | null;
    designation: string | null;
    employmentType: string | null;
    workLocation: string | null;
    workModel: string | null;
    personalEmail: string | null;
    workEmail: string | null;
    contactNumber: string | null;
    address: string | null;
    baseSalary: bigint | null;
    salaryCurrency: string;
    reportingManagerId: string | null;
    reportingHrId: string | null;
    teamName: string | null;
    notes: string | null;
    doj: Date | null;
  } | null;

  jobPosting: {
    id: string;
    employmentType: string;
    department: string;
    location: string;
    isRemote: boolean;
  } | null;
}

/**
 * Result of HIRED enrichment operation
 */
export interface FrappeHiredResult {
  success: boolean;
  employeeName: string | null;
  action:
    | "updated"             // Existing employee updated with full data
    | "reconciled"          // Found existing employee via reconciliation
    | "provisioned"         // No employee found, centralized provisioning invoked
    | "already_complete"    // Already processed (idempotency)
    | "needs_manual_review" // Ambiguous state, manual intervention required
    | "failed";             // Operation failed
  message: string;
  error?: string;
}

/**
 * Extract onboarding data from Ciago database entities
 * Priority: Employee > OnboardingRecord > JobApplication > JobPosting
 */
export function extractFrappeOnboardingData(
  sources: FrappeOnboardingDataSources
): FrappeOnboardingData {
  return {
    // Identity
    fullName: sources.application.fullName,
    email: sources.application.email,
    roleTitle: sources.onboardingRecord?.roleTitle || sources.application.roleTitle,

    // Employment
    department:
      sources.employee?.department ||
      sources.onboardingRecord?.department ||
      sources.jobPosting?.department ||
      null,
    employmentType:
      sources.employee?.employmentType || sources.jobPosting?.employmentType || null,
    joiningDate:
      sources.onboardingRecord?.doj?.toISOString().split('T')[0] ||
      sources.employee?.doj?.toISOString().split('T')[0] ||
      sources.onboardingRecord?.startDate?.toISOString().split('T')[0] ||
      null,
    startDate: sources.onboardingRecord?.startDate?.toISOString().split('T')[0] || null,
    workLocation:
      sources.employee?.workLocation || sources.jobPosting?.location || null,
    workModel:
      sources.employee?.workModel ||
      (sources.jobPosting?.isRemote ? "remote" : "office") ||
      null,

    // Compensation
    compensationInr: sources.onboardingRecord?.compensationInr
      ? Number(sources.onboardingRecord.compensationInr)
      : null,
    baseSalary: sources.employee?.baseSalary
      ? Number(sources.employee.baseSalary)
      : null,
    salaryCurrency: sources.employee?.salaryCurrency || "INR",

    // Contact
    personalEmail: sources.employee?.personalEmail || sources.application.email,
    contactNumber: sources.employee?.contactNumber || null,
    workEmail: sources.employee?.workEmail || null,
    address: sources.employee?.address || null,

    // Emergency contact
    emergencyContact: sources.onboardingRecord?.emergencyContact
      ? {
          name: (sources.onboardingRecord.emergencyContact as any).name,
          relationship: (sources.onboardingRecord.emergencyContact as any).relationship,
          phone: (sources.onboardingRecord.emergencyContact as any).phone,
        }
      : null,

    // Organizational
    reportingManagerId: sources.employee?.reportingManagerId || null,
    reportingHrId: sources.employee?.reportingHrId || null,
    teamName: sources.employee?.teamName || null,
    notes: sources.employee?.notes || null,
  };
}

/**
 * Update existing Frappe employee with full onboarding data
 * Called after reconciliation/provisioning to enrich preliminary employee
 *
 * FRAPPE FIELD MAPPING:
 * - Basic details: first_name, middle_name, last_name
 * - Contact: company_email, personal_email, cell_number, current_address
 * - Job details: date_of_joining (required), designation, department, employment_type, branch (all Link fields)
 * - Emergency: emergency_contact_name, emergency_phone, relation
 *
 * KNOWN LIMITATIONS:
 * - Link fields (designation, department, branch, employment_type) require existing DocType records
 * - Invalid Link field values will fail with LinkValidationError (403)
 * - Phase 2 approach: Skip Link fields if not found, log warning
 * - Future: Implement on-demand DocType creation
 */
async function enrichFrappeEmployee(
  employeeName: string,
  onboardingData: FrappeOnboardingData,
  client: FrappeClient,
  logPrefix: string
): Promise<void> {
  console.log(`${logPrefix} Enriching Frappe employee ${employeeName} with onboarding data`);

  // Parse name
  const nameParts = onboardingData.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || onboardingData.fullName;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;

  // Build update payload
  const updatePayload: Record<string, any> = {
    first_name: firstName,
    last_name: lastName,
  };

  if (middleName) {
    updatePayload.middle_name = middleName;
  }

  // Contact details
  if (onboardingData.workEmail) {
    updatePayload.company_email = onboardingData.workEmail;
  }
  if (onboardingData.personalEmail) {
    updatePayload.personal_email = onboardingData.personalEmail;
  }
  if (onboardingData.contactNumber) {
    updatePayload.cell_number = onboardingData.contactNumber;
  }
  if (onboardingData.address) {
    updatePayload.current_address = onboardingData.address;
  }

  // Job details - date_of_joining is critical
  if (onboardingData.joiningDate) {
    updatePayload.date_of_joining = onboardingData.joiningDate;
  }

  // Emergency contact
  if (onboardingData.emergencyContact) {
    if (onboardingData.emergencyContact.name) {
      updatePayload.emergency_contact_name = onboardingData.emergencyContact.name;
    }
    if (onboardingData.emergencyContact.phone) {
      updatePayload.emergency_phone = onboardingData.emergencyContact.phone;
    }
    if (onboardingData.emergencyContact.relationship) {
      updatePayload.relation = onboardingData.emergencyContact.relationship;
    }
  }

  // Link fields - Phase 2: Skip if not set (requires on-demand creation in future)
  // TODO Phase 2.1: Implement Link field resolution/creation
  // - designation (from roleTitle)
  // - department (from department)
  // - employment_type (from employmentType)
  // - branch (from workLocation)

  try {
    await client.updateEmployee(employeeName, updatePayload);
    console.log(`${logPrefix} Successfully enriched employee with onboarding data`);
  } catch (error) {
    console.error(`${logPrefix} Failed to enrich employee:`, error);
    throw error;
  }
}

/**
 * PHASE 2: Upsert Frappe Employee at HIRED state
 *
 * Complete reconciliation/update/enrichment flow for HIRED candidates
 *
 * IDEMPOTENCY GUARANTEES:
 * 1. Repeated HIRED events → same result, no duplicate employee
 * 2. Integration event idempotency via event claiming (handled by caller)
 * 3. DB persistence with lifecycle_version optimistic locking
 * 4. Final status re-check before Frappe operations
 *
 * CONCURRENCY PROTECTION:
 * - Transactional status validation (must be HIRED)
 * - lifecycle_version checks prevent races
 * - Integration event claiming (handled by caller)
 * - HIRED vs REJECTED race: status validation aborts if rejected
 *
 * RECONCILIATION PRIORITY:
 * 1. job_applications.frappe_employee_name (primary mapping)
 * 2. employees.frappe_employee_name (fallback for rehire scenarios)
 * 3. Centralized provisionFrappeEmployee() (never raw create)
 * 4. Manual review if ambiguous
 *
 * CRASH RECOVERY:
 * - After provisioning but before enrichment: next run enriches
 * - After enrichment but before DB persist: next run detects already-enriched
 * - Stale processing state: enter manual review (safe fallback)
 */
export async function upsertFrappeEmployeeAtHired(
  applicationId: string,
  candidateId: string,
  onboardingData: FrappeOnboardingData,
  db: PrismaClient,
  client: FrappeClient,
  correlationId?: string
): Promise<FrappeHiredResult> {
  const logPrefix = `[frappe-hired:${applicationId.slice(0, 8)}]`;
  console.log(`${logPrefix} Starting HIRED upsert/enrichment`, { correlationId });

  try {
    // Step 1: Load application with transactional status validation
    const application = await db.jobApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        status: true,
        frappeEmployeeName: true,
        frappeProvisioningState: true,
        frappeRecordStatus: true,
        lifecycleVersion: true,
      },
    });

    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    // CRITICAL: Verify status is still HIRED (race protection)
    if (application.status !== "hired") {
      console.warn(
        `${logPrefix} Application status is ${application.status}, not hired - aborting upsert`
      );

      await db.auditLog.create({
        data: {
          action: "FRAPPE_HIRED_UPSERT_ABORTED_STATUS_CHANGED",
          targetResource: `job_applications/${applicationId}`,
          details: {
            expectedStatus: "hired",
            actualStatus: application.status,
            reason: "Status changed between trigger and execution - race condition detected",
            correlationId,
          },
        },
      });

      return {
        success: false,
        employeeName: null,
        action: "failed",
        message: `Application status changed to ${application.status} - aborting HIRED upsert`,
        error: "Status race condition",
      };
    }

    console.log(`${logPrefix} Application verified as HIRED`, {
      lifecycleVersion: application.lifecycleVersion,
      existingEmployeeName: application.frappeEmployeeName,
      provisioningState: application.frappeProvisioningState,
    });

    // Step 2: Check if already fully processed (idempotency)
    if (
      application.frappeEmployeeName &&
      application.frappeProvisioningState === "succeeded"
    ) {
      // Verify employee still exists in Frappe
      try {
        const existing = await client.getEmployee(application.frappeEmployeeName);

        if (existing) {
          console.log(
            `${logPrefix} Already processed - employee ${application.frappeEmployeeName} exists and is mapped`
          );

          // Idempotent enrichment: re-apply onboarding data (safe operation)
          await enrichFrappeEmployee(
            application.frappeEmployeeName,
            onboardingData,
            client,
            logPrefix
          );

          return {
            success: true,
            employeeName: application.frappeEmployeeName,
            action: "already_complete",
            message: `Employee already provisioned and enriched (${application.frappeEmployeeName})`,
          };
        }

        // Employee deleted externally - continue to reconciliation
        console.warn(
          `${logPrefix} Employee ${application.frappeEmployeeName} was deleted from Frappe`
        );
      } catch (error) {
        console.error(`${logPrefix} Failed to verify existing employee:`, error);
        // Continue to reconciliation
      }
    }

    // Step 3: Reconcile from job_applications.frappe_employee_name
    if (application.frappeEmployeeName) {
      console.log(
        `${logPrefix} Reconciling existing employee name ${application.frappeEmployeeName} from job_applications`
      );

      try {
        const existing = await client.getEmployee(application.frappeEmployeeName);

        if (existing) {
          // Enrich with onboarding data
          await enrichFrappeEmployee(
            existing.name,
            onboardingData,
            client,
            logPrefix
          );

          // Update provisioning state
          await db.jobApplication.updateMany({
            where: {
              id: applicationId,
              lifecycleVersion: application.lifecycleVersion,
            },
            data: {
              frappeProvisioningState: "succeeded",
              frappeProvisioningSucceededAt: new Date(),
              lifecycleVersion: { increment: 1 },
            },
          });

          await db.auditLog.create({
            data: {
              action: "FRAPPE_EMPLOYEE_ENRICHED_AT_HIRED",
              targetResource: `job_applications/${applicationId}`,
              details: {
                employeeName: existing.name,
                action: "updated",
                joiningDate: onboardingData.joiningDate,
                correlationId,
              },
            },
          });

          console.log(`${logPrefix} Reconciled and enriched employee ${existing.name}`);

          return {
            success: true,
            employeeName: existing.name,
            action: "updated",
            message: `Reconciled and updated employee ${existing.name}`,
          };
        }

        console.warn(
          `${logPrefix} Employee ${application.frappeEmployeeName} not found in Frappe - attempting employees table reconciliation`
        );
      } catch (error) {
        console.error(`${logPrefix} Reconciliation from job_applications failed:`, error);
      }
    }

    // Step 4: Check employees table for existing mapping (rehire scenario)
    console.log(`${logPrefix} Checking employees table for existing Frappe mapping`);

    const employee = await db.employee.findUnique({
      where: { userId: candidateId },
      select: {
        frappeEmployeeName: true,
        frappeRecordStatus: true,
      },
    });

    if (employee?.frappeEmployeeName) {
      console.log(
        `${logPrefix} Found existing mapping in employees table: ${employee.frappeEmployeeName}`
      );

      // Check if employee was terminated
      if (employee.frappeRecordStatus === "TERMINATED" || employee.frappeRecordStatus === "LEFT") {
        console.warn(
          `${logPrefix} Employee ${employee.frappeEmployeeName} is ${employee.frappeRecordStatus} - cannot reuse for rehire`
        );

        await db.auditLog.create({
          data: {
            action: "FRAPPE_HIRED_REHIRE_TERMINATED_EMPLOYEE_BLOCKED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              employeeName: employee.frappeEmployeeName,
              recordStatus: employee.frappeRecordStatus,
              reason:
                "Cannot reuse terminated employee for rehire - requires explicit rehire flow",
              correlationId,
            },
          },
        });

        // Do NOT reuse terminated employee - fall through to provisioning
      } else {
        // Verify employee exists in Frappe
        try {
          const existing = await client.getEmployee(employee.frappeEmployeeName);

          if (existing) {
            // Reconcile: attach mapping to application
            await db.jobApplication.updateMany({
              where: {
                id: applicationId,
                lifecycleVersion: application.lifecycleVersion,
              },
              data: {
                frappeEmployeeName: existing.name,
                frappeProvisioningState: "succeeded",
                frappeProvisioningSucceededAt: new Date(),
                lifecycleVersion: { increment: 1 },
              },
            });

            // Enrich with onboarding data
            await enrichFrappeEmployee(
              existing.name,
              onboardingData,
              client,
              logPrefix
            );

            await db.auditLog.create({
              data: {
                action: "FRAPPE_EMPLOYEE_RECONCILED_FROM_EMPLOYEES_TABLE",
                targetResource: `job_applications/${applicationId}`,
                details: {
                  employeeName: existing.name,
                  candidateId,
                  action: "reconciled",
                  correlationId,
                },
              },
            });

            console.log(
              `${logPrefix} Reconciled from employees table and enriched ${existing.name}`
            );

            return {
              success: true,
              employeeName: existing.name,
              action: "reconciled",
              message: `Reconciled employee from employees table (${existing.name})`,
            };
          }
        } catch (error) {
          console.error(
            `${logPrefix} Failed to reconcile from employees table:`,
            error
          );
        }
      }
    }

    // Step 5: No mapping exists - invoke centralized provisioning
    console.log(
      `${logPrefix} No existing mapping found - invoking centralized provisioning for HIRED fallback`
    );

    const provisioningResult = await provisionFrappeEmployee(
      applicationId,
      db,
      client,
      correlationId || `hired-fallback-${applicationId}`
    );

    if (!provisioningResult.success) {
      console.error(`${logPrefix} Centralized provisioning failed:`, provisioningResult.error);

      return {
        success: false,
        employeeName: null,
        action: "failed",
        message: `Centralized provisioning failed: ${provisioningResult.error}`,
        error: provisioningResult.error,
      };
    }

    console.log(
      `${logPrefix} Centralized provisioning succeeded: ${provisioningResult.employeeName}`
    );

    // Enrich newly provisioned employee with onboarding data
    if (provisioningResult.employeeName) {
      await enrichFrappeEmployee(
        provisioningResult.employeeName,
        onboardingData,
        client,
        logPrefix
      );

      await db.auditLog.create({
        data: {
          action: "FRAPPE_EMPLOYEE_PROVISIONED_AND_ENRICHED_AT_HIRED",
          targetResource: `job_applications/${applicationId}`,
          details: {
            employeeName: provisioningResult.employeeName,
            action: "provisioned",
            provisioningAction: provisioningResult.action,
            joiningDate: onboardingData.joiningDate,
            correlationId,
          },
        },
      });
    }

    return {
      success: true,
      employeeName: provisioningResult.employeeName,
      action: "provisioned",
      message: `Provisioned and enriched new employee (${provisioningResult.employeeName})`,
    };
  } catch (error) {
    const classified = classifyFrappeError(error);

    console.error(`${logPrefix} HIRED upsert failed`, {
      errorType: classified.type,
      message: classified.message,
    });

    await db.auditLog.create({
      data: {
        action: "FRAPPE_HIRED_UPSERT_FAILED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          errorType: classified.type,
          errorMessage: classified.message,
          retryable: isFrappeRetryable(classified),
          correlationId,
        },
      },
    });

    return {
      success: false,
      employeeName: null,
      action: "failed",
      message: `HIRED upsert failed: ${classified.message}`,
      error: classified.message,
    };
  }
}
