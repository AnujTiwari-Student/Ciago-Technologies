/**
 * Clear Frappe Cache via API
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function clearCache() {
  console.log("========================================");
  console.log(" Clearing Frappe Cache");
  console.log("========================================\n");

  try {
    const res = await fetch(`${baseUrl}/api/method/frappe.utils.cache_manager.clear_global_cache`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (res.ok) {
      console.log("✅ Cache cleared successfully!\n");
    } else {
      console.log("⚠️  Cache clear response:", data);
    }
  } catch (e: any) {
    console.log("❌ Error:", e.message);
  }

  console.log("========================================");
  console.log(" NEXT STEPS (IMPORTANT!)");
  console.log("========================================\n");

  console.log("1. ✅ Cache cleared via API");
  console.log("2. ⏭️ Go to Frappe UI: http://localhost:8180");
  console.log("3. ⏭️ Click your profile picture (top right)");
  console.log("4. ⏭️ Click 'Logout'");
  console.log("5. ⏭️ Login again: anujavengers@gmail.com");
  console.log("6. ⏭️ Check sidebar - icons should now appear!\n");

  console.log("Alternative (if still not visible):");
  console.log("  - Clear browser cache: Ctrl+Shift+Delete");
  console.log("  - Or use Incognito/Private window");
  console.log("  - Or try different browser\n");
}

clearCache();
