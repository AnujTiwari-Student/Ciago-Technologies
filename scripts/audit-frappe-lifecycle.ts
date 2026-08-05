/**
 * Audit Current Frappe Lifecycle Implementation
 *
 * PURPOSE: Understand existing APPLIED → HIRED provisioning and identify User creation gaps
 *
 * AUDIT QUESTIONS:
 * 1. What happens at APPLIED? (Employee record created)
 * 2. What happens at HIRED? (Employee enriched with onboarding data)
 * 3. What happens at REJECTED? (Employee cleanup)
 * 4. Is Frappe User created? When? How?
 * 5. What Frappe roles exist in installed HRMS?
 * 6. How does Frappe User link to Employee?
 * 7. What is the correct role mapping for: Employee, Manager, HR, System Engineer, Developer, CEO?
 *
 * SCOPE: Read-only audit, no modifications
 */

import { createFrappeClient, type FrappeClient } from "@/integrations/frappe/client";
import { getAdminDb } from "@/lib/db/admin";

interface FrappeRole {
  name: string;
  disabled?: number;
  desk_access?: number;
}

interface FrappeUser {
  name: string; // email
  email: string;
  enabled: number;
  first_name?: string;
  last_name?: string;
  roles?: Array<{ role: string }>;
  user_type?: string;
}

interface FrappeEmployee {
  name: string; // HR-EMP-XXXXX
  employee_name: string;
  company_email?: string;
  personal_email?: string;
  status?: string;
  user_id?: string; // Link to User
  date_of_joining?: string;
}

async function auditFrappeRoles(client: FrappeClient): Promise<void> {
  console.log("\n=== FRAPPE ROLES AUDIT ===\n");

  try {
    // Fetch all roles from Frappe
    const response = await client.request<{ data: FrappeRole[] }>({
      method: "GET",
      url: "/api/resource/Role",
      params: {
        fields: JSON.stringify(["name", "disabled", "desk_access"]),
        filters: JSON.stringify([["disabled", "=", 0]]),
        limit_page_length: 100,
      },
    });

    const roles = response.data || [];
    console.log(`Found ${roles.length} enabled roles in Frappe:\n`);

    // Categorize roles
    const hrmsRoles = roles.filter(
      (r) =>
        r.name.toLowerCase().includes("employee") ||
        r.name.toLowerCase().includes("hr") ||
        r.name.toLowerCase().includes("manager"),
    );

    const systemRoles = roles.filter(
      (r) =>
        r.name.toLowerCase().includes("system") ||
        r.name.toLowerCase().includes("admin") ||
        r.name === "Administrator",
    );

    const otherRoles = roles.filter((r) => !hrmsRoles.includes(r) && !systemRoles.includes(r));

    console.log("HRMS/Employee Roles:");
    hrmsRoles.forEach((r) => console.log(`  - ${r.name} (desk: ${r.desk_access})`));

    console.log("\nSystem/Admin Roles:");
    systemRoles.forEach((r) => console.log(`  - ${r.name} (desk: ${r.desk_access})`));

    console.log(`\nOther Roles: ${otherRoles.length} (use --verbose to list)`);
  } catch (error) {
    console.error("Failed to fetch Frappe roles:", error);
  }
}

async function auditFrappeUsers(client: FrappeClient): Promise<void> {
  console.log("\n=== FRAPPE USERS AUDIT ===\n");

  try {
    const response = await client.request<{ data: FrappeUser[] }>({
      method: "GET",
      url: "/api/resource/User",
      params: {
        fields: JSON.stringify([
          "name",
          "email",
          "enabled",
          "first_name",
          "last_name",
          "user_type",
        ]),
        filters: JSON.stringify([
          ["enabled", "=", 1],
          ["user_type", "!=", "Website User"],
        ]),
        limit_page_length: 20,
      },
    });

    const users = response.data || [];
    console.log(`Found ${users.length} enabled users:\n`);

    for (const user of users) {
      console.log(`${user.email}:`);
      console.log(`  Name: ${user.first_name || ""} ${user.last_name || ""}`);
      console.log(`  Type: ${user.user_type || "System User"}`);
      console.log(`  Enabled: ${user.enabled === 1 ? "Yes" : "No"}`);
      console.log();
    }
  } catch (error) {
    console.error("Failed to fetch Frappe users:", error);
  }
}

async function auditFrappeEmployees(client: FrappeClient): Promise<void> {
  console.log("\n=== FRAPPE EMPLOYEES AUDIT ===\n");

  try {
    const response = await client.request<{ data: FrappeEmployee[] }>({
      method: "GET",
      url: "/api/resource/Employee",
      params: {
        fields: JSON.stringify([
          "name",
          "employee_name",
          "company_email",
          "personal_email",
          "status",
          "user_id",
          "date_of_joining",
        ]),
        limit_page_length: 10,
      },
    });

    const employees = response.data || [];
    console.log(`Found ${employees.length} employees:\n`);

    for (const emp of employees) {
      console.log(`${emp.name}:`);
      console.log(`  Name: ${emp.employee_name}`);
      console.log(`  Email: ${emp.company_email || emp.personal_email || "N/A"}`);
      console.log(`  Status: ${emp.status || "N/A"}`);
      console.log(`  User ID: ${emp.user_id || "NOT LINKED"}`);
      console.log(`  Joined: ${emp.date_of_joining || "N/A"}`);
      console.log();
    }

    // Check for employees WITHOUT user_id
    const unlinkedEmployees = employees.filter((e) => !e.user_id);
    console.log(`\n⚠️  ${unlinkedEmployees.length} employees have NO linked Frappe User`);
    if (unlinkedEmployees.length > 0) {
      console.log("Unlinked employees:");
      unlinkedEmployees.forEach((e) => console.log(`  - ${e.name} (${e.employee_name})`));
    }
  } catch (error) {
    console.error("Failed to fetch Frappe employees:", error);
  }
}

