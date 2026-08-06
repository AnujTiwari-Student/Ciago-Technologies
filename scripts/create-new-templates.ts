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
  return res.json();
}

async function createOrUpdatePrintFormat(name: string, docType: string, html: string) {
  const existing = await frappe(`/api/resource/Print%20Format/${encodeURIComponent(name)}`);
  if (existing.data) {
    await frappe(`/api/resource/Print%20Format/${encodeURIComponent(name)}`, "PUT", { html, disabled: 0 });
    console.log(`  Updated: ${name}`);
  } else {
    await frappe("/api/resource/Print%20Format", "POST", {
      name: name,
      doc_type: docType,
      print_format_type: "Jinja",
      standard: "No",
      custom_format: 1,
      html: html,
      disabled: 0,
    });
    console.log(`  Created: ${name}`);
  }
}

async function createOrUpdateEmailTemplate(name: string, subject: string, response: string) {
  const existing = await frappe(`/api/resource/Email%20Template/${encodeURIComponent(name)}`);
  if (existing.data) {
    await frappe(`/api/resource/Email%20Template/${encodeURIComponent(name)}`, "PUT", { subject, response });
    console.log(`  Updated: ${name}`);
  } else {
    await frappe("/api/resource/Email%20Template", "POST", { name, subject, response, enabled: 1 });
    console.log(`  Created: ${name}`);
  }
}

const COMPANY = "Ciago Technologies";
const HEADER = `<div style="border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px;">
  <h2 style="color: #4F46E5; margin: 0;">${COMPANY}</h2>
  <p style="color: #6B7280; margin: 5px 0 0 0; font-size: 12px;">Technology Solutions & Services</p>
</div>`;

const FOOTER = `<div style="border-top: 2px solid #E5E7EB; margin-top: 30px; padding-top: 15px; text-align: center; color: #9CA3AF; font-size: 11px;">
  <p>${COMPANY} | contact@ciago.in</p>
  <p>This is a system-generated document.</p>
</div>`;

