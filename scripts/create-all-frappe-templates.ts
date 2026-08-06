/**
 * Create ALL Frappe Templates - Complete System
 * Print formats, email templates for all modules
 */

import dotenv from "dotenv";
dotenv.config();

const baseUrl = process.env.FRAPPE_BASE_URL!;
const apiKey = process.env.FRAPPE_API_KEY!;
const apiSecret = process.env.FRAPPE_API_SECRET!;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

async function frappe(endpoint: string, method = "GET", body?: any) {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${endpoint}`, opts);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok && (data.exc_type || data.exception)) {
      throw new Error(`${data.exc_type}: ${data._error_message || data.exception}`);
    }
    return data;
  } catch (e: any) {
    if (e.message?.includes(":")) throw e;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return JSON.parse(text);
  }
}

async function exists(doctype: string, name: string): Promise<boolean> {
  try {
    const r = await frappe(`/api/resource/${doctype}/${encodeURIComponent(name)}`);
    return !!r.data;
  } catch {
    return false;
  }
}

async function createPrintFormat(name: string, doctype: string, html: string) {
  if (await exists("Print Format", name)) {
    console.log(`  [skip] ${name}`);
    return;
  }
  try {
    await frappe(`/api/resource/Print Format`, "POST", {
      name,
      doc_type: doctype,
      print_format_builder: 0,
      html,
      custom_format: 1,
      disabled: 0,
      standard: "No",
    });
    console.log(`  [created] ${name}`);
  } catch (e: any) {
    console.log(`  [error] ${name}:`, e.message?.substring(0, 80));
  }
}

async function createEmailTemplate(name: string, subject: string, response: string) {
  if (await exists("Email Template", name)) {
    console.log(`  [skip] ${name}`);
    return;
  }
  try {
    await frappe(`/api/resource/Email Template`, "POST", { name, subject, response });
    console.log(`  [created] ${name}`);
  } catch (e: any) {
    console.log(`  [error] ${name}:`, e.message?.substring(0, 80));
  }
}

console.log("Creating comprehensive Frappe templates for all modules...\n");

// ============================================================================
// SALES & CRM MODULE
// ============================================================================

console.log("📊 SALES & CRM Templates");

const quotationHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #3b82f6;">CIAGO TECHNOLOGIES</h1>
<p style="margin: 5px 0;">QUOTATION</p></div>
<table style="width: 100%; margin: 20px 0; font-size: 13px;">
<tr><td style="width: 50%;"><strong>Quotation No:</strong> {{ doc.name }}</td>
<td><strong>Date:</strong> {{ frappe.format_date(doc.transaction_date) }}</td></tr>
<tr><td><strong>Valid Until:</strong> {{ frappe.format_date(doc.valid_till) }}</td>
<td><strong>Status:</strong> {{ doc.status }}</td></tr></table>
<div style="margin: 30px 0;"><strong>To:</strong><br>{{ doc.customer_name }}<br>
{% if doc.customer_address %}{{ doc.customer_address }}{% endif %}</div>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead><tr style="background: #f0f9ff; border-bottom: 2px solid #3b82f6;">
<th style="padding: 10px; text-align: left;">#</th>
<th style="padding: 10px; text-align: left;">Item</th>
<th style="padding: 10px; text-align: right;">Qty</th>
<th style="padding: 10px; text-align: right;">Rate</th>
<th style="padding: 10px; text-align: right;">Amount</th></tr></thead><tbody>
{% for item in doc.items %}
<tr style="border-bottom: 1px solid #e5e7eb;">
<td style="padding: 10px;">{{ loop.index }}</td>
<td style="padding: 10px;">{{ item.item_name }}<br><small>{{ item.description or "" }}</small></td>
<td style="padding: 10px; text-align: right;">{{ item.qty }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.rate) }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.amount) }}</td>
</tr>{% endfor %}
<tr style="background: #f0f9ff; font-weight: bold;">
<td colspan="4" style="padding: 12px; text-align: right;">Grand Total</td>
<td style="padding: 12px; text-align: right;">₹ {{ "{:,.2f}".format(doc.grand_total) }}</td>
</tr></tbody></table>
<div style="margin-top: 30px; font-size: 12px;"><strong>Terms & Conditions:</strong><br>
{{ doc.terms or "Standard terms apply." }}</div></div>`;

await createPrintFormat("Ciago Quotation", "Quotation", quotationHTML);

const invoiceHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #10b981;">CIAGO TECHNOLOGIES</h1>
<p style="margin: 5px 0; font-size: 20px; font-weight: bold;">TAX INVOICE</p>
<p style="margin: 0; font-size: 12px;">GSTIN: 29XXXXX1234X1ZX</p></div>
<table style="width: 100%; margin: 20px 0; font-size: 13px;">
<tr><td style="width: 50%;"><strong>Invoice No:</strong> {{ doc.name }}</td>
<td><strong>Date:</strong> {{ frappe.format_date(doc.posting_date) }}</td></tr>
<tr><td><strong>Customer:</strong> {{ doc.customer_name }}</td>
<td><strong>Due Date:</strong> {{ frappe.format_date(doc.due_date) }}</td></tr></table>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead><tr style="background: #d1fae5; border-bottom: 2px solid #10b981;">
<th style="padding: 10px; text-align: left;">#</th>
<th style="padding: 10px; text-align: left;">Item</th>
<th style="padding: 10px; text-align: right;">Qty</th>
<th style="padding: 10px; text-align: right;">Rate</th>
<th style="padding: 10px; text-align: right;">Amount</th></tr></thead><tbody>
{% for item in doc.items %}
<tr style="border-bottom: 1px solid #e5e7eb;">
<td style="padding: 10px;">{{ loop.index }}</td>
<td style="padding: 10px;">{{ item.item_name }}</td>
<td style="padding: 10px; text-align: right;">{{ item.qty }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.rate) }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.amount) }}</td>
</tr>{% endfor %}
<tr style="background: #d1fae5; font-weight: bold; font-size: 16px;">
<td colspan="4" style="padding: 12px; text-align: right;">Grand Total</td>
<td style="padding: 12px; text-align: right;">₹ {{ "{:,.2f}".format(doc.grand_total) }}</td>
</tr></tbody></table>
<div style="margin-top: 40px; text-align: right;">
<p style="margin: 60px 0 5px 0;"><strong>Authorized Signatory</strong></p></div></div>`;

await createPrintFormat("Ciago Sales Invoice", "Sales Invoice", invoiceHTML);

// ============================================================================
// BUYING / PROCUREMENT MODULE
// ============================================================================

console.log("\n📦 BUYING & PROCUREMENT Templates");

const poHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #8b5cf6; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #8b5cf6;">CIAGO TECHNOLOGIES</h1>
<p style="margin: 5px 0; font-size: 18px; font-weight: bold;">PURCHASE ORDER</p></div>
<table style="width: 100%; margin: 20px 0; font-size: 13px;">
<tr><td style="width: 50%;"><strong>PO No:</strong> {{ doc.name }}</td>
<td><strong>Date:</strong> {{ frappe.format_date(doc.transaction_date) }}</td></tr>
<tr><td><strong>Supplier:</strong> {{ doc.supplier_name }}</td>
<td><strong>Status:</strong> {{ doc.status }}</td></tr></table>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead><tr style="background: #f3e8ff; border-bottom: 2px solid #8b5cf6;">
<th style="padding: 10px; text-align: left;">#</th>
<th style="padding: 10px; text-align: left;">Item</th>
<th style="padding: 10px; text-align: right;">Qty</th>
<th style="padding: 10px; text-align: right;">Rate</th>
<th style="padding: 10px; text-align: right;">Amount</th></tr></thead><tbody>
{% for item in doc.items %}
<tr style="border-bottom: 1px solid #e5e7eb;">
<td style="padding: 10px;">{{ loop.index }}</td>
<td style="padding: 10px;">{{ item.item_name }}</td>
<td style="padding: 10px; text-align: right;">{{ item.qty }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.rate) }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.amount) }}</td>
</tr>{% endfor %}
<tr style="background: #f3e8ff; font-weight: bold;">
<td colspan="4" style="padding: 12px; text-align: right;">Total</td>
<td style="padding: 12px; text-align: right;">₹ {{ "{:,.2f}".format(doc.grand_total) }}</td>
</tr></tbody></table></div>`;

