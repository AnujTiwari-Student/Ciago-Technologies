import type { AppRole } from "@prisma/client";

/**
 * Dashboard Access Control
 *
 * This module defines role-based access to dashboard surfaces.
 * Department-scoped data filtering is implemented in the server functions
 * (admin.functions.ts, jobPostings.functions.ts) based on user roles:
 *
 * - admin, system_engineer, developer: See all data (no department filtering)
 * - hr, manager: See only their department's data (department-scoped)
 *
 * The department ID flows: DB UserRole → getMyRoles() → route guard context → server functions
 */

export type DashboardSurface =
  | "overview"
  | "applications"
  | "postings"
  | "users"
  | "documents"
  | "audit"
  | "frappe"
  | "employee-directory";

const DASHBOARD_ROLES: Set<AppRole> = new Set([
  "admin",
  "system_engineer",
  "developer",
  "hr",
  "manager",
]);

const SURFACE_ROLES: Record<DashboardSurface, Set<AppRole>> = {
  overview: DASHBOARD_ROLES,
  applications: new Set(["admin", "hr", "manager"]),
  postings: new Set(["admin", "hr", "manager"]),
  users: new Set(["admin", "system_engineer"]),
  documents: new Set(["admin", "hr"]),
  audit: new Set(["admin", "system_engineer"]),
  frappe: new Set(["admin", "system_engineer", "developer"]),
  "employee-directory": DASHBOARD_ROLES,
};

export function canAccessDashboard(roles: AppRole[]): boolean {
  return roles.some((r) => DASHBOARD_ROLES.has(r));
}

export function canAccessSurface(roles: AppRole[], surface: DashboardSurface): boolean {
  const allowed = SURFACE_ROLES[surface];
  if (!allowed) return false;
  return roles.some((r) => allowed.has(r));
}

export function getAccessibleSurfaces(roles: AppRole[]): DashboardSurface[] {
  return (Object.keys(SURFACE_ROLES) as DashboardSurface[]).filter((surface) =>
    canAccessSurface(roles, surface),
  );
}
