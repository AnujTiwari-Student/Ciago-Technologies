/**
 * VERIFY AND FIX - Check actual workspace visibility per user
 *
 * In Frappe v15:
 * - public=1, roles=[] → visible to ALL users
 * - public=1, roles=[...] → visible ONLY to users with those roles
 * - public=0 → PRIVATE workspace (only visible to for_user)
 *
 * MISTAKE MADE BEFORE: Setting public=0 hides workspace from everyone!
 * CORRECT: Keep public=1 and use roles[] to restrict
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

async function main() {
  console.log("========================================");
  console.log(" VERIFY & FIX WORKSPACE VISIBILITY");
  console.log("========================================\n");

  // Step 1: Get user roles
  console.log("Step 1: Getting user roles...\n");

  const userRoles: Record<string, string[]> = {};

  for (const email of ["anujavengers@gmail.com", "joyboygaming2901@gmail.com", "tktpay2901@gmail.com"]) {
    const user = await frappe(`/api/resource/User/${encodeURIComponent(email)}`);
    userRoles[email] = (user.data?.roles || []).map((r: any) => r.role);
    console.log(`  ${email}: ${userRoles[email].length} roles`);
  }

  // Step 2: Check current state of ALL custom workspaces
  console.log("\n\nStep 2: Checking current workspace state...\n");

  const customWsList = [
    "HR Operations", "Finance Hub", "Manager Hub", "Sales & CRM",
    "Projects Hub", "Support Desk", "System Admin", "Executive View",
    "Procurement Hub", "My Portal",
  ];

  for (const wsName of customWsList) {
    const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);
    if (ws.data) {
      const roles = (ws.data.roles || []).map((r: any) => r.role);
      console.log(`  ${wsName.padEnd(20)} public=${ws.data.public}  roles=[${roles.join(", ")}]`);

      // Check who can see it
      const adminCanSee = ws.data.public === 1 && (roles.length === 0 || roles.some((r: string) => userRoles["anujavengers@gmail.com"].includes(r)));
      const hrCanSee = ws.data.public === 1 && (roles.length === 0 || roles.some((r: string) => userRoles["joyboygaming2901@gmail.com"].includes(r)));
      const empCanSee = ws.data.public === 1 && (roles.length === 0 || roles.some((r: string) => userRoles["tktpay2901@gmail.com"].includes(r)));

      if (!adminCanSee) {
        console.log(`    ⚠️  PROBLEM: Admin CANNOT see this! (public=${ws.data.public})`);
      }
    }
  }

  // Step 3: Apply CORRECT configuration
  console.log("\n\nStep 3: Applying CORRECT configuration...\n");
  console.log("Rule: ALL workspaces must be public=1. Use roles[] to restrict.\n");

  // Employee workspaces: public=1, roles=[] (visible to everyone)
  const employeeWorkspaces = [
    { name: "My Portal", icon: "hr", roles: [] },
    { name: "Support Desk", icon: "support", roles: [] },
  ];

  // HR workspaces: public=1, roles=[HR Manager, HR User, System Manager]
  const hrRestrictedWorkspaces = [
    {
      name: "HR Operations",
      icon: "hr",
      roles: [{ role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }],
    },
    {
      name: "Manager Hub",
      icon: "dashboard",
      roles: [{ role: "HR Manager" }, { role: "Leave Approver" }, { role: "Expense Approver" }, { role: "System Manager" }],
    },
  ];

  // Department workspaces: public=1, roles=[department + System Manager]
  const departmentWorkspaces = [
    {
      name: "Finance Hub",
      icon: "accounting",
      roles: [{ role: "Accounts Manager" }, { role: "Accounts User" }, { role: "System Manager" }],
    },
    {
      name: "Sales & CRM",
      icon: "sell",
      roles: [{ role: "Sales Manager" }, { role: "Sales User" }, { role: "Sales Master Manager" }, { role: "System Manager" }],
    },
    {
      name: "Projects Hub",
      icon: "projects",
      roles: [{ role: "Projects Manager" }, { role: "Projects User" }, { role: "System Manager" }],
    },
    {
      name: "Procurement Hub",
      icon: "buying",
      roles: [{ role: "Purchase Manager" }, { role: "Purchase User" }, { role: "Stock Manager" }, { role: "System Manager" }],
    },
  ];

  // Admin-only: public=1, roles=[System Manager]
  const adminWorkspaces = [
    { name: "System Admin", icon: "setting", roles: [{ role: "System Manager" }] },
    { name: "Executive View", icon: "accounting", roles: [{ role: "System Manager" }] },
  ];

  const allUpdates = [
    ...employeeWorkspaces.map(ws => ({ ...ws, label: "PUBLIC (all users)" })),
    ...hrRestrictedWorkspaces.map(ws => ({ ...ws, label: "HR + Admin" })),
    ...departmentWorkspaces.map(ws => ({ ...ws, label: "Department + Admin" })),
    ...adminWorkspaces.map(ws => ({ ...ws, label: "Admin only" })),
  ];

  for (const ws of allUpdates) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 1,       // MUST be 1 for visibility!
        roles: ws.roles, // Empty = everyone, non-empty = restricted
        is_hidden: 0,
        icon: ws.icon,
      });
      console.log(`  ✅ ${ws.name.padEnd(20)} → public=1, roles=${ws.roles.length === 0 ? "[] (everyone)" : JSON.stringify(ws.roles.map((r: any) => r.role))}`);
    } catch (e: any) {
      console.log(`  ❌ ${ws.name.padEnd(20)} → ${e.message?.substring(0, 60)}`);
    }
  }

  // Step 4: Verify final state
  console.log("\n\nStep 4: Verifying final state...\n");

  for (const wsName of customWsList) {
    const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);
    if (ws.data) {
      const roles = (ws.data.roles || []).map((r: any) => r.role);

      // Check visibility for each user
      const adminRoles = userRoles["anujavengers@gmail.com"];
      const hrRoles = userRoles["joyboygaming2901@gmail.com"];
      const empRoles = userRoles["tktpay2901@gmail.com"];

      const adminSees = ws.data.public === 1 && (roles.length === 0 || roles.some((r: string) => adminRoles.includes(r)));
      const hrSees = ws.data.public === 1 && (roles.length === 0 || roles.some((r: string) => hrRoles.includes(r)));
      const empSees = ws.data.public === 1 && (roles.length === 0 || roles.some((r: string) => empRoles.includes(r)));

      const adminIcon = adminSees ? "✅" : "❌";
      const hrIcon = hrSees ? "✅" : "❌";
      const empIcon = empSees ? "✅" : "❌";

      console.log(`  ${wsName.padEnd(20)} Admin:${adminIcon}  HR:${hrIcon}  Employee:${empIcon}`);
    }
  }

  console.log("\n\n========================================");
  console.log(" EXPECTED RESULTS");
  console.log("========================================\n");

  console.log("After LOGOUT and LOGIN:\n");

  console.log("👨‍💼 ADMIN (anujavengers@gmail.com):");
  console.log("   Custom: ALL 10 workspaces visible");
  console.log("   Standard: ALL standard Frappe workspaces\n");

  console.log("👔 HR (joyboygaming2901@gmail.com):");
  console.log("   Custom: My Portal, Support Desk, HR Operations, Manager Hub");
  console.log("   Standard: HR, Payroll, etc. (based on HR roles)\n");

  console.log("👤 EMPLOYEE (tktpay2901@gmail.com):");
  console.log("   Custom: My Portal, Support Desk");
  console.log("   Standard: Home (always visible)\n");

  console.log("========================================");
  console.log(" ACTION REQUIRED: LOGOUT AND LOGIN!");
  console.log("========================================\n");
}

main().catch(console.error);
