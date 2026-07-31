import { describe, it, expect } from "vitest";
import { canAccess, shouldShowOnboardingBanner, type AppRole } from "../route-access";

const roles: AppRole[] = ["user", "admin"];

describe("canAccess", () => {
  it("admin can access every surface", () => {
    expect(canAccess("admin", "admin")).toBe(true);
    expect(canAccess("admin", "public")).toBe(true);
    expect(canAccess("admin", "careers")).toBe(true);
    expect(canAccess("admin", "my-applications")).toBe(true);
    expect(canAccess("admin", "onboarding")).toBe(true);
  });

  it("only admin can reach the Admin command center", () => {
    for (const r of roles) {
      expect(canAccess(r, "admin")).toBe(r === "admin");
    }
  });

  it("standard users cannot reach admin surface", () => {
    expect(canAccess("user", "admin")).toBe(false);
    expect(canAccess(null, "admin")).toBe(false);
  });

  it("all users can reach public surfaces", () => {
    for (const r of roles) {
      expect(canAccess(r, "public")).toBe(true);
      expect(canAccess(r, "careers")).toBe(true);
      expect(canAccess(r, "my-applications")).toBe(true);
      expect(canAccess(r, "onboarding")).toBe(true);
    }
  });
});

describe("shouldShowOnboardingBanner", () => {
  it("shows only for the base user role", () => {
    expect(shouldShowOnboardingBanner("user")).toBe(true);
    expect(shouldShowOnboardingBanner(null)).toBe(true);
    expect(shouldShowOnboardingBanner("admin")).toBe(false);
  });
});
