/**
 * Verify templates are visible in Frappe UI
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function frappe(endpoint: string) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return res.json();
}

async function verify() {
  console.log("========================================");
  console.log(" Verifying Frappe Templates");
  console.log("========================================\n");

  console.log(`Frappe URL: ${baseUrl}`);
  console.log(`Testing connection...\n`);

  try {
    // Check Print Formats
    console.log("=== PRINT FORMATS ===");
    const pfData = await frappe("/api/resource/Print Format?limit_page_length=100");
    const allFormats = pfData.data || [];
    const ciagoFormats = allFormats.filter((f: any) => f.name.includes("Ciago"));

    console.log(`Total Print Formats: ${allFormats.length}`);
    console.log(`Ciago Branded: ${ciagoFormats.length}\n`);

    if (ciagoFormats.length > 0) {
      console.log("✅ Ciago Print Formats Found:");
      ciagoFormats.forEach((f: any) => console.log(`   - ${f.name}`));
    } else {
      console.log("⚠️  No Ciago print formats found!");
      console.log("   Run: npx tsx scripts/create-all-frappe-templates.ts");
    }

    console.log("\n=== EMAIL TEMPLATES ===");
    const etData = await frappe("/api/resource/Email Template?limit_page_length=100");
    const allEmails = etData.data || [];
    const customEmails = [
      "Salary Slip Release",
      "Leave Approved",
      "Quotation Sent",
      "Purchase Order Sent",
      "Support Ticket Created"
    ];
    const foundEmails = allEmails.filter((e: any) =>
      customEmails.includes(e.name)
    );

    console.log(`Total Email Templates: ${allEmails.length}`);
    console.log(`Custom Templates Found: ${foundEmails.length}/${customEmails.length}\n`);

    if (foundEmails.length > 0) {
      console.log("✅ Email Templates Found:");
      foundEmails.forEach((e: any) => console.log(`   - ${e.name}`));
    } else {
      console.log("⚠️  No custom email templates found!");
    }

    console.log("\n=== HOW TO VIEW IN UI ===");
    console.log("\n1. Login to Frappe:");
    console.log(`   URL: ${baseUrl}`);
    console.log("   Email: anujavengers@gmail.com");
    console.log("   Password: QWEbnm2901@");

    console.log("\n2. View Print Formats:");
    console.log("   - Press Ctrl+K (search)");
    console.log("   - Type: 'Print Format'");
    console.log("   - Click 'Print Format List'");
    console.log("   - Look for 'Ciago' formats");

    console.log("\n3. View Email Templates:");
    console.log("   - Press Ctrl+K");
    console.log("   - Type: 'Email Template'");
    console.log("   - Click 'Email Template List'");

    console.log("\n4. Test Print Format:");
    console.log("   - Open any Salary Slip");
    console.log("   - Click Print (dropdown)");
    console.log("   - Select 'Ciago Salary Slip'");
    console.log("   - PDF will generate\n");

    console.log("========================================");
    console.log(` Status: ${ciagoFormats.length > 0 ? '✅ READY' : '⚠️  NEEDS SETUP'}`);
    console.log("========================================\n");

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.log("\nPossible issues:");
    console.log("1. Frappe not running (start with: cd frappe-bench && bench start)");
    console.log("2. Wrong API credentials in .env");
    console.log("3. Network issue\n");
  }
}

verify();