await createPrintFormat("Ciago Purchase Order", "Purchase Order", poHTML);

// ============================================================================
// PROJECTS MODULE
// ============================================================================

console.log("\n🎯 PROJECTS Templates");

const projectHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #06b6d4; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #06b6d4;">PROJECT REPORT</h1>
<h2 style="margin: 10px 0 0 0;">{{ doc.project_name }}</h2></div>
<table style="width: 100%; margin: 20px 0;">
<tr><td style="width: 50%;"><strong>Project:</strong> {{ doc.name }}</td>
<td><strong>Status:</strong> {{ doc.status }}</td></tr>
<tr><td><strong>Start:</strong> {{ frappe.format_date(doc.expected_start_date) if doc.expected_start_date else "-" }}</td>
<td><strong>End:</strong> {{ frappe.format_date(doc.expected_end_date) if doc.expected_end_date else "-" }}</td></tr>
<tr><td><strong>Priority:</strong> {{ doc.priority }}</td>
<td><strong>Complete:</strong> {{ doc.percent_complete }}%</td></tr></table>
<div style="margin: 30px 0;"><h3>Summary</h3>
<p>{{ doc.project_details or "No description." }}</p></div></div>`;

await createPrintFormat("Ciago Project Report", "Project", projectHTML);

// ============================================================================
// SUPPORT MODULE
// ============================================================================

console.log("\n🎫 SUPPORT Templates");

const ticketHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #ef4444; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #ef4444;">SUPPORT TICKET</h1>
<p style="margin: 5px 0;">Ciago Technologies</p></div>
<table style="width: 100%; margin: 20px 0;">
<tr><td style="width: 50%;"><strong>Ticket:</strong> {{ doc.name }}</td>
<td><strong>Priority:</strong> {{ doc.priority }}</td></tr>
<tr><td><strong>Status:</strong> {{ doc.status }}</td>
<td><strong>Created:</strong> {{ frappe.format_date(doc.creation) }}</td></tr>
<tr><td><strong>Customer:</strong> {{ doc.customer_name or doc.raised_by }}</td>
<td><strong>Assigned:</strong> {{ doc.agent_name or "Unassigned" }}</td></tr></table>
<div style="margin: 30px 0;"><h3>Subject</h3>
<p>{{ doc.subject }}</p>
<h3>Description</h3>
<p>{{ doc.description }}</p></div></div>`;

