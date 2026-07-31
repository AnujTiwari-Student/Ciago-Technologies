/**
 * Resend Webhook Handler for Email Status Updates
 *
 * This Cloudflare Worker receives webhook events from Resend
 * and updates email status in the Neon database using Neon's
 * HTTP-based serverless driver (no WebSocket/Pool needed).
 */

import { neon } from "@neondatabase/serverless";

interface Env {
	DATABASE_URL: string;
	RESEND_WEBHOOK_SECRET?: string;
}

interface ResendWebhookPayload {
	type: string;
	data: {
		email_id?: string;
		created_at?: string;
	};
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Health check endpoint (any method)
		if (url.pathname === "/health") {
			return Response.json({ status: "ok", timestamp: new Date().toISOString() });
		}

		// Only allow POST for webhook
		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		// Verify DATABASE_URL is configured
		if (!env.DATABASE_URL) {
			console.error("[resend-webhook] DATABASE_URL not configured");
			return Response.json({ error: "Server configuration error" }, { status: 500 });
		}

		// Create Neon SQL client (HTTP-based, no WebSocket needed)
		const sql = neon(env.DATABASE_URL);

		try {
			const payload = await request.json() as ResendWebhookPayload;
			console.log("[resend-webhook] Received event:", payload.type);

			const { type, data } = payload;
			const resendId = data.email_id;

			if (!resendId) {
				console.warn("[resend-webhook] No email_id in payload");
				return Response.json({ error: "Missing email_id" }, { status: 400 });
			}

			// Find email record by Resend ID
			const rows = await sql`SELECT id, status FROM emails WHERE resend_id = ${resendId} LIMIT 1`;

			if (rows.length === 0) {
				console.warn(`[resend-webhook] Email not found: ${resendId}`);
				return Response.json({
					warning: "Email not found",
					resendId,
					note: "May be expected if email was sent from a different environment"
				});
			}

			const email = rows[0];
			const now = new Date().toISOString();

			// Update based on event type
			switch (type) {
				case "email.delivered":
					await sql`UPDATE emails SET status = 'delivered', delivered_at = ${now}, updated_at = ${now} WHERE id = ${email.id}`;
					console.log(`[resend-webhook] Email delivered: ${resendId}`);
					break;

				case "email.opened":
					if (email.status === "delivered" || email.status === "sent") {
						await sql`UPDATE emails SET status = 'opened', opened_at = ${now}, updated_at = ${now} WHERE id = ${email.id}`;
					} else {
						await sql`UPDATE emails SET opened_at = ${now}, updated_at = ${now} WHERE id = ${email.id}`;
					}
					console.log(`[resend-webhook] Email opened: ${resendId}`);
					break;

				case "email.clicked":
					await sql`UPDATE emails SET status = 'clicked', clicked_at = ${now}, updated_at = ${now} WHERE id = ${email.id}`;
					console.log(`[resend-webhook] Email clicked: ${resendId}`);
					break;

				case "email.bounced":
					await sql`UPDATE emails SET status = 'bounced', bounced_at = ${now}, updated_at = ${now} WHERE id = ${email.id}`;
					console.log(`[resend-webhook] Email bounced: ${resendId}`);
					break;

				case "email.delivery_delayed":
					console.log(`[resend-webhook] Delivery delayed: ${resendId}`);
					break;

				case "email.complained":
					await sql`UPDATE emails SET status = 'complained', updated_at = ${now} WHERE id = ${email.id}`;
					console.log(`[resend-webhook] Spam complaint: ${resendId}`);
					break;

				default:
					console.log(`[resend-webhook] Unhandled event type: ${type}`);
			}

			return Response.json({
				received: true,
				emailId: email.id,
				eventType: type,
			});

		} catch (error) {
			console.error("[resend-webhook] Error:", error);
			return Response.json(
				{ error: error instanceof Error ? error.message : "Internal server error" },
				{ status: 500 }
			);
		}
	},
} satisfies ExportedHandler<Env>;
