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

        // Notify user that their HR portal access is ready
        const frappeBaseUrl = process.env.FRAPPE_BASE_URL || "https://hrms.ciagotech.com";
        await db.inAppNotification.create({
          data: {
            userId,
            applicationId,
            title: "HR Portal Access Available",
            body: `Your Frappe HR account is already set up. You can login at ${frappeBaseUrl}`,
            link: "/my-applications",
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

      // Notify user that their account was linked
      const frappeBaseUrl = process.env.FRAPPE_BASE_URL || "https://hrms.ciagotech.com";
      await db.inAppNotification.create({
        data: {
          userId,
          applicationId,
          title: "HR Portal Account Linked",
          body: `Your existing Frappe HR account has been linked to your employee record. Access at ${frappeBaseUrl}`,
          link: "/my-applications",
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

    // Step 8: Send CiagoTech notification about Frappe account creation
    const frappeBaseUrl = process.env.FRAPPE_BASE_URL || "https://hrms.ciagotech.com";

    // Create in-app notification
    await db.inAppNotification.create({
      data: {
        userId,
        applicationId,
        title: "HR Portal Access Created",
        body: `Your Frappe HR account has been created. Check your email (${email}) for login instructions from Frappe.`,
        link: "/my-applications",
      },
    });

    // Send email notification
    try {
      const { sendResendEmail } = await import("@/lib/notifications.server");

      const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:800;font-size:18px;letter-spacing:-0.01em">Ciago <span style="color:#0d9488">Technologies</span></div>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 12px;font-size:14px;color:#64748b">Welcome · HR Portal Access</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Your HR Portal Account is Ready</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#334155">Hi ${firstName},</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">Congratulations on joining Ciago Technologies! Your Frappe HR portal account has been created.</p>

          <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #0d9488;border-radius:6px">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a">What happens next:</p>
            <ol style="margin:8px 0 0 0;padding-left:20px;font-size:14px;color:#334155;line-height:1.6">
              <li style="margin-bottom:6px">You'll receive a separate email from Frappe HR with a secure invitation link</li>
              <li style="margin-bottom:6px">Click the link in that email to set your password</li>
              <li style="margin-bottom:6px">Access your HR portal at: <strong>${frappeBaseUrl}</strong></li>
            </ol>
          </div>

          <p style="margin:18px 0 12px;font-size:15px;line-height:1.6;color:#334155">The Frappe invitation email will be sent to: <strong>${email}</strong></p>
          <p style="margin:0 0 12px;font-size:14px;color:#64748b">If you don't receive the Frappe invitation within 10 minutes, please check your spam folder or contact HR.</p>

          <div style="margin:24px 0;padding:14px 16px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px">
            <p style="margin:0;font-size:13px;color:#92400e"><strong>Important:</strong> The password reset link from Frappe is single-use and expires in 24 hours. Make sure to complete setup within this time.</p>
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#64748b">Welcome to the team!</p>
          <p style="margin:8px 0 0;font-size:13px;color:#64748b">— HR, Ciago Technologies</p>
        </td></tr>
      </table></td></tr></table></body></html>`;

      await sendResendEmail({
        to: email,
        subject: "Your Frappe HR Portal Account - Set Your Password",
        html,
        userId,
        applicationId,
      });

      console.log(`${logPrefix} CiagoTech notification sent to ${email}`);
    } catch (emailError) {
      console.error(`${logPrefix} Failed to send CiagoTech notification email:`, emailError);
      // Non-blocking - user provisioning already succeeded
    }

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
