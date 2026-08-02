/**
 * Discover OrangeHRM API Endpoints
 *
 * Systematically test various endpoint patterns to discover
 * what's available in OrangeHRM Community v5.7
 */

import { config } from "dotenv";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

config();

interface EndpointTest {
  name: string;
  method: string;
  path: string;
  body?: any;
  expectedWorking?: boolean;
}

async function testEndpoint(
  baseUrl: string,
  token: string,
  test: EndpointTest
): Promise<{ status: number; body: any; works: boolean }> {
  const url = `${baseUrl}/web/index.php/api/v2${test.path}`;

  try {
    const options: RequestInit = {
      method: test.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    };

    if (test.body) {
      options.headers = {
        ...options.headers,
        "Content-Type": "application/json",
      };
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(url, options);
    const text = await response.text();
    let body;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return {
      status: response.status,
      body,
      works: response.ok,
    };
  } catch (error: any) {
    return {
      status: 0,
      body: error.message,
      works: false,
    };
  }
}

async function main() {
  console.log("\n=== OrangeHRM API Endpoint Discovery ===\n");

  const client = getOrangeHRMClient();
  const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");

  let testEmpNumber: number | null = null;

  try {
    // Create test employee first
    console.log("Creating test employee...");
    const employee = await client.createEmployee({
      firstName: "DISCOVER",
      lastName: `TEST_${Date.now()}`,
    });
    testEmpNumber = employee.empNumber;
    console.log(`✅ Created empNumber: ${testEmpNumber}\n`);

    // Ensure token
    await (client as any).ensureToken();
    const token = (client as any).accessToken;

    // Define endpoint tests
    const tests: EndpointTest[] = [
      // Employee basic operations
      {
        name: "GET employee (known working)",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}`,
        expectedWorking: true,
      },
      {
        name: "PUT employee (known 403)",
        method: "PUT",
        path: `/pim/employees/${testEmpNumber}`,
        body: { firstName: "UPDATED" },
        expectedWorking: false,
      },
      {
        name: "PATCH employee",
        method: "PATCH",
        path: `/pim/employees/${testEmpNumber}`,
        body: { firstName: "PATCHED" },
        expectedWorking: false,
      },

      // Personal details (alternative endpoint)
      {
        name: "GET personal-details",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}/personal-details`,
      },
      {
        name: "PUT personal-details",
        method: "PUT",
        path: `/pim/employees/${testEmpNumber}/personal-details`,
        body: { firstName: "UPDATED", lastName: "TEST" },
      },
      {
        name: "PATCH personal-details",
        method: "PATCH",
        path: `/pim/employees/${testEmpNumber}/personal-details`,
        body: { firstName: "PATCHED" },
      },

      // Contact details
      {
        name: "GET contact-details",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}/contact-details`,
      },
      {
        name: "PUT contact-details (known 404)",
        method: "PUT",
        path: `/pim/employees/${testEmpNumber}/contact-details`,
        body: { workEmail: "test@example.com" },
        expectedWorking: false,
      },
      {
        name: "PATCH contact-details",
        method: "PATCH",
        path: `/pim/employees/${testEmpNumber}/contact-details`,
        body: { workEmail: "test@example.com" },
      },
      {
        name: "POST contact-details",
        method: "POST",
        path: `/pim/employees/${testEmpNumber}/contact-details`,
        body: { workEmail: "test@example.com" },
      },

      // Job details (known working)
      {
        name: "GET job-details",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}/job-details`,
      },
      {
        name: "PUT job-details (known working)",
        method: "PUT",
        path: `/pim/employees/${testEmpNumber}/job-details`,
        body: { joinedDate: "2026-09-01" },
        expectedWorking: true,
      },

      // Alternative paths
      {
        name: "GET custom-fields",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}/custom-fields`,
      },
      {
        name: "GET dependents",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}/dependents`,
      },
      {
        name: "GET emergency-contacts",
        method: "GET",
        path: `/pim/employees/${testEmpNumber}/emergency-contacts`,
      },
    ];

    console.log("Testing endpoints...\n");
    console.log("=".repeat(80) + "\n");

    const results: Array<EndpointTest & { result: any }> = [];

    for (const test of tests) {
      const result = await testEndpoint(baseUrl, token, test);

      const statusIcon =
        result.status >= 200 && result.status < 300
          ? "✅"
          : result.status === 404
            ? "❌"
            : result.status === 403
              ? "🔒"
              : "⚠️";

      console.log(`${statusIcon} ${test.method.padEnd(6)} ${test.path}`);
      console.log(`   Status: ${result.status}`);

      if (result.body && typeof result.body === "object" && Object.keys(result.body).length < 10) {
        console.log(`   Body: ${JSON.stringify(result.body)}`);
      } else if (result.body) {
        console.log(`   Body: <data present>`);
      }

      if (test.expectedWorking !== undefined && result.works !== test.expectedWorking) {
        console.log(`   ⚠️  Unexpected result! Expected ${test.expectedWorking ? "success" : "failure"}`);
      }

      console.log();

      results.push({ ...test, result });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("=".repeat(80) + "\n");

    // Summary
    const working = results.filter((r) => r.result.works);
    const forbidden = results.filter((r) => r.result.status === 403);
    const notFound = results.filter((r) => r.result.status === 404);
    const other = results.filter(
      (r) => !r.result.works && r.result.status !== 403 && r.result.status !== 404
    );

    console.log("📊 Summary:\n");
    console.log(`✅ Working endpoints: ${working.length}`);
    working.forEach((r) => console.log(`   - ${r.method} ${r.path}`));
    console.log();

    console.log(`🔒 Forbidden (403): ${forbidden.length}`);
    forbidden.forEach((r) => console.log(`   - ${r.method} ${r.path}`));
    console.log();

    console.log(`❌ Not Found (404): ${notFound.length}`);
    notFound.forEach((r) => console.log(`   - ${r.method} ${r.path}`));
    console.log();

    if (other.length > 0) {
      console.log(`⚠️  Other errors: ${other.length}`);
      other.forEach((r) => console.log(`   - ${r.method} ${r.path} (${r.result.status})`));
      console.log();
    }

    // Cleanup
    console.log("[Cleanup] Terminating test employee...");
    await client.terminateEmployee(testEmpNumber, {
      date: new Date().toISOString().split("T")[0],
      terminationReasonId: 1,
      note: "ENDPOINT_DISCOVERY_CLEANUP",
    });
    console.log("✅ Cleanup complete\n");

  } catch (error: any) {
    console.error("\n❌ Discovery failed:", error.message);

    if (testEmpNumber) {
      console.log(`\nAttempting cleanup of empNumber ${testEmpNumber}...`);
      try {
        await client.terminateEmployee(testEmpNumber, {
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1,
          note: "DISCOVERY_CLEANUP_AFTER_ERROR",
        });
        console.log("✅ Cleanup succeeded\n");
      } catch (cleanupError: any) {
        console.error(`❌ Cleanup failed: ${cleanupError.message}`);
        console.error(`⚠️ Manual cleanup required for empNumber ${testEmpNumber}\n`);
      }
    }

    process.exit(1);
  }
}

main();