await createPrintFormat("Ciago Support Ticket", "Issue", ticketHTML);

// ============================================================================
// STOCK MODULE
// ============================================================================

console.log("\n📦 STOCK Templates");

const deliveryNoteHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #f59e0b; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #f59e0b;">CIAGO TECHNOLOGIES</h1>
<p style="margin: 5px 0; font-size: 18px;">DELIVERY NOTE</p></div>
<table style="width: 100%; margin: 20px 0;">
<tr><td style="width: 50%;"><strong>DN No:</strong> {{ doc.name }}</td>
<td><strong>Date:</strong> {{ frappe.format_date(doc.posting_date) }}</td></tr>
<tr><td><strong>Customer:</strong> {{ doc.customer_name }}</td>
<td><strong>Contact:</strong> {{ doc.contact_display or "-" }}</td></tr></table>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead><tr style="background: #fef3c7; border-bottom: 2px solid #f59e0b;">
<th style="padding: 10px; text-align: left;">#</th>
<th style="padding: 10px; text-align: left;">Item</th>
<th style="padding: 10px; text-align: right;">Qty</th></tr></thead><tbody>
{% for item in doc.items %}
<tr style="border-bottom: 1px solid #e5e7eb;">
<td style="padding: 10px;">{{ loop.index }}</td>
<td style="padding: 10px;">{{ item.item_name }}</td>
<td style="padding: 10px; text-align: right;">{{ item.qty }} {{ item.uom }}</td>
</tr>{% endfor %}</tbody></table>
<div style="margin-top: 50px;"><strong>Received By:</strong> _____________________ <strong>Date:</strong> _____________</div></div>`;

await createPrintFormat("Ciago Delivery Note", "Delivery Note", deliveryNoteHTML);

// ============================================================================
// ACCOUNTING MODULE
// ============================================================================

console.log("\n💰 ACCOUNTING Templates");

const paymentReceiptHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #14b8a6; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #14b8a6;">PAYMENT RECEIPT</h1>
<p style="margin: 5px 0;">Ciago Technologies</p></div>
<table style="width: 100%; margin: 20px 0;">
<tr><td style="width: 50%;"><strong>Receipt No:</strong> {{ doc.name }}</td>
<td><strong>Date:</strong> {{ frappe.format_date(doc.posting_date) }}</td></tr>
<tr><td><strong>Received From:</strong> {{ doc.party_name }}</td>
<td><strong>Mode:</strong> {{ doc.mode_of_payment }}</td></tr></table>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead><tr style="background: #ccfbf1; border-bottom: 2px solid #14b8a6;">
<th style="padding: 10px; text-align: left;">Description</th>
<th style="padding: 10px; text-align: right;">Amount</th></tr></thead><tbody>
{% for ref in doc.references %}
<tr style="border-bottom: 1px solid #e5e7eb;">
<td style="padding: 10px;">{{ ref.reference_doctype }} - {{ ref.reference_name }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(ref.allocated_amount) }}</td>
</tr>{% endfor %}
<tr style="background: #ccfbf1; font-weight: bold;">
<td style="padding: 12px; text-align: right;">Total Received</td>
<td style="padding: 12px; text-align: right;">₹ {{ "{:,.2f}".format(doc.paid_amount) }}</td>
</tr></tbody></table></div>`;

