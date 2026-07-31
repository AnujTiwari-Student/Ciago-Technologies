// Server-only email helpers. Import only from server fns / server routes.

type StatusEmailContent = {
  subject: string;
  html: string;
  inAppTitle: string;
  inAppBody: string;
};

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offered: "Offer Extended",
  hired: "Hired",
  rejected: "Not Progressing",
};

export function getStatusEmailContent(
  status: string,
  roleTitle: string,
  fullName: string,
): StatusEmailContent {
  const label = STATUS_LABEL[status] ?? status;
  const greeting = fullName ? `Hi ${fullName.split(" ")[0]},` : "Hi there,";

  let intro = "";
  let cta = "";
  switch (status) {
    case "screening":
    case "interviewing":
      intro = `Good news — our team has started reviewing your application for <strong>${roleTitle}</strong>. We'll be in touch soon with the next steps.`;
      cta = "Track your application";
      break;
    case "rejected":
      intro = `Thank you for applying for <strong>${roleTitle}</strong>. After careful review, we've decided not to move forward with your application at this time. We truly appreciate the time you invested, and we encourage you to apply again for future roles that match your background.`;
      cta = "See other open roles";
      break;
    case "offered":
      intro = `We're thrilled to let you know that we'd like to extend an offer for the <strong>${roleTitle}</strong> role at Ciago Technologies. Our team will reach out shortly with the details — congratulations!`;
      cta = "View next steps";
      break;
    case "hired":
      intro = `Welcome aboard! You're officially hired for <strong>${roleTitle}</strong>. Your onboarding will begin shortly.`;
      cta = "Open onboarding";
      break;
    default:
      intro = `Your application for <strong>${roleTitle}</strong> is now marked as <strong>${label}</strong>.`;
      cta = "Open dashboard";
  }

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">
          <div style="font-weight:800;font-size:18px;letter-spacing:-0.01em">Ciago <span style="color:#0d9488">Technologies</span></div>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 12px;font-size:14px;color:#64748b">Application update</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Status: ${label}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">${greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155">${intro}</p>
          <a href="https://ciagotech.com${status === "offered" || status === "hired" ? "/onboarding" : "/my-applications"}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:14px">${cta}</a>
          <p style="margin:32px 0 0;font-size:13px;color:#64748b">— The Ciago Technologies team</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
          You're receiving this because you applied for a role at Ciago Technologies.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    subject: `Your application update — ${label}`,
    html,
    inAppTitle: `Application marked ${label}`,
    inAppBody: `Your application for ${roleTitle} is now ${label}.`,
  };
}

export async function sendResendEmail(args: {
  to: string;
  subject: string;
  html: string;
  userId?: string;
  applicationId?: string;
}) {
  const { sendWorkflowEmail } = await import("@/lib/email.functions");

  return sendWorkflowEmail({
    to: args.to,
    subject: args.subject,
    html: args.html,
    emailType: "application_status",
    userId: args.userId,
    applicationId: args.applicationId,
  });
  return { skipped: false };
}
