/**
 * ClickUp API client for workspace invitations.
 * Uses ClickUp API v2.
 */

export class ClickUpClient {
  private token: string;
  private workspaceId: string;

  constructor(token: string, workspaceId: string) {
    this.token = token;
    this.workspaceId = workspaceId;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `https://api.clickup.com/api/v2${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ClickUp API error [${method} ${path}]: ${response.status} ${text}`);
    }

    return response.json();
  }

  async inviteToWorkspace(email: string, admin: boolean = false): Promise<void> {
    await this.request("POST", `/team/${this.workspaceId}/user`, {
      email,
      admin,
    });
  }

  async removeFromWorkspace(userId: string): Promise<void> {
    await this.request("DELETE", `/team/${this.workspaceId}/user/${userId}`);
  }
}

export function getClickUpClient(): ClickUpClient {
  const token = process.env.CLICKUP_API_TOKEN;
  const workspaceId = process.env.CLICKUP_WORKSPACE_ID;

  if (!token || !workspaceId) {
    throw new Error("ClickUp credentials missing: CLICKUP_API_TOKEN, CLICKUP_WORKSPACE_ID");
  }

  return new ClickUpClient(token, workspaceId);
}
