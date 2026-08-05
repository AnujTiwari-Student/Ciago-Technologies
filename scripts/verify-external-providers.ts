/**
 * External Provider Capability Verification (Phase 0)
 *
 * SAFETY RULES:
 * - READ-ONLY wherever possible
 * - No real user invitations
 * - Use metadata/permission endpoints only
 * - No destructive operations against production identities
 */

import "dotenv/config";

type CapabilityStatus = "SUPPORTED" | "UNSUPPORTED" | "UNKNOWN" | "NOT_SAFE_TO_PROBE";

interface CapabilityResult {
  provider: string;
  capability: string;
  status: CapabilityStatus;
  endpoint?: string;
  httpMethod?: string;
  httpStatus?: number;
  tested: boolean;
  destructive: boolean;
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

  console.log(
    `${statusEmoji} [${result.provider}] ${result.capability}: ${result.status}${result.notes ? ` (${result.notes})` : ""}`,
  );
}

async function main() {
  console.log("\n🔍 External Provider Capability Verification\n");
  console.log("Timestamp:", new Date().toISOString());
  console.log("\n" + "=".repeat(60) + "\n");

  // ============================================================
  // 1. GitHub
  // ============================================================
  console.log("📋 GitHub Capabilities\n");

  const githubToken = process.env.GITHUB_TOKEN;
  const githubOrg = process.env.GITHUB_ORG;

  if (!githubToken || !githubOrg) {
    console.log("⚠️ GitHub credentials not configured\n");
    recordResult({
      provider: "github",
      capability: "token_configured",
      status: "UNSUPPORTED",
      tested: false,
      destructive: false,
      notes: "GITHUB_TOKEN or GITHUB_ORG not set",
    });
  } else {
    // Check token scope
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (response.ok) {
        const scopes = response.headers.get("x-oauth-scopes");
        const hasAdminOrg = scopes?.includes("admin:org") || false;

        recordResult({
          provider: "github",
          capability: "token_authenticated",
          status: "SUPPORTED",
          endpoint: "/user",
          httpMethod: "GET",
          httpStatus: response.status,
          tested: true,
          destructive: false,
          notes: `Scopes: ${scopes || "none"}`,
        });

        recordResult({
          provider: "github",
          capability: "admin_org_scope",
          status: hasAdminOrg ? "SUPPORTED" : "UNSUPPORTED",
          endpoint: "/user",
          httpMethod: "GET",
          tested: true,
          destructive: false,
          notes: hasAdminOrg ? "admin:org scope present" : "admin:org scope MISSING",
        });
      } else {
        recordResult({
          provider: "github",
          capability: "token_authenticated",
          status: "UNSUPPORTED",
          endpoint: "/user",
          httpMethod: "GET",
          httpStatus: response.status,
          tested: true,
          destructive: false,
          error: await response.text(),
        });
      }
    } catch (error) {
      recordResult({
        provider: "github",
        capability: "token_authenticated",
        status: "UNKNOWN",
        endpoint: "/user",
        httpMethod: "GET",
        tested: true,
        destructive: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Check org membership management (read-only)
    try {
      const response = await fetch(
        `https://api.github.com/orgs/${githubOrg}/memberships/NONEXISTENT_USER`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      // 404 = endpoint exists but user not found (expected)
      // 403 = no permission
      // 401 = auth failure

      if (response.status === 404) {
        recordResult({
          provider: "github",
          capability: "org_membership_read",
          status: "SUPPORTED",
          endpoint: "/orgs/{org}/memberships/{username}",
          httpMethod: "GET",
          httpStatus: 404,
          tested: true,
          destructive: false,
          notes: "Endpoint accessible (404 expected for nonexistent user)",
        });
      } else if (response.status === 403) {
        recordResult({
          provider: "github",
          capability: "org_membership_read",
          status: "UNSUPPORTED",
          endpoint: "/orgs/{org}/memberships/{username}",
          httpMethod: "GET",
          httpStatus: 403,
          tested: true,
          destructive: false,
          notes: "Forbidden - insufficient permissions",
        });
      } else {
        recordResult({
          provider: "github",
          capability: "org_membership_read",
          status: "UNKNOWN",
          endpoint: "/orgs/{org}/memberships/{username}",
          httpMethod: "GET",
          httpStatus: response.status,
          tested: true,
          destructive: false,
        });
      }
    } catch (error) {
      recordResult({
        provider: "github",
        capability: "org_membership_read",
        status: "UNKNOWN",
        endpoint: "/orgs/{org}/memberships/{username}",
        httpMethod: "GET",
        tested: true,
        destructive: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Invitation capability (DO NOT actually invite)
    recordResult({
      provider: "github",
      capability: "org_invitation",
      status: "NOT_SAFE_TO_PROBE",
      endpoint: "/orgs/{org}/memberships/{username}",
      httpMethod: "PUT",
      tested: false,
      destructive: true,
      notes: "Would send real invitation; mark for manual verification",
    });

    // Team management (read-only check if teams endpoint accessible)
    recordResult({
      provider: "github",
      capability: "team_management",
      status: "NOT_SAFE_TO_PROBE",
      endpoint: "/orgs/{org}/teams",
      httpMethod: "GET",
      tested: false,
      destructive: false,
      notes: "Deferred to manual verification; existing client does not implement",
    });
  }

  // ============================================================
  // 2. Microsoft Graph / Teams
  // ============================================================
  console.log("\n📋 Microsoft Graph / Teams Capabilities\n");

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    console.log("⚠️ Azure credentials not configured\n");
    recordResult({
      provider: "microsoft_teams",
      capability: "credentials_configured",
      status: "UNSUPPORTED",
      tested: false,
      destructive: false,
      notes: "Azure credentials not set",
    });
  } else {
    // Obtain access token
    try {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const params = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      });

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!tokenResponse.ok) {
        recordResult({
          provider: "microsoft_teams",
          capability: "authentication",
          status: "UNSUPPORTED",
          endpoint: "/oauth2/v2.0/token",
          httpMethod: "POST",
          httpStatus: tokenResponse.status,
          tested: true,
          destructive: false,
          error: await tokenResponse.text(),
        });
      } else {
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        recordResult({
          provider: "microsoft_teams",
          capability: "authentication",
          status: "SUPPORTED",
          endpoint: "/oauth2/v2.0/token",
          httpMethod: "POST",
          httpStatus: 200,
          tested: true,
          destructive: false,
        });

        // Check user read capability
        try {
          const userResponse = await fetch(
            "https://graph.microsoft.com/v1.0/users?$select=id&$top=1",
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (userResponse.ok) {
            recordResult({
              provider: "microsoft_teams",
              capability: "user_read",
              status: "SUPPORTED",
              endpoint: "/v1.0/users",
              httpMethod: "GET",
              httpStatus: userResponse.status,
              tested: true,
              destructive: false,
            });
          } else {
            recordResult({
              provider: "microsoft_teams",
              capability: "user_read",
              status: "UNSUPPORTED",
              endpoint: "/v1.0/users",
              httpMethod: "GET",
              httpStatus: userResponse.status,
              tested: true,
              destructive: false,
              error: await userResponse.text(),
            });
          }
        } catch (error) {
          recordResult({
            provider: "microsoft_teams",
            capability: "user_read",
            status: "UNKNOWN",
            endpoint: "/v1.0/users",
            httpMethod: "GET",
            tested: true,
            destructive: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Team member add (DO NOT actually add)
        recordResult({
          provider: "microsoft_teams",
          capability: "team_member_add",
          status: "NOT_SAFE_TO_PROBE",
          endpoint: "/v1.0/teams/{teamId}/members",
          httpMethod: "POST",
          tested: false,
          destructive: true,
          notes: "Would add real user to team; mark for manual verification",
        });
      }
    } catch (error) {
      recordResult({
        provider: "microsoft_teams",
        capability: "authentication",
        status: "UNKNOWN",
        endpoint: "/oauth2/v2.0/token",
        httpMethod: "POST",
        tested: true,
        destructive: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ============================================================
  // 3. ClickUp
  // ============================================================
  console.log("\n📋 ClickUp Capabilities\n");

  const clickupToken = process.env.CLICKUP_API_TOKEN;
  const clickupWorkspace = process.env.CLICKUP_WORKSPACE_ID;

  if (!clickupToken || !clickupWorkspace) {
    console.log("⚠️ ClickUp credentials not configured\n");
    recordResult({
      provider: "clickup",
      capability: "credentials_configured",
      status: "UNSUPPORTED",
      tested: false,
      destructive: false,
      notes: "ClickUp credentials not set",
    });
  } else {
    // Check auth
    try {
      const response = await fetch("https://api.clickup.com/api/v2/user", {
        headers: {
          Authorization: clickupToken,
        },
      });

      if (response.ok) {
        recordResult({
          provider: "clickup",
          capability: "authentication",
          status: "SUPPORTED",
          endpoint: "/api/v2/user",
          httpMethod: "GET",
          httpStatus: response.status,
          tested: true,
          destructive: false,
        });
      } else {
        recordResult({
          provider: "clickup",
          capability: "authentication",
          status: "UNSUPPORTED",
          endpoint: "/api/v2/user",
          httpMethod: "GET",
          httpStatus: response.status,
          tested: true,
          destructive: false,
          error: await response.text(),
        });
      }
    } catch (error) {
      recordResult({
        provider: "clickup",
        capability: "authentication",
        status: "UNKNOWN",
        endpoint: "/api/v2/user",
        httpMethod: "GET",
        tested: true,
        destructive: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Workspace invitation (DO NOT actually invite)
    recordResult({
      provider: "clickup",
      capability: "workspace_invitation",
      status: "NOT_SAFE_TO_PROBE",
      endpoint: "/api/v2/team/{teamId}/user",
      httpMethod: "POST",
      tested: false,
      destructive: true,
      notes: "Would send real invitation; mark for manual verification",
    });
  }

  // ============================================================
  // Output Results
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 EXTERNAL PROVIDER VERIFICATION SUMMARY\n");
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
  const outputPath = "docs/external-provider-verification-results.json";
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`✅ Results written to: ${outputPath}\n`);

  return results;
}

main().catch((error) => {
  console.error("\n❌ External provider verification failed:", error);
  process.exit(1);
});
