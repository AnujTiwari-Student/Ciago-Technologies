/**
 * Frappe HR / ERPNext v15 API Client
 *
 * Authentication: API Key + API Secret
 * Format: Authorization: token {api_key}:{api_secret}
 *
 * Based on Phase 1 verification against live instance (ciago.localhost)
 */

import type {
  FrappeEmployee,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  FrappeAPIResponse,
  FrappeListResponse,
  FrappeErrorResponse,
  FrappeUser,
  CreateUserPayload,
} from "./types";

export class FrappeError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public excType?: string,
    public originalResponse?: FrappeErrorResponse,
  ) {
    super(message);
    this.name = "FrappeError";
  }
}

export class FrappeClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor(baseUrl: string, apiKey: string, apiSecret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Get authorization header value
   */
  private getAuthHeader(): string {
    return `token ${this.apiKey}:${this.apiSecret}`;
  }

  /**
   * Make authenticated request to Frappe API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      "Content-Type": "application/json",
      Authorization: this.getAuthHeader(),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const text = await response.text();

      // Parse response
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // Response is not JSON
        if (!response.ok) {
          throw new FrappeError(`Frappe API error: ${response.status} ${text}`, response.status);
        }
        throw new FrappeError(`Invalid JSON response from Frappe: ${text}`, response.status);
      }

      // Check for Frappe error response
      if (data.exception || data.exc_type) {
        const errorResponse = data as FrappeErrorResponse;
        const errorMessage =
          errorResponse._error_message || errorResponse.exception || "Unknown Frappe error";

        throw new FrappeError(errorMessage, response.status, errorResponse.exc_type, errorResponse);
      }

      if (!response.ok) {
        throw new FrappeError(
          `Frappe API error: ${response.status} ${JSON.stringify(data)}`,
          response.status,
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof FrappeError) {
        throw error;
      }

      // Network/fetch error
      throw new FrappeError(
        `Frappe API request failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        "NetworkError",
      );
    }
  }

  /**
   * Test API authentication
   * Returns logged-in user info
   */
  async testAuth(): Promise<string> {
    const response = await this.request<{ message: string }>(
      "/api/method/frappe.auth.get_logged_user",
    );
    return response.message;
  }

  /**
   * Create a new Employee in Frappe HR
   *
   * @param payload Employee creation payload
   * @returns Created employee record with name (HR-EMP-XXXXX)
   */
  async createEmployee(payload: CreateEmployeePayload): Promise<FrappeEmployee> {
    const response = await this.request<FrappeAPIResponse<FrappeEmployee>>(
      "/api/resource/Employee",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  /**
   * Get an employee by name (ID)
   *
   * @param name Employee name/ID (e.g. "HR-EMP-00001")
   * @returns Employee record or null if not found
   */
  async getEmployee(name: string): Promise<FrappeEmployee | null> {
    try {
      const response = await this.request<FrappeAPIResponse<FrappeEmployee>>(
        `/api/resource/Employee/${encodeURIComponent(name)}`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof FrappeError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update an employee
   *
   * @param name Employee name/ID (e.g. "HR-EMP-00001")
   * @param payload Fields to update (partial update)
   * @returns Updated employee record
   */
  async updateEmployee(name: string, payload: UpdateEmployeePayload): Promise<FrappeEmployee> {
    const response = await this.request<FrappeAPIResponse<FrappeEmployee>>(
      `/api/resource/Employee/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  /**
   * Mark an employee as terminated/left
   *
   * @param name Employee name/ID
   * @param relievingDate Date employee left (YYYY-MM-DD)
   * @returns Updated employee record
   */
  async terminateEmployee(name: string, relievingDate: string): Promise<FrappeEmployee> {
    return this.updateEmployee(name, {
      status: "Left",
      relieving_date: relievingDate,
    });
  }

  /**
   * List all employees (paginated)
   *
   * @param limit Max results (default: 20)
   * @param offset Starting offset (default: 0)
   * @returns List of employees (partial data)
   */
  async listEmployees(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const response = await this.request<FrappeListResponse<FrappeEmployee>>(
      `/api/resource/Employee?limit_start=${offset}&limit_page_length=${limit}`,
    );

    return response.data;
  }

  /**
   * Search employees by email
   * Useful for reconciliation/duplicate prevention
   *
   * @param email Email to search for
   * @returns Array of matching employees
   */
  async searchEmployeesByEmail(email: string): Promise<FrappeEmployee[]> {
    try {
      // Search in both personal_email and company_email fields
      const personalEmailResults = await this.request<FrappeListResponse<FrappeEmployee>>(
        `/api/resource/Employee?filters=[["personal_email","=","${encodeURIComponent(email)}"]]`,
      );

      const companyEmailResults = await this.request<FrappeListResponse<FrappeEmployee>>(
        `/api/resource/Employee?filters=[["company_email","=","${encodeURIComponent(email)}"]]`,
      );

      // Combine and deduplicate by name
      const combined = [...personalEmailResults.data, ...companyEmailResults.data];

      const uniqueNames = new Set<string>();
      const unique: FrappeEmployee[] = [];

      for (const emp of combined) {
        if (!uniqueNames.has(emp.name)) {
          uniqueNames.add(emp.name);
          // Fetch full employee data
          const full = await this.getEmployee(emp.name);
          if (full) {
            unique.push(full);
          }
        }
      }

      return unique;
    } catch (error) {
      console.error("Failed to search employees by email:", error);
      return [];
    }
  }

  // ============================================================
  // USER MANAGEMENT METHODS
  // ============================================================

  /**
   * Get a Frappe User by email
   *
   * @param email User email (primary key)
   * @returns User record or null if not found
   */
  async getUser(email: string): Promise<FrappeUser | null> {
    try {
      const response = await this.request<FrappeAPIResponse<FrappeUser>>(
        `/api/resource/User/${encodeURIComponent(email)}`,
      );
      return response.data;
    } catch (error) {
      if (error instanceof FrappeError && error.statusCode === 404) {
        return null; // User not found
      }
      throw error;
    }
  }

  /**
   * Create a new Frappe User with secure invitation
   *
   * SECURITY: Uses Frappe's send_welcome_email mechanism for secure password setup.
   * Password is NOT stored in CiagoTech. User receives invitation link to set own password.
   *
   * @param payload User creation payload
   * @returns Created user record
   */
  async createUser(payload: CreateUserPayload): Promise<FrappeUser> {
    const response = await this.request<FrappeAPIResponse<FrappeUser>>("/api/resource/User", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        user_type: payload.user_type || "System User",
        enabled: payload.enabled !== undefined ? payload.enabled : 1,
        send_welcome_email:
          payload.send_welcome_email !== undefined ? payload.send_welcome_email : 1,
      }),
    });

    return response.data;
  }

  /**
   * Link a Frappe User to an Employee via user_id field
   *
   * @param employeeName Employee ID (HR-EMP-XXXXX)
   * @param userEmail User email to link
   */
  async linkUserToEmployee(employeeName: string, userEmail: string): Promise<void> {
    await this.updateEmployee(employeeName, {
      user_id: userEmail,
    });
  }

  /**
   * Update Frappe User roles
   * Must be called AFTER linking User to Employee (Frappe removes Employee/ESS roles if no linked employee)
   *
   * @param email User email
   * @param roles Array of role objects
   */
  async updateUserRoles(email: string, roles: Array<{ role: string }>): Promise<void> {
    await this.request<FrappeAPIResponse<FrappeUser>>(
      `/api/resource/User/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          roles: roles.map((r) => ({ role: r.role, doctype: "Has Role" })),
        }),
      },
    );
  }

  /**
   * Set a user's Module Profile (controls sidebar module visibility)
   */
  async setUserModuleProfile(email: string, profileName: string): Promise<void> {
    await this.request<FrappeAPIResponse<FrappeUser>>(
      `/api/resource/User/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          module_profile: profileName,
        }),
      },
    );
  }

  /**
   * Trigger Frappe password setup/reset flow for a user.
   * Frappe generates reset_password_key and (if SMTP configured) sends its own email.
   */
  async triggerPasswordReset(email: string): Promise<void> {
    await this.request<{ message?: string }>(
      "/api/method/frappe.core.doctype.user.user.reset_password",
      {
        method: "POST",
        body: JSON.stringify({ user: email }),
      },
    );
  }

  /**
   * Set a user's password directly via the Admin API.
   *
   * Frappe's reset_password_key flow is broken in Docker dev environments
   * (keys are rejected with 410 even when freshly generated).
   * This bypasses that entirely by setting the password as Administrator.
   */
  async setUserPassword(email: string, newPassword: string): Promise<void> {
    await this.request<any>("/api/method/frappe.client.set_value", {
      method: "POST",
      body: JSON.stringify({
        doctype: "User",
        name: email,
        fieldname: "new_password",
        value: newPassword,
      }),
    });
  }

  /**
   * Generate a password setup link for user onboarding.
   *
   * STRATEGY: Since Frappe's reset_password_key validation is broken in Docker
   * environments (returns 410 "Invalid Link" for freshly generated keys), we:
   * 1. Set a temporary password directly via Admin API
   * 2. Return the Frappe login URL so the user can log in and change it
   *
   * The caller (notifyFrappeAccessReady) will include the temp password in the
   * email notification sent to the user.
   */
  async generatePasswordSetupLink(
    email: string,
    _options?: { forceRotate?: boolean },
  ): Promise<string> {
    return `${this.baseUrl}/login`;
  }

  /**
   * Disable a Frappe User (offboarding)
   *
   * @param email User email
   */
  async disableUser(email: string): Promise<void> {
    await this.request<FrappeAPIResponse<FrappeUser>>(
      `/api/resource/User/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          enabled: 0,
        }),
      },
    );
  }

  async enableUser(email: string): Promise<void> {
    await this.request<FrappeAPIResponse<FrappeUser>>(
      `/api/resource/User/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          enabled: 1,
        }),
      },
    );
  }

  // ============================================================
  // JOB OPENING MANAGEMENT METHODS
  // ============================================================

  /**
   * Create a new Job Opening in Frappe HR
   *
   * @param payload Job Opening creation payload
   * @returns Created Job Opening record with name
   */
  async createJobOpening(payload: any): Promise<{ name: string }> {
    const response = await this.request<FrappeAPIResponse<{ name: string }>>(
      "/api/resource/Job Opening",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  /**
   * Get a Job Opening by name (ID)
   *
   * @param name Job Opening name/ID
   * @returns Job Opening record or null if not found
   */
  async getJobOpening(name: string): Promise<any | null> {
    try {
      const response = await this.request<FrappeAPIResponse<any>>(
        `/api/resource/Job Opening/${encodeURIComponent(name)}`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof FrappeError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a Job Opening
   *
   * @param name Job Opening name/ID
   * @param payload Fields to update (partial update)
   * @returns Updated Job Opening record
   */
  async updateJobOpening(name: string, payload: any): Promise<any> {
    const response = await this.request<FrappeAPIResponse<any>>(
      `/api/resource/Job Opening/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  /**
   * List all Job Openings (paginated)
   *
   * @param limit Max results (default: 20)
   * @param offset Starting offset (default: 0)
   * @returns List of Job Openings (partial data)
   */
  async listJobOpenings(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const response = await this.request<FrappeListResponse<{ name: string }>>(
      `/api/resource/Job Opening?limit_start=${offset}&limit_page_length=${limit}`,
    );

    return response.data;
  }

  // ============================================================
  // JOB APPLICANT MANAGEMENT METHODS
  // ============================================================

  /**
   * Create a new Job Applicant in Frappe HR
   *
   * @param payload Job Applicant creation payload
   * @returns Created Job Applicant record with name
   */
  async createJobApplicant(payload: any): Promise<{ name: string }> {
    const response = await this.request<FrappeAPIResponse<{ name: string }>>(
      "/api/resource/Job Applicant",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  /**
   * Get a Job Applicant by name (ID)
   *
   * @param name Job Applicant name/ID
   * @returns Job Applicant record or null if not found
   */
  async getJobApplicant(name: string): Promise<any | null> {
    try {
      const response = await this.request<FrappeAPIResponse<any>>(
        `/api/resource/Job Applicant/${encodeURIComponent(name)}`,
      );

      return response.data;
    } catch (error) {
      if (error instanceof FrappeError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a Job Applicant
   *
   * @param name Job Applicant name/ID
   * @param payload Fields to update (partial update)
   * @returns Updated Job Applicant record
   */
  async updateJobApplicant(name: string, payload: any): Promise<any> {
    const response = await this.request<FrappeAPIResponse<any>>(
      `/api/resource/Job Applicant/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  /**
   * List all Job Applicants (paginated)
   *
   * @param limit Max results (default: 20)
   * @param offset Starting offset (default: 0)
   * @returns List of Job Applicants (partial data)
   */
  async listJobApplicants(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const response = await this.request<FrappeListResponse<{ name: string }>>(
      `/api/resource/Job Applicant?limit_start=${offset}&limit_page_length=${limit}`,
    );

    return response.data;
  }

  // ============================================================
  // MASTER DATA METHODS
  // ============================================================

  /**
   * List all Designations
   * @param limit Max results (0 = no limit)
   * @param offset Starting offset
   */
  async listDesignations(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const limitParam = limit === 0 ? 999999 : limit;
    const response = await this.request<FrappeListResponse<{ name: string }>>(
      `/api/resource/Designation?limit_start=${offset}&limit_page_length=${limitParam}`,
    );
    return response.data;
  }

  /**
   * List all Departments
   * @param limit Max results (0 = no limit)
   * @param offset Starting offset
   */
  async listDepartments(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const limitParam = limit === 0 ? 999999 : limit;
    const response = await this.request<FrappeListResponse<{ name: string }>>(
      `/api/resource/Department?limit_start=${offset}&limit_page_length=${limitParam}`,
    );
    return response.data;
  }

  /**
   * List all Employment Types
   * @param limit Max results (0 = no limit)
   * @param offset Starting offset
   */
  async listEmploymentTypes(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const limitParam = limit === 0 ? 999999 : limit;
    const response = await this.request<FrappeListResponse<{ name: string }>>(
      `/api/resource/Employment Type?limit_start=${offset}&limit_page_length=${limitParam}`,
    );
    return response.data;
  }

  /**
   * List all Branches
   * @param limit Max results (0 = no limit)
   * @param offset Starting offset
   */
  async listBranches(limit = 20, offset = 0): Promise<Array<{ name: string }>> {
    const limitParam = limit === 0 ? 999999 : limit;
    const response = await this.request<FrappeListResponse<{ name: string }>>(
      `/api/resource/Branch?limit_start=${offset}&limit_page_length=${limitParam}`,
    );
    return response.data;
  }

  /**
   * Create a new Designation
   */
  async createDesignation(name: string, description?: string): Promise<{ name: string }> {
    const response = await this.request<FrappeAPIResponse<{ name: string }>>(
      `/api/resource/Designation`,
      {
        method: "POST",
        body: JSON.stringify({
          designation_name: name,
          description: description || `Auto-created from job posting sync`,
        }),
      },
    );
    return response.data;
  }

  /**
   * Create a new Department
   */
  async createDepartment(name: string, company: string): Promise<{ name: string }> {
    const response = await this.request<FrappeAPIResponse<{ name: string }>>(
      `/api/resource/Department`,
      {
        method: "POST",
        body: JSON.stringify({
          department_name: name,
          company: company,
          is_group: 0,
        }),
      },
    );
    return response.data;
  }

  /**
   * Create a new Branch.
   */
  async createBranch(name: string): Promise<{ name: string }> {
    const response = await this.request<FrappeAPIResponse<{ name: string }>>(
      `/api/resource/Branch`,
      {
        method: "POST",
        body: JSON.stringify({
          branch: name,
        }),
      },
    );
    return response.data;
  }
}

/**
 * Create a Frappe client from environment variables
 */
export function createFrappeClient(): FrappeClient {
  const baseUrl = process.env.FRAPPE_BASE_URL;
  const apiKey = process.env.FRAPPE_API_KEY;
  const apiSecret = process.env.FRAPPE_API_SECRET;

  if (!baseUrl || !apiKey || !apiSecret) {
    throw new Error(
      "Missing Frappe credentials. Required: FRAPPE_BASE_URL, FRAPPE_API_KEY, FRAPPE_API_SECRET",
    );
  }

  return new FrappeClient(baseUrl, apiKey, apiSecret);
}