async function main() {
  console.log("========================================");
  console.log(" CREATING / UPDATING ALL TEMPLATES");
  console.log("========================================\n");

  // ======== PRINT FORMATS ========
  console.log("=== PRINT FORMATS ===\n");

  // 1. Purchase Invoice
  await createOrUpdatePrintFormat("Ciago Purchase Invoice", "Purchase Invoice", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 13px; color: #1F2937; }
  .header-section { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-title { font-size: 16px; color: #374151; margin-top: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
  .info-block { background: #F9FAFB; padding: 12px; border-radius: 6px; }
  .info-block h4 { margin: 0 0 8px 0; color: #4F46E5; font-size: 12px; text-transform: uppercase; }
  .info-block p { margin: 3px 0; font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.items th { background: #4F46E5; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  table.items tr:nth-child(even) { background: #F9FAFB; }
  .totals { text-align: right; margin-top: 15px; }
  .totals table { margin-left: auto; }
  .totals td { padding: 4px 12px; font-size: 12px; }
  .totals .grand-total { font-weight: 700; font-size: 14px; color: #4F46E5; border-top: 2px solid #4F46E5; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 40px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header-section">
    <div class="company-name">${COMPANY}</div>
    <div class="doc-title">PURCHASE INVOICE - {{ doc.name }}</div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h4>Supplier</h4>
      <p><strong>{{ doc.supplier_name }}</strong></p>
      <p>{{ doc.supplier_address or '' }}</p>
    </div>
    <div class="info-block">
      <h4>Invoice Details</h4>
      <p><strong>Date:</strong> {{ doc.posting_date }}</p>
      <p><strong>Due Date:</strong> {{ doc.due_date }}</p>
      <p><strong>Bill No:</strong> {{ doc.bill_no or '-' }}</p>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {% for item in doc.items %}
      <tr>
        <td>{{ loop.index }}</td>
        <td>{{ item.item_name }}</td>
        <td>{{ item.qty }} {{ item.uom }}</td>
        <td>{{ frappe.format_value(item.rate, {'fieldtype': 'Currency'}) }}</td>
        <td>{{ frappe.format_value(item.amount, {'fieldtype': 'Currency'}) }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Net Total:</td><td>{{ frappe.format_value(doc.net_total, {'fieldtype': 'Currency'}) }}</td></tr>
      {% if doc.total_taxes_and_charges %}<tr><td>Taxes:</td><td>{{ frappe.format_value(doc.total_taxes_and_charges, {'fieldtype': 'Currency'}) }}</td></tr>{% endif %}
      <tr class="grand-total"><td>Grand Total:</td><td>{{ frappe.format_value(doc.grand_total, {'fieldtype': 'Currency'}) }}</td></tr>
    </table>
  </div>

  <div class="footer"><p>${COMPANY} | System Generated Document</p></div>
</div>`);

  // 2. Leave Application
  await createOrUpdatePrintFormat("Ciago Leave Application", "Leave Application", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 13px; color: #1F2937; max-width: 700px; margin: auto; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 25px; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-title { font-size: 16px; color: #374151; margin-top: 8px; }
  .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #F3F4F6; }
  .detail-label { color: #6B7280; font-weight: 500; }
  .detail-value { font-weight: 600; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .status-approved { background: #D1FAE5; color: #065F46; }
  .status-pending { background: #FEF3C7; color: #92400E; }
  .status-rejected { background: #FEE2E2; color: #991B1B; }
  .reason-box { background: #F9FAFB; padding: 15px; border-radius: 8px; margin-top: 20px; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 40px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header">
    <div class="company-name">${COMPANY}</div>
    <div class="doc-title">LEAVE APPLICATION</div>
  </div>

  <div class="detail-row">
    <span class="detail-label">Application ID</span>
    <span class="detail-value">{{ doc.name }}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Employee</span>
    <span class="detail-value">{{ doc.employee_name }} ({{ doc.employee }})</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Department</span>
    <span class="detail-value">{{ doc.department or '-' }}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Leave Type</span>
    <span class="detail-value">{{ doc.leave_type }}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">From Date</span>
    <span class="detail-value">{{ doc.from_date }}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">To Date</span>
    <span class="detail-value">{{ doc.to_date }}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Total Days</span>
    <span class="detail-value">{{ doc.total_leave_days }}</span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Status</span>
    <span class="detail-value">
      <span class="status-badge {% if doc.status == 'Approved' %}status-approved{% elif doc.status == 'Rejected' %}status-rejected{% else %}status-pending{% endif %}">{{ doc.status }}</span>
    </span>
  </div>
  <div class="detail-row">
    <span class="detail-label">Leave Approver</span>
    <span class="detail-value">{{ doc.leave_approver_name or doc.leave_approver or '-' }}</span>
  </div>

  {% if doc.description %}
  <div class="reason-box">
    <strong>Reason:</strong><br>{{ doc.description }}
  </div>
  {% endif %}

  <div class="footer"><p>${COMPANY} | Leave Management System</p></div>
</div>`);

  // 3. Appointment Letter
  await createOrUpdatePrintFormat("Ciago Appointment Letter", "Appointment Letter", `
<style>
  .print-format { font-family: 'Georgia', serif; font-size: 13px; color: #1F2937; max-width: 750px; margin: auto; line-height: 1.7; }
  .letterhead { border-bottom: 3px solid #4F46E5; padding-bottom: 20px; margin-bottom: 30px; }
  .company-name { font-size: 24px; font-weight: 700; color: #4F46E5; font-family: 'Inter', sans-serif; }
  .company-tagline { color: #6B7280; font-size: 12px; margin-top: 4px; }
  .date-line { text-align: right; color: #6B7280; margin-bottom: 25px; }
  .recipient { margin-bottom: 25px; }
  .subject-line { font-weight: 700; font-size: 14px; margin: 20px 0; text-decoration: underline; }
  .body-text p { margin: 12px 0; text-align: justify; }
  .terms-list { margin: 15px 0; padding-left: 20px; }
  .terms-list li { margin: 8px 0; }
  .signature-block { margin-top: 50px; }
  .signature-line { border-top: 1px solid #374151; width: 200px; margin-top: 40px; padding-top: 5px; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 60px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="letterhead">
    <div class="company-name">${COMPANY}</div>
    <div class="company-tagline">Technology Solutions & Services</div>
  </div>

  <div class="date-line">Date: {{ doc.appointment_date or frappe.utils.today() }}</div>

  <div class="recipient">
    <p><strong>{{ doc.applicant_name }}</strong></p>
  </div>

  <div class="subject-line">Subject: Appointment Letter</div>

  <div class="body-text">
    <p>Dear <strong>{{ doc.applicant_name }}</strong>,</p>

    <p>We are pleased to inform you that you have been selected for the position of <strong>{{ doc.designation }}</strong> at ${COMPANY}. Your appointment is effective from <strong>{{ doc.appointment_date }}</strong>.</p>

    <p>Please find below the terms and conditions of your appointment:</p>

    {% if doc.terms %}
    <div>{{ doc.terms }}</div>
    {% else %}
    <ul class="terms-list">
      <li>This appointment is subject to satisfactory completion of background verification.</li>
      <li>You will be on probation for a period of 6 months from the date of joining.</li>
      <li>Your compensation and benefits will be as discussed during the interview process.</li>
      <li>You are required to maintain confidentiality of all company information.</li>
    </ul>
    {% endif %}

    <p>We look forward to welcoming you to the ${COMPANY} team. Please sign and return a copy of this letter as acceptance of the terms.</p>

    <p>Congratulations and welcome aboard!</p>
  </div>

  <div class="signature-block">
    <p>Yours sincerely,</p>
    <div class="signature-line">
      <p><strong>HR Department</strong><br>${COMPANY}</p>
    </div>
  </div>

  <div class="footer"><p>${COMPANY} | Confidential Document</p></div>
</div>`);

  // 4. Stock Entry
  await createOrUpdatePrintFormat("Ciago Stock Entry", "Stock Entry", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 13px; color: #1F2937; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-title { font-size: 14px; color: #374151; margin-top: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0; }
  .info-box { background: #F9FAFB; padding: 10px; border-radius: 6px; text-align: center; }
  .info-box .label { font-size: 10px; color: #6B7280; text-transform: uppercase; }
  .info-box .value { font-size: 14px; font-weight: 700; color: #1F2937; margin-top: 4px; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.items th { background: #4F46E5; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 30px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header">
    <div class="company-name">${COMPANY}</div>
    <div class="doc-title">STOCK ENTRY - {{ doc.name }} | Type: {{ doc.stock_entry_type }}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="label">Date</div>
      <div class="value">{{ doc.posting_date }}</div>
    </div>
    <div class="info-box">
      <div class="label">Purpose</div>
      <div class="value">{{ doc.stock_entry_type }}</div>
    </div>
    <div class="info-box">
      <div class="label">Total Value</div>
      <div class="value">{{ frappe.format_value(doc.total_amount, {'fieldtype': 'Currency'}) }}</div>
    </div>
  </div>

  {% if doc.from_warehouse or doc.to_warehouse %}
  <p><strong>From:</strong> {{ doc.from_warehouse or '-' }} &rarr; <strong>To:</strong> {{ doc.to_warehouse or '-' }}</p>
  {% endif %}

  <table class="items">
    <thead>
      <tr><th>#</th><th>Item</th><th>Source</th><th>Target</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {% for item in doc.items %}
      <tr>
        <td>{{ loop.index }}</td>
        <td>{{ item.item_name }}</td>
        <td>{{ item.s_warehouse or '-' }}</td>
        <td>{{ item.t_warehouse or '-' }}</td>
        <td>{{ item.qty }} {{ item.uom }}</td>
        <td>{{ frappe.format_value(item.basic_rate, {'fieldtype': 'Currency'}) }}</td>
        <td>{{ frappe.format_value(item.basic_amount, {'fieldtype': 'Currency'}) }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="footer"><p>${COMPANY} | Inventory Management</p></div>
</div>`);

  // 5. Material Request
  await createOrUpdatePrintFormat("Ciago Material Request", "Material Request", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 13px; color: #1F2937; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-title { font-size: 14px; color: #374151; margin-top: 8px; }
  .meta-info { display: flex; justify-content: space-between; margin: 15px 0; padding: 12px; background: #F9FAFB; border-radius: 6px; }
  .meta-item { text-align: center; }
  .meta-item .label { font-size: 10px; color: #6B7280; text-transform: uppercase; }
  .meta-item .value { font-size: 13px; font-weight: 600; margin-top: 3px; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.items th { background: #4F46E5; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 30px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header">
    <div class="company-name">${COMPANY}</div>
    <div class="doc-title">MATERIAL REQUEST - {{ doc.name }}</div>
  </div>

  <div class="meta-info">
    <div class="meta-item"><div class="label">Type</div><div class="value">{{ doc.material_request_type }}</div></div>
    <div class="meta-item"><div class="label">Date</div><div class="value">{{ doc.transaction_date }}</div></div>
    <div class="meta-item"><div class="label">Required By</div><div class="value">{{ doc.schedule_date or '-' }}</div></div>
    <div class="meta-item"><div class="label">Department</div><div class="value">{{ doc.department or '-' }}</div></div>
  </div>

  <table class="items">
    <thead>
      <tr><th>#</th><th>Item</th><th>Qty</th><th>UOM</th><th>Warehouse</th><th>Required By</th></tr>
    </thead>
    <tbody>
      {% for item in doc.items %}
      <tr>
        <td>{{ loop.index }}</td>
        <td>{{ item.item_name }}</td>
        <td>{{ item.qty }}</td>
        <td>{{ item.uom }}</td>
        <td>{{ item.warehouse or '-' }}</td>
        <td>{{ item.schedule_date or '-' }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="footer"><p>${COMPANY} | Procurement Management</p></div>
</div>`);

  // 6. Work Order
  await createOrUpdatePrintFormat("Ciago Work Order", "Work Order", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 13px; color: #1F2937; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-title { font-size: 14px; color: #374151; margin-top: 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
  .info-block { background: #F9FAFB; padding: 12px; border-radius: 6px; }
  .info-block h4 { margin: 0 0 8px 0; color: #4F46E5; font-size: 11px; text-transform: uppercase; }
  .info-block p { margin: 4px 0; font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.items th { background: #4F46E5; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  .progress-bar { background: #E5E7EB; border-radius: 4px; height: 8px; margin-top: 10px; }
  .progress-fill { background: #4F46E5; border-radius: 4px; height: 8px; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 30px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header">
    <div class="company-name">${COMPANY}</div>
    <div class="doc-title">WORK ORDER - {{ doc.name }}</div>
  </div>

  <div class="info-grid">
    <div class="info-block">
      <h4>Production Details</h4>
      <p><strong>Item:</strong> {{ doc.production_item }}</p>
      <p><strong>Qty to Produce:</strong> {{ doc.qty }}</p>
      <p><strong>Produced:</strong> {{ doc.produced_qty or 0 }}</p>
      <p><strong>BOM:</strong> {{ doc.bom_no or '-' }}</p>
    </div>
    <div class="info-block">
      <h4>Schedule</h4>
      <p><strong>Start:</strong> {{ doc.planned_start_date or '-' }}</p>
      <p><strong>End:</strong> {{ doc.expected_delivery_date or '-' }}</p>
      <p><strong>Status:</strong> {{ doc.status }}</p>
      <p><strong>Workstation:</strong> {{ doc.workstation or '-' }}</p>
    </div>
  </div>

  {% if doc.produced_qty and doc.qty %}
  <p><strong>Progress:</strong> {{ ((doc.produced_qty / doc.qty) * 100) | int }}%</p>
  <div class="progress-bar"><div class="progress-fill" style="width: {{ ((doc.produced_qty / doc.qty) * 100) | int }}%"></div></div>
  {% endif %}

  {% if doc.required_items %}
  <h4 style="margin-top: 25px; color: #374151;">Required Materials</h4>
  <table class="items">
    <thead>
      <tr><th>#</th><th>Item</th><th>Required Qty</th><th>Transferred</th><th>Source Warehouse</th></tr>
    </thead>
    <tbody>
      {% for item in doc.required_items %}
      <tr>
        <td>{{ loop.index }}</td>
        <td>{{ item.item_name }}</td>
        <td>{{ item.required_qty }}</td>
        <td>{{ item.transferred_qty or 0 }}</td>
        <td>{{ item.source_warehouse or '-' }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
  {% endif %}

  <div class="footer"><p>${COMPANY} | Manufacturing Management</p></div>
</div>`);

  // 7. Attendance (summary view)
  await createOrUpdatePrintFormat("Ciago Attendance Sheet", "Attendance", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 13px; color: #1F2937; max-width: 600px; margin: auto; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 25px; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-title { font-size: 14px; color: #374151; margin-top: 8px; }
  .attendance-card { background: #F9FAFB; border-radius: 10px; padding: 20px; margin: 20px 0; }
  .attendance-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #E5E7EB; }
  .attendance-row:last-child { border-bottom: none; }
  .att-label { color: #6B7280; }
  .att-value { font-weight: 600; }
  .status-present { color: #059669; }
  .status-absent { color: #DC2626; }
  .status-half { color: #D97706; }
  .status-leave { color: #7C3AED; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 30px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header">
    <div class="company-name">${COMPANY}</div>
    <div class="doc-title">ATTENDANCE RECORD</div>
  </div>

  <div class="attendance-card">
    <div class="attendance-row">
      <span class="att-label">Employee</span>
      <span class="att-value">{{ doc.employee_name }} ({{ doc.employee }})</span>
    </div>
    <div class="attendance-row">
      <span class="att-label">Date</span>
      <span class="att-value">{{ doc.attendance_date }}</span>
    </div>
    <div class="attendance-row">
      <span class="att-label">Status</span>
      <span class="att-value {% if doc.status == 'Present' %}status-present{% elif doc.status == 'Absent' %}status-absent{% elif doc.status == 'Half Day' %}status-half{% else %}status-leave{% endif %}">{{ doc.status }}</span>
    </div>
    {% if doc.leave_type %}
    <div class="attendance-row">
      <span class="att-label">Leave Type</span>
      <span class="att-value">{{ doc.leave_type }}</span>
    </div>
    {% endif %}
    <div class="attendance-row">
      <span class="att-label">Department</span>
      <span class="att-value">{{ doc.department or '-' }}</span>
    </div>
    <div class="attendance-row">
      <span class="att-label">Shift</span>
      <span class="att-value">{{ doc.shift or 'General' }}</span>
    </div>
    {% if doc.early_exit or doc.late_entry %}
    <div class="attendance-row">
      <span class="att-label">Remarks</span>
      <span class="att-value">{% if doc.late_entry %}Late Entry{% endif %} {% if doc.early_exit %}Early Exit{% endif %}</span>
    </div>
    {% endif %}
  </div>

  <div class="footer"><p>${COMPANY} | Attendance Management</p></div>
</div>`);

  // ======== UPDATE EXISTING PRINT FORMATS ========
  console.log("\n=== UPDATING EXISTING PRINT FORMATS ===\n");

  // Update Ciago Salary Slip with better design
  await createOrUpdatePrintFormat("Ciago Salary Slip", "Salary Slip", `
<style>
  .print-format { font-family: 'Inter', sans-serif; font-size: 12px; color: #1F2937; }
  .header { border-bottom: 3px solid #4F46E5; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .company-name { font-size: 22px; font-weight: 700; color: #4F46E5; }
  .doc-label { font-size: 11px; color: #6B7280; text-align: right; }
  .doc-label .slip-id { font-size: 14px; font-weight: 600; color: #374151; }
  .emp-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; background: #F9FAFB; padding: 15px; border-radius: 8px; }
  .emp-info p { margin: 4px 0; font-size: 12px; }
  .emp-info .label { color: #6B7280; display: inline-block; width: 120px; }
  .earnings-deductions { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
  .ed-section h4 { background: #4F46E5; color: white; padding: 8px 12px; border-radius: 6px 6px 0 0; margin: 0; font-size: 12px; }
  .ed-table { width: 100%; border: 1px solid #E5E7EB; border-top: none; }
  .ed-table td { padding: 6px 12px; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
  .ed-table tr:last-child td { border-bottom: none; font-weight: 700; background: #F9FAFB; }
  .net-pay { text-align: center; margin: 25px 0; padding: 20px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 10px; }
  .net-pay .label { color: rgba(255,255,255,0.8); font-size: 12px; }
  .net-pay .amount { color: white; font-size: 28px; font-weight: 700; margin-top: 5px; }
  .footer { border-top: 2px solid #E5E7EB; margin-top: 30px; padding-top: 10px; text-align: center; color: #9CA3AF; font-size: 10px; }
</style>

<div class="print-format">
  <div class="header">
    <div>
      <div class="company-name">${COMPANY}</div>
      <div style="color: #6B7280; font-size: 11px; margin-top: 4px;">Pay Slip - {{ doc.start_date }} to {{ doc.end_date }}</div>
    </div>
    <div class="doc-label">
      <div class="slip-id">{{ doc.name }}</div>
      <div>{{ doc.posting_date }}</div>
    </div>
  </div>

  <div class="emp-info">
    <div>
      <p><span class="label">Employee:</span> <strong>{{ doc.employee_name }}</strong></p>
      <p><span class="label">Employee ID:</span> {{ doc.employee }}</p>
      <p><span class="label">Department:</span> {{ doc.department or '-' }}</p>
      <p><span class="label">Designation:</span> {{ doc.designation or '-' }}</p>
    </div>
    <div>
      <p><span class="label">Bank Account:</span> {{ doc.bank_account_no or '-' }}</p>
      <p><span class="label">Bank Name:</span> {{ doc.bank_name or '-' }}</p>
      <p><span class="label">Payment Days:</span> {{ doc.payment_days }}</p>
      <p><span class="label">Working Days:</span> {{ doc.total_working_days }}</p>
    </div>
  </div>

  <div class="earnings-deductions">
    <div class="ed-section">
      <h4>Earnings</h4>
      <table class="ed-table">
        {% for e in doc.earnings %}
        <tr><td>{{ e.salary_component }}</td><td style="text-align:right">{{ frappe.format_value(e.amount, {'fieldtype': 'Currency'}) }}</td></tr>
        {% endfor %}
        <tr><td><strong>Total Earnings</strong></td><td style="text-align:right"><strong>{{ frappe.format_value(doc.gross_pay, {'fieldtype': 'Currency'}) }}</strong></td></tr>
      </table>
    </div>
    <div class="ed-section">
      <h4>Deductions</h4>
      <table class="ed-table">
        {% for d in doc.deductions %}
        <tr><td>{{ d.salary_component }}</td><td style="text-align:right">{{ frappe.format_value(d.amount, {'fieldtype': 'Currency'}) }}</td></tr>
        {% endfor %}
        <tr><td><strong>Total Deductions</strong></td><td style="text-align:right"><strong>{{ frappe.format_value(doc.total_deduction, {'fieldtype': 'Currency'}) }}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="net-pay">
    <div class="label">NET PAY</div>
    <div class="amount">{{ frappe.format_value(doc.net_pay, {'fieldtype': 'Currency'}) }}</div>
  </div>

  <div class="footer">
    <p>This is a computer-generated pay slip and does not require a signature.</p>
    <p>${COMPANY} | Payroll Management System</p>
  </div>
</div>`);

  // ======== EMAIL TEMPLATES ========
  console.log("\n=== EMAIL TEMPLATES ===\n");

  // Update existing and create new
  await createOrUpdateEmailTemplate(
    "Leave Approved",
    "Your Leave has been Approved - {{ doc.leave_type }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #059669;">Leave Application Approved</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>Your leave application has been <strong style="color: #059669;">approved</strong>.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Leave Type</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.leave_type }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>From</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.from_date }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>To</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.to_date }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Total Days</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.total_leave_days }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Approved By</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.leave_approver_name or doc.leave_approver }}</td></tr>
</table>
<p>Enjoy your time off!</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Leave Rejected",
    "Leave Application Update - {{ doc.leave_type }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #DC2626;">Leave Application Not Approved</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>We regret to inform you that your leave application has been <strong style="color: #DC2626;">not approved</strong>.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Leave Type</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.leave_type }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>From</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.from_date }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>To</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.to_date }}</td></tr>
</table>
<p>Please contact your leave approver or HR department for more details. You may resubmit with different dates if needed.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Expense Claim Approved",
    "Expense Claim {{ doc.name }} Approved",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #059669;">Expense Claim Approved</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>Your expense claim <strong>{{ doc.name }}</strong> has been <strong style="color: #059669;">approved</strong>.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Claim ID</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Total Amount</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.total_claimed_amount }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Sanctioned Amount</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.total_sanctioned_amount }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Approved By</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.expense_approver }}</td></tr>
</table>
<p>The amount will be reimbursed in your next salary cycle.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Expense Claim Rejected",
    "Expense Claim {{ doc.name }} - Action Required",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #DC2626;">Expense Claim Requires Revision</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>Your expense claim <strong>{{ doc.name }}</strong> has been <strong style="color: #DC2626;">rejected</strong> and requires revision.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Claim ID</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Amount Claimed</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.total_claimed_amount }}</td></tr>
</table>
<p>Please review the claim, make necessary corrections, and resubmit. Contact your expense approver for clarification.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Salary Slip Release",
    "Your Salary Slip for {{ doc.start_date }} to {{ doc.end_date }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #4F46E5;">Salary Slip Available</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>Your salary slip for the period <strong>{{ doc.start_date }}</strong> to <strong>{{ doc.end_date }}</strong> is now available.</p>
<div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 10px; padding: 25px; text-align: center; margin: 20px 0;">
  <div style="color: rgba(255,255,255,0.8); font-size: 12px;">NET PAY</div>
  <div style="color: white; font-size: 32px; font-weight: 700; margin-top: 5px;">{{ doc.net_pay }}</div>
</div>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Gross Pay</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.gross_pay }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Total Deductions</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.total_deduction }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Payment Days</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.payment_days }}</td></tr>
</table>
<p>You can view the detailed breakdown in your My Portal workspace.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Attendance Reminder",
    "Attendance Reminder - Please Mark Your Attendance",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #D97706;">Attendance Reminder</h3>
<p>Dear Team Member,</p>
<p>This is a friendly reminder to mark your attendance for today. Please use the Check-in feature in your My Portal workspace.</p>
<div style="background: #FEF3C7; border-left: 4px solid #D97706; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <strong>Action Required:</strong> Please mark your attendance before end of day.
</div>
<p>If you are on leave today, please ensure your leave application is submitted and approved.</p>
<p>Thank you for your cooperation.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Probation Completion Notice",
    "Probation Period Completion - {{ doc.employee_name }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #059669;">Probation Period Completed</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>Congratulations! We are pleased to inform you that you have successfully completed your probation period at ${COMPANY}.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Employee ID</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Date of Joining</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.date_of_joining }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Department</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.department }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Designation</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.designation }}</td></tr>
</table>
<p>You are now confirmed as a regular employee. We look forward to your continued contributions to the team.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Asset Assignment Notice",
    "Asset Assigned to You - {{ doc.asset_name }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #4F46E5;">Asset Assignment Notification</h3>
<p>Dear Team Member,</p>
<p>The following asset has been assigned to you. Please acknowledge receipt and handle it with care.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Asset Name</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.asset_name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Asset ID</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.name }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Category</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.asset_category }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Location</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.location or '-' }}</td></tr>
</table>
<p>Please report any issues or damages immediately to the IT/Admin department.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Project Deadline Reminder",
    "Project Deadline Approaching - {{ doc.project_name }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #D97706;">Project Deadline Reminder</h3>
