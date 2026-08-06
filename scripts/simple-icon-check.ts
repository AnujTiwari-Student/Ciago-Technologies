/**
 * Simple workspace icon verification
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function frappe(endpoint: string) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.json();
}

async function checkIcons() {
  console.log("========================================");
  console.log(" Workspace Icon Verification");
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

  console.log("Checking custom workspaces:\n");

  for (const wsName of workspaces) {
    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      if (ws.data) {
        const icon = ws.data.icon || "NO ICON";
        const status = ws.data.icon ? "✅" : "❌";
        console.log(`${status} ${wsName.padEnd(20)} → ${icon}`);
      }
    } catch (e) {
      console.log(`⚠️  ${wsName.padEnd(20)} → NOT FOUND`);
    }
  }

  console.log("\n========================================");
  console.log(" Visual Check Instructions");
  console.log("========================================\n");

  console.log("To see icons in browser:");
  console.log("1. Open: http://localhost:8180");
  console.log("2. Login as: anujavengers@gmail.com");
  console.log("3. Look at the LEFT SIDEBAR");
  console.log("4. Each workspace should show an ICON + NAME");
  console.log("5. If no icons visible:");
  console.log("   - Press Ctrl+Shift+R (hard refresh)");
  console.log("   - Or clear browser cache completely");
  console.log("   - Or try different browser\n");

  console.log("========================================");
  console.log(" Alternative: Check in Workspace List");
  console.log("========================================\n");

  console.log("1. In Frappe, press Ctrl+K (search)");
  console.log("2. Type: 'Workspace List'");
  console.log("3. Click: 'Workspace List'");
  console.log("4. You'll see all workspaces with their icons");
  console.log("5. Filter by: 'Is Standard = No' to see custom ones\n");
}

checkIcons().catch(console.error);