await createPrintFormat("Ciago Payment Receipt", "Payment Entry", paymentReceiptHTML);

// ============================================================================
// EXPENSE CLAIMS
// ============================================================================

console.log("\n💳 EXPENSE Templates");

const expenseHTML = `<div style="font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;">
<div style="text-align: center; border-bottom: 3px solid #a855f7; padding-bottom: 20px; margin-bottom: 30px;">
<h1 style="margin: 0; color: #a855f7;">EXPENSE CLAIM</h1>
<p style="margin: 5px 0;">Ciago Technologies</p></div>
<table style="width: 100%; margin: 20px 0;">
<tr><td style="width: 50%;"><strong>Claim No:</strong> {{ doc.name }}</td>
<td><strong>Date:</strong> {{ frappe.format_date(doc.posting_date) }}</td></tr>
<tr><td><strong>Employee:</strong> {{ doc.employee_name }}</td>
<td><strong>Status:</strong> {{ doc.status }}</td></tr></table>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead><tr style="background: #f3e8ff; border-bottom: 2px solid #a855f7;">
<th style="padding: 10px; text-align: left;">Date</th>
<th style="padding: 10px; text-align: left;">Expense Type</th>
<th style="padding: 10px; text-align: left;">Description</th>
<th style="padding: 10px; text-align: right;">Amount</th></tr></thead><tbody>
{% for item in doc.expenses %}
<tr style="border-bottom: 1px solid #e5e7eb;">
<td style="padding: 10px;">{{ frappe.format_date(item.expense_date) }}</td>
<td style="padding: 10px;">{{ item.expense_type }}</td>
<td style="padding: 10px;">{{ item.description }}</td>
<td style="padding: 10px; text-align: right;">₹ {{ "%.2f"|format(item.amount) }}</td>
</tr>{% endfor %}
<tr style="background: #f3e8ff; font-weight: bold;">
<td colspan="3" style="padding: 12px; text-align: right;">Total</td>
<td style="padding: 12px; text-align: right;">₹ {{ "{:,.2f}".format(doc.total_claimed_amount) }}</td>
</tr></tbody></table></div>`;

await createPrintFormat("Ciago Expense Claim", "Expense Claim", expenseHTML);

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

console.log("\n📧 EMAIL Templates");

