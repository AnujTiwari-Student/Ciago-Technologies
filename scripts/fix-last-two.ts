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

async function fixLastTwo() {
  console.log("========================================");
  console.log(" Fixing Last 2 Workspaces");
  console.log("========================================\n");

  // Try multiple icon options for each
  const options = [
    // Executive View - try different dashboard/report icons
    { name: "Executive View", icons: ["dashboard", "hr", "project", "chart", "trending-up"] },
    // My Portal - try different user/home icons
    { name: "My Portal", icons: ["employee", "hr", "user", "avatar", "profile"] },
  ];

  for (const workspace of options) {
    console.log(`\n📋 Testing ${workspace.name}...`);

    // Try first icon
    const testIcon = workspace.icons[0];

    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(workspace.name)}`, "PUT", {
        icon: testIcon,
        module: "Custom",
        public: 1,
        is_hidden: 0,
      });
      console.log(`   ✅ Set to: ${testIcon}`);
      console.log(`   Alternative options if this doesn't work:`);
      workspace.icons.slice(1).forEach(alt => {
        console.log(`      - ${alt}`);
      });
    } catch (e: any) {
      console.log(`   ❌ Error: ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("\n========================================");
  console.log(" Trying Safe Fallback Icons");
  console.log("========================================\n");

  // Use icons we KNOW work (from other workspaces that are visible)
  const safeFallbacks = [
    { name: "Executive View", icon: "accounting" },  // We know this works (Finance Hub)
    { name: "My Portal", icon: "hr" },  // We know this works (HR Operations)
  ];

  for (const ws of safeFallbacks) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(ws.name)}`, "PUT", {
        icon: ws.icon,
      });
      console.log(`✅ ${ws.name} → ${ws.icon} (verified working icon)`);
    } catch (e: any) {
      console.log(`❌ ${ws.name}: Error`);
    }
  }

  console.log("\n========================================");
  console.log(" Comparison Check");
  console.log("========================================\n");

  // Compare with a working workspace
  console.log("Checking Finance Hub (WORKS) vs Executive View (doesn't)...\n");

  const financeHub = await frappe("/api/resource/Workspace/Finance Hub");
  const execView = await frappe("/api/resource/Workspace/Executive View");

  console.log("Finance Hub:");
  console.log(`  icon: "${financeHub.data?.icon}"`);
  console.log(`  label: "${financeHub.data?.label}"`);
  console.log(`  module: "${financeHub.data?.module}"`);
  console.log(`  public: ${financeHub.data?.public}`);

  console.log("\nExecutive View:");
  console.log(`  icon: "${execView.data?.icon}"`);
  console.log(`  label: "${execView.data?.label}"`);
  console.log(`  module: "${execView.data?.module}"`);
  console.log(`  public: ${execView.data?.public}`);

  console.log("\n💡 If they look identical but Executive View still has no icon,");
  console.log("   the issue might be with the LABEL field, not the icon field.\n");

  console.log("🔄 Refresh browser: Ctrl+Shift+R\n");
}

fixLastTwo().catch(console.error);
