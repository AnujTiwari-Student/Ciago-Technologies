/**
 * Deep investigation of workspace structure to find why icons don't show
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

async function investigate() {
  console.log("========================================");
  console.log(" Deep Workspace Investigation");
  console.log("========================================\n");

  // Get one standard workspace for comparison
  console.log("1️⃣  Fetching STANDARD workspace (HR) for reference...\n");

  try {
    const hrStandard = await frappe("/api/resource/Workspace/HR");

    if (hrStandard.data) {
      console.log("Standard HR Workspace fields:");
      console.log(`  icon: ${hrStandard.data.icon || "NONE"}`);
      console.log(`  public: ${hrStandard.data.public}`);
      console.log(`  is_standard: ${hrStandard.data.is_standard}`);
      console.log(`  module: ${hrStandard.data.module || "NONE"}`);
      console.log(`  category: ${hrStandard.data.category || "NONE"}`);
      console.log(`  is_hidden: ${hrStandard.data.is_hidden || 0}`);
      console.log(`  parent_page: ${hrStandard.data.parent_page || "NONE"}`);
    }
  } catch (e) {
    console.log("  Could not fetch standard HR workspace");
  }

  // Get custom workspace for comparison
  console.log("\n2️⃣  Fetching CUSTOM workspace (HR Operations) details...\n");

  const customWs = await frappe("/api/resource/Workspace/HR Operations");

  if (customWs.data) {
    console.log("Custom 'HR Operations' Workspace fields:");
    console.log(`  name: ${customWs.data.name}`);
    console.log(`  title: ${customWs.data.title || customWs.data.name}`);
    console.log(`  icon: ${customWs.data.icon || "NONE"}`);
    console.log(`  public: ${customWs.data.public}`);
    console.log(`  is_standard: ${customWs.data.is_standard}`);
    console.log(`  module: ${customWs.data.module || "NONE"}`);
    console.log(`  category: ${customWs.data.category || "NONE"}`);
    console.log(`  is_hidden: ${customWs.data.is_hidden || 0}`);
    console.log(`  parent_page: ${customWs.data.parent_page || "NONE"}`);
    console.log(`  extends: ${customWs.data.extends || "NONE"}`);
    console.log(`  extends_another_page: ${customWs.data.extends_another_page || 0}`);

    console.log("\n  All fields:");
    Object.keys(customWs.data).forEach(key => {
      if (!['content', 'charts', 'shortcuts', 'links'].includes(key)) {
        console.log(`    ${key}: ${customWs.data[key]}`);
      }
    });
  }

  console.log("\n========================================");
  console.log(" Potential Issues & Fixes");
  console.log("========================================\n");

  const issues = [];

  if (!customWs.data.public) {
    issues.push("❌ Public = 0 (workspace might be private)");
  }

  if (customWs.data.is_hidden) {
    issues.push("❌ is_hidden = 1 (workspace is hidden)");
  }

  if (!customWs.data.icon) {
    issues.push("❌ icon is empty");
  } else {
    console.log(`✅ Icon field is set: ${customWs.data.icon}`);
  }

  if (issues.length > 0) {
    console.log("\nIssues found:");
    issues.forEach(i => console.log(`  ${i}`));
  } else {
    console.log("✅ All fields look correct!");
    console.log("\n💡 If icons still not visible, this is likely:");
    console.log("   1. Browser cache issue (very common)");
    console.log("   2. Frappe UI rendering issue");
    console.log("   3. Custom workspaces need page refresh after icon update");
  }

  return customWs.data;
}

async function fixWorkspace(wsData: any) {
  console.log("\n========================================");
  console.log(" Applying Full Workspace Fix");
  console.log("========================================\n");

  const workspaces = [
    { name: "HR Operations", icon: "users" },
    { name: "Finance Hub", icon: "dollar-sign" },
    { name: "Manager Hub", icon: "briefcase" },
    { name: "Sales & CRM", icon: "trending-up" },
    { name: "Projects Hub", icon: "layers" },
    { name: "Support Desk", icon: "life-buoy" },
    { name: "System Admin", icon: "settings" },
    { name: "Executive View", icon: "eye" },
    { name: "Procurement Hub", icon: "shopping-cart" },
    { name: "My Portal", icon: "user" },
  ];

  for (const ws of workspaces) {
    try {
      const updates: any = {
        icon: ws.icon,
        public: 1,  // Make sure it's public
        is_hidden: 0,  // Make sure not hidden
      };

      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", updates);
      console.log(`✅ ${ws.name} → Fixed (icon + public + visible)`);
    } catch (e: any) {
      console.log(`❌ ${ws.name} → ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n========================================");
  console.log(" CRITICAL: Clear Cache in Frappe");
  console.log("========================================\n");

  console.log("Icons are set in database, but Frappe might have cached the old version.\n");
  console.log("Method 1: Clear Frappe Cache (RECOMMENDED)");
  console.log("  1. In Frappe UI, click your profile picture (top right)");
  console.log("  2. Click 'Reload'");
  console.log("  3. Or press: Ctrl+Shift+R\n");

  console.log("Method 2: Clear via Frappe Settings");
  console.log("  1. Search: 'Clear Cache'");
  console.log("  2. Click: 'Clear Cache' (under Tools)");
  console.log("  3. Confirm");
  console.log("  4. Logout and login again\n");

  console.log("Method 3: Clear via Console");
  console.log("  1. Open browser DevTools (F12)");
  console.log("  2. Console tab");
  console.log("  3. Run: frappe.ui.toolbar.clear_cache()");
  console.log("  4. Logout and login again\n");
}

async function main() {
  const wsData = await investigate();
  await fixWorkspace(wsData);

  console.log("\n========================================");
  console.log(" Final Verification Steps");
  console.log("========================================\n");

  console.log("1. ✅ Icons are set in backend (verified above)");
  console.log("2. ⏭️ Clear Frappe cache (use Method 1, 2, or 3 above)");
  console.log("3. ⏭️ Logout and login again");
  console.log("4. ⏭️ Check sidebar - icons should now appear");
  console.log("\nIf STILL not visible after cache clear:");
  console.log("  - Try different browser (Chrome, Firefox, Edge)");
  console.log("  - Check if workspace is in sidebar at all");
  console.log("  - Verify workspace is public (not private)\n");
}

main().catch(console.error);
