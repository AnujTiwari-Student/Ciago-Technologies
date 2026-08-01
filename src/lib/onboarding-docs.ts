/**
 * Pure helpers that compute the effective onboarding document requirements
 * for a candidate, combining the HR-defined per-posting requirements with
 * conditional rules driven by the job's employment type.
 *
 * Document Requirements by Employment Type:
 *
 * INTERNSHIP & PART-TIME:
 *  - Required: PAN, Aadhaar, Passbook, Photo, 10th Marksheet, 12th/Diploma, All Semester Results
 *  - Optional: UG Degree, PG Degree
 *
 * ALL OTHER TYPES (Full-time, Contract, etc.):
 *  - Required: PAN, Aadhaar, Passbook, Photo, 10th Marksheet, 12th/Diploma, UG Degree
 *  - Optional: PG Degree, PG Marksheet, Address Proof, Past Employment Proof
 *
 * Extracted so both the wizard UI and the submission gate use the same rules,
 * and so we can unit-test them without a live Supabase.
 */

export type EmploymentType = "full_time" | "internship" | "contract" | string;
export type EducationLevel = "10th" | "12th" | "diploma" | "ug" | "pg" | null;

/** Doc keys used by onboarding — comprehensive list. */
export const CONDITIONAL_DOC_LABELS: Record<string, string> = {
  pan: "PAN Card",
  aadhaar: "Aadhaar Card",
  marksheet_10: "10th Marksheet",
  marksheet_12: "12th Marksheet / Diploma Certificate",
  diploma_marksheet: "Diploma Marksheet / Certificate",
  ug_degree: "UG Degree Certificate / Provisional",
  pg_degree: "PG Degree Certificate / Provisional",
  pg_marksheet: "PG Consolidated Marksheet (All Semesters)",
  semester_results: "All Semester Results (Combined PDF)",
  bank_details: "Bank Account Details (Cancelled Cheque / Passbook)",
  photo: "Passport-size Photograph",
  address_proof: "Address Proof (Current Residence)",
  past_employment_proof: "Past Employment Proof (Relieving Letter)",
};

export type DocRequirement = {
  key: string;
  mandatory: boolean;
  reason?: string;
};

/**
 * Compute onboarding document requirements based on employment type and education level.
 *
 * Employment-specific rules:
 *
 * For Internship and Part-time:
 *  - Required: PAN, Aadhaar, Bank Details (Passbook), Photo, 10th Marksheet, 12th/Diploma, All Semester Results
 *  - Optional: UG Degree, PG Degree
 *
 * For all other employment types (Full-time, Contract, etc.):
 *  - Required: PAN, Aadhaar, Bank Details (Passbook), Photo, 10th Marksheet, 12th/Diploma, UG Degree
 *  - Optional: PG Degree
 *
 * HR can override by specifying in postingRequired — those become mandatory.
 */
export function computeDocRequirements(
  employmentType: EmploymentType | null | undefined,
  postingRequired: readonly string[] | null | undefined,
  educationLevel?: EducationLevel,
): DocRequirement[] {
  const configured = new Set((postingRequired ?? []).filter(Boolean));
  const out: DocRequirement[] = [];

  // Base mandatory documents for everyone
  const baseMandatory = ["pan", "aadhaar", "bank_details", "photo", "marksheet_10"];

  for (const key of baseMandatory) {
    if (!configured.has(key)) {
      out.push({ key, mandatory: true, reason: "Required for all candidates" });
    }
  }

  // Add HR-configured requirements (all mandatory)
  for (const key of configured) {
    if (!baseMandatory.includes(key)) {
      out.push({ key, mandatory: true, reason: "Required by HR for this role" });
    }
  }

  const type = (employmentType ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const isInternOrPartTime = type === "internship" || type === "intern" || type === "part_time" || type === "parttime";

  // 12th/Diploma is mandatory for all
  if (!configured.has("marksheet_12") && !configured.has("diploma_marksheet")) {
    out.push({ key: "marksheet_12", mandatory: true, reason: "12th Marksheet or Diploma Certificate required" });
  }

  if (isInternOrPartTime) {
    // INTERNSHIP and PART-TIME requirements
    // Required: All Semester Results
    if (!configured.has("semester_results")) {
      out.push({
        key: "semester_results",
        mandatory: true,
        reason: "Required for interns/part-time - all semesters combined in one PDF"
      });
    }

    // Optional: UG Degree, PG Degree
    if (!configured.has("ug_degree")) {
      out.push({
        key: "ug_degree",
        mandatory: false,
        reason: "Optional for interns/part-time (may be pursuing)"
      });
    }

    if (!configured.has("pg_degree")) {
      out.push({
        key: "pg_degree",
        mandatory: false,
        reason: "Optional for interns/part-time"
      });
    }
  } else {
    // ALL OTHER EMPLOYMENT TYPES (Full-time, Contract, etc.)
    // Required: UG Degree
    if (!configured.has("ug_degree")) {
      out.push({
        key: "ug_degree",
        mandatory: true,
        reason: "Required for full-time/contract employees"
      });
    }

    // Optional: PG Degree
    if (!configured.has("pg_degree")) {
      out.push({
        key: "pg_degree",
        mandatory: false,
        reason: "Optional - PG Degree if applicable"
      });
    }

    // Optional: PG Marksheet (if PG degree exists)
    if (!configured.has("pg_marksheet")) {
      out.push({
        key: "pg_marksheet",
        mandatory: false,
        reason: "Optional - PG consolidated marksheet"
      });
    }

    // Additional requirements for specific types
    if (type === "full_time" || type === "permanent" || type === "fulltime") {
      if (!configured.has("address_proof")) {
        out.push({
          key: "address_proof",
          mandatory: false,
          reason: "Optional - Address proof for full-time employees"
        });
      }
    }

    if (type === "contract") {
      if (!configured.has("past_employment_proof")) {
        out.push({
          key: "past_employment_proof",
          mandatory: false,
          reason: "Optional - Past employment proof for contract roles"
        });
      }
    }
  }

  // Remove duplicates by key (keep first occurrence)
  const seen = new Set<string>();
  return out.filter(d => {
    if (seen.has(d.key)) return false;
    seen.add(d.key);
    return true;
  });
}

/** Convenience: just the mandatory keys, for gating submission. */
export function mandatoryDocKeys(
  employmentType: EmploymentType | null | undefined,
  postingRequired: readonly string[] | null | undefined,
  educationLevel?: EducationLevel,
): string[] {
  return computeDocRequirements(employmentType, postingRequired, educationLevel)
    .filter((d) => d.mandatory)
    .map((d) => d.key);
}
