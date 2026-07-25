
-- 1. Seed 'employee' role for atpay2901@gmail.com (if the auth user exists)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee'::app_role FROM auth.users WHERE lower(email) = 'atpay2901@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also auto-grant employee role on email confirm for that address (parallel to admin seeder)
CREATE OR REPLACE FUNCTION public.grant_employee_for_seeded_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) IN ('atpay2901@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_employee_for_seeded_emails() FROM PUBLIC, anon, authenticated;

-- 2. Add columns to employee_tasks for admin delegation tracking
ALTER TABLE public.employee_tasks
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_reference text;

-- 3. Onboarding records table
CREATE TABLE IF NOT EXISTS public.onboarding_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  department text,
  start_date date,
  compensation_inr bigint,
  offer_accepted_at timestamptz,
  offer_declined_at timestamptz,
  emergency_contact jsonb,
  id_ack boolean NOT NULL DEFAULT false,
  code_of_conduct_ack boolean NOT NULL DEFAULT false,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','submitted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

GRANT SELECT, INSERT, UPDATE ON public.onboarding_records TO authenticated;
GRANT ALL ON public.onboarding_records TO service_role;

ALTER TABLE public.onboarding_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_onboarding_select" ON public.onboarding_records
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "own_onboarding_insert" ON public.onboarding_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_onboarding_update" ON public.onboarding_records
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER onboarding_records_set_updated_at
  BEFORE UPDATE ON public.onboarding_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Secure RPC to elevate candidate → employee upon onboarding submission
CREATE OR REPLACE FUNCTION public.complete_onboarding(_onboarding_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rec RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _rec FROM public.onboarding_records WHERE id = _onboarding_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding record not found' USING ERRCODE = '42704'; END IF;
  IF _rec.status = 'declined' THEN RAISE EXCEPTION 'Offer already declined' USING ERRCODE = '22023'; END IF;
  IF _rec.emergency_contact IS NULL OR NOT _rec.id_ack OR NOT _rec.code_of_conduct_ack THEN
    RAISE EXCEPTION 'Onboarding paperwork incomplete' USING ERRCODE = '22023';
  END IF;

  UPDATE public.onboarding_records
     SET status = 'submitted', submitted_at = now()
   WHERE id = _onboarding_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'employee')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid) TO authenticated;
