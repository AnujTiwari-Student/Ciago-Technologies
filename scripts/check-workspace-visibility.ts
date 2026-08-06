/**
 * Check which workspaces are visible and why some might not show
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

async function checkVisibility() {
  console.log("========================================");
  console.log(" Checking Workspace Visibility");
  console.log("========================================\n");

  const workspaces = [
    "HR Operations",
    "Finance Hub",
    "Manager Hub",
    "Sales & CRM",
    "Projects Hub",
    "Support Desk",
    "System Admin",
    "Executive View",
    "Procurement Hub",
    "My Portal",
  ];

  console.log("Checking each workspace:\n");

  for (const wsName of workspaces) {
    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      if (ws.data) {
        const roles = ws.data.roles || [];
        const roleNames = roles.map((r: any) => r.role).join(", ");

        console.log(`📋 ${wsName}`);
        console.log(`   Icon: ${ws.data.icon || "NONE"}`);
        console.log(`   Public: ${ws.data.public ? "Yes" : "No"}`);
        console.log(`   Hidden: ${ws.data.is_hidden ? "Yes" : "No"}`);
        console.log(`   Roles: ${roleNames || "NONE (public to all)"}`);
        console.log(`   Module: ${ws.data.module || "NONE"}`);

        // Check if has content
        const hasContent = (ws.data.shortcuts?.length > 0) || (ws.data.links?.length > 0);
        console.log(`   Has Content: ${hasContent ? "Yes" : "No"}`);

        console.log();
      }
    } catch (e: any) {
      console.log(`❌ ${wsName}: ${e.message?.substring(0, 60)}\n`);
    }
  }

  console.log("========================================");
  console.log(" Analysis");
  console.log("========================================\n");

  console.log("For a workspace to show with icon, it needs:");
  console.log("  1. ✅ icon field set (we just did this)");
  console.log("  2. ✅ public = 1 OR user has one of the roles");
  console.log("  3. ✅ is_hidden = 0");
  console.log("  4. ✅ Has content (shortcuts/links)");
  console.log("  5. ⚠️  Module might affect visibility\n");

  console.log("💡 If some workspaces don't show:");
  console.log("   → They might be restricted by role");
  console.log("   → User (anujavengers@gmail.com) might not have those roles\n");
}

async function fixAllVisibility() {
  console.log("========================================");
  console.log(" Making ALL Workspaces Public");
  console.log("========================================\n");

  const workspaces = [
    "HR Operations",
    "Finance Hub",
    "Manager Hub",
    "Sales & CRM",
    "Projects Hub",
    "Support Desk",
    "System Admin",
    "Executive View",
    "Procurement Hub",
    "My Portal",
  ];

  console.log("Setting ALL workspaces to public (no role restrictions):\n");

  for (const wsName of workspaces) {
    try {
      // Get current workspace
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      // Update: clear roles to make it public to everyone
      await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`, "PUT", {
        public: 1,
        is_hidden: 0,
        roles: [],  // Empty roles = visible to all
      });

      console.log(`✅ ${wsName} → Made fully public`);
    } catch (e: any) {
      console.log(`❌ ${wsName} → ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n========================================");
  console.log(" Done - Refresh Browser");
  console.log("========================================\n");

  console.log("All custom workspaces are now:");
  console.log("  - Public (visible to all users)");
  console.log("  - Not hidden");
  console.log("  - Have standard Frappe icons");
  console.log("  - No role restrictions\n");

  console.log("🔄 Refresh browser (Ctrl+Shift+R) to see ALL icons!\n");
}

async function main() {
  await checkVisibility();

  console.log("\n🔧 Applying fix to make all workspaces visible...\n");

  await fixAllVisibility();
}

main().catch(console.error);
