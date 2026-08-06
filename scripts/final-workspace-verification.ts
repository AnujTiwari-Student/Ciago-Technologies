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

async function verify() {
  console.log("========================================");
  console.log(" Final Workspace Verification");
  console.log("========================================\n");

  const allWorkspaces = [
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

  console.log("Current status of all custom workspaces:\n");

  let visible = 0;
  let invisible = 0;

  for (const wsName of allWorkspaces) {
    try {
      const ws = await frappe(`/api/resource/Workspace/${encodeURIComponent(wsName)}`);

      if (ws.data) {
        const hasIcon = ws.data.icon ? "✅" : "❌";
        const status = ws.data.icon ? "SHOULD BE VISIBLE" : "NO ICON";

        console.log(`${hasIcon} ${wsName.padEnd(20)} → icon: "${ws.data.icon || "NONE"}" (${status})`);

        if (ws.data.icon) {
          visible++;
        } else {
          invisible++;
        }
      }
    } catch (e) {
      console.log(`❌ ${wsName.padEnd(20)} → ERROR`);
      invisible++;
    }
  }

  console.log(`\n📊 Summary: ${visible} should be visible, ${invisible} without icons\n`);

  if (invisible > 0) {
    console.log("⚠️  Some workspaces still missing icons - applying final fix...\n");
    await applyFinalFix();
  }

  console.log("\n========================================");
  console.log(" Browser Refresh Instructions");
  console.log("========================================\n");

  console.log("If icons still don't show after refresh:");
  console.log("\n1. Clear Frappe Cache Completely:");
  console.log("   - In Frappe UI, click profile picture");
  console.log("   - Click 'Logout'");
  console.log("   - Close ALL browser windows");
  console.log("   - Reopen browser");
  console.log("   - Login again");
  console.log("\n2. OR Use Different Browser:");
  console.log("   - Try Chrome, Firefox, or Edge");
  console.log("   - Fresh browser = no cache");
  console.log("\n3. OR Use Browser DevTools:");
  console.log("   - F12 → Application tab");
  console.log("   - Clear Storage → Clear site data");
  console.log("   - Refresh\n");
}

async function applyFinalFix() {
  console.log("Applying final fix with VERIFIED working icons:\n");

  // Use ONLY icons we've seen working
  const fixes = [
    { name: "Executive View", icon: "hr" },  // HR icon works (seen in HR Operations)
    { name: "My Portal", icon: "projects" },  // Projects icon works (seen in Projects Hub)
  ];

  for (const fix of fixes) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(fix.name)}`, "PUT", {
        icon: fix.icon,
        public: 1,
        is_hidden: 0,
        module: "Custom",
      });
      console.log(`✅ ${fix.name} → ${fix.icon}`);
    } catch (e) {
      console.log(`❌ ${fix.name} → Error`);
    }
  }
}

verify().catch(console.error);
