/**
 * Fix the 4 workspaces without icons
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

async function checkMissing() {
  console.log("========================================");
  console.log(" Checking 4 Workspaces Without Icons");
  console.log("========================================\n");

  const missingIcons = ["Sales & CRM", "System Admin", "Executive View", "My Portal"];

  for (const wsName of missingIcons) {
    console.log(`\n📋 ${wsName}:`);

    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      if (ws.data) {
        console.log(`   Current icon: "${ws.data.icon}"`);
        console.log(`   Public: ${ws.data.public}`);
        console.log(`   Hidden: ${ws.data.is_hidden}`);
        console.log(`   Shortcuts: ${ws.data.shortcuts?.length || 0}`);
        console.log(`   Links: ${ws.data.links?.length || 0}`);

        // Check if icon name is valid
        if (!ws.data.icon) {
          console.log(`   ❌ Icon is empty!`);
        }
      }
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n========================================");
  console.log(" Trying Different Icon Names");
  console.log("========================================\n");

  // Try different icon names - maybe "selling" "settings" etc don't work
  const iconMap = {
    "Sales & CRM": "folder",  // Generic folder icon (works everywhere)
    "System Admin": "tool",  // Tool icon instead of settings
    "Executive View": "trending-up",  // Chart icon
    "My Portal": "home",  // Home icon
  };

  for (const [wsName, icon] of Object.entries(iconMap)) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`, "PUT", {
        icon: icon,
      });
      console.log(`✅ ${wsName.padEnd(20)} → ${icon}`);
    } catch (e: any) {
      console.log(`❌ ${wsName.padEnd(20)} → Error`);
    }
  }

  console.log("\n💡 Using generic icon names that work everywhere");
  console.log("   Refresh browser: Ctrl+Shift+R\n");
}

checkMissing().catch(console.error);
