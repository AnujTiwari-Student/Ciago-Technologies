/**
 * Resend Frappe HR Portal Credentials Email
 *
 * Sets a new temporary password via Admin API and emails it.
 *
 * Usage:
 *   npx tsx scripts/resend-frappe-password-email.ts <email>
 *   npx tsx scripts/resend-frappe-password-email.ts anujcloudwork@gmail.com
 */
import * as crypto from "crypto";
import { getAdminDb } from "../src/lib/db/admin";
import { createFrappeClient } from "../src/integrations/frappe/client";
import * as dotenv from "dotenv";
dotenv.config();

const TARGET_EMAIL = process.argv[2];

if (!TARGET_EMAIL) {
  console.error("Usage: npx tsx scripts/resend-frappe-password-email.ts <email>");
  process.exit(1);
}

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

(async () => {
  try {
    const db = getAdminDb();
    const frappeClient = createFrappeClient();
    const frappeBaseUrl = process.env.FRAPPE_BASE_URL || "http://localhost:8180";

    console.log(`\nResetting password for: ${TARGET_EMAIL}\n`);

    // Verify user exists in Frappe
    const frappeUser = await frappeClient.getUser(TARGET_EMAIL);
    if (!frappeUser) {
      console.log(`❌ User ${TARGET_EMAIL} not found in Frappe`);
      process.exit(1);
    }
    console.log(`✓ Found Frappe user: ${frappeUser.email}`);

    // Set new temporary password
    const tempPassword = generateTempPassword();
    await frappeClient.setUserPassword(TARGET_EMAIL, tempPassword);
    console.log(`✓ Temporary password set`);

    // Verify login works
    const loginResponse = await fetch(`${frappeBaseUrl}/api/method/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr: TARGET_EMAIL, pwd: tempPassword }),
    });

    if (loginResponse.status === 200) {
      console.log(`✓ Login verified successfully\n`);
    } else {
      console.log(`⚠️  Login verification returned ${loginResponse.status} (may still work)\n`);
    }

    // Find application and user in our database
    const clerkUser = await db.clerkUserMap.findUnique({
      where: { email: TARGET_EMAIL },
    });

    const application = await db.jobApplication.findFirst({
      where: { email: TARGET_EMAIL, status: "hired", isSoftDeleted: false },
      orderBy: { hiredAt: "desc" },
    });

    const firstName = application?.fullName?.split(" ")[0] || TARGET_EMAIL.split("@")[0] || "User";
    const loginUrl = `${frappeBaseUrl}/login`;

    // Send email
    console.log("Sending credentials email...");
    const { sendResendEmail } = await import("../src/lib/notifications.server");

    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:800;font-size:18px;letter-spacing:-0.01em">Ciago <span style="color:#0d9488">Technologies</span></div>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 12px;font-size:14px;color:#64748b">HR Portal Access</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Your HR Portal Credentials</h1>
          <p style="margin:0 0 8px;font-size:15px;color:#334155">Hi ${firstName},</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">Here are your login credentials for the Ciago Technologies HR Portal.</p>

          <div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #0d9488;border-radius:6px">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a">Your login credentials:</p>
            <table style="width:100%;font-size:14px;color:#334155;line-height:1.8">
              <tr><td style="font-weight:600;width:120px">Portal URL:</td><td><a href="${loginUrl}" style="color:#0d9488">${frappeBaseUrl}</a></td></tr>
              <tr><td style="font-weight:600">Email:</td><td>${TARGET_EMAIL}</td></tr>
              <tr><td style="font-weight:600">Password:</td><td style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:4px">${tempPassword}</td></tr>
            </table>
          </div>

          <p style="margin:16px 0 12px">
            <a href="${loginUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">Log in to HR Portal</a>
          </p>

          <div style="margin:24px 0;padding:14px 16px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px">
            <p style="margin:0;font-size:13px;color:#92400e"><strong>Important:</strong> Please change your password after first login. Go to Settings, then Change Password.</p>
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#64748b">Welcome to the team!</p>
          <p style="margin:8px 0 0;font-size:13px;color:#64748b">— HR, Ciago Technologies</p>
        </td></tr>
      </table></td></tr></table></body></html>`;

    await sendResendEmail({
      to: TARGET_EMAIL,
      subject: "Your HR Portal Credentials - Ciago Technologies",
      html,
      userId: clerkUser?.authUserId || "",
      applicationId: application?.id || "",
    });

    console.log(`✓ Email sent!\n`);

    console.log("═══════════════════════════════════════════════════════════");
    console.log("SUCCESS!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`  Portal: ${frappeBaseUrl}`);
    console.log(`  Email:  ${TARGET_EMAIL}`);
    console.log(`  Pass:   ${tempPassword}`);
    console.log("═══════════════════════════════════════════════════════════\n");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
})();
