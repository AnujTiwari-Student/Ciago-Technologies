/**
 * Resend webhook endpoint for email event tracking.
 *
 * Handles: email.delivered, email.opened, email.clicked, email.bounced
 *
 * Configure in Resend dashboard:
 * Webhook URL: https://your-domain.com/api/webhooks/resend
 * Events: Select all email events
 */

import { createAPIFileRoute } from "@tanstack/start/api";
import { handleResendWebhook } from "@/lib/email.functions";

export const Route = createAPIFileRoute("/api/webhooks/resend")({
  POST: async ({ request }) => {
    try {
      // Verify webhook signature
      const signature = request.headers.get("svix-signature");
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        // TODO: Implement Svix signature verification
        // For now, just log it
        console.log("[resend-webhook] Signature verification skipped");
      }

      const payload = await request.json();

      await handleResendWebhook(payload);

      return new Response(
        JSON.stringify({ received: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("[resend-webhook] Error:", error);

      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Webhook processing failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
});
