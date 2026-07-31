/**
 * Microsoft Teams (Graph API) client for adding users to teams.
 * Uses Microsoft Graph API v1.0.
 */

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export class TeamsClient {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(tenantId: string, clientId: string, clientSecret: string) {
    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private async ensureToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft token fetch failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as TokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    await this.ensureToken();

    const url = `https://graph.microsoft.com/v1.0${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft Graph error [${method} ${path}]: ${response.status} ${text}`);
    }

    return response.json();
  }

  async addUserToTeam(teamId: string, userId: string, roles: string[] = []): Promise<void> {
    await this.request("POST", `/teams/${teamId}/members`, {
      "@odata.type": "#microsoft.graph.aadUserConversationMember",
      roles,
      "user@odata.bind": `https://graph.microsoft.com/v1.0/users/${userId}`,
    });
  }

  async removeUserFromTeam(teamId: string, membershipId: string): Promise<void> {
    await this.request("DELETE", `/teams/${teamId}/members/${membershipId}`);
  }

  async getUserByEmail(email: string): Promise<{ id: string } | null> {
    try {
      const result = await this.request<{ value: Array<{ id: string }> }>(
        "GET",
        `/users?$filter=mail eq '${email}' or userPrincipalName eq '${email}'&$select=id`,
      );
      return result.value[0] || null;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }
}

export function getTeamsClient(): TeamsClient {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft Teams credentials missing: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET",
    );
  }

  return new TeamsClient(tenantId, clientId, clientSecret);
}