<p>Dear Team,</p>
<p>This is a reminder that the following project deadline is approaching:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Project</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.project_name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Expected End</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.expected_end_date }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Status</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.status }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Completion</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.percent_complete or 0 }}%</td></tr>
</table>
<p>Please ensure all pending tasks are completed on time. Reach out to the project manager if you need any support.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Invoice Due Reminder",
    "Payment Reminder - Invoice {{ doc.name }} Due",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #DC2626;">Payment Reminder</h3>
<p>Dear {{ doc.customer_name }},</p>
<p>This is a friendly reminder that the following invoice is due for payment:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Invoice No</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Invoice Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.posting_date }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Due Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.due_date }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Outstanding Amount</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB; font-weight: 700; color: #DC2626;">{{ doc.outstanding_amount }}</td></tr>
</table>
<p>Please arrange for payment at your earliest convenience. If you have already made the payment, please disregard this notice.</p>
<p>For any queries, please contact our accounts department.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Purchase Order Confirmation",
    "Purchase Order {{ doc.name }} Confirmed",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #4F46E5;">Purchase Order Confirmation</h3>
<p>Dear {{ doc.supplier_name }},</p>
<p>We are pleased to confirm the following purchase order:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>PO Number</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.transaction_date }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Grand Total</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.grand_total }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Delivery Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.schedule_date or '-' }}</td></tr>
</table>
<p>Please process this order as per the agreed terms and deliver by the scheduled date.</p>
<p>For any queries regarding this order, please contact our procurement team.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Interview Feedback Request",
    "Interview Feedback Required - {{ doc.job_applicant_name }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #4F46E5;">Interview Feedback Required</h3>
