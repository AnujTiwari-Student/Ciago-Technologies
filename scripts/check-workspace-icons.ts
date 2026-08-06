/**
 * Check and Fix Workspace Icons
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

async function checkIcons() {
  console.log("========================================");
  console.log(" Checking Workspace Icons");
  console.log("========================================\n");

  // Get all workspaces
  const workspaces = await frappe("/api/resource/Workspace?fields=[\"name\",\"title\",\"icon\",\"module\",\"public\",\"is_standard\"]&limit_page_length=200");

  console.log(`Total Workspaces: ${workspaces.data?.length || 0}\n`);

  // Filter custom workspaces (non-standard)
  const customWorkspaces = workspaces.data?.filter((w: any) => !w.is_standard) || [];
  const standardWorkspaces = workspaces.data?.filter((w: any) => w.is_standard) || [];

  console.log(`Standard Workspaces: ${standardWorkspaces.length}`);
  console.log(`Custom Workspaces: ${customWorkspaces.length}\n`);

  console.log("=== CUSTOM WORKSPACES ===\n");
  customWorkspaces.forEach((w: any) => {
    const iconStatus = w.icon ? `✅ ${w.icon}` : "❌ NO ICON";
    console.log(`${w.title || w.name}`);
    console.log(`  Name: ${w.name}`);
    console.log(`  Icon: ${iconStatus}`);
    console.log(`  Public: ${w.public ? "Yes" : "No"}`);
    console.log(`  Module: ${w.module || "None"}`);
    console.log();
  });

  const missingIcons = customWorkspaces.filter((w: any) => !w.icon);

  console.log("=== MISSING ICONS ===");
  console.log(`Workspaces without icons: ${missingIcons.length}\n`);

  if (missingIcons.length > 0) {
    console.log("Workspaces needing icons:");
    missingIcons.forEach((w: any) => console.log(`  - ${w.title || w.name}`));
  }

  return { customWorkspaces, missingIcons };
}

async function fixIcons(missingIcons: any[]) {
  console.log("\n========================================");
  console.log(" Fixing Workspace Icons");
  console.log("========================================\n");

  // Icon mapping (using Frappe icons)
  const iconMap: Record<string, string> = {
    "HR Operations": "users",
    "Finance Hub": "dollar-sign",
    "Manager Hub": "briefcase",
    "Sales & CRM": "trending-up",
    "Projects Hub": "layers",
    "Support Desk": "life-buoy",
    "System Admin": "settings",
    "Executive View": "eye",
    "Procurement Hub": "shopping-cart",
    "My Portal": "user",
  };

  for (const ws of missingIcons) {
    const workspaceName = ws.title || ws.name;
    const icon = iconMap[workspaceName];

    if (icon) {
      try {
        await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
          icon: icon,
        });
        console.log(`✅ ${workspaceName} → icon: ${icon}`);
      } catch (e: any) {
        console.log(`❌ ${workspaceName}: ${e.message?.substring(0, 80)}`);
      }
    } else {
      console.log(`⚠️  ${workspaceName}: No icon mapping found`);
    }
  }

  console.log("\n========================================");
  console.log(" Icon Fix Complete");
  console.log("========================================\n");
  console.log("💡 Clear browser cache and refresh to see icons\n");
}

async function main() {
  const { customWorkspaces, missingIcons } = await checkIcons();

  if (missingIcons.length > 0) {
    console.log("\n🔧 Applying icon fixes...\n");
    await fixIcons(missingIcons);

    // Verify again
    console.log("\n🔍 Verifying fixes...\n");
    const { customWorkspaces: updatedWorkspaces } = await checkIcons();

    const stillMissing = updatedWorkspaces.filter((w: any) => !w.icon);
    if (stillMissing.length === 0) {
      console.log("✅ All custom workspaces now have icons!");
    } else {
      console.log(`⚠️  ${stillMissing.length} workspaces still missing icons`);
    }
  } else {
    console.log("✅ All custom workspaces already have icons!");
  }

  // Print instructions
  console.log("\n========================================");
  console.log(" How to Verify in Browser");
  console.log("========================================\n");
  console.log("1. Open Frappe in browser: http://localhost:8180");
  console.log("2. Press F12 to open DevTools");
  console.log("3. Go to Console tab");
  console.log("4. Run this command:");
  console.log(`\n   cur_page.container.find('.workspace-sidebar-item').each(function() {
     console.log($(this).find('.sidebar-item-label').text(), '→', $(this).find('svg').length > 0 ? 'HAS ICON' : 'NO ICON');
   });\n`);
  console.log("5. This will show which workspaces have icons\n");
}

main().catch(console.error);
