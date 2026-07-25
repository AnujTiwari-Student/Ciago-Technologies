import { describe, expect, it } from "vitest";
import { computeDocRequirements, mandatoryDocKeys } from "../onboarding-docs";

describe("computeDocRequirements", () => {
  it("keeps HR-configured docs mandatory as-is for unknown types", () => {
    const out = computeDocRequirements("contract", ["aadhaar", "pan"]);
    expect(out.map((r) => r.key)).toEqual(["aadhaar", "pan"]);
    expect(out.every((r) => r.mandatory)).toBe(true);
  });

  it("internship: adds mandatory all-semester marksheet and optional UG degree", () => {
    const out = computeDocRequirements("internship", ["aadhaar"]);
    const byKey = Object.fromEntries(out.map((r) => [r.key, r]));
    expect(byKey.aadhaar.mandatory).toBe(true);
    expect(byKey.marksheet_all_sems.mandatory).toBe(true);
    expect(byKey.ug_degree.mandatory).toBe(false);
  });

  it("internship: does not re-add ug_degree when HR already required a degree doc", () => {
    const out = computeDocRequirements("internship", ["aadhaar", "degree_final"]);
    expect(out.find((r) => r.key === "ug_degree")).toBeUndefined();
  });

  it("full-time: adds UG degree as mandatory when HR did not configure any degree doc", () => {
    const out = computeDocRequirements("full_time", ["aadhaar"]);
    const ug = out.find((r) => r.key === "ug_degree");
    expect(ug?.mandatory).toBe(true);
  });

  it("full-time: does not double up when HR already required degree_provisional", () => {
    const out = computeDocRequirements("full_time", ["degree_provisional"]);
    expect(out.find((r) => r.key === "ug_degree")).toBeUndefined();
  });

  it("mandatoryDocKeys returns only the mandatory keys", () => {
    const keys = mandatoryDocKeys("internship", ["aadhaar"]);
    expect(keys).toContain("aadhaar");
    expect(keys).toContain("marksheet_all_sems");
    expect(keys).not.toContain("ug_degree");
  });
});
