/**
 * OrangeHRM Capability Verification Script (Phase 0)
 *
 * SAFETY RULES:
 * - READ-ONLY wherever possible
 * - Destructive tests use disposable test employee only
 * - Test employee marked "CAPABILITY_TEST_ONLY"
 * - No operations against real/production employees
 * - Mark as UNKNOWN if not safe to probe
 */

import "dotenv/config";
import { getOrangeHRMClient } from "../src/integrations/orangehrm/client";

type CapabilityStatus = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN" | "NOT_SAFE_TO_PROBE";

interface CapabilityResult {
  capability: string;
  status: CapabilityStatus;
  endpoint?: string;
  httpMethod?: string;
  httpStatus?: number;
  tested: boolean;
  destructive: boolean;
  testEmployeeId?: number;
  error?: string;
  notes?: string;
  timestamp: string;
}

const results: CapabilityResult[] = [];

function recordResult(result: Omit<CapabilityResult, "timestamp">) {
  results.push({
    ...result,
    timestamp: new Date().toISOString(),
  });

  const statusEmoji = {
    SUPPORTED: "✅",
    UNSUPPORTED: "❌",
    UNKNOWN: "❓",
    NOT_SAFE_TO_PROBE: "⚠️",
  }[result.status];

  console.log(`${statusEmoji} ${result.capability}: ${result.status}${result.notes ? ` (${result.notes})` : ""}`);
}

