/**
 * Compare standard workspaces (with icons) vs custom (without icons)
 * to find what's different
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
  console.log(" Comparing Standard vs Custom Workspaces");
  console.log("========================================\n");

  // Check Selling (standard - has icon)
  console.log("1️⃣  SELLING (Standard - HAS icon):\n");
  const selling = await frappe("/api/resource/Workspace/Selling");

  if (selling.data) {
    console.log(`   name: "${selling.data.name}"`);
    console.log(`   label: "${selling.data.label}"`);
    console.log(`   title: "${selling.data.title}"`);
    console.log(`   icon: "${selling.data.icon}"`);
    console.log(`   module: "${selling.data.module}"`);
    console.log(`   public: ${selling.data.public}`);
    console.log(`   for_user: "${selling.data.for_user || ""}"`);
    console.log(`   is_standard: ${selling.data.is_standard}`);
  }

  // Check Sales & CRM (custom - NO icon)
  console.log("\n2️⃣  SALES & CRM (Custom - NO icon):\n");
  const salesCrm = await frappe("/api/resource/Workspace/Sales & CRM");

  if (salesCrm.data) {
    console.log(`   name: "${salesCrm.data.name}"`);
    console.log(`   label: "${salesCrm.data.label}"`);
    console.log(`   title: "${salesCrm.data.title}"`);
    console.log(`   icon: "${salesCrm.data.icon}"`);
    console.log(`   module: "${salesCrm.data.module || ""}"`);
    console.log(`   public: ${salesCrm.data.public}`);
    console.log(`   for_user: "${salesCrm.data.for_user || ""}"`);
    console.log(`   is_standard: ${salesCrm.data.is_standard}`);
  }

  console.log("\n========================================");
  console.log(" KEY DIFFERENCES");
  console.log("========================================\n");

  console.log(`SELLING (works):`);
  console.log(`  - name: "Selling"`);
  console.log(`  - icon: "${selling.data?.icon}"`);
  console.log(`  - module: "${selling.data?.module}"`);
  console.log(`  - title: "${selling.data?.title}"`);

  console.log(`\nSALES & CRM (doesn't work):`);
  console.log(`  - name: "Sales & CRM"`);
  console.log(`  - icon: "${salesCrm.data?.icon}"`);
  console.log(`  - module: "${salesCrm.data?.module || "EMPTY"}"`);
  console.log(`  - title: "${salesCrm.data?.title}"`);

  console.log("\n💡 HYPOTHESIS:");
  console.log("   The '&' character in workspace name might cause issues!");
  console.log("   'Sales & CRM' has special character");
  console.log("   Standard workspaces have simple names\n");

  console.log("   Also: Empty module field might affect icon rendering\n");
}

async function fixSpecialChars() {
  console.log("========================================");
  console.log(" Solution: Set Module Field");
  console.log("========================================\n");

  const fixes = [
    { name: "Sales & CRM", module: "Selling", icon: "selling" },
    { name: "System Admin", module: "Custom", icon: "tool" },
    { name: "Executive View", module: "Custom", icon: "dashboard" },
    { name: "My Portal", module: "Custom", icon: "home" },
  ];

  for (const fix of fixes) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(fix.name)}`, "PUT", {
        module: fix.module,
        icon: fix.icon,
      });
      console.log(`✅ ${fix.name.padEnd(20)} → module: ${fix.module}, icon: ${fix.icon}`);
    } catch (e: any) {
      console.log(`❌ ${fix.name}: ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n🔄 Refresh browser: Ctrl+Shift+R\n");
}

async function main() {
  await compare();
  await fixSpecialChars();
}

main().catch(console.error);
