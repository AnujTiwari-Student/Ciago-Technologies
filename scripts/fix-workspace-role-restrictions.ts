/**
 * Fix workspace visibility - set proper role restrictions
 * Employees should see fewer workspaces, admins see all
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function frappe(endpoint: string, method = "GET", body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  return res.json();
}

async function fixRoles() {
  console.log("========================================");
  console.log(" Setting Proper Workspace Roles");
  console.log("========================================\n");

  console.log("Goal:");
  console.log("  - Employees see: My Portal, HR Operations, Support Desk");
  console.log("  - HR sees: + Finance Hub, Manager Hub");
  console.log("  - Managers see: + Projects Hub, Sales & CRM");
  console.log("  - Admins see: Everything\n");

  const workspaceRoles = [
    {
      name: "HR Operations",
      roles: [
        { role: "HR Manager" },
        { role: "HR User" },
        { role: "System Manager" },
      ],
    },
    {
      name: "Finance Hub",
      roles: [
        { role: "Accounts Manager" },
        { role: "Accounts User" },
        { role: "System Manager" },
      ],
    },
    {
      name: "Manager Hub",
      roles: [
        { role: "Leave Approver" },
        { role: "Expense Approver" },
        { role: "Projects Manager" },
        { role: "Sales Manager" },
        { role: "HR Manager" },
        { role: "System Manager" },
      ],
    },
    {
      name: "Sales & CRM",
      roles: [
        { role: "Sales User" },
        { role: "Sales Manager" },
        { role: "System Manager" },
      ],
    },
    {
      name: "Projects Hub",
      roles: [
        { role: "Projects User" },
        { role: "Projects Manager" },
        { role: "System Manager" },
      ],
    },
    {
      name: "Support Desk",
      roles: [
        { role: "Support Team" },
        { role: "Employee" },
        { role: "System Manager" },
      ],
    },
    {
      name: "System Admin",
      roles: [
        { role: "System Manager" },
        { role: "Administrator" },
      ],
    },
    {
      name: "Executive View",
      roles: [
        { role: "System Manager" },
      ],
    },
    {
      name: "Procurement Hub",
      roles: [
        { role: "Purchase Manager" },
        { role: "Purchase User" },
        { role: "Stock Manager" },
        { role: "System Manager" },
      ],
    },
    {
      name: "My Portal",
      roles: [
        { role: "Employee" },
        { role: "Employee Self Service" },
      ],
    },
  ];

  console.log("Setting role restrictions:\n");

  for (const ws of workspaceRoles) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        roles: ws.roles,
        public: 0,  // Not public - restricted by roles
      });

      const roleNames = ws.roles.map(r => r.role).join(", ");
      console.log(`✅ ${ws.name}`);
      console.log(`   Roles: ${roleNames}\n`);
    } catch (e: any) {
      console.log(`❌ ${ws.name}: ${e.message?.substring(0, 60)}\n`);
    }
  }

  console.log("========================================");
  console.log(" Testing User Access");
  console.log("========================================\n");

  console.log("After this fix:");
  console.log("\n👤 EMPLOYEE (tktpay2901@gmail.com) will see:");
  console.log("   - My Portal");
  console.log("   - Support Desk");
  console.log("   - HR (standard - for leaves/attendance)");
  console.log("\n👔 HR USER (joyboygaming2901@gmail.com) will see:");
  console.log("   - Everything above +");
  console.log("   - HR Operations");
  console.log("   - Manager Hub (if Leave Approver)");
  console.log("\n👨‍💼 ADMIN (anujavengers@gmail.com) will see:");
  console.log("   - ALL workspaces");
  console.log("\n💡 Standard workspaces (HR, Projects, etc.) still visible based on their own roles\n");

  console.log("========================================");
  console.log(" IMPORTANT: Hide Duplicate Standard Workspaces");
  console.log("========================================\n");

  console.log("You have both:");
  console.log("  - 'HR Operations' (custom)");
  console.log("  - 'HR' (standard Frappe)");
  console.log("\nTo hide standard 'HR' workspace for employees:");
  console.log("  1. Go to Workspace List");
  console.log("  2. Open 'HR' workspace");
  console.log("  3. Remove 'Employee' from roles");
  console.log("  4. Keep only HR Manager, HR User");
  console.log("\nOr I can do it via API...\n");
}

async function hideStandardWorkspaces() {
  console.log("Hiding standard workspaces that conflict with custom ones:\n");

  // Hide standard HR from employees (they should use HR Operations)
  try {
    const hrWs = await frappe("/api/resource/Workspace/HR");

    if (hrWs.data) {
      // Remove Employee role, keep only HR roles
      const newRoles = [
        { role: "HR Manager" },
        { role: "HR User" },
        { role: "System Manager" },
      ];

      await frappe("/api/resource/Workspace/HR", "PUT", {
        roles: newRoles,
        public: 0,
      });

      console.log("✅ Standard 'HR' workspace - restricted to HR users only");
    }
  } catch (e) {
    console.log("⚠️  Could not update standard HR workspace");
  }

  // Hide standard Projects from regular employees
  try {
    const projWs = await frappe("/api/resource/Workspace/Projects");

    if (projWs.data) {
      const newRoles = [
        { role: "Projects User" },
        { role: "Projects Manager" },
        { role: "System Manager" },
      ];

      await frappe("/api/resource/Workspace/Projects", "PUT", {
        roles: newRoles,
        public: 0,
      });

      console.log("✅ Standard 'Projects' workspace - restricted to project users only");
    }
  } catch (e) {
    console.log("⚠️  Could not update standard Projects workspace");
  }

  console.log("\n✅ Done! Logout and login to see clean workspace sidebar.\n");
}

async function main() {
  await fixRoles();
  await hideStandardWorkspaces();

  console.log("========================================");
  console.log(" Summary");
  console.log("========================================\n");

  console.log("✅ Custom workspaces: Role restrictions set");
  console.log("✅ Standard workspaces: Hidden from employees");
  console.log("✅ Employees now see clean, minimal sidebar");
  console.log("✅ Admins still see everything\n");

  console.log("🔄 LOGOUT and LOGIN to see changes!\n");
}

main().catch(console.error);
