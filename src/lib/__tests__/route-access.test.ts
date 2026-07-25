import { describe, it, expect } from "vitest";
import { canAccess, shouldShowOnboardingBanner, type AppRole } from "../route-access";

const roles: AppRole[] = ["user", "employee", "manager", "hr", "admin"];

describe("canAccess", () => {
  it("admin can access every surface", () => {
    for (const s of ["employee", "manager", "hr", "admin"] as const) {
      expect(canAccess("admin", s)).toBe(true);
    }
  });

  it("only hr and admin can reach the HR portal", () => {
    for (const r of roles) {
      expect(canAccess(r, "hr")).toBe(r === "hr" || r === "admin");
    }
  });

  it("only admin can reach the Admin command center", () => {
    for (const r of roles) {
      expect(canAccess(r, "admin")).toBe(r === "admin");
    }
  });

  it("standard users cannot reach staff surfaces", () => {
    expect(canAccess("user", "employee")).toBe(false);
    expect(canAccess("user", "manager")).toBe(false);
    expect(canAccess(null, "employee")).toBe(false);
  });

  it("employees can reach employee portal but not manager/HR/admin", () => {
    expect(canAccess("employee", "employee")).toBe(true);
    expect(canAccess("employee", "manager")).toBe(false);
    expect(canAccess("employee", "hr")).toBe(false);
    expect(canAccess("employee", "admin")).toBe(false);
  });

  it("managers can reach manager portal but not HR/admin", () => {
    expect(canAccess("manager", "manager")).toBe(true);
    expect(canAccess("manager", "hr")).toBe(false);
    expect(canAccess("manager", "admin")).toBe(false);
  });
});

describe("shouldShowOnboardingBanner", () => {
  it("shows only for the base user role", () => {
    expect(shouldShowOnboardingBanner("user")).toBe(true);
    expect(shouldShowOnboardingBanner(null)).toBe(true);
    for (const r of ["employee", "manager", "hr", "admin"] as const) {
      expect(shouldShowOnboardingBanner(r)).toBe(false);
    }
  });
});
