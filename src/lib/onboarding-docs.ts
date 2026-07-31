/**
 * Pure helpers that compute the effective onboarding document requirements
 * for a candidate, combining the HR-defined per-posting requirements with
 * conditional rules driven by the job's employment type and education level.
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
  marksheet_12: "12th Marksheet",
  diploma_marksheet: "Diploma Marksheet / Certificate",
  ug_degree: "UG Degree Certificate / Provisional",
  pg_degree: "PG Degree Certificate / Provisional",
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
 * Base mandatory for all:
 *  - PAN, Aadhaar, Bank Details, Photo, 10th Marksheet
 *
 * Education-specific rules:
 *  - If highest education is 12th: 12th marksheet is mandatory
 *  - If highest education is Diploma: diploma marksheet is mandatory, 12th is optional
 *  - If highest education is UG or above: UG degree is mandatory, 12th is optional
 *  - If highest education is PG: PG degree is mandatory
 *
 * Employment-specific:
 *  - Full-time: Address proof mandatory
 *  - Contract: Past employment proof optional
 *  - Internship: UG degree optional (students may still be pursuing)
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

  // Education-level specific requirements
  const edu = educationLevel?.toLowerCase();

  if (edu === "pg") {
    // Postgraduate: UG + PG mandatory, 12th optional
    if (!configured.has("ug_degree")) {
      out.push({ key: "ug_degree", mandatory: true, reason: "Required for PG graduates" });
    }
    if (!configured.has("pg_degree")) {
      out.push({ key: "pg_degree", mandatory: true, reason: "Required for PG graduates" });
    }
    if (!configured.has("marksheet_12")) {
      out.push({ key: "marksheet_12", mandatory: false, reason: "Optional for graduates" });
    }
  } else if (edu === "ug") {
    // Undergraduate: UG mandatory, 12th optional
    if (!configured.has("ug_degree")) {
      out.push({ key: "ug_degree", mandatory: true, reason: "Required for UG graduates" });
    }
    if (!configured.has("marksheet_12")) {
      out.push({ key: "marksheet_12", mandatory: false, reason: "Optional for graduates" });
    }
  } else if (edu === "diploma") {
    // Diploma: Diploma mandatory, 12th optional
    if (!configured.has("diploma_marksheet")) {
      out.push({ key: "diploma_marksheet", mandatory: true, reason: "Required for diploma holders" });
    }
    if (!configured.has("marksheet_12")) {
      out.push({ key: "marksheet_12", mandatory: false, reason: "Optional if diploma completed" });
    }
  } else if (edu === "12th") {
    // 12th pass: 12th mandatory
    if (!configured.has("marksheet_12")) {
      out.push({ key: "marksheet_12", mandatory: true, reason: "Required for 12th pass candidates" });
    }
  } else {
    // Default/unknown: require both 12th and UG
    if (!configured.has("marksheet_12")) {
      out.push({ key: "marksheet_12", mandatory: true, reason: "Standard requirement" });
    }
    if (!configured.has("ug_degree")) {
      out.push({ key: "ug_degree", mandatory: true, reason: "Standard requirement for full-time roles" });
    }
  }

  const type = (employmentType ?? "").toLowerCase().replace(/[\s-]+/g, "_");

  // Employment-type specific
  if (type === "full_time" || type === "permanent" || type === "fulltime") {
    if (!configured.has("address_proof")) {
      out.push({ key: "address_proof", mandatory: true, reason: "Required for full-time employees" });
    }
  }

  if (type === "internship" || type === "intern") {
    // For interns, make degree optional
    const ugIdx = out.findIndex(d => d.key === "ug_degree");
    if (ugIdx >= 0 && out[ugIdx].mandatory) {
      out[ugIdx] = { ...out[ugIdx], mandatory: false, reason: "Optional for interns (may be pursuing)" };
    }
  }

  if (type === "contract") {
    if (!configured.has("past_employment_proof")) {
      out.push({ key: "past_employment_proof", mandatory: false, reason: "Optional for contract roles" });
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
