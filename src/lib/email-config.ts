/**
 * Email sender routing configuration.
 * Maps email types to sender identities verified in Resend.
 */

export type EmailType =
  | "application_status"
  | "interview_scheduled"
  | "offer_letter"
  | "joining_letter"
  | "ess_credentials"
  | "onboarding_reminder"
  | "document_required"
  | "system_notification";

export type SenderIdentity = {
  email: string;
  name: string;
};

export const EMAIL_SENDERS: Record<EmailType, SenderIdentity> = {
  application_status: {
    email: "careers@ciagotech.com",
    name: "Ciago Careers",
  },
  interview_scheduled: {
    email: "careers@ciagotech.com",
    name: "Ciago Careers",
  },
  offer_letter: {
    email: "hr@ciagotech.com",
    name: "Ciago HR",
  },
  joining_letter: {
    email: "hr@ciagotech.com",
    name: "Ciago HR",
  },
  ess_credentials: {
    email: "hr@ciagotech.com",
    name: "Ciago HR",
  },
  onboarding_reminder: {
    email: "hr@ciagotech.com",
    name: "Ciago HR",
  },
  document_required: {
    email: "hr@ciagotech.com",
    name: "Ciago HR",
  },
  system_notification: {
    email: "noreply@ciagotech.com",
    name: "Ciago",
  },
};

export function getSenderForEmailType(emailType: EmailType): SenderIdentity {
  return EMAIL_SENDERS[emailType];
}

export function formatSender(sender: SenderIdentity): string {
  return `${sender.name} <${sender.email}>`;
}