<p>Dear Interviewer,</p>
<p>Please submit your interview feedback for the following candidate:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Candidate</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.job_applicant_name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Job Opening</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.job_opening or '-' }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Interview Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.scheduled_on }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Interview Round</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.interview_round }}</td></tr>
</table>
<div style="background: #FEF3C7; border-left: 4px solid #D97706; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <strong>Action Required:</strong> Please submit your feedback within 24 hours of the interview.
</div>
<p>Your timely feedback helps us make informed hiring decisions.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Employee Onboarding Welcome",
    "Welcome to ${COMPANY} - {{ doc.employee_name }}!",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #4F46E5;">Welcome Aboard!</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>We are thrilled to welcome you to the ${COMPANY} family! Your first day is an exciting milestone, and we want to make sure you have everything you need.</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Employee ID</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.employee }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Department</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.department }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Designation</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.designation }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Date of Joining</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.date_of_joining }}</td></tr>
</table>
<h4>Your First Week Checklist:</h4>
<ul style="line-height: 2;">
  <li>Complete your employee profile in the HRMS portal</li>
  <li>Submit your bank details for salary processing</li>
  <li>Collect your ID card and access credentials</li>
  <li>Meet your team and reporting manager</li>
  <li>Complete mandatory compliance training</li>
</ul>
<p>If you need any assistance, please reach out to the HR team. We are here to help!</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Employee Exit Notice",
    "Exit Process Initiated - {{ doc.employee_name }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #6B7280;">Employee Exit - Process Initiated</h3>
