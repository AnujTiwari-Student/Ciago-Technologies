/**
 * Email sending functions with Resend integration and delivery tracking.
 *
 * WEBHOOK SETUP:
 * TanStack Start doesn't support API routes for webhooks. To enable webhook tracking:
 * 1. Use a separate webhook handler service (e.g., Vercel Edge Function, Cloudflare Worker)
 * 2. Or implement webhook endpoint in your hosting platform (e.g., Next.js API route if migrating)
 * 3. Webhook handler should call handleResendWebhook() function exported below
 *
 * For now, email tracking works but status updates require manual polling or external webhook.
 */

import { getAdminDb } from "@/lib/db/admin";
import { getSenderForEmailType, formatSender, type EmailType } from "@/lib/email-config";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  emailType: EmailType;
  userId?: string;
  applicationId?: string;
  metadata?: Record<string, unknown>;
};

export async function sendWorkflowEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  emailId: string;
  resendId?: string;
  error?: string;
}> {
  const { to, subject, html, emailType, userId, applicationId, metadata } = options;

  const sender = getSenderForEmailType(emailType);
  const from = formatSender(sender);

  const adminDb = getAdminDb();

  // Create email record
  const emailRecord = await adminDb.email.create({
    data: {
      sender: from,
      recipient: to,
      subject,
      emailType,
      status: "pending",
      userId: userId || null,
      applicationId: applicationId || null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
    },
  });

  // Check feature flag
  const { isResendEmailEnabled } = await import("@/lib/feature-flags.server");
  const emailEnabled = await isResendEmailEnabled();

  if (!emailEnabled) {
    console.log(`[email] Resend disabled, email queued: ${emailRecord.id}`);
    return {
      success: true,
      emailId: emailRecord.id,
    };
  }

  try {
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
        from,
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(data)}`);
    }

    // Update email record with Resend ID
    await adminDb.email.update({
      where: { id: emailRecord.id },
      data: {
        resendId: data.id,
        status: "sent",
        sentAt: new Date(),
      },
    });

    console.log(`[email] Sent successfully: ${emailRecord.id} (Resend: ${data.id})`);

    return {
      success: true,
      emailId: emailRecord.id,
      resendId: data.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await adminDb.email.update({
      where: { id: emailRecord.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorMessage,
      },
    });

    console.error(`[email] Send failed: ${emailRecord.id}`, error);

    return {
      success: false,
      emailId: emailRecord.id,
      error: errorMessage,
    };
  }
}

/**
 * Handle Resend webhook events to update email status.
 */
export async function handleResendWebhook(payload: {
  type: string;
  data: {
    email_id?: string;
    created_at?: string;
  };
}): Promise<void> {
  const { type, data } = payload;
  const resendId = data.email_id;

  if (!resendId) {
    console.warn("[email-webhook] No email_id in payload");
    return;
  }

  const adminDb = getAdminDb();

  const emailRecord = await adminDb.email.findFirst({
    where: { resendId },
  });

  if (!emailRecord) {
    console.warn(`[email-webhook] Email not found: ${resendId}`);
    return;
  }

  const timestamp = data.created_at ? new Date(data.created_at) : new Date();

  switch (type) {
    case "email.delivered":
      await adminDb.email.update({
        where: { id: emailRecord.id },
        data: {
          status: "delivered",
          deliveredAt: timestamp,
        },
      });
      break;

    case "email.opened":
      await adminDb.email.update({
        where: { id: emailRecord.id },
        data: {
          openedAt: timestamp,
        },
      });
      break;

    case "email.clicked":
      await adminDb.email.update({
        where: { id: emailRecord.id },
        data: {
          clickedAt: timestamp,
        },
      });
      break;

    case "email.bounced":
      await adminDb.email.update({
        where: { id: emailRecord.id },
        data: {
          status: "bounced",
          bouncedAt: timestamp,
        },
      });
      break;

    case "email.delivery_delayed":
      // Track but don't change status
      console.log(`[email-webhook] Delivery delayed: ${resendId}`);
      break;

    default:
      console.log(`[email-webhook] Unhandled event type: ${type}`);
  }

  console.log(`[email-webhook] Processed ${type} for ${resendId}`);
}
