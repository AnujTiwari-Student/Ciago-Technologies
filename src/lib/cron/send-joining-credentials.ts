/**
 * Send Frappe Credentials on Joining Date
 *
 * Generates a temporary password, sets it on Frappe via admin API,
 * and sends the credentials email with URL + email + password.
 */

import { getAdminDb } from "@/lib/db/admin";
import { startOfDay, endOfDay } from "date-fns";
import crypto from "crypto";

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const special = "@#$!";
  let password = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 10; i++) {
    password += chars[bytes[i]! % chars.length];
  }
  password += special[bytes[10]! % special.length];
  password += crypto.randomBytes(2).toString("hex");
  return password;
}

function generateCredentialsEmail(params: {
  fullName: string;
  email: string;
  position: string;
  frappeUrl: string;
  loginUrl: string;
  tempPassword: string;
}): { subject: string; html: string; text: string } {
  const { fullName, email, position, frappeUrl, loginUrl, tempPassword } = params;
  const firstName = fullName.split(" ")[0];

  const subject = `Your HR Portal Credentials - Welcome to Ciago Technologies`;

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
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">
        Congratulations on joining Ciago Technologies as <strong>${position}</strong>! Your Frappe HR Portal is now active. Use the credentials below to log in.
      </p>

      <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #0d9488;border-radius:6px">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a">Your login credentials:</p>
        <table style="width:100%;font-size:14px;color:#334155;line-height:1.8">
          <tr><td style="font-weight:600;width:120px">Portal URL:</td><td><a href="${loginUrl}" style="color:#0d9488">${frappeUrl}</a></td></tr>
          <tr><td style="font-weight:600">Email:</td><td>${email}</td></tr>
          <tr><td style="font-weight:600">Password:</td><td style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:4px">${tempPassword}</td></tr>
        </table>
      </div>

      <p style="margin:16px 0 12px">
        <a href="${loginUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">Log in to HR Portal</a>
      </p>

      <div style="margin:24px 0;padding:14px 16px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px">
        <p style="margin:0;font-size:13px;color:#92400e"><strong>Important:</strong> This is a temporary password. Please change it after your first login. Go to Settings &rarr; Change Password once logged in.</p>
      </div>

      <div style="margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a">What you can do on the portal:</p>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:2">
          <li>View and download your salary slips</li>
          <li>Apply for leaves and track approvals</li>
          <li>Mark attendance and view history</li>
          <li>Update your personal information</li>
          <li>Access company policies and documents</li>
        </ul>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#64748b">Welcome to the team, ${firstName}!</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b">&mdash; HR, Ciago Technologies</p>
    </td></tr>
  </table></td></tr></table></body></html>`;

  const text = `Your HR Portal Credentials - Ciago Technologies

Hi ${firstName},

Congratulations on joining Ciago Technologies as ${position}! Your Frappe HR Portal is now active.

YOUR LOGIN CREDENTIALS:
- Portal URL: ${frappeUrl}
- Email: ${email}
- Password: ${tempPassword}

Log in here: ${loginUrl}

IMPORTANT: This is a temporary password. Please change it after your first login.
Go to Settings > Change Password once logged in.

WHAT YOU CAN DO:
- View and download your salary slips
- Apply for leaves and track approvals
- Mark attendance and view history
- Update your personal information
- Access company policies and documents

If you have any issues, contact HR at hr@ciagotech.com.

Welcome to the team!
- HR, Ciago Technologies`;

  return { subject, html, text };
}

/**
 * Send credentials email to a new joiner.
 * Generates a temp password, sets it on Frappe, and emails it to the user.
 */
export async function sendCredentialsEmail(application: any): Promise<boolean> {
  try {
    const { createFrappeClient } = await import("@/integrations/frappe/client");
    const client = createFrappeClient();

    const frappeUrl = process.env.FRAPPE_BASE_URL || "https://hrms.ciagotech.com";
    const loginUrl = `${frappeUrl}/login`;
    const workEmail = application.email;

    // Ensure user is enabled in Frappe
    const frappeUser = await client.getUser(workEmail);
    if (frappeUser && !frappeUser.enabled) {
      await client.enableUser(workEmail);
      console.log(`[credentials] Enabled Frappe user: ${workEmail}`);
    }

    // Generate and set temporary password on Frappe
    const tempPassword = generateTempPassword();
    await client.setUserPassword(workEmail, tempPassword);
    console.log(`[credentials] Set temporary password for ${workEmail}`);

    const emailContent = generateCredentialsEmail({
      fullName: application.fullName,
      email: workEmail,
      position: application.roleTitle,
      frappeUrl,
      loginUrl,
      tempPassword,
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Ciago Technologies <hr@ciagotech.com>",
        to: workEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(result)}`);
    }

    console.log(`[credentials] Email sent to ${workEmail}:`, result.id);

    // Track email in database
    const db = getAdminDb();
    await db.email.create({
      data: {
        sender: "Ciago Technologies <hr@ciagotech.com>",
        recipient: workEmail,
        subject: emailContent.subject,
        emailType: "frappe_credentials",
        status: "sent",
        resendId: result.id,
        userId: application.userId,
        applicationId: application.id,
        metadata: {
          joiningDate: application.joiningDate?.toISOString?.() ?? null,
          frappeUrl,
        },
      },
    });

    return true;
  } catch (error) {
    console.error(`[credentials] Failed to send credentials email:`, error);
    return false;
  }
}

/**
 * Main cron job function - sends credentials to all employees joining today
 */
export async function sendJoiningDayCredentials(): Promise<{
  success: boolean;
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  console.log("[credentials] Starting joining day credentials job...");

  const db = getAdminDb();
  const today = startOfDay(new Date());
  const tomorrow = endOfDay(new Date());

  try {
    const applications = await db.jobApplication.findMany({
      where: {
        joiningDate: {
          gte: today,
          lte: tomorrow,
        },
        status: "hired",
        frappeProvisioningState: "succeeded",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        roleTitle: true,
        joiningDate: true,
        userId: true,
        frappeProvisioningState: true,
      },
    });

    console.log(`[credentials] Found ${applications.length} employees joining today`);

    const results = {
      success: true,
      processed: applications.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const application of applications) {
      try {
        const sent = await sendCredentialsEmail(application);
        if (sent) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(`Failed to send to ${application.email}`);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.errors.push(`${application.email}: ${errorMsg}`);
        console.error(`[credentials] Error processing ${application.email}:`, error);
      }
    }

    if (results.failed > 0) {
      results.success = false;
    }

    console.log("[credentials] Job completed:", results);
    return results;
  } catch (error) {
    console.error("[credentials] Fatal error:", error);
    return {
      success: false,
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