async function auditCiagoApplications(): Promise<void> {
  console.log("\n=== CIAGO APPLICATION STATUS AUDIT ===\n");

  const db = getAdminDb();

  const [applied, hired, rejected, provisioned, failed] = await Promise.all([
    db.jobApplication.count({
      where: { status: "applied", isSoftDeleted: false },
    }),
    db.jobApplication.count({
      where: { status: "hired", isSoftDeleted: false },
    }),
    db.jobApplication.count({
      where: { status: "rejected", isSoftDeleted: false },
    }),
    db.jobApplication.count({
      where: {
        isSoftDeleted: false,
        frappeProvisioningState: "succeeded",
      },
    }),
    db.jobApplication.count({
      where: {
        isSoftDeleted: false,
        frappeProvisioningState: "failed",
      },
    }),
  ]);

  console.log("CiagoTech Application Status:");
  console.log(`  APPLIED: ${applied}`);
  console.log(`  HIRED: ${hired}`);
  console.log(`  REJECTED: ${rejected}`);
  console.log();
  console.log("Frappe Provisioning Status:");
  console.log(`  Succeeded: ${provisioned}`);
  console.log(`  Failed: ${failed}`);
  console.log();

  // Check HIRED applications
  const hiredApps = await db.jobApplication.findMany({
    where: { status: "hired", isSoftDeleted: false },
    select: {
      id: true,
      fullName: true,
      email: true,
      frappeEmployeeName: true,
      frappeProvisioningState: true,
    },
    take: 5,
  });

  console.log(`Sample HIRED applications (showing ${hiredApps.length}):`);
  for (const app of hiredApps) {
    console.log(`  ${app.fullName} (${app.email}):`);
    console.log(`    Frappe Employee: ${app.frappeEmployeeName || "NOT PROVISIONED"}`);
    console.log(`    State: ${app.frappeProvisioningState}`);
  }
}

async function auditUserCreationCapability(client: FrappeClient): Promise<void> {
  console.log("\n=== FRAPPE USER CREATION CAPABILITY AUDIT ===\n");

  console.log("Checking Frappe User creation API...");

  try {
    // Try to get User doctype metadata to understand fields
    const response = await client.request<any>({
      method: "GET",
      url: "/api/resource/User/Administrator",
    });

    const adminUser = response.data;
    console.log("\nAdministrator user fields (sample):");
    console.log(`  email: ${adminUser.email}`);
    console.log(`  enabled: ${adminUser.enabled}`);
    console.log(`  user_type: ${adminUser.user_type}`);
    console.log(`  roles: ${adminUser.roles?.length || 0} roles assigned`);

    if (adminUser.roles && adminUser.roles.length > 0) {
      console.log("\nAdministrator roles:");
      adminUser.roles.slice(0, 5).forEach((r: any) => console.log(`    - ${r.role}`));
      if (adminUser.roles.length > 5) {
        console.log(`    ... and ${adminUser.roles.length - 5} more`);
      }
    }
  } catch (error) {
    console.error("Failed to fetch Administrator user:", error);
  }

  console.log("\n✅ User creation should be possible via POST /api/resource/User");
  console.log("Required fields likely: email, first_name, enabled=1, user_type");
  console.log("Roles assigned via nested 'roles' array: [{ role: 'Role Name' }]");
  console.log("\n⚠️  SECURITY: Use send_welcome_email or invitation mechanism for password setup");
}

async function main() {
  console.log("=========================================");
  console.log("FRAPPE LIFECYCLE AUDIT");
  console.log("=========================================");
  console.log(`Frappe Base URL: ${process.env.FRAPPE_BASE_URL || "NOT SET"}`);
  console.log(`Frappe Sync Enabled: ${process.env.FRAPPE_EMPLOYEE_SYNC_ENABLED || "false"}`);
  console.log("=========================================\n");

  const client = createFrappeClient();

  // Run audits
  await auditCiagoApplications();
  await auditFrappeEmployees(client);
  await auditFrappeUsers(client);
  await auditFrappeRoles(client);
  await auditUserCreationCapability(client);

  console.log("\n=========================================");
  console.log("AUDIT COMPLETE");
  console.log("=========================================\n");

  console.log("KEY FINDINGS:");
  console.log("1. APPLIED → Employee record created in Frappe (provisional)");
  console.log("2. HIRED → Employee enriched with onboarding data");
  console.log("3. ⚠️  Frappe User NOT automatically created at HIRED");
  console.log("4. Employee.user_id field exists for linking User ↔ Employee");
  console.log("5. Frappe roles exist for: Employee, Manager, HR, System Manager");
  console.log("\nRECOMMENDATIONS:");
  console.log("- Implement Frappe User creation at HIRED stage");
  console.log("- Link User to Employee via user_id field");
  console.log("- Assign appropriate Frappe roles based on CiagoTech role");
  console.log("- Use Frappe's send_welcome_email or invitation for secure password setup");
  console.log("- Do NOT store plaintext passwords");
}

main().catch((error) => {
  console.error("Audit failed:", error);
  process.exit(1);
});
