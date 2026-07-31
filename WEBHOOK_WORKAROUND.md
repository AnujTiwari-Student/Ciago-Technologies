# Resend Webhook Workaround

**Issue**: TanStack Start doesn't support API routes for webhook endpoints.

**Solution**: Deploy a separate webhook handler that calls the existing `handleResendWebhook()` function.

---

## Option 1: Vercel Edge Function (Recommended)

Create `api/webhooks/resend.ts` in a separate Vercel project:

```typescript
import { handleResendWebhook } from "@/lib/email.functions";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Verify signature (optional but recommended)
    const signature = req.headers.get("svix-signature");
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      // TODO: Implement Svix signature verification
      console.log("[resend-webhook] Signature verification skipped");
    }

    const payload = await req.json();
    await handleResendWebhook(payload);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[resend-webhook] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Webhook processing failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
```

**Deploy**:
```bash
vercel deploy
```

**Configure in Resend**:
- Webhook URL: `https://your-vercel-app.vercel.app/api/webhooks/resend`
- Events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`

---

## Option 2: Cloudflare Worker

Create `worker.js`:

```javascript
import { handleResendWebhook } from "./email-functions";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const payload = await request.json();
      await handleResendWebhook(payload);

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[resend-webhook] Error:", error);
      return new Response(
        JSON.stringify({
          error: error.message || "Webhook processing failed",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
```

**Deploy**:
```bash
wrangler publish
```

---

## Option 3: Shared Neon Database Connection

If you deploy a separate webhook handler, it needs access to your Neon database.

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

### Prisma Client Setup
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);

export const prisma = new PrismaClient({ adapter });
```

---

## Option 4: Manual Polling (Temporary)

If you can't deploy a webhook handler immediately, you can poll Resend API:

```typescript
// scripts/poll-resend-status.ts
import { Resend } from "resend";
import { getAdminDb } from "@/lib/db/admin";

const resend = new Resend(process.env.RESEND_API_KEY);
const adminDb = getAdminDb();

async function pollEmailStatus() {
  // Get emails with pending status
  const pending = await adminDb.email.findMany({
    where: { status: "sent" },
    take: 100,
  });

  for (const email of pending) {
    if (!email.resendId) continue;

    try {
      const result = await resend.emails.get(email.resendId);

      if (result.data?.status) {
        await adminDb.email.update({
          where: { id: email.id },
          data: {
            status: result.data.status,
            deliveredAt: result.data.status === "delivered" ? new Date() : undefined,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to poll ${email.id}:`, error);
    }
  }
}

pollEmailStatus().catch(console.error);
```

Run via cron:
```bash
# Every 5 minutes
*/5 * * * * cd /path/to/project && npx tsx scripts/poll-resend-status.ts
```

---

## Testing the Webhook

### Local Testing with ngrok
```bash
# Terminal 1: Start ngrok
ngrok http 8080

# Terminal 2: Deploy webhook to local ngrok URL
# Or use Resend CLI
resend webhooks:create https://your-ngrok-url.ngrok.io/api/webhooks/resend

# Terminal 3: Send test email
npx tsx scripts/test-email-webhook.ts
```

### Test Script
```typescript
// scripts/test-email-webhook.ts
import { handleResendWebhook } from "@/lib/email.functions";

const mockPayload = {
  type: "email.delivered",
  data: {
    email_id: "re_xxxxx",
    created_at: new Date().toISOString(),
  },
};

handleResendWebhook(mockPayload)
  .then(() => console.log("✅ Webhook test passed"))
  .catch((err) => console.error("❌ Webhook test failed:", err));
```

---

## Production Recommendations

1. **Use Vercel Edge Functions** (easiest, free tier available)
2. **Enable signature verification** for security
3. **Monitor webhook delivery** in Resend dashboard
4. **Set up retry logic** for failed webhooks
5. **Add rate limiting** to prevent abuse

---

## Current Status

- ✅ Email tracking table created (emails table in Neon)
- ✅ `handleResendWebhook()` function implemented
- ✅ Email sending with Resend API working
- ✅ Cloudflare Worker deployed: https://resend-worker.anujavengers.workers.dev
- ✅ Worker connects to Neon via HTTP SQL (no Prisma/WebSocket needed)
- ✅ Automatic status updates working (delivered, opened, clicked, bounced)

**Webhook URL for Resend dashboard**: `https://resend-worker.anujavengers.workers.dev`
**Events to subscribe**: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`

---

## Future: Native API Route Support

If TanStack Start adds API route support in the future, you can create:

```typescript
// src/routes/api/webhooks/resend.ts (future)
export async function POST({ request }: { request: Request }) {
  const payload = await request.json();
  await handleResendWebhook(payload);
  return { received: true };
}
```

Track progress: https://github.com/TanStack/router/discussions
