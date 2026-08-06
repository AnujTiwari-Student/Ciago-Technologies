/**
 * Compare HR Operations (working icon) vs Finance Hub (no icon)
 * to find the difference
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

async function compare() {
  console.log("========================================");
  console.log(" Comparing Workspaces");
  console.log("========================================\n");

  // HR Operations - HAS ICON
  console.log("1️⃣  HR Operations (ICON VISIBLE):\n");
  const hrOps = await frappe("/api/resource/Workspace/HR Operations");

  if (hrOps.data) {
    console.log("Key fields:");
    console.log(`  icon: "${hrOps.data.icon}"`);
    console.log(`  label: "${hrOps.data.label}"`);
    console.log(`  title: "${hrOps.data.title}"`);
    console.log(`  public: ${hrOps.data.public}`);
    console.log(`  module: "${hrOps.data.module || ""}"`);
    console.log(`  category: "${hrOps.data.category || ""}"`);
    console.log(`  parent_page: "${hrOps.data.parent_page || ""}"`);
    console.log(`  is_standard: ${hrOps.data.is_standard}`);
    console.log(`  for_user: "${hrOps.data.for_user || ""}"`);
    console.log(`  extends: "${hrOps.data.extends || ""}"`);
    console.log(`  extends_another_page: ${hrOps.data.extends_another_page}`);

    // Check if it has content
    console.log(`\n  Has shortcuts: ${hrOps.data.shortcuts?.length > 0 ? "Yes (" + hrOps.data.shortcuts.length + ")" : "No"}`);
    console.log(`  Has links: ${hrOps.data.links?.length > 0 ? "Yes (" + hrOps.data.links.length + ")" : "No"}`);
    console.log(`  Has charts: ${hrOps.data.charts?.length > 0 ? "Yes" : "No"}`);
  }

  // Finance Hub - NO ICON
  console.log("\n2️⃣  Finance Hub (NO ICON VISIBLE):\n");
  const finHub = await frappe("/api/resource/Workspace/Finance Hub");

  if (finHub.data) {
    console.log("Key fields:");
    console.log(`  icon: "${finHub.data.icon}"`);
    console.log(`  label: "${finHub.data.label}"`);
    console.log(`  title: "${finHub.data.title}"`);
    console.log(`  public: ${finHub.data.public}`);
    console.log(`  module: "${finHub.data.module || ""}"`);
    console.log(`  category: "${finHub.data.category || ""}"`);
    console.log(`  parent_page: "${finHub.data.parent_page || ""}"`);
    console.log(`  is_standard: ${finHub.data.is_standard}`);
    console.log(`  for_user: "${finHub.data.for_user || ""}"`);
    console.log(`  extends: "${finHub.data.extends || ""}"`);
    console.log(`  extends_another_page: ${finHub.data.extends_another_page}`);

    console.log(`\n  Has shortcuts: ${finHub.data.shortcuts?.length > 0 ? "Yes (" + finHub.data.shortcuts.length + ")" : "No"}`);
    console.log(`  Has links: ${finHub.data.links?.length > 0 ? "Yes (" + finHub.data.links.length + ")" : "No"}`);
    console.log(`  Has charts: ${finHub.data.charts?.length > 0 ? "Yes" : "No"}`);
  }

  // Check standard workspace (Accounting - has icon)
  console.log("\n3️⃣  Accounting (STANDARD - HAS ICON):\n");
  const accounting = await frappe("/api/resource/Workspace/Accounting");

  if (accounting.data) {
    console.log("Key fields:");
    console.log(`  icon: "${accounting.data.icon}"`);
    console.log(`  label: "${accounting.data.label}"`);
    console.log(`  title: "${accounting.data.title}"`);
    console.log(`  public: ${accounting.data.public}`);
    console.log(`  module: "${accounting.data.module || ""}"`);
    console.log(`  is_standard: ${accounting.data.is_standard}`);

    console.log(`\n  Has shortcuts: ${accounting.data.shortcuts?.length > 0 ? "Yes (" + accounting.data.shortcuts.length + ")" : "No"}`);
    console.log(`  Has links: ${accounting.data.links?.length > 0 ? "Yes (" + accounting.data.links.length + ")" : "No"}`);
  }

  console.log("\n========================================");
  console.log(" Analysis");
  console.log("========================================\n");

  console.log("Comparing icon fields:");
  console.log(`  HR Operations: "${hrOps.data?.icon}"`);
  console.log(`  Finance Hub: "${finHub.data?.icon}"`);
  console.log(`  Accounting: "${accounting.data?.icon}"`);

  console.log("\nComparing content:");
  console.log(`  HR Operations shortcuts: ${hrOps.data?.shortcuts?.length || 0}`);
  console.log(`  Finance Hub shortcuts: ${finHub.data?.shortcuts?.length || 0}`);
  console.log(`  Accounting shortcuts: ${accounting.data?.shortcuts?.length || 0}`);

  console.log("\n💡 HYPOTHESIS:");
  if ((hrOps.data?.shortcuts?.length || 0) > 0 && (finHub.data?.shortcuts?.length || 0) === 0) {
    console.log("  Workspaces need SHORTCUTS/LINKS to show icons in sidebar!");
    console.log("  HR Operations has content → icon shows");
    console.log("  Finance Hub has no content → no icon shows");
  } else {
    console.log("  Need to investigate further...");
  }
}

compare().catch(console.error);