await createEmailTemplate(
  "Quotation Sent",
  "Quotation {{ doc.name }} from Ciago Technologies",
  `<p>Dear {{ doc.customer_name }},</p>
<p>Thank you for your interest in Ciago Technologies.</p>
<p>Please find attached quotation <strong>{{ doc.name }}</strong> for your review.</p>
<p><strong>Valid Until:</strong> {{ frappe.format_date(doc.valid_till) }}<br>
<strong>Total Amount:</strong> ₹ {{ "{:,.2f}".format(doc.grand_total) }}</p>
<p>For any queries, feel free to contact us.</p>
<p>Best regards,<br>Sales Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Invoice Payment Due",
  "Payment Due: Invoice {{ doc.name }}",
  `<p>Dear {{ doc.customer_name }},</p>
<p>This is a reminder that payment for invoice <strong>{{ doc.name }}</strong> is due.</p>
<p><strong>Invoice Date:</strong> {{ frappe.format_date(doc.posting_date) }}<br>
<strong>Due Date:</strong> {{ frappe.format_date(doc.due_date) }}<br>
<strong>Amount Due:</strong> ₹ {{ "{:,.2f}".format(doc.outstanding_amount) }}</p>
<p>Please arrange payment at your earliest convenience.</p>
<p>Thank you,<br>Accounts Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Purchase Order Sent",
  "Purchase Order {{ doc.name }}",
  `<p>Dear {{ doc.supplier_name }},</p>
<p>Please find attached purchase order <strong>{{ doc.name }}</strong>.</p>
<p><strong>PO Date:</strong> {{ frappe.format_date(doc.transaction_date) }}<br>
<strong>Required By:</strong> {{ frappe.format_date(doc.schedule_date) if doc.schedule_date else "ASAP" }}<br>
<strong>Total Amount:</strong> ₹ {{ "{:,.2f}".format(doc.grand_total) }}</p>
<p>Please confirm acceptance and estimated delivery date.</p>
<p>Best regards,<br>Procurement Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Project Task Assigned",
  "New Task Assigned: {{ doc.subject }}",
  `<p>Hi {{ doc.assigned_to_name }},</p>
<p>A new task has been assigned to you:</p>
<p><strong>Project:</strong> {{ doc.project }}<br>
<strong>Task:</strong> {{ doc.subject }}<br>
<strong>Priority:</strong> {{ doc.priority }}<br>
<strong>Due Date:</strong> {{ frappe.format_date(doc.exp_end_date) if doc.exp_end_date else "Not set" }}</p>
<p><strong>Description:</strong><br>{{ doc.description }}</p>
<p>Please login to review and update progress.</p>
<p>Thanks,<br>Project Management</p>`,
);

await createEmailTemplate(
  "Expense Claim Approved",
  "Your Expense Claim {{ doc.name }} is Approved",
  `<p>Hi {{ doc.employee_name }},</p>
<p>Your expense claim <strong>{{ doc.name }}</strong> has been approved.</p>
<p><strong>Amount Approved:</strong> ₹ {{ "{:,.2f}".format(doc.total_sanctioned_amount) }}<br>
<strong>Payment Mode:</strong> {{ doc.mode_of_payment }}</p>
<p>The amount will be credited to your account within 3-5 business days.</p>
<p>Thank you,<br>Finance Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Expense Claim Rejected",
  "Your Expense Claim {{ doc.name }} Needs Revision",
  `<p>Hi {{ doc.employee_name }},</p>
<p>Your expense claim <strong>{{ doc.name }}</strong> requires revision.</p>
<p><strong>Reason:</strong> {{ doc.rejection_reason or "Please contact HR for details" }}</p>
<p>Please review and resubmit with necessary corrections.</p>
<p>Thank you,<br>Finance Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Support Ticket Created",
  "Support Ticket {{ doc.name }} Created",
  `<p>Hi,</p>
<p>Your support ticket has been created successfully.</p>
<p><strong>Ticket No:</strong> {{ doc.name }}<br>
<strong>Subject:</strong> {{ doc.subject }}<br>
<strong>Priority:</strong> {{ doc.priority }}<br>
<strong>Status:</strong> {{ doc.status }}</p>
<p>Our support team will respond within 24 hours.</p>
<p>You can track your ticket at: {{ doc.get_url() }}</p>
<p>Best regards,<br>Support Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Support Ticket Resolved",
  "Your Ticket {{ doc.name }} is Resolved",
  `<p>Hi,</p>
<p>Your support ticket <strong>{{ doc.name }}</strong> has been resolved.</p>
<p><strong>Subject:</strong> {{ doc.subject }}<br>
<strong>Resolution:</strong> {{ doc.resolution_details or "Issue fixed" }}</p>
<p>If you face any further issues, please reopen this ticket or create a new one.</p>
<p>Thank you for your patience!</p>
<p>Best regards,<br>Support Team<br>Ciago Technologies</p>`,
);

await createEmailTemplate(
  "Customer Welcome",
  "Welcome to Ciago Technologies!",
  `<p>Dear {{ doc.customer_name }},</p>
<p>Welcome to <strong>Ciago Technologies</strong>! We're thrilled to have you on board.</p>
<p>Your account has been set up successfully. Our team is ready to assist you with all your needs.</p>
<p><strong>Your Account Details:</strong><br>
Customer ID: {{ doc.name }}<br>
Contact Person: {{ doc.customer_primary_contact }}</p>
<p>For any assistance, feel free to reach out to us at support@ciagotech.com</p>
<p>Looking forward to a great partnership!</p>
<p>Best regards,<br>The Ciago Team</p>`,
);

await createEmailTemplate(
  "Supplier Welcome",
  "Welcome Supplier - Ciago Technologies",
  `<p>Dear {{ doc.supplier_name }},</p>
<p>Thank you for partnering with <strong>Ciago Technologies</strong>!</p>
<p>Your supplier account has been created successfully. We look forward to a mutually beneficial relationship.</p>
<p><strong>Your Supplier Details:</strong><br>
Supplier ID: {{ doc.name }}<br>
Contact: {{ doc.supplier_primary_contact }}</p>
<p>For procurement queries, contact: procurement@ciagotech.com</p>
<p>Best regards,<br>Procurement Team<br>Ciago Technologies</p>`,
);

console.log("\n✅ All templates created successfully!");
console.log("\n📊 Summary:");
console.log("  - 10 Print Formats (Sales, Buying, Projects, Support, Stock, Accounting, Expense)");
console.log("  - 10 Email Templates (Quotation, Invoice, PO, Task, Expense, Ticket, Welcome)");
console.log("\n💡 Next: Run export script to package everything for production");
console.log("   npx tsx scripts/frappe-export-all.ts\n");
