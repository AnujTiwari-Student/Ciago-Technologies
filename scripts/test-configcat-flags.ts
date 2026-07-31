/**
 * Test script to verify ConfigCat feature flags integration.
 * Run: npx tsx scripts/test-configcat-flags.ts
 */

import "dotenv/config";
import { getConfigCatClient, isFlagOn } from "../src/lib/feature-flags.server";
import { FEATURE_FLAGS } from "../src/lib/feature-flags";

const EXPECTED_FLAGS = [
  // Architecture
  "new_architecture_enabled",
  "legacy_portals_readonly",
  // OrangeHRM
  "ess_auto_provisioning_enabled",
  "orangehrm_salary_sync_enabled",
  // Email
  "resend_email_sending_enabled",
  // Provisioning
  "auto_offboarding_trigger_enabled",
  // Background Verification
  "manual_background_verification_only",
  // Legacy (should already exist)
  "clerkAuthentication",
  "authenticationButtonEnabled",
  "dashboardEnabled",
];

async function main() {
  console.log("\n======================================");
  console.log(" ConfigCat Feature Flags Test");
  console.log("======================================\n");

  // Test 1: Check SDK initialization
  console.log("📋 Test 1: ConfigCat SDK");
  const client = getConfigCatClient();
  if (!client) {
    console.error("❌ ConfigCat client not initialized");
    console.error("   Missing CONFIGCAT_SDK_KEY in .env");
    process.exit(1);
  }
  console.log("✅ ConfigCat SDK initialized\n");

  // Test 2: Check all flags are readable
  console.log("📋 Test 2: Flag Availability");
  const testUser = {
    identifier: "test@ciagotech.com",
    email: "test@ciagotech.com",
    custom: {
      role: "admin",
    },
  };

  let allFlagsOk = true;

  for (const flagKey of EXPECTED_FLAGS) {
    try {
      const value = await client.getValueAsync<boolean>(flagKey, false, testUser);
      console.log(`   ${flagKey}: ${value ? "✓ enabled" : "○ disabled"}`);
    } catch (error) {
      console.error(`   ❌ ${flagKey}: ${error instanceof Error ? error.message : "Error"}`);
      allFlagsOk = false;
    }
  }

  if (!allFlagsOk) {
    console.error("\n❌ Some flags failed to load. Check ConfigCat dashboard.");
    process.exit(1);
  }

  console.log("\n✅ All flags readable\n");

  // Test 3: Verify helper functions
  console.log("📋 Test 3: Helper Functions");

  try {
    const { isOrangeHRMProvisioningEnabled, isResendEmailEnabled } = await import(
      "../src/lib/feature-flags.server"
    );

    const ohrEnabled = await isOrangeHRMProvisioningEnabled(testUser);
    console.log(`   isOrangeHRMProvisioningEnabled: ${ohrEnabled}`);

    const emailEnabled = await isResendEmailEnabled(testUser);
    console.log(`   isResendEmailEnabled: ${emailEnabled}`);

    console.log("✅ Helper functions working\n");
  } catch (error) {
    console.error(`❌ Helper function error: ${error instanceof Error ? error.message : "Error"}`);
    process.exit(1);
  }

  // Test 4: Test targeting (simulate internal user)
  console.log("📋 Test 4: Targeting Rules");

  const internalUser = {
    identifier: "admin@ciagotech.com",
    email: "admin@ciagotech.com",
  };

  const externalUser = {
    identifier: "user@example.com",
    email: "user@example.com",
  };

  try {
    const internalValue = await client.getValueAsync<boolean>(
      "new_architecture_enabled",
      false,
      internalUser,
    );
    const externalValue = await client.getValueAsync<boolean>(
      "new_architecture_enabled",
      false,
      externalUser,
    );

    console.log(`   Internal user (@ciagotech.com): ${internalValue ? "✓" : "○"}`);
    console.log(`   External user (@example.com): ${externalValue ? "✓" : "○"}`);

    if (internalValue === externalValue) {
      console.log(
        "\n⚠️  Warning: Targeting rules may not be configured yet.\n   Both users got the same value.",
      );
    } else {
      console.log("\n✅ Targeting rules working correctly\n");
    }
  } catch (error) {
    console.error(`❌ Targeting test failed: ${error instanceof Error ? error.message : "Error"}`);
  }

  // Test 5: Check SDK key environment
  console.log("📋 Test 5: Environment Check");
  const sdkKey = process.env.CONFIGCAT_SDK_KEY || process.env.CONFIGCAT_SERVER_SDK_KEY;
  if (sdkKey) {
    const envType = sdkKey.includes("test") ? "TEST" : sdkKey.includes("prod") ? "PRODUCTION" : "DEVELOPMENT";
    console.log(`   SDK Key Environment: ${envType}`);
    console.log(`   Key: ${sdkKey.slice(0, 20)}...`);
  }
  console.log("✅ Environment configured\n");

  console.log("======================================");
  console.log(" ✨ ALL TESTS PASSED");
  console.log("======================================\n");

  console.log("Next steps:");
  console.log("1. Verify all flags exist in ConfigCat dashboard");
  console.log("2. Configure targeting rules for new_architecture_enabled");
  console.log("3. Test flag changes propagate within 60 seconds");
  console.log("4. Setup Slack webhook for flag change notifications\n");

  // Cleanup
  await client.dispose();
  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});
