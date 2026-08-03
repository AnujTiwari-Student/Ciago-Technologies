/**
 * CiagoTech AppRole → Frappe HRMS Role Mapping
 *
 * PURPOSE: Map CiagoTech organizational roles to appropriate Frappe HRMS roles
 *
 * SECURITY PRINCIPLE: Minimal privilege
 * - Start with Employee role (basic access)
 * - Add additional roles based on organizational function
 * - Never automatically assign Administrator (reserved for break-glass)
 *
 * FRAPPE ROLES (ERPNext v15 + HRMS v15):
 * - Employee: Employee self-service (own attendance, leave, expenses, tasks)
 * - Employee Self Service: ESS portal access (mobile/portal)
 * - Leave Approver: Approve leave requests (manager function)
 * - Expense Approver: Approve expenses (manager function)
 * - HR User: HR data entry and document management
 * - HR Manager: Full HR operations (employee lifecycle, onboarding, offboarding)
 * - Projects Manager: Project and task management
 * - System Manager: Frappe system administration (users, permissions, configuration)
 * - Administrator: Superuser (DO NOT assign automatically)
 *
 * MULTI-ROLE USERS: Users with multiple CiagoTech roles receive ALL applicable Frappe roles
 *
 * Example: User with [employee, manager, hr] receives:
 * - Employee, Employee Self Service, Leave Approver, Expense Approver, HR User, HR Manager
 */

import type { AppRole } from "@prisma/client";

/**
 * Map CiagoTech roles to Frappe HRMS roles
 *
 * @param ciagoRoles Array of CiagoTech AppRole enum values
 * @returns Array of Frappe role names (deduplicated)
 */
export function mapCiagoRolesToFrappeRoles(ciagoRoles: AppRole[]): string[] {
  const frappeRoles = new Set<string>();

  // Base: All users with any role get Employee access
  if (ciagoRoles.length > 0) {
    frappeRoles.add("Employee");
    frappeRoles.add("Employee Self Service");
  }

  // Manager: Approval powers
  if (ciagoRoles.includes("manager")) {
    frappeRoles.add("Leave Approver");
    frappeRoles.add("Expense Approver");
  }

  // HR: HR operations
  if (ciagoRoles.includes("hr")) {
    frappeRoles.add("HR User");
    frappeRoles.add("HR Manager");
  }

  // System roles: Technical/admin access
  if (
    ciagoRoles.includes("admin") ||
    ciagoRoles.includes("system_engineer") ||
    ciagoRoles.includes("developer")
  ) {
    frappeRoles.add("System Manager");
  }

  // Note: Administrator role NOT automatically assigned
  // CEO/Executive would receive: Employee, HR Manager, Projects Manager, custom workspace
  // Additional roles can be assigned manually in Frappe UI if needed

  return Array.from(frappeRoles);
}

/**
 * Validate that required base roles are present
 *
 * @param frappeRoles Array of Frappe role names
 * @returns true if valid, false if missing base roles
 */
export function validateFrappeRoles(frappeRoles: string[]): boolean {
  // All users should have at least Employee role
  return frappeRoles.includes("Employee");
}

/**
 * Format roles for Frappe User creation payload
 *
 * @param roleNames Array of Frappe role names
 * @returns Array of role objects for Frappe API
 */
export function formatRolesForFrappe(roleNames: string[]): Array<{ role: string }> {
  return roleNames.map((role) => ({ role }));
}