async function main() {
  console.log("\n🔍 OrangeHRM Capability Verification\n");
  console.log("Environment:", process.env.ORANGEHRM_BASE_URL);
  console.log("Timestamp:", new Date().toISOString());
  console.log("\n" + "=".repeat(60) + "\n");

  const client = getOrangeHRMClient();

  // ============================================================
  // 1. OrangeHRM Edition & Version
  // ============================================================
  console.log("📋 Checking OrangeHRM edition and version...\n");

  try {
    // OrangeHRM doesn't have a public version endpoint in v2 API
    // Edition is inferred from Docker image: orangehrm/orangehrm:5.7
    recordResult({
      capability: "orangehrm_edition",
      status: "SUPPORTED",
      endpoint: "N/A (from Docker image)",
      httpMethod: "N/A",
      tested: false,
      destructive: false,
      notes: "orangehrm/orangehrm:5.7 (Community/Open Source)",
    });
  } catch (error) {
    recordResult({
      capability: "orangehrm_edition",
      status: "UNKNOWN",
      endpoint: "/api/v2/core/config",
      httpMethod: "GET",
      tested: true,
      destructive: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ============================================================
  // 2. Create Employee (Already Verified)
  // ============================================================
  console.log("\n📋 Verifying employee operations...\n");

  recordResult({
    capability: "create_employee",
    status: "SUPPORTED",
    endpoint: "/api/v2/pim/employees",
    httpMethod: "POST",
    tested: false,
    destructive: false,
    notes: "Already verified in existing integration",
  });

  recordResult({
    capability: "update_employee",
    status: "SUPPORTED",
    endpoint: "/api/v2/pim/employees/{empNumber}",
    httpMethod: "PUT",
    tested: false,
    destructive: false,
    notes: "Already verified in existing integration",
  });

  recordResult({
    capability: "get_employee",
    status: "SUPPORTED",
    endpoint: "/api/v2/pim/employees/{empNumber}",
    httpMethod: "GET",
    tested: false,
    destructive: false,
    notes: "Already verified in existing integration",
  });

  // ============================================================
  // 3. Create Test Employee for Destructive Tests
  // ============================================================
  console.log("\n🧪 Creating disposable test employee for capability verification...\n");

  let testEmployeeId: number | null = null;

  try {
    const testEmployee = await client.createEmployee({
      firstName: "CAPABILITY_TEST_ONLY",
      lastName: "DELETE_ME",
    });

    testEmployeeId = testEmployee.empNumber;
    console.log(`✅ Created test employee: empNumber=${testEmployeeId}\n`);

    // Update with contact details to mark as test
    await client.updateEmployeeContactDetails(testEmployeeId, {
      workEmail: "capability-test@example.invalid",
      otherEmail: "DO_NOT_USE@example.invalid",
    });

  } catch (error) {
    console.error("❌ Failed to create test employee:", error);
    console.log("\n⚠️ Cannot proceed with destructive capability tests without test employee.\n");
  }

  // ============================================================
  // 4. Delete Employee
  // ============================================================
  console.log("📋 Testing DELETE employee...\n");

  if (testEmployeeId) {
    try {
      // OrangeHRM v5.7 (Community) typically does NOT support DELETE via API
      // The API uses soft-delete or termination instead
      // Attempt DELETE and capture response

      const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");
      const url = `${baseUrl}/web/index.php/api/v2/pim/employees/${testEmployeeId}`;

      // Need to manually construct request since client doesn't have deleteEmployee yet
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${(client as any).accessToken}`,
          Accept: "application/json",
        },
      });

      if (response.status === 204 || response.status === 200) {
        recordResult({
          capability: "delete_employee",
          status: "SUPPORTED",
          endpoint: "/api/v2/pim/employees/{empNumber}",
          httpMethod: "DELETE",
          httpStatus: response.status,
          tested: true,
          destructive: true,
          testEmployeeId,
        });
        testEmployeeId = null; // Mark as deleted
      } else if (response.status === 404) {
        recordResult({
          capability: "delete_employee",
          status: "UNSUPPORTED",
          endpoint: "/api/v2/pim/employees/{empNumber}",
          httpMethod: "DELETE",
          httpStatus: 404,
          tested: true,
          destructive: true,
          testEmployeeId,
          notes: "Endpoint not found (404)",
        });
      } else if (response.status === 405) {
        recordResult({
          capability: "delete_employee",
          status: "UNSUPPORTED",
          endpoint: "/api/v2/pim/employees/{empNumber}",
          httpMethod: "DELETE",
          httpStatus: 405,
          tested: true,
          destructive: true,
          testEmployeeId,
          notes: "Method not allowed (405)",
        });
      } else {
        const text = await response.text();
        recordResult({
          capability: "delete_employee",
          status: "UNKNOWN",
          endpoint: "/api/v2/pim/employees/{empNumber}",
          httpMethod: "DELETE",
          httpStatus: response.status,
          tested: true,
          destructive: true,
          testEmployeeId,
          error: text.substring(0, 200),
        });
      }
    } catch (error) {
      recordResult({
        capability: "delete_employee",
        status: "UNKNOWN",
        endpoint: "/api/v2/pim/employees/{empNumber}",
        httpMethod: "DELETE",
        tested: true,
        destructive: true,
        testEmployeeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    recordResult({
      capability: "delete_employee",
      status: "NOT_SAFE_TO_PROBE",
      endpoint: "/api/v2/pim/employees/{empNumber}",
      httpMethod: "DELETE",
      tested: false,
      destructive: true,
      notes: "No test employee available",
    });
  }

  // ============================================================
  // 5. Terminate Employee
  // ============================================================
  console.log("\n📋 Testing TERMINATE employee...\n");

  if (testEmployeeId) {
    try {
      // OrangeHRM termination endpoint
      const baseUrl = process.env.ORANGEHRM_BASE_URL!.replace(/\/$/, "");
      const url = `${baseUrl}/web/index.php/api/v2/pim/employees/${testEmployeeId}/terminations`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(client as any).accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          terminationReasonId: 1, // Common termination reason ID
          note: "CAPABILITY_TEST_ONLY - automated verification",
        }),
      });

      if (response.status === 200 || response.status === 201) {
        recordResult({
          capability: "terminate_employee",
          status: "SUPPORTED",
          endpoint: "/api/v2/pim/employees/{empNumber}/terminations",
          httpMethod: "POST",
          httpStatus: response.status,
          tested: true,
          destructive: true,
          testEmployeeId,
        });
      } else if (response.status === 404) {
        recordResult({
          capability: "terminate_employee",
          status: "UNSUPPORTED",
          endpoint: "/api/v2/pim/employees/{empNumber}/terminations",
          httpMethod: "POST",
          httpStatus: 404,
          tested: true,
          destructive: true,
          testEmployeeId,
          notes: "Endpoint not found (404)",
        });
      } else {
        const text = await response.text();
        recordResult({
          capability: "terminate_employee",
          status: "UNKNOWN",
          endpoint: "/api/v2/pim/employees/{empNumber}/terminations",
          httpMethod: "POST",
          httpStatus: response.status,
          tested: true,
          destructive: true,
          testEmployeeId,
          error: text.substring(0, 200),
        });
      }
    } catch (error) {
      recordResult({
        capability: "terminate_employee",
        status: "UNKNOWN",
        endpoint: "/api/v2/pim/employees/{empNumber}/terminations",
        httpMethod: "POST",
        tested: true,
        destructive: true,
        testEmployeeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    recordResult({
      capability: "terminate_employee",
      status: "NOT_SAFE_TO_PROBE",
      endpoint: "/api/v2/pim/employees/{empNumber}/terminations",
      httpMethod: "POST",
      tested: false,
      destructive: true,
      notes: "No test employee available",
    });
  }

  // ============================================================
  // 6. ESS/System User Operations
  // ============================================================
  console.log("\n📋 Testing ESS/System User operations...\n");

  recordResult({
    capability: "create_system_user",
    status: "SUPPORTED",
    endpoint: "/api/v2/admin/users",
    httpMethod: "POST",
    tested: false,
    destructive: false,
    notes: "Already verified in existing integration",
  });

  recordResult({
    capability: "update_user_status",
    status: "SUPPORTED",
    endpoint: "/api/v2/admin/users/{userId}",
    httpMethod: "PUT",
    tested: false,
    destructive: false,
    notes: "Already verified in existing integration (enable/disable)",
  });

  // ============================================================
  // 7. Change Password via API
  // ============================================================
  console.log("\n📋 Testing password change via API...\n");

  recordResult({
    capability: "change_password_api",
    status: "NOT_SAFE_TO_PROBE",
    endpoint: "/api/v2/admin/users/{userId}",
    httpMethod: "PUT",
    tested: false,
    destructive: true,
    notes: "Cannot safely test password change without risking test user access; mark as UNKNOWN for manual verification",
  });

  // ============================================================
  // 8. Delete System User
  // ============================================================
  console.log("\n📋 Testing DELETE system user...\n");

  recordResult({
    capability: "delete_system_user",
    status: "NOT_SAFE_TO_PROBE",
    endpoint: "/api/v2/admin/users/{userId}",
    httpMethod: "DELETE",
    tested: false,
    destructive: true,
    notes: "Requires test system user creation first; deferred to manual verification",
  });

  // ============================================================
  // 9. Cleanup Test Employee (if still exists)
  // ============================================================
  if (testEmployeeId) {
    console.log(`\n🧹 Cleaning up test employee ${testEmployeeId}...\n`);
    console.log("⚠️ Test employee still exists. Manual cleanup required if DELETE API unsupported.\n");
    console.log(`   Navigate to OrangeHRM Admin → PIM → Employees → empNumber=${testEmployeeId} and delete manually.\n`);
  }

  // ============================================================
  // 10. Output Results
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 CAPABILITY VERIFICATION SUMMARY\n");
  console.log("=".repeat(60) + "\n");

  const supported = results.filter((r) => r.status === "SUPPORTED").length;
  const unsupported = results.filter((r) => r.status === "UNSUPPORTED").length;
  const unknown = results.filter((r) => r.status === "UNKNOWN").length;
  const notSafe = results.filter((r) => r.status === "NOT_SAFE_TO_PROBE").length;

  console.log(`✅ SUPPORTED:          ${supported}`);
  console.log(`❌ UNSUPPORTED:        ${unsupported}`);
  console.log(`❓ UNKNOWN:            ${unknown}`);
  console.log(`⚠️  NOT_SAFE_TO_PROBE: ${notSafe}`);
  console.log(`📋 TOTAL:              ${results.length}\n`);

  console.log("=".repeat(60) + "\n");

  // Write results to JSON
  const fs = await import("node:fs/promises");
  const outputPath = "docs/capability-verification-results.json";
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`✅ Results written to: ${outputPath}\n`);

  return results;
}

main().catch((error) => {
  console.error("\n❌ Capability verification failed:", error);
  process.exit(1);
});
