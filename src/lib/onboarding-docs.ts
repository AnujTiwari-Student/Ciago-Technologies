/**
 * Pure helpers that compute the effective onboarding document requirements
 * for a candidate, combining the HR-defined per-posting requirements with
 * conditional rules driven by the job's employment type.
 *
 * Extracted so both the wizard UI and the submission gate use the same rules,
 * and so we can unit-test them without a live Supabase.
 */

export type EmploymentType = "full_time" | "internship" | "contract" | string;

/** Doc keys used only by these conditional rules — added to ONBOARDING_DOC_LABELS. */
export const CONDITIONAL_DOC_LABELS: Record<string, string> = {
  marksheet_all_sems: "All-semester Marksheets (single PDF)",
  ug_degree: "UG Degree Certificate",
};

export type DocRequirement = {
  key: string;
  mandatory: boolean;
  reason?: string;
};

/**
 * Merge HR-configured required_docs with rules derived from the employment
 * type of the role. Everything HR configured stays mandatory.
 *
 * Rules:
 *  - Internship: `marksheet_all_sems` is mandatory; `ug_degree` is optional.
 *  - Full-time / permanent: `ug_degree` is mandatory (unless HR already
 *    required an equivalent like `degree_final` / `degree_provisional`).
 *  - Contract / other: no derived docs added.
 */
export function computeDocRequirements(
  employmentType: EmploymentType | null | undefined,
  postingRequired: readonly string[] | null | undefined,
): DocRequirement[] {
  const configured = new Set((postingRequired ?? []).filter(Boolean));
  const out: DocRequirement[] = [];
  for (const key of configured) out.push({ key, mandatory: true });

  const type = (employmentType ?? "").toLowerCase().replace(/[\s-]+/g, "_");

  if (type === "internship" || type === "intern") {
    if (!configured.has("marksheet_all_sems")) {
      out.push({
        key: "marksheet_all_sems",
        mandatory: true,
        reason: "Required for interns — all-semester marksheets in one PDF.",
      });
    }
    if (
      !configured.has("ug_degree") &&
      !configured.has("degree_final") &&
      !configured.has("degree_provisional")
    ) {
      out.push({ key: "ug_degree", mandatory: false, reason: "Optional for interns." });
    }
    return out;
  }

  if (type === "full_time" || type === "permanent" || type === "fulltime") {
    const hasDegree =
      configured.has("ug_degree") ||
      configured.has("degree_final") ||
      configured.has("degree_provisional");
    if (!hasDegree) {
      out.push({
        key: "ug_degree",
        mandatory: true,
        reason: "Required for full-time roles.",
      });
    }
    return out;
  }

  return out;
}

/** Convenience: just the mandatory keys, for gating submission. */
export function mandatoryDocKeys(
  employmentType: EmploymentType | null | undefined,
  postingRequired: readonly string[] | null | undefined,
): string[] {
  return computeDocRequirements(employmentType, postingRequired)
    .filter((d) => d.mandatory)
    .map((d) => d.key);
}
