import type {
  OrangeHRMEmployee,
  OrangeHRMSalary,
  OrangeHRMUser,
  CreateEmployeePayload,
  CreateUserPayload,
  EmployeeJobDetailsPayload,
  EmployeeContactDetailsPayload,
  JobVacancy,
  CreateJobVacancyPayload,
  UpdateJobVacancyPayload,
} from "./types";

import { loadToken, saveToken } from "./token-store";

export class OrangeHRMClient {
  private baseUrl: string;

  private clientId: string;

  private clientSecret: string;

  private accessToken: string | null = null;

  private refreshToken: string | null = null;

  private tokenExpiry = 0;

  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");

    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  /**
   * Load saved OAuth token.
   */
  private async loadStoredToken(): Promise<void> {
    const stored = await loadToken();

    if (!stored) {
      throw new Error(
        "OrangeHRM OAuth authorization required. " + "Run: npx tsx scripts/orangehrm-auth.ts",
      );
    }

    this.accessToken = stored.accessToken;

    this.refreshToken = stored.refreshToken;

    this.tokenExpiry = stored.expiresAt;
  }

  /**
   * Refresh the access token.
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      await this.loadStoredToken();
    }

    if (!this.refreshToken) {
      throw new Error(
        "No OrangeHRM refresh token available. " + "Run: npx tsx scripts/orangehrm-auth.ts",
      );
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",

      client_id: this.clientId,

      // Required for your confidential client.
      client_secret: this.clientSecret,

      refresh_token: this.refreshToken,
    });

    const response = await fetch(`${this.baseUrl}/web/index.php/oauth2/token`, {
      method: "POST",

      headers: {
        "Content-Type": "application/x-www-form-urlencoded",

        Accept: "application/json",
      },

      body: params.toString(),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`OrangeHRM token refresh failed: ` + `${response.status} ${text}`);
    }

    let data: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Invalid OrangeHRM refresh response: ${text}`);
    }

    if (!data.access_token) {
      throw new Error(`OrangeHRM did not return a new access token: ${text}`);
    }

    /**
     * OrangeHRM may rotate the refresh token.
     */
    const newRefreshToken = data.refresh_token ?? this.refreshToken;

    const expiresIn = data.expires_in ?? 1800;

    this.accessToken = data.access_token;

    this.refreshToken = newRefreshToken;

    this.tokenExpiry = Date.now() + expiresIn * 1000 - 60_000;

    await saveToken({
      accessToken: this.accessToken,

      refreshToken: this.refreshToken,

      expiresAt: this.tokenExpiry,
    });

