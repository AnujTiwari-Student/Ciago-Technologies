/**
 * Test the complete email webhook flow:
 * 1. Insert a test email record
 * 2. Trigger webhook with delivered event
 * 3. Verify database updated
 * 4. Clean up
 */

import { neon } from "@neondatabase/serverless";

const WORKER_URL = "https://resend-worker.anujavengers.workers.dev";
import * as dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.NEON_DATABASE_URL || "";

async function testEmailWebhookFlow() {
  console.log("🧪 Testing Email Webhook Flow\n");

  if (!DATABASE_URL) {
    throw new Error("NEON_DATABASE_URL not set");
  }

  const sql = neon(DATABASE_URL);

  // Step 1: Insert test email record
  console.log("1️⃣  Creating test email record...");
  const testResendId = `test-webhook-${Date.now()}`;

  const insertResult = await sql`
    INSERT INTO emails (resend_id, sender, recipient, subject, email_type, status, sent_at)
    VALUES (
      ${testResendId},
      'Ciago HR <hr@ciagotech.com>',
      'test@example.com',
      'Test Email Webhook',
      'system_notification',
      'sent',
      NOW()
    )
    RETURNING id, resend_id, status, delivered_at
  `;

  const emailRecord = insertResult[0];
  console.log(`   ✅ Created: ${emailRecord.id}`);
  console.log(`   📧 Resend ID: ${emailRecord.resend_id}`);
  console.log(`   📊 Status: ${emailRecord.status}`);

  // Step 2: Trigger webhook
  console.log("\n2️⃣  Triggering webhook (email.delivered)...");

  const webhookPayload = {
    type: "email.delivered",
    data: {
      email_id: testResendId,
      created_at: new Date().toISOString(),
    },
  };

  const webhookResponse = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  const webhookResult = await webhookResponse.json();
  console.log(`   ✅ Webhook responded: ${webhookResponse.status}`);
  console.log(`   📦 Response:`, webhookResult);

  if (!webhookResponse.ok || !webhookResult.received) {
    throw new Error(`Webhook failed: ${JSON.stringify(webhookResult)}`);
  }

  // Step 3: Verify database updated
  console.log("\n3️⃣  Verifying database update...");

  await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause

  const verifyResult = await sql`
    SELECT id, resend_id, status, delivered_at, updated_at
    FROM emails
    WHERE resend_id = ${testResendId}
  `;

  const updatedRecord = verifyResult[0];
  console.log(`   📊 Status: ${updatedRecord.status}`);
  console.log(`   📅 Delivered At: ${updatedRecord.delivered_at}`);
  console.log(`   🕐 Updated At: ${updatedRecord.updated_at}`);

  if (updatedRecord.status !== "delivered") {
    throw new Error(`Expected status 'delivered', got '${updatedRecord.status}'`);
  }

  if (!updatedRecord.delivered_at) {
    throw new Error("delivered_at should be set");
  }

  console.log("   ✅ Database updated correctly");

  // Step 4: Test other webhook events
  console.log("\n4️⃣  Testing email.opened event...");

  const openedPayload = {
    type: "email.opened",
    data: {
      email_id: testResendId,
      created_at: new Date().toISOString(),
    },
  };

  const openedResponse = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(openedPayload),
  });

  const openedResult = await openedResponse.json();
  console.log(`   ✅ Webhook responded: ${openedResponse.status}`);

  await new Promise(resolve => setTimeout(resolve, 1000));

  const openedCheck = await sql`
    SELECT status, opened_at
    FROM emails
    WHERE resend_id = ${testResendId}
  `;

  console.log(`   📊 Status: ${openedCheck[0].status}`);
  console.log(`   📅 Opened At: ${openedCheck[0].opened_at}`);

  if (!openedCheck[0].opened_at) {
    throw new Error("opened_at should be set");
  }

  console.log("   ✅ Opened event tracked");

  // Step 5: Cleanup
  console.log("\n5️⃣  Cleaning up test data...");

  await sql`DELETE FROM emails WHERE resend_id = ${testResendId}`;
  console.log("   ✅ Test data removed");

  // Final summary
  console.log("\n" + "=".repeat(50));
  console.log("✨ EMAIL WEBHOOK FLOW TEST PASSED");
  console.log("=".repeat(50));
  console.log("\n✅ Webhook worker operational");
  console.log("✅ Database updates working");
  console.log("✅ Event tracking accurate");
  console.log("\n📋 Events tested:");
  console.log("   • email.delivered ✓");
  console.log("   • email.opened ✓");
  console.log("\n🔗 Worker URL:", WORKER_URL);
}

testEmailWebhookFlow().catch((error) => {
  console.error("\n❌ TEST FAILED:", error.message);
  process.exit(1);
});
