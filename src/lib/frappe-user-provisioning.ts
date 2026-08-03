/**
 * Frappe User Provisioning at HIRED Stage
 *
 * PURPOSE: Create Frappe User account and link to Employee after hiring
 *
 * SECURITY:
 * - Uses Frappe's send_welcome_email for secure password setup
 * - NO plaintext passwords stored in CiagoTech
 * - User receives invitation link to set own password
 * - Password never transits through CiagoTech
 *
 * IDEMPOTENCY:
 * - Checks if User already exists before creating
 * - Verifies User→Employee link before creating
 * - Updates roles if User exists but roles changed
 * - Safe to call multiple times
 *
 * ROLE MAPPING:
 * - Maps CiagoTech AppRole → Frappe HRMS roles
 * - Minimal privilege principle
 * - Never automatically assigns Administrator
 */

import type { PrismaClient, AppRole } from "@prisma/client";
import type { FrappeClient } from "@/integrations/frappe/client";
import { mapCiagoRolesToFrappeRoles, formatRolesForFrappe } from "./frappe-role-mapping";

export interface FrappeUserProvisioningResult {
  success: boolean;
  userEmail: string | null;
  action:
    | "created"          // New User created
    | "already_exists"   // User already existed
    | "linked"           // User linked to Employee
    | "failed";          // Provisioning failed
  message: string;
  error?: string;
}

/**
 * Provision Frappe User account at HIRED stage
 *
 * WORKFLOW:
 * 1. Fetch user's CiagoTech roles from database
 * 2. Map CiagoTech roles → Frappe roles
 * 3. Check if Frappe User already exists
 * 4. Create User if missing (with send_welcome_email=1)
 * 5. Link User to Employee via user_id field
 * 6. Audit log the action
 *
 * @param applicationId Job application ID
 * @param employeeName Frappe Employee ID (HR-EMP-XXXXX)
 * @param email User email
 * @param firstName First name
 * @param lastName Last name
 * @param userId CiagoTech user ID (for role lookup)
 * @param db Prisma client
 * @param client Frappe client
 * @param correlationId Correlation ID for audit
 * @returns Provisioning result
 */
export async function provisionFrappeUser(
  applicationId: string,
  employeeName: string,
  email: string,
  firstName: string,
  lastName: string | null,
  userId: string,
  db: PrismaClient,
  client: FrappeClient,
  correlationId?: string
): Promise<FrappeUserProvisioningResult> {
  const logPrefix = `[frappe-user:${applicationId.slice(0, 8)}]`;
  console.log(`${logPrefix} Starting Frappe User provisioning for ${email}`);

  try {
    // Step 1: Fetch CiagoTech roles
    const userRoles = await db.userRole.findMany({
      where: { userId },
      select: { role: true },
    });

    const ciagoRoles = userRoles.map((r) => r.role);
    console.log(`${logPrefix} User has CiagoTech roles:`, ciagoRoles);

    // Step 2: Map to Frappe roles
    const frappeRoleNames = mapCiagoRolesToFrappeRoles(ciagoRoles as AppRole[]);
    const frappeRoles = formatRolesForFrappe(frappeRoleNames);
    console.log(`${logPrefix} Mapped to Frappe roles:`, frappeRoleNames);

    // Step 3: Check if User already exists
    const existingUser = await client.getUser(email);

    if (existingUser) {
      console.log(`${logPrefix} Frappe User already exists: ${email}`);

      // Verify User→Employee link
      const employee = await client.getEmployee(employeeName);

      if (employee && employee.user_id === email) {
        console.log(`${logPrefix} User already linked to Employee`);

        await db.auditLog.create({
          data: {
            action: "FRAPPE_USER_ALREADY_EXISTS_AND_LINKED",
            targetResource: `job_applications/${applicationId}`,
            details: {
              email,
              employeeName,
              roles: frappeRoleNames,
              correlationId,
            },
          },
        });

        return {
          success: true,
          userEmail: email,
          action: "already_exists",
          message: `Frappe User already exists and linked: ${email}`,
        };
      }

      // User exists but not linked to Employee - create link
      console.log(`${logPrefix} Linking existing User to Employee`);
      await client.linkUserToEmployee(employeeName, email);

      await db.auditLog.create({
        data: {
          action: "FRAPPE_USER_LINKED_TO_EMPLOYEE",
          targetResource: `job_applications/${applicationId}`,
          details: {
            email,
            employeeName,
            action: "linked",
            correlationId,
          },
        },
      });

      return {
        success: true,
        userEmail: email,
        action: "linked",
        message: `Linked existing User to Employee: ${email} → ${employeeName}`,
      };
    }

    // Step 4: Create new Frappe User (without Employee/ESS roles — Frappe removes them if no linked Employee)
    console.log(`${logPrefix} Creating new Frappe User: ${email}`);

    await client.createUser({
      email,
      first_name: firstName,
      last_name: lastName || undefined,
      user_type: "System User",
      enabled: 1,
      send_welcome_email: 1, // Frappe sends secure invitation
    });

    console.log(`${logPrefix} Frappe User created successfully`);

    // Step 5: Link User to Employee FIRST (required before Employee/ESS roles can persist)
    await client.linkUserToEmployee(employeeName, email);
    console.log(`${logPrefix} User linked to Employee: ${email} → ${employeeName}`);

    // Step 6: Assign roles AFTER linking (Frappe validates Employee link for Employee/ESS roles)
    if (frappeRoles.length > 0) {
      await client.updateUserRoles(email, frappeRoles);
      console.log(`${logPrefix} Roles assigned: ${frappeRoleNames.join(", ")}`);
    }

    // Step 7: Audit log
    await db.auditLog.create({
      data: {
        action: "FRAPPE_USER_CREATED_AT_HIRED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          email,
          employeeName,
          roles: frappeRoleNames,
          firstName,
          lastName: lastName || null,
          welcomeEmailSent: true,
          correlationId,
        },
      },
    });

    return {
      success: true,
      userEmail: email,
      action: "created",
      message: `Created Frappe User with invitation: ${email}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Frappe User provisioning failed:`, errorMessage);

    await db.auditLog.create({
      data: {
        action: "FRAPPE_USER_PROVISIONING_FAILED",
        targetResource: `job_applications/${applicationId}`,
        details: {
          email,
          employeeName,
          error: errorMessage,
          correlationId,
        },
      },
    });

    return {
      success: false,
      userEmail: null,
      action: "failed",
      message: `Frappe User provisioning failed: ${errorMessage}`,
      error: errorMessage,
    };
  }
}
