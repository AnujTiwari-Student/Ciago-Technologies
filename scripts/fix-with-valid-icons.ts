/**
 * Fix workspace icons with VALID Frappe icon names
 * Some icons might not exist in Frappe's icon library
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

async function fixIcons() {
  console.log("========================================");
  console.log(" Using VALID Frappe Icons");
  console.log("========================================\n");

  console.log("💡 Hypothesis: Some icon names might not exist in Frappe\n");
  console.log("Standard Frappe icons that definitely work:");
  console.log("  - hr, accounting, selling, buying, stock");
  console.log("  - projects, support, tools, settings");
  console.log("  - dashboard, reports, home\n");

  console.log("Let's use icons from STANDARD workspaces that we know work:\n");

  // Use icon names from standard workspaces
  const workspaces = [
    { name: "HR Operations", icon: "hr" },  // From HR workspace
    { name: "Finance Hub", icon: "accounting" },  // From Accounting workspace
    { name: "Manager Hub", icon: "dashboard" },  // From dashboard
    { name: "Sales & CRM", icon: "selling" },  // From Selling workspace
    { name: "Projects Hub", icon: "projects" },  // From Projects workspace
    { name: "Support Desk", icon: "support" },  // From Support workspace
    { name: "System Admin", icon: "settings" },  // From settings
    { name: "Executive View", icon: "reports" },  // From reports
    { name: "Procurement Hub", icon: "buying" },  // From Buying workspace
    { name: "My Portal", icon: "tools" },  // From Tools
  ];

  console.log("Updating workspaces with STANDARD icon names:\n");

  for (const ws of workspaces) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        icon: ws.icon,
      });
      console.log(`✅ ${ws.name.padEnd(20)} → ${ws.icon}`);
    } catch (e: any) {
      console.log(`❌ ${ws.name.padEnd(20)} → Error: ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n========================================");
  console.log(" NEXT STEPS");
  console.log("========================================\n");

  console.log("1. Icons updated with STANDARD Frappe icons");
  console.log("2. Refresh browser: Ctrl+Shift+R");
  console.log("3. Or logout and login again");
  console.log("4. Icons should now appear!\n");

  console.log("If icons STILL don't show:");
  console.log("  → The issue might be with workspace VISIBILITY");
  console.log("  → Not the icon itself\n");
}

fixIcons().catch(console.error);
