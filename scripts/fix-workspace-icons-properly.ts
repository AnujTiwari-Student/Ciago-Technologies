/**
 * Properly fix workspace icons by checking actual workspace records
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
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

async function main() {
  console.log("========================================");
  console.log(" Fixing Workspace Icons - Proper Method");
  console.log("========================================\n");

  // Define exact workspace names that need icons
  const workspacesToFix = [
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

  console.log("Attempting to fix icons for custom workspaces...\n");

  let fixed = 0;
  let notFound = 0;
  let errors = 0;

  for (const ws of workspacesToFix) {
    try {
      // Check if workspace exists
      const checkRes = await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`);

      if (checkRes.data) {
        // Workspace exists, update it
        const updateRes = await frappe(
          `/api/resource/Workspace/${encodeURIComponent(ws.name)}`,
          "PUT",
          { icon: ws.icon }
        );

        if (updateRes.data) {
          console.log(`✅ ${ws.name} → ${ws.icon}`);
          fixed++;
        } else {
          console.log(`⚠️  ${ws.name}: Update returned no data`);
          errors++;
        }
      } else {
        console.log(`❌ ${ws.name}: Not found`);
        notFound++;
      }
    } catch (e: any) {
      const msg = e.message || String(e);
      if (msg.includes("DoesNotExist") || msg.includes("404")) {
        console.log(`❌ ${ws.name}: Workspace does not exist`);
        notFound++;
      } else {
        console.log(`⚠️  ${ws.name}: ${msg.substring(0, 80)}`);
        errors++;
      }
    }
  }

  console.log("\n========================================");
  console.log(" Summary");
  console.log("========================================\n");
  console.log(`✅ Fixed: ${fixed}`);
  console.log(`❌ Not Found: ${notFound}`);
  console.log(`⚠️  Errors: ${errors}\n`);

  if (notFound > 0) {
    console.log("💡 Workspaces not found - they may have different names");
    console.log("   Let's list all available workspaces...\n");

    try {
      const allWorkspaces = await frappe("/api/resource/Workspace?limit_page_length=500");

      if (allWorkspaces.data && allWorkspaces.data.length > 0) {
        console.log(`Found ${allWorkspaces.data.length} total workspaces:\n`);

        // Show first 30
        allWorkspaces.data.slice(0, 30).forEach((w: any) => {
          console.log(`  - ${w.name}`);
        });

        if (allWorkspaces.data.length > 30) {
          console.log(`  ... and ${allWorkspaces.data.length - 30} more\n`);
        }
      }
    } catch (e) {
      console.log("Could not list workspaces");
    }
  }

  console.log("\n========================================");
  console.log(" Browser Console Verification");
  console.log("========================================\n");
  console.log("To check icons in browser:");
  console.log("1. Open: http://localhost:8180");
  console.log("2. Login as anujavengers@gmail.com");
  console.log("3. Press F12 (DevTools)");
  console.log("4. Go to Console tab");
  console.log("5. Paste and run:\n");
  console.log(`// Check workspace icons
frappe.call({
  method: 'frappe.desk.desktop.get_desktop_page',
  args: { page: '' },
  callback: function(r) {
    if (r.message && r.message.cards) {
      r.message.cards.shortcuts.items.forEach(item => {
        console.log(item.label + ' → Icon: ' + (item.icon || 'NONE'));
      });
    }
  }
});\n`);

  console.log("This will show all visible workspaces and their icons\n");
}

main().catch(console.error);
