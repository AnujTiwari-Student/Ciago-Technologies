-- Create emails table for tracking Resend email delivery

CREATE TABLE emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id text,
  sender text NOT NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  email_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  error_message text,
  user_id uuid,
  application_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emails_resend_id ON emails(resend_id);
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_application_id ON emails(application_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_email_type ON emails(email_type);

-- Enable RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all emails
CREATE POLICY "emails_admin_all" ON emails FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Users can see their own emails
CREATE POLICY "emails_self_read" ON emails FOR SELECT TO authenticated
  USING (user_id = auth.uid());
