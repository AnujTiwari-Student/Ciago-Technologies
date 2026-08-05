/**
 * Email template for hiring notification with offer and joining letters
 */

import { format } from "date-fns";

export interface HiringEmailParams {
  candidateName: string;
  firstName: string;
  position: string;
  joiningDate: Date;
  salaryCtc: string;
  workEmail: string;
  frappeUrl?: string;
}

/**
 * Generate HTML email for hiring notification with letter attachments
 */
export function generateHiringEmailWithLetters(params: HiringEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const joiningDateFormatted = format(params.joiningDate, "PPPP"); // e.g., "Monday, March 1st, 2026"
  const joiningDateShort = format(params.joiningDate, "PP"); // e.g., "Mar 1, 2026"
  const frappeUrl = params.frappeUrl || process.env.FRAPPE_BASE_URL || "https://frappe.ciagotech.com";

  const subject = `🎉 Welcome to Ciago Technologies - Joining Date: ${joiningDateShort}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Ciago Technologies</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #3498db;
    }
    .header h1 {
      color: #2c3e50;
      margin: 0;
      font-size: 28px;
    }
    .header p {
      color: #7f8c8d;
      margin: 10px 0 0 0;
      font-size: 14px;
    }
    .content {
      margin: 30px 0;
    }
    .greeting {
      font-size: 18px;
      color: #2c3e50;
      margin-bottom: 20px;
    }
    .highlight-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
      text-align: center;
    }
    .highlight-box h2 {
      margin: 0 0 10px 0;
      font-size: 22px;
    }
    .highlight-box .date {
      font-size: 32px;
      font-weight: bold;
      margin: 15px 0;
    }
    .info-box {
      background-color: #ecf0f1;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
      border-left: 4px solid #3498db;
    }
    .info-box h3 {
      margin: 0 0 15px 0;
      color: #2c3e50;
      font-size: 16px;
    }
    .info-item {
      margin: 10px 0;
      display: flex;
      align-items: flex-start;
    }
    .info-label {
      font-weight: 600;
      color: #555;
      min-width: 140px;
    }
    .info-value {
      color: #333;
    }
    .attachments {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      padding: 20px;
      border-radius: 6px;
      margin: 25px 0;
    }
    .attachments h3 {
      margin: 0 0 15px 0;
      color: #856404;
      font-size: 16px;
    }
    .attachment-item {
      display: flex;
      align-items: center;
      padding: 10px;
      background-color: white;
      border-radius: 4px;
      margin: 10px 0;
    }
    .attachment-icon {
      width: 40px;
      height: 40px;
      background-color: #e74c3c;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      font-weight: bold;
      margin-right: 15px;
    }
    .dashboard-info {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .dashboard-info h3 {
      margin: 0 0 15px 0;
      font-size: 18px;
    }
    .dashboard-info .lock-notice {
      background-color: rgba(255, 255, 255, 0.2);
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .dashboard-info a {
      color: #fff;
      text-decoration: underline;
    }
    .next-steps {
      margin: 30px 0;
    }
    .next-steps h3 {
      color: #2c3e50;
      margin-bottom: 15px;
    }
    .next-steps ul {
      list-style: none;
      padding: 0;
    }
    .next-steps li {
      padding: 10px 0;
      border-bottom: 1px solid #ecf0f1;
    }
    .next-steps li:before {
      content: "✓ ";
      color: #27ae60;
      font-weight: bold;
      margin-right: 10px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ecf0f1;
      text-align: center;
      color: #7f8c8d;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #3498db;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      margin: 15px 0;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to Ciago Technologies!</h1>
      <p>Your Journey Starts Here</p>
    </div>

    <div class="content">
      <p class="greeting">Dear <strong>${params.candidateName}</strong>,</p>

      <p>Congratulations! We are thrilled to officially welcome you to the Ciago Technologies team. After careful consideration, we are confident that you will be an excellent addition to our ${params.position} role.</p>

      <div class="highlight-box">
        <h2>📅 Your Joining Date</h2>
        <div class="date">${joiningDateFormatted}</div>
        <p style="margin: 10px 0 0 0; font-size: 14px;">Mark your calendar!</p>
      </div>

      <div class="info-box">
        <h3>📋 Your Employment Details</h3>
        <div class="info-item">
          <span class="info-label">Position:</span>
          <span class="info-value">${params.position}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Annual CTC:</span>
          <span class="info-value">${params.salaryCtc}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Work Email:</span>
          <span class="info-value">${params.workEmail}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Start Date:</span>
          <span class="info-value">${joiningDateShort}</span>
        </div>
      </div>

      <div class="attachments">
        <h3>📎 Important Documents Attached</h3>
        <p>Please find the following documents attached to this email:</p>

        <div class="attachment-item">
          <div class="attachment-icon">PDF</div>
          <div>
            <strong>Offer Letter</strong><br>
            <span style="font-size: 13px; color: #666;">Your official offer letter with compensation details</span>
          </div>
        </div>

        <div class="attachment-item">
          <div class="attachment-icon">PDF</div>
          <div>
            <strong>Joining Letter</strong><br>
            <span style="font-size: 13px; color: #666;">Onboarding details and first-day instructions</span>
          </div>
        </div>
      </div>

      <div class="dashboard-info">
        <h3>🔐 Frappe HR Dashboard Access</h3>
        <p>Your employee dashboard will be available on your joining date:</p>

        <div class="lock-notice">
          <p style="margin: 0;"><strong>🔒 Dashboard Status:</strong> Locked until ${joiningDateShort}</p>
          <p style="margin: 10px 0 0 0; font-size: 14px;">You will receive login credentials via email on <strong>${joiningDateShort}</strong></p>
        </div>

        <p style="margin: 15px 0 0 0;">
          <strong>Dashboard URL:</strong> <a href="${frappeUrl}" style="color: white;">${frappeUrl}</a>
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px;">
          Once unlocked, you'll have access to HR services, leave management, attendance, and more.
        </p>
      </div>

      <div class="next-steps">
        <h3>✅ Next Steps</h3>
        <ul>
          <li>Review the attached offer letter and joining letter carefully</li>
          <li>Prepare the required documents mentioned in the joining letter</li>
          <li>Reply to this email to confirm your acceptance</li>
          <li>Watch for your dashboard credentials email on ${joiningDateShort}</li>
          <li>Mark ${joiningDateShort} on your calendar and be ready to start!</li>
        </ul>
      </div>

      <p>If you have any questions before your start date, please don't hesitate to reach out to us at <a href="mailto:hr@ciagotech.com">hr@ciagotech.com</a>.</p>

      <p>We're excited to have you join our team and look forward to working with you!</p>

      <p style="margin-top: 30px;">
        <strong>Best regards,</strong><br>
        <strong>Ciago Technologies</strong><br>
        Human Resources Team<br>
        <a href="mailto:hr@ciagotech.com">hr@ciagotech.com</a>
      </p>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} Ciago Technologies. All rights reserved.</p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://ciagotech.com" style="color: #3498db;">www.ciagotech.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `
Welcome to Ciago Technologies!

Dear ${params.candidateName},

Congratulations! We are thrilled to officially welcome you to the Ciago Technologies team.

YOUR JOINING DATE: ${joiningDateFormatted}

EMPLOYMENT DETAILS:
- Position: ${params.position}
- Annual CTC: ${params.salaryCtc}
- Work Email: ${params.workEmail}
- Start Date: ${joiningDateShort}

ATTACHED DOCUMENTS:
Please find the following documents attached to this email:
1. Offer Letter - Your official offer letter with compensation details
2. Joining Letter - Onboarding details and first-day instructions

FRAPPE HR DASHBOARD:
Your employee dashboard will be available on your joining date.
- Dashboard Status: Locked until ${joiningDateShort}
- You will receive login credentials via email on ${joiningDateShort}
- Dashboard URL: ${frappeUrl}

NEXT STEPS:
✓ Review the attached offer letter and joining letter carefully
✓ Prepare the required documents mentioned in the joining letter
✓ Reply to this email to confirm your acceptance
✓ Watch for your dashboard credentials email on ${joiningDateShort}
✓ Mark ${joiningDateShort} on your calendar and be ready to start!

If you have any questions before your start date, please reach out to us at hr@ciagotech.com.

We're excited to have you join our team!

Best regards,
Ciago Technologies
Human Resources Team
hr@ciagotech.com
  `.trim();

  return {
    subject,
    html,
    text,
  };
}
