import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminDb } from "@/lib/db/admin";
import type { DeptType } from "@prisma/client";

export type EmployeeDirectoryEntry = {
  userId: string;
  workEmail: string | null;
  personalEmail: string | null;
  contactNumber: string | null;
  department: DeptType | null;
  teamName: string | null;
  designation: string | null;
  doj: string | null;
  employmentType: string | null;
  workModel: string | null;
  workLocation: string | null;
  accountStatus: string;
  fullName: string | null;
  profileImageUrl: string | null;
};

/**
 * Determines if the user should see department-scoped data.
 * Returns the department ID if scoping is required, null if user sees all data.
 *
 * Logic:
 * - admin, system_engineer, developer → null (see all)
 * - hr, manager → departmentId (department-scoped)
 */
async function shouldScopeToDepartment(userId: string): Promise<string | null> {
  const adminDb = getAdminDb();
  const roles = await adminDb.userRole.findMany({
    where: { userId },
  });

  const roleSet = new Set(roles.map((r) => r.role));

  // Admin and system roles see everything
  if (
    roleSet.has("admin") ||
    roleSet.has("system_engineer") ||
    roleSet.has("developer")
  ) {
    return null;
  }

  // HR and manager roles are department-scoped
  if (roleSet.has("hr") || roleSet.has("manager")) {
    const departmentRole = roles.find((r) => r.departmentId);
    return departmentRole?.departmentId ?? null;
  }

  return null;
}

/**
 * Asserts that the user has dashboard access.
 * Dashboard-eligible roles: admin, system_engineer, developer, hr, manager
 */
async function assertDashboardAccess(_db: any, userId: string) {
  const adminDb = getAdminDb();
  const count = await adminDb.userRole.count({
    where: {
      userId,
      role: { in: ["admin", "system_engineer", "developer", "hr", "manager"] },
    },
  });
  if (count === 0) throw new Error("Forbidden");
}

/**
 * Lists all employees for the employee directory.
 *
 * Authorization:
 * - admin, system_engineer, developer: see all employees
 * - hr, manager: see only employees in their department
 *
 * Server-side filtering ensures security - no client-side filtering for authorization.
 */
export const listAllEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmployeeDirectoryEntry[]> => {
    await assertDashboardAccess(context.db, context.userId);
    const adminDb = getAdminDb();

    const scopedDepartmentId = await shouldScopeToDepartment(context.userId);

    // Build where clause based on department scoping
    const whereClause: any = {
      accountStatus: { not: "deleted" },
    };

    // If department-scoped, filter employees by department
    // NOTE: Employee.department is a DeptType enum, not a FK to Department
    // We'll need to map Department.id → Department.code → DeptType enum
    if (scopedDepartmentId) {
      const department = await adminDb.department.findUnique({
        where: { id: scopedDepartmentId },
        select: { code: true },
      });

      if (department) {
        // Map department code to DeptType enum value
        // Department codes: ENG, HR, OPS, MGMT, PROD, DES, FIN, SALES, MKT, CS, LEGAL, IT
        // DeptType enum values: Engineering, HR, Operations, Management, Product, Design, Finance, Sales, Marketing, CS, Legal, IT
        const deptTypeMap: Record<string, DeptType> = {
          ENG: "Engineering" as DeptType,
          HR: "HR" as DeptType,
          OPS: "Operations" as DeptType,
          MGMT: "Management" as DeptType,
          PROD: "Product" as DeptType,
          DES: "Design" as DeptType,
          FIN: "Finance" as DeptType,
          SALES: "Sales" as DeptType,
          MKT: "Marketing" as DeptType,
          CS: "CS" as DeptType,
          LEGAL: "Legal" as DeptType,
          IT: "IT" as DeptType,
        };

        const deptType = deptTypeMap[department.code];
        if (deptType) {
          whereClause.department = deptType;
        } else {
          // If no mapping found, return empty list (safer than showing all)
          return [];
        }
      } else {
        // If department not found, return empty list
        return [];
      }
    }

    const employees = await adminDb.employee.findMany({
      where: whereClause,
      select: {
        userId: true,
        workEmail: true,
        personalEmail: true,
        contactNumber: true,
        department: true,
        teamName: true,
        designation: true,
        doj: true,
        employmentType: true,
        workModel: true,
        workLocation: true,
        accountStatus: true,
      },
      orderBy: [{ doj: "desc" }, { workEmail: "asc" }],
    });

    // Fetch user profiles for full name and profile image
    const userIds = employees.map((e) => e.userId);
    const profiles = await adminDb.clerkUserMap.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        fullName: true,
        profileImageUrl: true,
      },
    });

    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    return employees.map((emp) => {
      const profile = profileMap.get(emp.userId);
      return {
        userId: emp.userId,
        workEmail: emp.workEmail,
        personalEmail: emp.personalEmail,
        contactNumber: emp.contactNumber,
        department: emp.department,
        teamName: emp.teamName,
        designation: emp.designation,
        doj: emp.doj ? emp.doj.toISOString().split("T")[0] : null,
        employmentType: emp.employmentType,
        workModel: emp.workModel,
        workLocation: emp.workLocation,
        accountStatus: emp.accountStatus,
        fullName: profile?.fullName ?? null,
        profileImageUrl: profile?.profileImageUrl ?? null,
      };
    });
  });

/**
 * Gets department statistics for the dashboard.
 *
 * Authorization: same as listAllEmployees
 * - admin/system_engineer/developer: see all department stats
 * - hr/manager: see only their department's stats
 */
export const getDepartmentStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      totalEmployees: number;
      byDepartment: Array<{ department: string; count: number }>;
      recentHires: number;
    }> => {
      await assertDashboardAccess(context.db, context.userId);
      const adminDb = getAdminDb();

      const scopedDepartmentId = await shouldScopeToDepartment(context.userId);

      const whereClause: any = {
        accountStatus: { not: "deleted" },
      };

      if (scopedDepartmentId) {
        const department = await adminDb.department.findUnique({
          where: { id: scopedDepartmentId },
          select: { code: true },
        });

        if (department) {
          const deptTypeMap: Record<string, DeptType> = {
            ENG: "Engineering" as DeptType,
            HR: "HR" as DeptType,
            OPS: "Operations" as DeptType,
            MGMT: "Management" as DeptType,
            PROD: "Product" as DeptType,
            DES: "Design" as DeptType,
            FIN: "Finance" as DeptType,
            SALES: "Sales" as DeptType,
            MKT: "Marketing" as DeptType,
            CS: "CS" as DeptType,
            LEGAL: "Legal" as DeptType,
            IT: "IT" as DeptType,
          };

          const deptType = deptTypeMap[department.code];
          if (deptType) {
            whereClause.department = deptType;
          } else {
            return { totalEmployees: 0, byDepartment: [], recentHires: 0 };
          }
        } else {
          return { totalEmployees: 0, byDepartment: [], recentHires: 0 };
        }
      }

      const [totalEmployees, employeesByDept, recentHires] = await Promise.all([
        adminDb.employee.count({ where: whereClause }),
        adminDb.employee.groupBy({
          by: ["department"],
          where: whereClause,
          _count: { userId: true },
        }),
        adminDb.employee.count({
          where: {
            ...whereClause,
            doj: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
            },
          },
        }),
      ]);

      return {
        totalEmployees,
        byDepartment: employeesByDept.map((d) => ({
          department: d.department ?? "Unassigned",
          count: d._count.userId,
        })),
        recentHires,
      };
    },
  );
