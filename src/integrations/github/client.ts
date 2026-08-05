/**
 * GitHub API client for organization invitations.
 * Uses GitHub REST API v3.
 */

export class GitHubClient {
  private token: string;
  private org: string;

  constructor(token: string, org: string) {
    this.token = token;
    this.org = org;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `https://api.github.com${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error [${method} ${path}]: ${response.status} ${text}`);
    }

    return response.json();
  }

  async inviteToOrg(username: string, role: "member" | "admin" = "member"): Promise<void> {
    await this.request("PUT", `/orgs/${this.org}/memberships/${username}`, { role });
  }

  async removeFromOrg(username: string): Promise<void> {
    await this.request("DELETE", `/orgs/${this.org}/memberships/${username}`);
  }

  async checkMembership(username: string): Promise<boolean> {
    try {
      await this.request("GET", `/orgs/${this.org}/memberships/${username}`);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return false;
      }
      throw error;
    }
  }
}

export function getGitHubClient(): GitHubClient {
  const token = process.env.GITHUB_TOKEN;
  const org = process.env.GITHUB_ORG;

  if (!token || !org) {
    throw new Error("GitHub credentials missing: GITHUB_TOKEN, GITHUB_ORG");
  }

  return new GitHubClient(token, org);
}
