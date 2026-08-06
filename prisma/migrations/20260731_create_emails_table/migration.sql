-- Create emails table for tracking Resend email delivery

CREATE TABLE IF NOT EXISTS public.emails (
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

CREATE INDEX IF NOT EXISTS idx_emails_resend_id ON public.emails(resend_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_application_id ON public.emails(application_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON public.emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_email_type ON public.emails(email_type);

-- Enable RLS
ALTER TABLE IF EXISTS public.emails ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all emails (only create if auth schema and functions exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'auth')
     AND EXISTS (SELECT FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth'))
     AND EXISTS (SELECT FROM pg_proc WHERE proname = 'has_role' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN

    BEGIN
      CREATE POLICY "emails_admin_all" ON public.emails FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;

    -- Policy: Users can see their own emails
    BEGIN
      CREATE POLICY "emails_self_read" ON public.emails FOR SELECT TO authenticated
        USING (user_id = auth.uid());
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;

  END IF;
END $$;
