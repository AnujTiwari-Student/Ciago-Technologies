/**
 * Check if frappe_employee_sync_enabled flag exists in ConfigCat
 */

import "dotenv/config";
import { getConfigCatClient, isFlagOn } from "../src/lib/feature-flags.server";

async function checkFlag() {
  console.log("Checking ConfigCat flag: frappe_employee_sync_enabled");
  console.log("ConfigCat SDK Key present:", !!process.env.CONFIGCAT_SDK_KEY);

  const client = getConfigCatClient();
  if (!client) {
    console.warn("⚠️  ConfigCat client not available - using default values");
    console.log("Default value: false");
    return;
  }

  try {
    const value = await isFlagOn("frappe_employee_sync_enabled");
    console.log("✓ Flag found in ConfigCat");
    console.log("Current value:", value);
    console.log("Default fallback: false");
  } catch (error) {
    console.error("✗ Error checking flag:", error);
  }

  await client.dispose();
}

checkFlag().catch(console.error);
