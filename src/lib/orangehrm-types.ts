/**
 * Phase 3: OrangeHRM Full Lifecycle Type Definitions
 *
 * Onboarding data structure that bridges:
 * - Ciago application/onboarding data → OnboardingData → OrangeHRM employee update
 *
 * IMPORTANT: All fields mapped from ACTUAL existing database schema.
 * No invented fields. See docs/onboarding-data-mapping.md for complete mapping.
 */

import type { DeptType } from "@prisma/client";

/**
 * Complete onboarding data collected during hire flow
 * Maps to JobApplication + OnboardingRecord + Employee schema
 */
export interface OnboardingData {
  // Identity (from JobApplication)
  fullName: string;
  email: string;
  roleTitle: string;

  // Employment details (from OnboardingRecord + Employee)
  department: DeptType | string | null;
  employmentType: string; // "full_time" | "part_time" | "contract" | "internship"
  joiningDate: string | null; // doj field, format: YYYY-MM-DD
  startDate: string | null; // onboarding start_date
  workLocation: string | null;
  workModel: string | null; // "remote" | "hybrid" | "office"

  // Compensation (from OnboardingRecord)
  compensationInr: number | null;
  baseSalary: number | null;
  salaryCurrency: string;

  // Contact (from OnboardingRecord.formState + Employee)
  personalEmail: string | null;
  contactNumber: string | null;
  workEmail: string | null;
  address: string | null;

  // Emergency contact (from OnboardingRecord.emergencyContact JSONB)
  emergencyContact: {
    name?: string;
    relationship?: string;
    phone?: string;
  } | null;

  // Reporting (from Employee)
  reportingManagerId: string | null; // UUID in Ciago, needs mapping
  reportingHrId: string | null; // UUID in Ciago

  // Team (from Employee)
  teamName: string | null;

  // Admin notes (from Employee)
  notes: string | null;
}

/**
 * Extracted source data for onboarding extraction
 * Used to build OnboardingData from database queries
 */
export interface OnboardingDataSources {
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
    doj: string | null;
    startDate: string | null;
    compensationInr: number | null;
    formState: Record<string, unknown>;
    emergencyContact: Record<string, unknown> | null;
  } | null;

  employee: {
    department: DeptType | null;
    designation: string | null;
    employmentType: string | null;
    workLocation: string | null;
    workModel: string | null;
    personalEmail: string | null;
    workEmail: string | null;
    contactNumber: string | null;
    address: string | null;
    baseSalary: number | null;
    salaryCurrency: string;
    reportingManagerId: string | null;
    reportingHrId: string | null;
    teamName: string | null;
    notes: string | null;
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
 * OrangeHRM update payload for HIRED employee enrichment
 * Maps OnboardingData → OrangeHRM API payload structure
 */
export interface OrangeHRMEmployeeUpdatePayload {
  // Basic employee details (updateEmployee)
  firstName?: string;
  middleName?: string;
  lastName?: string;
  employeeId?: string;

  // Job details (updateEmployeeJobDetails)
  jobDetails?: {
    jobTitleId?: number; // Requires lookup/mapping
    empStatusId?: number; // Employment status (1=Full-time, etc)
    joinedDate?: string; // YYYY-MM-DD
    subUnitId?: number; // Department ID (requires lookup)
    locationId?: number; // Location ID (requires lookup)
  };

  // Contact details (updateEmployeeContactDetails)
  contactDetails?: {
    workEmail?: string;
    otherEmail?: string;
    mobile?: string;
    homeTelephone?: string;
    addressStreet1?: string;
    city?: string;
    province?: string;
    zipCode?: string;
    countryCode?: string;
  };
}

/**
 * Result of HIRED upsert operation
 */
export interface HiredUpsertResult {
  success: boolean;
  empNumber: number | null;
  employeeId: string | null;
  action:
    | "updated" // Existing employee updated with full data
    | "reconciled" // Found existing employee via reconciliation
    | "provisioned" // No employee found, centralized provisioning invoked
    | "already_complete" // Already processed (idempotency)
    | "needs_manual_review" // Ambiguous state, manual intervention required
    | "failed"; // Operation failed
  message: string;
  error?: string;
}