<p>Dear {{ doc.employee_name }},</p>
<p>This is to confirm that your exit process has been initiated. Please complete the following before your last working day:</p>
<ul style="line-height: 2;">
  <li>Return all company assets (laptop, ID card, access cards)</li>
  <li>Complete knowledge transfer with your replacement/team</li>
  <li>Clear any pending expense claims</li>
  <li>Complete the exit questionnaire</li>
  <li>Obtain clearance from all departments</li>
</ul>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Employee</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.employee_name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Resignation Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.resignation_letter_date or '-' }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Relieving Date</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.relieving_date or 'To be confirmed' }}</td></tr>
</table>
<p>We wish you all the best in your future endeavors. Please complete the exit formalities at your earliest.</p>
${FOOTER}
</div>`
  );

  await createOrUpdateEmailTemplate(
    "Training Scheduled",
    "Training Session Scheduled - {{ doc.event_name or doc.name }}",
    `<div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: auto; padding: 20px;">
${HEADER}
<h3 style="color: #4F46E5;">Training Session Scheduled</h3>
<p>Dear Team Member,</p>
<p>You have been enrolled in the following training session:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Training</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.event_name or doc.name }}</td></tr>
  <tr><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Type</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.type or '-' }}</td></tr>
  <tr style="background: #F9FAFB;"><td style="padding: 10px; border: 1px solid #E5E7EB;"><strong>Trainer</strong></td><td style="padding: 10px; border: 1px solid #E5E7EB;">{{ doc.trainer_name or '-' }}</td></tr>
</table>
<div style="background: #EEF2FF; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; border-radius: 4px;">
  <strong>Please Note:</strong> Attendance is mandatory. If you cannot attend, please inform HR at least 24 hours in advance.
</div>
<p>Looking forward to your participation!</p>
${FOOTER}
</div>`
  );

  console.log("\n========================================");
  console.log(" ALL TEMPLATES CREATED / UPDATED!");
  console.log("========================================\n");
}

main().catch(console.error);
