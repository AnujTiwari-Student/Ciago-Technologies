/**
 * Create Frappe Print Format Templates
 * Custom PDF templates for various documents
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
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

// Salary Slip Template - Professional Format
const salarySlipHTML = `
<div style="font-family: 'Arial', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">
  <!-- Header -->
  <div style="text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="margin: 0; color: #0d9488; font-size: 28px;">CIAGO TECHNOLOGIES</h1>
    <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Salary Slip</p>
  </div>

  <!-- Employee Details -->
  <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
    <tr>
      <td style="width: 50%; padding: 8px 0;">
        <strong>Employee Name:</strong> {{ doc.employee_name }}
      </td>
      <td style="width: 50%; padding: 8px 0;">
        <strong>Employee ID:</strong> {{ doc.employee }}
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0;">
        <strong>Designation:</strong> {{ doc.designation }}
      </td>
      <td style="padding: 8px 0;">
        <strong>Department:</strong> {{ doc.department }}
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 0;">
        <strong>Date of Joining:</strong> {{ frappe.format_date(doc.date_of_joining, "dd-MMM-yyyy") if doc.date_of_joining else "-" }}
      </td>
      <td style="padding: 8px 0;">
        <strong>Pay Period:</strong> {{ frappe.format_date(doc.start_date, "MMM yyyy") }}
      </td>
    </tr>
  </table>

  <!-- Salary Breakdown -->
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
    <thead>
      <tr style="background: #f0f9ff; border-bottom: 2px solid #0d9488;">
        <th style="padding: 12px; text-align: left;">Earnings</th>
        <th style="padding: 12px; text-align: right;">Amount (₹)</th>
        <th style="padding: 12px; text-align: left;">Deductions</th>
        <th style="padding: 12px; text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      {% set earnings = doc.earnings or [] %}
      {% set deductions = doc.deductions or [] %}
      {% set max_rows = [earnings|length, deductions|length]|max %}
      {% for i in range(max_rows) %}
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px;">
          {% if i < earnings|length %}
            {{ earnings[i].salary_component }}
          {% endif %}
        </td>
        <td style="padding: 10px; text-align: right;">
          {% if i < earnings|length %}
            {{ "%.2f"|format(earnings[i].amount) }}
          {% endif %}
        </td>
        <td style="padding: 10px;">
          {% if i < deductions|length %}
            {{ deductions[i].salary_component }}
          {% endif %}
        </td>
        <td style="padding: 10px; text-align: right;">
          {% if i < deductions|length %}
            {{ "%.2f"|format(deductions[i].amount) }}
          {% endif %}
        </td>
      </tr>
      {% endfor %}
      <tr style="background: #f0f9ff; font-weight: bold; font-size: 14px;">
        <td style="padding: 12px;">Gross Pay</td>
        <td style="padding: 12px; text-align: right;">{{ "%.2f"|format(doc.gross_pay) }}</td>
        <td style="padding: 12px;">Total Deductions</td>
        <td style="padding: 12px; text-align: right;">{{ "%.2f"|format(doc.total_deduction) }}</td>
      </tr>
    </tbody>
  </table>

  <!-- Net Pay -->
  <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
    <p style="margin: 0; font-size: 16px;">Net Pay</p>
    <h2 style="margin: 10px 0 0 0; font-size: 32px;">₹ {{ "{:,.2f}".format(doc.net_pay) }}</h2>
    <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">
      In Words: {{ frappe.utils.money_in_words(doc.net_pay, "INR") }}
    </p>
  </div>

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #666;">
    <p style="margin: 5px 0;"><strong>Note:</strong> This is a computer-generated document and does not require a signature.</p>
    <p style="margin: 5px 0;">For any queries, contact: hr@ciagotech.com</p>
  </div>
</div>
`;

// Offer Letter Template
const offerLetterHTML = `
<div style="font-family: 'Arial', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333;">
  <!-- Letterhead -->
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="margin: 0; color: #0d9488; font-size: 32px;">CIAGO TECHNOLOGIES</h1>
    <p style="margin: 5px 0; color: #666; font-size: 13px;">
      Innovation Drive, Tech Park, Bangalore - 560001<br>
      Email: hr@ciagotech.com | Phone: +91-80-1234-5678
    </p>
  </div>

  <!-- Date -->
  <div style="text-align: right; margin-bottom: 30px; font-size: 14px;">
    <strong>Date:</strong> {{ frappe.format_date(frappe.utils.today(), "dd MMMM yyyy") }}
  </div>

  <!-- Recipient -->
  <div style="margin-bottom: 30px; font-size: 14px;">
    <p style="margin: 0;"><strong>{{ doc.applicant_name }}</strong></p>
    <p style="margin: 5px 0 0 0;">{{ doc.applicant_email }}</p>
  </div>

  <!-- Subject -->
  <div style="margin-bottom: 30px;">
    <p style="margin: 0; font-weight: bold; font-size: 14px;">
      Subject: Offer of Employment - {{ doc.designation }}
    </p>
  </div>

  <!-- Body -->
  <div style="line-height: 1.8; font-size: 14px;">
    <p>Dear {{ doc.applicant_name.split()[0] }},</p>

    <p>We are pleased to offer you the position of <strong>{{ doc.designation }}</strong> at Ciago Technologies. We believe that your skills and experience will be a valuable addition to our team.</p>

    <p><strong>Terms of Employment:</strong></p>

    <table style="width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 0; width: 40%;">Position:</td>
        <td style="padding: 12px 0;"><strong>{{ doc.designation }}</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 0;">Department:</td>
        <td style="padding: 12px 0;">{{ doc.department or "Engineering" }}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 0;">Proposed Date of Joining:</td>
        <td style="padding: 12px 0;"><strong>{{ frappe.format_date(doc.expected_start_date, "dd MMMM yyyy") if doc.expected_start_date else "To be mutually decided" }}</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 0;">Annual CTC:</td>
        <td style="padding: 12px 0;"><strong>₹ {{ "{:,.0f}".format(doc.ctc or 0) }}</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 0;">Probation Period:</td>
        <td style="padding: 12px 0;">3 months (extendable)</td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">Notice Period:</td>
        <td style="padding: 12px 0;">30 days (post probation)</td>
      </tr>
    </table>

    <p><strong>Benefits:</strong></p>
    <ul style="margin: 10px 0; padding-left: 20px;">
      <li>Leave as per company policy (12 Casual + 12 Sick + 15 Earned annually)</li>
      <li>Health Insurance coverage</li>
      <li>Performance-based bonuses</li>
      <li>Flexible work arrangements</li>
    </ul>

    <p>Please confirm your acceptance of this offer by signing and returning a copy of this letter by {{ frappe.format_date(frappe.utils.add_days(frappe.utils.today(), 7), "dd MMMM yyyy") }}.</p>

    <p>We look forward to welcoming you to the Ciago Technologies family!</p>

    <div style="margin-top: 50px;">
      <p style="margin: 0;"><strong>Warm regards,</strong></p>
      <p style="margin: 30px 0 5px 0;"><strong>HR Team</strong></p>
      <p style="margin: 0;">Ciago Technologies</p>
    </div>

    <!-- Acceptance -->
    <div style="margin-top: 60px; padding-top: 30px; border-top: 2px dashed #e5e7eb;">
      <p style="margin: 0 0 30px 0; font-size: 13px;"><strong>Acceptance:</strong></p>
      <p style="margin: 0;">I, <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>, accept the above terms and conditions.</p>
      <div style="margin-top: 40px;">
        <table style="width: 100%;">
          <tr>
            <td style="width: 50%;">
              <p style="margin: 0;">Signature: _________________</p>
            </td>
            <td style="width: 50%;">
              <p style="margin: 0;">Date: _________________</p>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</div>
`;

async function createPrintFormats() {
  console.log("\n=== Creating Print Format Templates ===");

  // 1. Salary Slip
  if (!(await exists("Print Format", "Ciago Salary Slip"))) {
    try {
      await frappe(`/api/resource/Print Format`, "POST", {
        name: "Ciago Salary Slip",
        doc_type: "Salary Slip",
        print_format_builder: 0,
        html: salarySlipHTML,
        custom_format: 1,
        disabled: 0,
        standard: "No",
      });
      console.log("  [created] Ciago Salary Slip");
    } catch (e: any) {
      console.log("  [error]:", e.message?.substring(0, 100));
    }
  } else {
    console.log("  [skip] Ciago Salary Slip exists");
  }

  // 2. Offer Letter
  if (!(await exists("Print Format", "Ciago Offer Letter"))) {
    try {
      await frappe(`/api/resource/Print Format`, "POST", {
        name: "Ciago Offer Letter",
        doc_type: "Job Offer",
        print_format_builder: 0,
        html: offerLetterHTML,
        custom_format: 1,
        disabled: 0,
        standard: "No",
      });
      console.log("  [created] Ciago Offer Letter");
    } catch (e: any) {
      console.log("  [error]:", e.message?.substring(0, 100));
    }
  } else {
    console.log("  [skip] Ciago Offer Letter exists");
  }

  console.log("\nPrint formats created successfully!");
}

async function createEmailTemplates() {
  console.log("\n=== Creating Email Templates ===");

  // 1. Salary Slip Email
  const salarySlipEmail = {
    name: "Salary Slip Release",
    subject: "Your Salary Slip for {{ doc.start_date.strftime('%B %Y') }}",
    response: `
Dear {{ doc.employee_name }},

Your salary slip for {{ doc.start_date.strftime('%B %Y') }} is now available.

**Summary:**
- Gross Pay: ₹ {{ "{:,.2f}".format(doc.gross_pay) }}
- Total Deductions: ₹ {{ "{:,.2f}".format(doc.total_deduction) }}
- Net Pay: ₹ {{ "{:,.2f}".format(doc.net_pay) }}

You can download the detailed slip from your Frappe HR portal.

Login: {{ frappe.utils.get_url() }}

For any queries, please contact HR at hr@ciagotech.com.

Best regards,
HR Team
Ciago Technologies
    `.trim(),
  };

  if (!(await exists("Email Template", "Salary Slip Release"))) {
    try {
      await frappe(`/api/resource/Email Template`, "POST", salarySlipEmail);
      console.log("  [created] Salary Slip Release");
    } catch (e: any) {
      console.log("  [error]:", e.message?.substring(0, 100));
    }
  }

  // 2. Leave Approval Email
  const leaveApprovalEmail = {
    name: "Leave Approved",
    subject: "Leave Application Approved - {{ doc.leave_type }}",
    response: `
Dear {{ doc.employee_name }},

Your leave application has been **APPROVED**.

**Leave Details:**
- Leave Type: {{ doc.leave_type }}
- From Date: {{ frappe.format_date(doc.from_date, "dd-MMM-yyyy") }}
- To Date: {{ frappe.format_date(doc.to_date, "dd-MMM-yyyy") }}
- Total Days: {{ doc.total_leave_days }}

Enjoy your time off!

Best regards,
HR Team
Ciago Technologies
    `.trim(),
  };

  if (!(await exists("Email Template", "Leave Approved"))) {
    try {
      await frappe(`/api/resource/Email Template`, "POST", leaveApprovalEmail);
      console.log("  [created] Leave Approved");
    } catch (e: any) {
      console.log("  [error]:", e.message?.substring(0, 100));
    }
  }

  console.log("\nEmail templates created successfully!");
}

async function fixHolidayList() {
  console.log("\n=== Fixing Holiday List Export ===");

  try {
    const holidayLists = await frappe(
      `/api/resource/Holiday List?fields=["*"]&limit_page_length=10`
    );

    fs.writeFileSync(
      path.join(process.cwd(), "frappe-exports", "master_data", "holiday_lists.json"),
      JSON.stringify(holidayLists.data || [], null, 2)
    );
    console.log(`  Re-exported ${holidayLists.data?.length || 0} holiday lists`);
  } catch (e: any) {
    console.log("  Error:", e.message);
  }
}

async function main() {
  console.log("========================================");
  console.log(" Create Frappe Templates");
  console.log("========================================");

  await createPrintFormats();
  await createEmailTemplates();
  await fixHolidayList();

  console.log("\n========================================");
  console.log(" Done!");
  console.log("========================================");
}

main();
