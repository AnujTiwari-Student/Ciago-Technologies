// Pure role-based access matrix. Mirrors the guards enforced by route files
// so we can unit-test which surfaces each role is allowed to see.

import type { AppRole as PrismaAppRole } from "@prisma/client";
import { canAccessDashboard } from "./dashboard-access";

export type AppRole = "user" | "admin";

export type Surface = "public" | "careers" | "my-applications" | "onboarding" | "admin";

const DASHBOARD_ELIGIBLE_SIMPLE_ROLES: Set<AppRole> = new Set(["admin"]);

export function canAccess(role: AppRole | null | undefined, surface: Surface): boolean {
  const r = role ?? "user";
  switch (surface) {
    case "public":
    case "careers":
    case "my-applications":
    case "onboarding":
      return true;
    case "admin":
      return DASHBOARD_ELIGIBLE_SIMPLE_ROLES.has(r);
    default:
      return false;
  }
}

export function canAccessWithRoles(roles: PrismaAppRole[], surface: Surface): boolean {
  switch (surface) {
    case "public":
    case "careers":
    case "my-applications":
    case "onboarding":
      return true;
    case "admin":
      return canAccessDashboard(roles);
    default:
      return false;
  }
}

export function shouldShowOnboardingBanner(role: AppRole | null | undefined): boolean {
  return (role ?? "user") === "user";
}
