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

async function fixFinal() {
  console.log("Final icon fix for 4 workspaces...\n");

  const updates = [
    { name: "Sales & CRM", icon: "sell", module: "Selling" },
    { name: "System Admin", icon: "setting", module: "Custom" },
    { name: "Executive View", icon: "insights", module: "Custom" },
    { name: "My Portal", icon: "contact", module: "Custom" },
  ];

  for (const u of updates) {
    try {
      await frappe(`/api/resource/Workspace/${encodeURIComponent(u.name)}`, "PUT", {
        icon: u.icon,
        module: u.module,
      });
      console.log(`✅ ${u.name} → ${u.icon} (module: ${u.module})`);
    } catch (e: any) {
      console.log(`❌ ${u.name}: ${e.message}`);
    }
  }

  console.log("\n✅ Done! Refresh browser now.\n");
}

fixFinal();
