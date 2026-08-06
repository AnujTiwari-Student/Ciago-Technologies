/**
 * Fix workspace visibility - PROPERLY this time
 * Admin should see EVERYTHING
 * Employees should see: Home, Support Desk, My Portal
 * HR should see: HR workspaces + employee workspaces
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

async function fixVisibility() {
  console.log("========================================");
  console.log(" FIXING WORKSPACE VISIBILITY");
  console.log("========================================\n");

  console.log("Goal:");
  console.log("  - Admin (System Manager): See EVERYTHING");
  console.log("  - Employees: See Home, My Portal, Support Desk");
  console.log("  - HR: See HR workspaces + employee workspaces\n");

  // 1. Workspaces that EVERYONE should see (including employees)
  console.log("1️⃣  Making workspaces PUBLIC for all employees:\n");

  const publicWorkspaces = [
    { name: "Home", icon: "home" },
    { name: "My Portal", icon: "hr" },
    { name: "Support Desk", icon: "support" },
  ];

  for (const ws of publicWorkspaces) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 1,  // Public = visible to ALL users
        roles: [],  // Empty roles = no restrictions
        is_hidden: 0,
        icon: ws.icon,
      });
      console.log(`   ✅ ${ws.name} → PUBLIC (visible to all)`);
    } catch (e: any) {
      console.log(`   ❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  // 2. HR workspaces - visible to HR team AND admins
  console.log("\n2️⃣  Setting HR workspaces:\n");

  const hrWorkspaces = [
    { name: "HR Operations", icon: "hr" },
  ];

  for (const ws of hrWorkspaces) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 0,
        roles: [
          { role: "HR Manager" },
          { role: "HR User" },
          { role: "System Manager" },  // Admin can see
        ],
        is_hidden: 0,
        icon: ws.icon,
      });
      console.log(`   ✅ ${ws.name} → HR + Admin`);
    } catch (e: any) {
      console.log(`   ❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  // 3. Department-specific workspaces - visible to department + admins
  console.log("\n3️⃣  Setting department workspaces:\n");

  const deptWorkspaces = [
    {
      name: "Finance Hub",
      icon: "accounting",
      roles: [{ role: "Accounts Manager" }, { role: "Accounts User" }, { role: "System Manager" }],
    },
    {
      name: "Sales & CRM",
      icon: "sell",
      roles: [{ role: "Sales Manager" }, { role: "Sales User" }, { role: "System Manager" }],
    },
    {
      name: "Projects Hub",
      icon: "projects",
      roles: [{ role: "Projects Manager" }, { role: "Projects User" }, { role: "System Manager" }],
    },
    {
      name: "Procurement Hub",
      icon: "buying",
      roles: [{ role: "Purchase Manager" }, { role: "Purchase User" }, { role: "System Manager" }],
    },
    {
      name: "Manager Hub",
      icon: "dashboard",
      roles: [
        { role: "Leave Approver" },
        { role: "Expense Approver" },
        { role: "HR Manager" },
        { role: "System Manager" },
      ],
    },
  ];

  for (const ws of deptWorkspaces) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 0,
        roles: ws.roles,
        is_hidden: 0,
        icon: ws.icon,
      });
      console.log(`   ✅ ${ws.name} → Department + Admin`);
    } catch (e: any) {
      console.log(`   ❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  // 4. Admin-only workspaces
  console.log("\n4️⃣  Setting admin-only workspaces:\n");

  const adminWorkspaces = [
    { name: "System Admin", icon: "setting" },
    { name: "Executive View", icon: "accounting" },
  ];

  for (const ws of adminWorkspaces) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        public: 0,
        roles: [{ role: "System Manager" }],
        is_hidden: 0,
        icon: ws.icon,
      });
      console.log(`   ✅ ${ws.name} → Admin only`);
    } catch (e: any) {
      console.log(`   ❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  // 5. Make sure standard workspaces are also accessible
  console.log("\n5️⃣  Checking standard workspaces:\n");

  const standardWorkspaces = ["HR", "Accounting", "Selling", "Buying", "Stock", "Projects"];

  for (const wsName of standardWorkspaces) {
    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      if (ws.data) {
        // Just verify, don't change standard workspaces too much
        console.log(`   ℹ️  ${wsName} - exists (standard workspace)`);
      }
    } catch (e) {
      console.log(`   ℹ️  ${wsName} - not found`);
    }
  }

  console.log("\n========================================");
  console.log(" Testing Access");
  console.log("========================================\n");

  // Check user roles
  console.log("Checking user roles:\n");

  const users = [
    "anujavengers@gmail.com",
    "joyboygaming2901@gmail.com",
    "tktpay2901@gmail.com",
  ];

  for (const email of users) {
    try {
      const user = await frappe(`/api/resource/User/${encodeURIComponent(email)}`);

      if (user.data) {
        const roles = (user.data.roles || []).map((r: any) => r.role).join(", ");
        console.log(`   ${email}`);
        console.log(`      Roles: ${roles || "NONE"}\n`);
      }
    } catch (e) {
      console.log(`   ${email} - Error\n`);
    }
  }

  console.log("========================================");
  console.log(" Expected Visibility");
  console.log("========================================\n");

  console.log("After logout/login:\n");

  console.log("👤 EMPLOYEE (tktpay2901@gmail.com) should see:");
  console.log("   - Home");
  console.log("   - My Portal");
  console.log("   - Support Desk");
  console.log("   - Any standard workspaces based on their roles\n");

  console.log("👔 HR USER (joyboygaming2901@gmail.com) should see:");
  console.log("   - Everything employees see +");
  console.log("   - HR Operations");
  console.log("   - Manager Hub");
  console.log("   - Standard HR workspace\n");

  console.log("👨‍💼 ADMIN (anujavengers@gmail.com) should see:");
  console.log("   - EVERYTHING (all custom + all standard workspaces)\n");

  console.log("========================================");
  console.log(" CRITICAL: LOGOUT AND LOGIN");
  console.log("========================================\n");

  console.log("⚠️  Workspace visibility is SESSION-BASED");
  console.log("   You MUST logout and login for changes to take effect!\n");

  console.log("Steps:");
  console.log("  1. Go to Frappe: http://localhost:8180");
  console.log("  2. Click profile picture → Logout");
  console.log("  3. Login again");
  console.log("  4. Check sidebar\n");
}

fixVisibility().catch(console.error);