    console.log("🔄 OrangeHRM access token refreshed.");
  }

  /**
   * Ensure we have a valid access token.
   */
  private async ensureToken(): Promise<void> {
    if (!this.accessToken) {
      await this.loadStoredToken();
    }

    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    await this.refreshAccessToken();
  }

  /**
   * Generic OrangeHRM API request.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{
    data: T;
    meta?: unknown;
  }> {
    await this.ensureToken();

    const url = `${this.baseUrl}/web/index.php/api/v2${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response = await fetch(url, {
      method,

      headers,

      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    /**
     * If OrangeHRM says unauthorized,
     * refresh once and retry.
     */
    if (response.status === 401) {
      await this.refreshAccessToken();

      headers.Authorization = `Bearer ${this.accessToken}`;

      response = await fetch(url, {
        method,

        headers,

        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }

    if (!response.ok) {
      const text = await response.text();

      throw new Error(
        `OrangeHRM API error ` + `[${method} ${path}]: ` + `${response.status} ${text}`,
      );
    }

    const text = await response.text();

    if (!text) {
      return {
        data: undefined as T,
      };
    }

    return JSON.parse(text);
  }

  async createEmployee(payload: CreateEmployeePayload): Promise<OrangeHRMEmployee> {
    const result = await this.request<OrangeHRMEmployee>("POST", "/pim/employees", payload);

    return result.data;
  }

  async getEmployee(empNumber: number): Promise<OrangeHRMEmployee | null> {
    try {
      const result = await this.request<OrangeHRMEmployee>("GET", `/pim/employees/${empNumber}`);

      return result.data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }

      throw error;
    }
  }

  async updateEmployee(empNumber: number, payload: Partial<CreateEmployeePayload>) {
    return this.request("PUT", `/pim/employees/${empNumber}`, payload);
  }

  /**
   * Update employee job details (job title, employment status, department, etc.)
   */
  async updateEmployeeJobDetails(empNumber: number, payload: EmployeeJobDetailsPayload) {
    return this.request("PUT", `/pim/employees/${empNumber}/job-details`, payload);
  }

  /**
   * Update employee contact details (email, phone, address, etc.)
   */
  async updateEmployeeContactDetails(empNumber: number, payload: EmployeeContactDetailsPayload) {
    return this.request("PUT", `/pim/employees/${empNumber}/contact-details`, payload);
  }

  /**
   * Get available job titles from OrangeHRM
   */
  async getJobTitles() {
    const result = await this.request<Array<{ id: number; title: string; deleted: boolean }>>(
      "GET",
      "/admin/job-titles"
    );
    return result.data;
  }

  /**
   * Get available employment statuses from OrangeHRM
   */
  async getEmploymentStatuses() {
    const result = await this.request<Array<{ id: number; name: string }>>(
      "GET",
      "/admin/employment-statuses"
    );
    return result.data;
  }

  /**
   * Get available sub units (departments) from OrangeHRM
   */
  async getSubunits() {
    const result = await this.request<Array<{ id: number; name: string; unitId: string }>>(
      "GET",
      "/admin/subunits"
    );
    return result.data;
  }

  /**
   * Create a new job title in OrangeHRM
   */
  async createJobTitle(title: string) {
    const result = await this.request<{ id: number; title: string; deleted: boolean }>(
      "POST",
      "/admin/job-titles",
      { title }
    );
    return result.data;
  }

  /**
   * Create a new employment status in OrangeHRM
   */
  async createEmploymentStatus(name: string) {
    const result = await this.request<{ id: number; name: string }>(
      "POST",
      "/admin/employment-statuses",
      { name }
    );
    return result.data;
  }

  /**
   * Create a new sub-unit (department) in OrangeHRM
   */
  async createSubunit(name: string, parentId?: number) {
    const result = await this.request<{ id: number; name: string; unitId: string }>(
      "POST",
      "/admin/subunits",
      {
        name,
        parentId: parentId || null
      }
    );
    return result.data;
  }

  /**
   * Get all job vacancies from OrangeHRM
   */
  async getJobVacancies() {
    const result = await this.request<JobVacancy[]>("GET", "/recruitment/vacancies");
    return result.data;
  }

  /**
   * Get a specific job vacancy
   */
  async getJobVacancy(vacancyId: number): Promise<JobVacancy | null> {
    try {
      const result = await this.request<JobVacancy>("GET", `/recruitment/vacancies/${vacancyId}`);
      return result.data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a job vacancy in OrangeHRM
   */
  async createJobVacancy(payload: CreateJobVacancyPayload) {
    const result = await this.request<JobVacancy>("POST", "/recruitment/vacancies", payload);
    return result.data;
  }

  /**
   * Update a job vacancy in OrangeHRM
   */
  async updateJobVacancy(vacancyId: number, payload: UpdateJobVacancyPayload) {
    const result = await this.request<JobVacancy>(
      "PUT",
      `/recruitment/vacancies/${vacancyId}`,
      payload
    );
    return result.data;
  }

  async getSalary(empNumber: number): Promise<OrangeHRMSalary[]> {
    const result = await this.request<OrangeHRMSalary[]>(
      "GET",
      `/pim/employees/${empNumber}/salary-components`,
    );

    return result.data;
  }

  async getUser(userId: number): Promise<OrangeHRMUser | null> {
    try {
      const result = await this.request<OrangeHRMUser>("GET", `/admin/users/${userId}`);

      return result.data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }

      throw error;
    }
  }

  async createUser(payload: CreateUserPayload): Promise<OrangeHRMUser> {
    const result = await this.request<OrangeHRMUser>("POST", "/admin/users", payload);

    return result.data;
  }

  async updateUserStatus(userId: number, enabled: boolean) {
    return this.request("PUT", `/admin/users/${userId}`, {
      status: enabled,
    });
  }
}

export function getOrangeHRMClient(): OrangeHRMClient {
  const baseUrl = process.env.ORANGEHRM_BASE_URL;

  const clientId = process.env.ORANGEHRM_CLIENT_ID;

  const clientSecret = process.env.ORANGEHRM_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      "OrangeHRM credentials missing: " +
        "ORANGEHRM_BASE_URL, " +
        "ORANGEHRM_CLIENT_ID, " +
        "ORANGEHRM_CLIENT_SECRET",
    );
  }

  return new OrangeHRMClient(baseUrl, clientId, clientSecret);
}
