/**
 * Fix remaining workspace issues:
 * 1. HR missing "My Portal" - add Employee role to HR user or adjust My Portal roles
 * 2. Employee seeing too many standard workspaces - restrict standard workspaces
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
  console.log(" FIXING REMAINING ISSUES");
  console.log("========================================\n");

  // Issue 1: HR user missing "My Portal"
  // Reason: My Portal has roles=[] which means everyone sees it
  // But HR user DOES see it in the check... let me check actual roles on My Portal

  console.log("1️⃣  Fix: My Portal visible to HR user\n");

  const myPortal = await frappe("/api/resource/Workspace/My Portal");
  console.log(`   Current My Portal: public=${myPortal.data?.public}, roles=${JSON.stringify((myPortal.data?.roles || []).map((r: any) => r.role))}`);

  // My Portal should be visible to Employee and HR users
  // HR user (joyboygaming) has "Employee" role - so it should work if roles=[]
  // But maybe it didn't show because roles were empty AND the user had HR Manager?
  // Let's explicitly add roles that should see My Portal

  await frappe("/api/resource/Workspace/My Portal", "PUT", {
    public: 1,
    roles: [
      { role: "Employee" },
      { role: "Employee Self Service" },
      { role: "HR Manager" },
      { role: "HR User" },
      { role: "System Manager" },
    ],
    is_hidden: 0,
  });
  console.log("   ✅ My Portal: Added Employee + HR + Admin roles\n");

  // Issue 2: Employee sees too many standard workspaces
  // Standard workspaces visible to employee:
  // Payables, Receivables, Financial Reports, Recruitment, Employee Lifecycle,
  // Performance, Shift & Attendance, Expense Claims, Salary Payout, Leaves, Tax & Benefits
  //
  // Which ones should employee see?
  // ✅ Leaves (apply for leave)
  // ✅ Shift & Attendance (mark attendance)
  // ✅ Expense Claims (submit expenses)
  // ✅ Salary Payout (view salary slips)
  // ✅ Tax & Benefits (view tax info)
  // ❌ Payables (finance only)
  // ❌ Receivables (finance only)
  // ❌ Financial Reports (finance only)
  // ❌ Recruitment (HR only)
  // ❌ Employee Lifecycle (HR only)
  // ❌ Performance (HR/Manager only)

  console.log("2️⃣  Fix: Restricting standard workspaces from regular employees\n");

  const restrictFromEmployees = [
    {
      name: "Payables",
      roles: [{ role: "Accounts Manager" }, { role: "Accounts User" }, { role: "System Manager" }],
    },
    {
      name: "Receivables",
      roles: [{ role: "Accounts Manager" }, { role: "Accounts User" }, { role: "System Manager" }],
    },
    {
      name: "Financial Reports",
      roles: [{ role: "Accounts Manager" }, { role: "Accounts User" }, { role: "System Manager" }],
    },
    {
      name: "Recruitment",
      roles: [{ role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }],
    },
    {
      name: "Employee Lifecycle",
      roles: [{ role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }],
    },
    {
      name: "Performance",
      roles: [{ role: "HR Manager" }, { role: "HR User" }, { role: "Leave Approver" }, { role: "System Manager" }],
    },
  ];

  for (const ws of restrictFromEmployees) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 1,
        roles: ws.roles,
      });
      console.log(`   ✅ ${ws.name} → Restricted to ${ws.roles.map(r => r.role).join(", ")}`);
    } catch (e: any) {
      console.log(`   ❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  // Employee should keep these standard workspaces:
  console.log("\n3️⃣  Ensuring employee-accessible workspaces remain visible\n");

  const keepForEmployees = [
    { name: "Leaves", roles: [{ role: "Employee" }, { role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }] },
    { name: "Shift & Attendance", roles: [{ role: "Employee" }, { role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }] },
    { name: "Expense Claims", roles: [{ role: "Employee" }, { role: "HR Manager" }, { role: "Expense Approver" }, { role: "System Manager" }] },
    { name: "Salary Payout", roles: [{ role: "Employee" }, { role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }] },
    { name: "Tax & Benefits", roles: [{ role: "Employee" }, { role: "HR Manager" }, { role: "HR User" }, { role: "System Manager" }] },
  ];

  for (const ws of keepForEmployees) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 1,
        roles: ws.roles,
      });
      console.log(`   ✅ ${ws.name} → Employee + HR + Admin`);
    } catch (e: any) {
      console.log(`   ❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n========================================");
  console.log(" DONE - Now verifying by logging in again...");
  console.log("========================================\n");
}

main().catch(console.error);
