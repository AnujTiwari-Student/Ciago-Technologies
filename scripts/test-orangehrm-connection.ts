import "dotenv/config";

import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

import { loadToken } from "../src/integrations/orangehrm/token-store";

async function main() {
  console.log("\n======================================");

  console.log(" OrangeHRM API Connection Test");

  console.log("======================================\n");

  try {
    const token = await loadToken();

    if (!token) {
      console.error("❌ No OrangeHRM OAuth token found.");

      console.error("\nRun this first:\n");

      console.error("  npx tsx scripts/orangehrm-auth.ts\n");

      process.exit(1);
    }

    console.log("✅ OAuth token found");

    console.log(`   Token expires at: ${new Date(token.expiresAt).toLocaleString()}`);

    const client = getOrangeHRMClient();

    console.log(`   Base URL: ${process.env.ORANGEHRM_BASE_URL}`);

    /**
     * Test 1
     */
    console.log("\n📝 Test 1: Create test employee");

    const testEmployee = await client.createEmployee({
      firstName: "Test",
      lastName: "Employee",
    });

    console.log(`✅ Employee created: empNumber=${testEmployee.empNumber}`);

    /**
     * Test 2
     */
    console.log("\n📖 Test 2: Fetch employee details");

    const fetchedEmployee = await client.getEmployee(testEmployee.empNumber);

    if (!fetchedEmployee) {
      throw new Error("Employee was created but could not be fetched.");
    }

    console.log(
      `✅ Employee fetched: ` + `${fetchedEmployee.firstName} ` + `${fetchedEmployee.lastName}`,
    );

    /**
     * Test 3
     */
    console.log("\n💰 Test 3: Fetch salary components");

    const salary = await client.getSalary(testEmployee.empNumber);

    console.log(`✅ Salary components fetched: ${salary.length} items`);

    console.log("\n======================================");

    console.log(" ✨ ALL TESTS PASSED");

    console.log("======================================\n");
  } catch (error) {
    console.error("\n❌ OrangeHRM API test failed:");

    console.error(error instanceof Error ? error.message : error);

    process.exit(1);
  }
}

main();
