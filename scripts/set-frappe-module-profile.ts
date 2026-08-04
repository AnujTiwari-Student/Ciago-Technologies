/**
 * Set a Frappe user's Module Profile (controls sidebar visibility)
 *
 * Usage:
 *   npx tsx scripts/set-frappe-module-profile.ts <email> <profile-name>
 *
 * Available profiles:
 *   - "Employee Profile"      → HR, Payroll, Projects only
 *   - "HR Manager Profile"    → HR, Payroll, Projects, Quality, Support
 *   - "Manager Profile"       → HR, Payroll, Projects, Quality, Support
 *   - "Admin Profile"         → All modules (no restrictions)
 *
 * Examples:
 *   npx tsx scripts/set-frappe-module-profile.ts user@example.com "Employee Profile"
 *   npx tsx scripts/set-frappe-module-profile.ts user@example.com "HR Manager Profile"
 *   npx tsx scripts/set-frappe-module-profile.ts user@example.com "Admin Profile"
 */
import { createFrappeClient } from "../src/integrations/frappe/client";
import * as dotenv from "dotenv";
dotenv.config();

const email = process.argv[2];
const profileName = process.argv[3];

if (!email || !profileName) {
  console.error('Usage: npx tsx scripts/set-frappe-module-profile.ts <email> "<profile-name>"');
  console.error("\nAvailable profiles:");
  console.error('  "Employee Profile"      - HR, Payroll, Projects');
  console.error('  "HR Manager Profile"    - HR, Payroll, Projects, Quality, Support');
  console.error('  "Manager Profile"       - HR, Payroll, Projects, Quality, Support');
  console.error('  "Admin Profile"         - All modules');
  process.exit(1);
}

(async () => {
  try {
    const client = createFrappeClient();

    const user = await client.getUser(email);
    if (!user) {
      console.error(`User ${email} not found in Frappe`);
      process.exit(1);
    }

    console.log(`\nUser: ${email}`);
    console.log(`Current profile: ${user.module_profile || "NONE"}`);

    await client.setUserModuleProfile(email, profileName);

    console.log(`New profile: ${profileName}`);
    console.log(`\n✓ Done! User will see the updated sidebar on next page load.\n`);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
})();
