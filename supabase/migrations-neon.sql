
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;


-- [20260723180241_1d23cbc5-1889-40b4-9424-cf3d1414281c.sql]
CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id text NOT NULL,
  role_title text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  portfolio_url text,
  resume_storage_path text,
  resume_link text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own applications"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own applications"
  ON public.job_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- [20260723183216_cbd7d643-41cc-44ba-9d32-0c12128a4b8d.sql]
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'in_queue';
UPDATE public.job_applications
  SET status = 'in_queue'
  WHERE status NOT IN ('in_queue','under_review','rejected','offer_extended');
ALTER TABLE public.job_applications
  ALTER COLUMN status SET DEFAULT 'in_queue';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_status_check') THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_status_check
      CHECK (status IN ('in_queue','under_review','rejected','offer_extended'));
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.project_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  project_type TEXT NOT NULL,
  scale TEXT NOT NULL,
  timeline TEXT NOT NULL,
  budget_low INTEGER NOT NULL,
  budget_high INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit an estimate" ON public.project_estimates;
CREATE POLICY "Anyone can submit an estimate" ON public.project_estimates
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE TABLE IF NOT EXISTS public.resource_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  resource_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resource_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can request a resource" ON public.resource_downloads;
CREATE POLICY "Anyone can request a resource" ON public.resource_downloads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- [20260723184122_d636b76f-9d64-4575-b280-8b0316c0147d.sql]
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
CREATE OR REPLACE FUNCTION public.grant_admin_for_seeded_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) IN ('anuj@ciagotech.com', 'anujavengers@gmail.com', 'atpay2901@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_seeded_emails();
DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_seeded_emails();
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) IN ('anuj@ciagotech.com', 'anujavengers@gmail.com', 'atpay2901@gmail.com')
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.job_applications;
CREATE POLICY "Admins can view all applications"
  ON public.job_applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update applications" ON public.job_applications;
CREATE POLICY "Admins can update applications"
  ON public.job_applications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- [20260723190749_f4327783-c605-475d-9aba-52653da5203f.sql]
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  public_email text,
  bio text,
  pronouns text,
  website text,
  linkedin text,
  portfolio text,
  leetcode text,
  avatar_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can grant roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can revoke roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users withdraw own in-queue applications" ON public.job_applications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'in_queue');
CREATE POLICY "Admins delete rejected applications" ON public.job_applications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND status = 'rejected');

-- [20260723192414_a7dad284-947d-4d7a-b562-4ed348a5463f.sql]
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_soft_deleted BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS job_applications_soft_deleted_idx
  ON public.job_applications (is_soft_deleted, deleted_at);

-- [20260723193744_671c5176-d1d4-4a11-9f98-dd921cbe1f35.sql]
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_resource text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs (timestamp DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX in_app_notifications_user_idx ON public.in_app_notifications (user_id, read, created_at DESC);
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications"
  ON public.in_app_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read"
  ON public.in_app_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TYPE public.job_posting_status AS ENUM ('active', 'paused', 'closed');
CREATE TABLE public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text NOT NULL,
  location text NOT NULL,
  is_remote boolean NOT NULL DEFAULT true,
  employment_type text NOT NULL DEFAULT 'Full-time',
  summary text NOT NULL,
  description text NOT NULL,
  requirements text[] NOT NULL DEFAULT ARRAY[]::text[],
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  salary_min_inr bigint,
  salary_max_inr bigint,
  status public.job_posting_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_postings_status_idx ON public.job_postings (status, created_at DESC);
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active postings"
  ON public.job_postings FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert postings"
  ON public.job_postings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update postings"
  ON public.job_postings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete postings"
  ON public.job_postings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER job_postings_set_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- [20260724040506_cd1a9062-d7bf-43f8-9c66-db65340c7bcc.sql]
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can submit an estimate" ON public.project_estimates;
DROP POLICY IF EXISTS "Anyone can request a resource" ON public.resource_downloads;
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limits_bucket_key_time_idx
  ON public.rate_limits (bucket, key, occurred_at DESC);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.prune_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE occurred_at < now() - interval '1 day';
$$;

-- [20260724043809_8c2b9f11-9a4b-40a5-b82c-db2bf2c268cb.sql]
DROP POLICY IF EXISTS "Anyone reads active postings" ON public.job_postings;
CREATE POLICY "Public reads active postings" ON public.job_postings FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Admins read all postings" ON public.job_postings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- [20260724045755_f3add6da-6355-4b95-90f1-08a14072699a.sql]
CREATE SEQUENCE IF NOT EXISTS public.job_postings_code_seq START 1001;
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS job_code TEXT UNIQUE;
CREATE OR REPLACE FUNCTION public.assign_job_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.job_code IS NULL OR NEW.job_code = '' THEN
    NEW.job_code := 'CGT-' ||
      upper(substring(regexp_replace(coalesce(NEW.department,''), '[^A-Za-z]', '', 'g') from 1 for 3)) ||
      '-' || lpad(nextval('public.job_postings_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS assign_job_code_trg ON public.job_postings;
CREATE TRIGGER assign_job_code_trg
BEFORE INSERT ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.assign_job_code();
UPDATE public.job_postings
SET job_code = 'CGT-' ||
    upper(substring(regexp_replace(coalesce(department,''), '[^A-Za-z]', '', 'g') from 1 for 3)) ||
    '-' || lpad(nextval('public.job_postings_code_seq')::text, 4, '0')
WHERE job_code IS NULL;
CREATE INDEX IF NOT EXISTS job_applications_role_created_idx
  ON public.job_applications (role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_user_role_idx
  ON public.job_applications (user_id, role_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.apply_for_role(
  _role_id TEXT,
  _role_title TEXT,
  _full_name TEXT,
  _email TEXT,
  _portfolio_url TEXT,
  _resume_storage_path TEXT,
  _resume_link TEXT
)
RETURNS TABLE(application_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _existing RECORD;
  _new_id UUID;
  _days_left INT;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Serialize concurrent applies for the same user+role
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || '|' || _role_id, 0));

  SELECT id, status, is_soft_deleted, created_at
    INTO _existing
    FROM public.job_applications
    WHERE user_id = _uid
      AND role_id = _role_id
      AND created_at > now() - interval '90 days'
    ORDER BY created_at DESC
    LIMIT 1;

  IF FOUND THEN
    _days_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((_existing.created_at + interval '90 days') - now())) / 86400)::INT);
    IF _existing.is_soft_deleted OR _existing.status = 'rejected' THEN
      RAISE EXCEPTION 'You can re-apply for this role in % day%',
        _days_left, CASE WHEN _days_left = 1 THEN '' ELSE 's' END
        USING ERRCODE = '23505';
    ELSE
      RAISE EXCEPTION 'You have already applied for this role. Please wait for a decision before re-applying.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  INSERT INTO public.job_applications (
    user_id, role_id, role_title, full_name, email,
    portfolio_url, resume_storage_path, resume_link
  ) VALUES (
    _uid, _role_id, _role_title, _full_name, _email,
    NULLIF(_portfolio_url,''), NULLIF(_resume_storage_path,''), NULLIF(_resume_link,'')
  )
  RETURNING id INTO _new_id;

  application_id := _new_id;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_for_role(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;

-- [20260724050749_997094c7-ee65-4595-a5dd-de57257b07b0.sql]
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'employee'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'employee';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.employee_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'to_do' CHECK (status IN ('to_do','in_progress','blocked','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_read_own_tasks" ON public.employee_tasks
  FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_insert_own_tasks" ON public.employee_tasks
  FOR INSERT TO authenticated
  WITH CHECK (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_update_own_tasks" ON public.employee_tasks
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_delete_own_tasks" ON public.employee_tasks
  FOR DELETE TO authenticated
  USING (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER employee_tasks_set_updated_at
BEFORE UPDATE ON public.employee_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_employee_tasks_assignee ON public.employee_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status ON public.employee_tasks(status);
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  hours_logged numeric(4,2) NOT NULL CHECK (hours_logged >= 0 AND hours_logged <= 24),
  project_reference text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timesheets_read_own" ON public.timesheets
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "timesheets_insert_own" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "timesheets_update_own" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "timesheets_delete_own" ON public.timesheets
  FOR DELETE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER timesheets_set_updated_at
BEFORE UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON public.timesheets(employee_id, date DESC);
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  candidate_email text NOT NULL,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  referral_status text NOT NULL DEFAULT 'pending' CHECK (referral_status IN ('pending','interviewing','hired','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_read_own" ON public.referrals
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "referrals_insert_own" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "referrals_update_admin" ON public.referrals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "referrals_delete_own_or_admin" ON public.referrals
  FOR DELETE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER referrals_set_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_referrals_employee ON public.referrals(employee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_job_posting ON public.referrals(job_posting_id);

-- [20260724053051_3d20cf29-f3d8-44e2-a084-69451971d0f3.sql]
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'employee'::app_role FROM auth.users WHERE lower(email) = 'atpay2901@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
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
ALTER TABLE public.employee_tasks
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_reference text;
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

-- [20260724054526_d048d387-afcd-4420-83a4-60dc3e2db741.sql]
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'atpay2901@gmail.com')
  AND role = 'employee';
CREATE OR REPLACE FUNCTION public.grant_employee_for_seeded_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Intentionally disabled: no emails auto-granted employee anymore.
  RETURN NEW;
END;
$function$;
DELETE FROM public.job_applications
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'atpay2901@gmail.com');

-- [20260724061937_b4924a2e-5d14-4558-a41b-aa3e6e7879ab.sql]
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';

-- [20260724062022_03bc8e8a-60df-4c1d-8513-fc8f474f58b5.sql]
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS required_onboarding_docs text[] NOT NULL DEFAULT ARRAY['aadhaar','pan','bank_details']::text[];
ALTER TABLE public.onboarding_records
  ADD COLUMN IF NOT EXISTS doj date,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS current_step smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rejection_feedback text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.onboarding_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  doc_key text NOT NULL,
  storage_path text NOT NULL,
  original_filename text,
  status text NOT NULL DEFAULT 'pending',
  feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onboarding_id, doc_key)
);
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own docs" ON public.onboarding_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own docs" ON public.onboarding_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own docs while pending" ON public.onboarding_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status IN ('pending','changes_requested')) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff read all docs" ON public.onboarding_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "Staff review docs" ON public.onboarding_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_onboarding_documents_updated
  BEFORE UPDATE ON public.onboarding_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  slot_at timestamptz NOT NULL,
  location text,
  notes text,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidate reads own slots" ON public.interview_slots FOR SELECT TO authenticated USING (auth.uid() = candidate_user_id);
CREATE POLICY "Candidate selects a slot" ON public.interview_slots FOR UPDATE TO authenticated USING (auth.uid() = candidate_user_id) WITH CHECK (auth.uid() = candidate_user_id);
CREATE POLICY "Staff manages slots" ON public.interview_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_interview_slots_updated
  BEFORE UPDATE ON public.interview_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type text NOT NULL DEFAULT 'pto',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees manage own leave" ON public.leave_requests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage all leave" ON public.leave_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_leave_requests_updated
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "HR read all applications" ON public.job_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR update applications" ON public.job_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR manage postings" ON public.job_postings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read onboarding" ON public.onboarding_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR update onboarding" ON public.onboarding_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read referrals" ON public.referrals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read user_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));

-- [20260724063611_691486a2-cb25-44e4-a22e-d9579db90cbc.sql]
ALTER TABLE public.onboarding_records ADD COLUMN IF NOT EXISTS form_state jsonb NOT NULL DEFAULT '{}'::jsonb;

-- [20260724085158_62cacc0c-7cb1-412a-a868-c487077f164e.sql]
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';

-- [20260724085243_c1fe06cb-d70d-4223-9384-d34da17c3c29.sql]
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can read departments" ON public.departments;
CREATE POLICY "Staff can read departments" ON public.departments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
);
DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.departments (name, code, description) VALUES
  ('Engineering', 'ENG', 'Product Engineering & Platform'),
  ('Human Resources', 'HR', 'People Operations'),
  ('Operations', 'OPS', 'Business & Delivery Operations')
ON CONFLICT (code) DO NOTHING;
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS user_roles_department_idx ON public.user_roles(department_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_track_type') THEN
    CREATE TYPE public.job_track_type AS ENUM ('standard', 'manager_track', 'hr_track');
  END IF;
END $$;
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS track_type public.job_track_type NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target_user_id uuid,
  _new_role public.app_role,
  _department_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles' USING ERRCODE = '42501';
  END IF;
  IF _new_role NOT IN ('employee','manager','hr','admin') THEN
    RAISE EXCEPTION 'Unsupported role %', _new_role USING ERRCODE = '22023';
  END IF;

  -- Remove existing staff roles for this user (keeps 'user' baseline outside user_roles table).
  DELETE FROM public.user_roles
    WHERE user_id = _target_user_id
      AND role IN ('employee','manager','hr','admin');

  INSERT INTO public.user_roles (user_id, role, department_id)
  VALUES (_target_user_id, _new_role, _department_id)
  ON CONFLICT (user_id, role) DO UPDATE SET department_id = EXCLUDED.department_id;

  INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
  VALUES (
    _actor,
    'role.updated',
    _target_user_id::text,
    jsonb_build_object('new_role', _new_role, 'department_id', _department_id)
  );
END;
$$;

-- [20260724091153_c48e7be7-73ce-47ac-b639-65262bd579d9.sql]
ALTER TABLE public.onboarding_documents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
ALTER TABLE public.onboarding_documents
  DROP CONSTRAINT IF EXISTS onboarding_documents_onboarding_id_doc_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_documents_current_unique
  ON public.onboarding_documents (onboarding_id, doc_key)
  WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS onboarding_documents_history_idx
  ON public.onboarding_documents (onboarding_id, doc_key, version DESC);

-- [20260724091808_c504d373-51e4-47f3-955e-27bbf6296104.sql]
DROP POLICY IF EXISTS "Managers manage team leave" ON public.leave_requests;
CREATE POLICY "Managers manage team leave" ON public.leave_requests
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_roles mgr
    JOIN public.user_roles emp ON emp.department_id = mgr.department_id
    WHERE mgr.user_id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.department_id IS NOT NULL
      AND emp.user_id = public.leave_requests.user_id
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'manager'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.user_roles mgr
    JOIN public.user_roles emp ON emp.department_id = mgr.department_id
    WHERE mgr.user_id = auth.uid()
      AND mgr.role = 'manager'
      AND mgr.department_id IS NOT NULL
      AND emp.user_id = public.leave_requests.user_id
  )
);

-- [20260724092327_2600057f-851b-4f54-b3d0-da6853fb6b0d.sql]
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  hours NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','leave','regularized','pending_regularization')),
  regularization_reason TEXT,
  regularized_by UUID REFERENCES auth.users(id),
  regularized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own attendance" ON public.attendance_records FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Users insert own attendance" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attendance" ON public.attendance_records FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'manager')) WITH CHECK (true);
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ctc_annual_inr NUMERIC(12,2) NOT NULL,
  basic_monthly NUMERIC(12,2) NOT NULL,
  hra_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  special_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf_employee_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  pt_monthly NUMERIC(12,2) NOT NULL DEFAULT 200,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own structure" ON public.salary_structures FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR manages structures" ON public.salary_structures FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_salary_structures_updated_at BEFORE UPDATE ON public.salary_structures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.salary_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  working_days INT NOT NULL DEFAULT 22,
  lwp_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  basic NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra NUMERIC(12,2) NOT NULL DEFAULT 0,
  special NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  pt NUMERIC(12,2) NOT NULL DEFAULT 0,
  tds NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  generated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_year, period_month)
);
ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own slips" ON public.salary_slips FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR manages slips" ON public.salary_slips FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_salary_slips_updated_at BEFORE UPDATE ON public.salary_slips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- [20260724092948_ea1ed76c-ac71-4b12-b186-453b1f3609a0.sql]
ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS internal_only BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.resignations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_on DATE NOT NULL DEFAULT CURRENT_DATE,
  last_working_day DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resignations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees manage own resignation" ON public.resignations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "HR admin manager can view resignations" ON public.resignations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "HR admin can decide resignations" ON public.resignations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));
CREATE TRIGGER trg_resignations_updated_at
  BEFORE UPDATE ON public.resignations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_resignations_user ON public.resignations(user_id);
CREATE INDEX IF NOT EXISTS idx_resignations_status ON public.resignations(status);

-- [20260724104449_750eefd7-e072-4776-b1e7-0140fc4e9d4a.sql]
CREATE OR REPLACE FUNCTION public.complete_onboarding(_onboarding_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Paperwork submitted. HR verification + DOJ are the true gate to a staff role.
  UPDATE public.onboarding_records
     SET status = 'submitted',
         submitted_at = now(),
         verification_status = COALESCE(verification_status, 'pending')
   WHERE id = _onboarding_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.finalize_onboarding_role(_onboarding_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _rec RECORD;
  _track text;
  _target_role app_role;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(_actor,'admin') OR public.has_role(_actor,'hr')) THEN
    RAISE EXCEPTION 'Only HR or admin may finalize onboarding roles' USING ERRCODE = '42501';
  END IF;

  SELECT o.id, o.user_id, o.application_id, o.verification_status, o.doj,
         COALESCE(jp.job_track_type, 'standard') AS job_track_type
    INTO _rec
    FROM public.onboarding_records o
    LEFT JOIN public.job_applications ja ON ja.id = o.application_id
    LEFT JOIN public.job_postings jp    ON jp.id = ja.role_id
   WHERE o.id = _onboarding_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding not found' USING ERRCODE = '42704'; END IF;
  IF _rec.verification_status <> 'approved' THEN
    RAISE EXCEPTION 'Paperwork must be approved before role elevation' USING ERRCODE = '22023';
  END IF;
  IF _rec.doj IS NULL THEN
    RAISE EXCEPTION 'Date of Joining must be set before role elevation' USING ERRCODE = '22023';
  END IF;

  _track := _rec.job_track_type;
  IF _track = 'hr_track' THEN
    IF NOT public.has_role(_actor,'admin') THEN
      RAISE EXCEPTION 'HR-track candidates must be finalized by an admin' USING ERRCODE = '42501';
    END IF;
    _target_role := 'hr';
  ELSIF _track = 'manager_track' THEN
    _target_role := 'manager';
  ELSE
    _target_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_rec.user_id, _target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
  VALUES (
    _actor,
    'onboarding.role_finalized',
    _onboarding_id::text,
    jsonb_build_object('user_id', _rec.user_id, 'role', _target_role, 'job_track', _track)
  );

  RETURN _target_role::text;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_onboarding_role(uuid) FROM PUBLIC;

-- [20260724105952_55ad4707-1875-4c43-a499-d7c0492edbf5.sql]
CREATE OR REPLACE FUNCTION public.finalize_onboarding_role(_onboarding_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _rec RECORD;
  _track text;
  _target_role app_role;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(_actor,'admin') OR public.has_role(_actor,'hr')) THEN
    RAISE EXCEPTION 'Only HR or admin may finalize onboarding roles' USING ERRCODE = '42501';
  END IF;

  SELECT o.id, o.user_id, o.application_id, o.verification_status, o.doj,
         COALESCE(jp.track_type::text, 'standard') AS track_type
    INTO _rec
    FROM public.onboarding_records o
    LEFT JOIN public.job_applications ja ON ja.id = o.application_id
    LEFT JOIN public.job_postings jp    ON jp.id = ja.role_id
   WHERE o.id = _onboarding_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding not found' USING ERRCODE = '42704'; END IF;
  IF _rec.verification_status <> 'approved' THEN
    RAISE EXCEPTION 'Paperwork must be approved before role elevation' USING ERRCODE = '22023';
  END IF;
  IF _rec.doj IS NULL THEN
    RAISE EXCEPTION 'Date of Joining must be set before role elevation' USING ERRCODE = '22023';
  END IF;

  _track := _rec.track_type;
  IF _track = 'hr_track' THEN
    IF NOT public.has_role(_actor,'admin') THEN
      RAISE EXCEPTION 'HR-track candidates must be finalized by an admin' USING ERRCODE = '42501';
    END IF;
    _target_role := 'hr';
  ELSIF _track = 'manager_track' THEN
    _target_role := 'manager';
  ELSE
    _target_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_rec.user_id, _target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
  VALUES (
    _actor,
    'onboarding.role_finalized',
    _onboarding_id::text,
    jsonb_build_object('user_id', _rec.user_id, 'role', _target_role, 'job_track', _track)
  );

  RETURN _target_role::text;
END;
$function$;

-- [20260724114953_45dbf1cf-8804-4a7e-ad13-b79140e3d36c.sql]
DO $$
DECLARE
  _emails text[] := ARRAY['tktpay2901@gmail.com', 'anujcloudwork@gmail.com'];
  _uid uuid;
  _email text;
BEGIN
  FOREACH _email IN ARRAY _emails LOOP
    SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email);
    IF _uid IS NULL THEN CONTINUE; END IF;

    -- Null out non-cascading references first so the auth delete can proceed.
    UPDATE public.resignations         SET decided_by = NULL WHERE decided_by = _uid;
    UPDATE public.leave_requests       SET decided_by = NULL WHERE decided_by = _uid;
    UPDATE public.onboarding_documents SET reviewed_by = NULL WHERE reviewed_by = _uid;
    UPDATE public.attendance_records   SET regularized_by = NULL WHERE regularized_by = _uid;
    UPDATE public.audit_logs           SET actor_id = NULL WHERE actor_id = _uid;

    -- Explicit cleanup of tables without a cascading FK.
    DELETE FROM public.in_app_notifications WHERE user_id = _uid;
    DELETE FROM public.interview_slots      WHERE proposed_by = _uid OR candidate_user_id = _uid;

    -- Cascades on auth.users handle: profiles, user_roles, job_applications, onboarding_records,
    -- onboarding_documents (via onboarding_id), employee_tasks, timesheets, attendance_records,
    -- leave_requests, resignations, referrals, salary_slips, salary_structures.
    DELETE FROM auth.users WHERE id = _uid;
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Approvers can read profile names" ON public.profiles;
CREATE POLICY "Approvers can read profile names"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'hr'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- [20260724123535_c7c9b52e-fa4d-4074-85cd-3c332ed4307a.sql]
CREATE OR REPLACE FUNCTION public.finalize_onboarding_role(_onboarding_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid := auth.uid();
  _rec RECORD;
  _track text;
  _target_role app_role;
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(_actor,'admin') OR public.has_role(_actor,'hr')) THEN
    RAISE EXCEPTION 'Only HR or admin may finalize onboarding roles' USING ERRCODE = '42501';
  END IF;

  SELECT o.id, o.user_id, o.application_id, o.verification_status, o.doj,
         COALESCE(jp.track_type::text, 'standard') AS track_type
    INTO _rec
    FROM public.onboarding_records o
    LEFT JOIN public.job_applications ja ON ja.id = o.application_id
    LEFT JOIN public.job_postings jp    ON jp.id::text = ja.role_id
   WHERE o.id = _onboarding_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding not found' USING ERRCODE = '42704'; END IF;
  IF _rec.verification_status <> 'approved' THEN
    RAISE EXCEPTION 'Paperwork must be approved before role elevation' USING ERRCODE = '22023';
  END IF;
  IF _rec.doj IS NULL THEN
    RAISE EXCEPTION 'Date of Joining must be set before role elevation' USING ERRCODE = '22023';
  END IF;

  _track := _rec.track_type;
  IF _track = 'hr_track' THEN
    IF NOT public.has_role(_actor,'admin') THEN
      RAISE EXCEPTION 'HR-track candidates must be finalized by an admin' USING ERRCODE = '42501';
    END IF;
    _target_role := 'hr';
  ELSIF _track = 'manager_track' THEN
    _target_role := 'manager';
  ELSE
    _target_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_rec.user_id, _target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
  VALUES (
    _actor,
    'onboarding.role_finalized',
    _onboarding_id::text,
    jsonb_build_object('user_id', _rec.user_id, 'role', _target_role, 'job_track', _track)
  );

  RETURN _target_role::text;
END;
$function$;

-- [20260724141305_d8ef926b-55d7-49cc-8536-8ccc5ac97854.sql]
DO $$ BEGIN
  CREATE TYPE public.dept_type AS ENUM (
    'engineering','operations','human_resource','management','product','design',
    'finance','sales','marketing','customer_support','legal','it_infrastructure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.employees (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  work_email text,
  personal_email text,
  contact_number text,
  address text,
  department public.dept_type,
  team_name text,
  designation text,
  reporting_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporting_hr_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  doj date,
  employment_type text CHECK (employment_type IN ('full_time','part_time','contractor','intern','probation')),
  base_salary numeric(14,2),
  salary_currency text NOT NULL DEFAULT 'INR',
  work_model text CHECK (work_model IN ('onsite','remote','hybrid')),
  work_location text,
  probation_months smallint CHECK (probation_months IS NULL OR probation_months BETWEEN 0 AND 24),
  probation_status text NOT NULL DEFAULT 'under_review' CHECK (probation_status IN ('under_review','confirmed','extended')),
  background_check_status text NOT NULL DEFAULT 'not_started' CHECK (background_check_status IN ('not_started','in_progress','cleared','flagged')),
  doc_verification_status text NOT NULL DEFAULT 'pending' CHECK (doc_verification_status IN ('pending','verified','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_admin_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin');
$$;
CREATE POLICY "employees_self_read" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "employees_manager_read" ON public.employees FOR SELECT TO authenticated
  USING (reporting_manager_id = auth.uid() OR reporting_hr_id = auth.uid());
CREATE POLICY "employees_admin_all" ON public.employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_hr_read_non_admin" ON public.employees FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE POLICY "employees_hr_write_non_admin" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE POLICY "employees_hr_update_non_admin" ON public.employees FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id))
  WITH CHECK (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_employees_dept ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_hr ON public.employees(reporting_hr_id);
CREATE TABLE IF NOT EXISTS public.identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('pan','aadhaar','passport')),
  doc_number text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  feedback text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_type)
);
ALTER TABLE public.identity_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "idoc_self_rw" ON public.identity_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "idoc_admin_all" ON public.identity_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "idoc_hr_read" ON public.identity_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE POLICY "idoc_hr_update" ON public.identity_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id))
  WITH CHECK (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE TRIGGER trg_idoc_updated_at BEFORE UPDATE ON public.identity_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE FUNCTION public.prevent_hr_admin_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RETURN NEW; END IF; -- backend/service_role
  IF public.has_role(_actor,'admin') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF public.has_role(_actor,'hr') THEN
    IF (TG_OP='INSERT' AND NEW.role='admin')
       OR (TG_OP='UPDATE' AND (NEW.role='admin' OR OLD.role='admin'))
       OR (TG_OP='DELETE' AND OLD.role='admin') THEN
      RAISE EXCEPTION 'HR users cannot modify System Admin accounts' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_prevent_hr_admin_role_change ON public.user_roles;
CREATE TRIGGER trg_prevent_hr_admin_role_change
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hr_admin_role_change();
CREATE OR REPLACE FUNCTION public.list_directory()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role app_role,
  is_admin boolean,
  department public.dept_type,
  designation text,
  team_name text,
  doj date,
  employment_type text,
  work_model text,
  work_location text,
  base_salary numeric,
  salary_currency text,
  probation_status text,
  background_check_status text,
  doc_verification_status text,
  reporting_manager_id uuid,
  reporting_hr_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT (public.has_role(_actor,'admin') OR public.has_role(_actor,'hr')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.full_name,
    COALESCE(
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id=u.id
        ORDER BY CASE ur.role
          WHEN 'admin' THEN 1 WHEN 'hr' THEN 2 WHEN 'manager' THEN 3
          WHEN 'employee' THEN 4 WHEN 'user' THEN 5 ELSE 6 END LIMIT 1),
      'user'::app_role
    ),
    public.is_admin_user(u.id),
    e.department, e.designation, e.team_name, e.doj, e.employment_type,
    e.work_model, e.work_location, e.base_salary, COALESCE(e.salary_currency,'INR'),
    COALESCE(e.probation_status,'under_review'),
    COALESCE(e.background_check_status,'not_started'),
    COALESCE(e.doc_verification_status,'pending'),
    e.reporting_manager_id, e.reporting_hr_id, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id=u.id
  LEFT JOIN public.employees e ON e.user_id=u.id
  ORDER BY u.created_at DESC;
END; $$;

-- [20260724143134_000abe78-9996-455f-9cf2-1653a8889b30.sql]
INSERT INTO public.departments (name, code, description) VALUES
  ('Engineering','ENG','Product Engineering & Platform'),
  ('Operations','OPS','Business & Delivery Operations'),
  ('Human Resources','HR','People Operations'),
  ('Management','MGMT','Leadership & Strategy'),
  ('Product','PROD','Product Management'),
  ('Design','DES','Design & UX'),
  ('Finance','FIN','Finance & Accounting'),
  ('Sales','SALES','Sales & Growth'),
  ('Marketing','MKT','Marketing & Brand'),
  ('Customer Support','CS','Customer Support'),
  ('Legal','LEGAL','Legal & Compliance'),
  ('IT Infrastructure','IT','IT & Infrastructure')
ON CONFLICT (name) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.employment_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employment_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read employment types" ON public.employment_types;
CREATE POLICY "Public read employment types" ON public.employment_types
  FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.employment_types(code,label,sort_order) VALUES
  ('full_time','Full-time',1),
  ('part_time','Part-time',2),
  ('internship','Internship',3),
  ('apprenticeship','Apprenticeship',4),
  ('contractor','Contractor',5)
ON CONFLICT (code) DO NOTHING;
DROP POLICY IF EXISTS "Public reads active postings" ON public.job_postings;
ALTER TYPE public.job_posting_status RENAME TO job_posting_status_old;
CREATE TYPE public.job_posting_status AS ENUM ('draft','published','internal_only','closed','archived');
ALTER TABLE public.job_postings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.job_postings
  ALTER COLUMN status TYPE public.job_posting_status USING (
    CASE status::text
      WHEN 'active' THEN 'published'
      WHEN 'paused' THEN 'draft'
      WHEN 'closed' THEN 'closed'
      ELSE 'draft'
    END
  )::public.job_posting_status;
ALTER TABLE public.job_postings
  ALTER COLUMN status SET DEFAULT 'draft'::public.job_posting_status;
DROP TYPE public.job_posting_status_old;
CREATE POLICY "Public reads published postings" ON public.job_postings
  FOR SELECT TO anon, authenticated
  USING (status = 'published'::public.job_posting_status);
ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;
UPDATE public.job_applications SET status = CASE status
  WHEN 'in_queue' THEN 'applied'
  WHEN 'under_review' THEN 'screening'
  WHEN 'offer_extended' THEN 'offered'
  WHEN 'rejected' THEN 'rejected'
  ELSE 'applied'
END;
ALTER TABLE public.job_applications ALTER COLUMN status SET DEFAULT 'applied';
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('applied','screening','interviewing','offered','hired','rejected'));
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_account_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_account_status_check
  CHECK (account_status IN ('active','inactive','suspended'));

-- [20260724144329_8f111f09-5f22-4710-a2ab-f593536d6fb0.sql]
CREATE TABLE IF NOT EXISTS public.status_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('job_posting','application','user_account')),
  code text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, code)
);
ALTER TABLE public.status_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_options readable by everyone"
  ON public.status_options FOR SELECT
  TO anon, authenticated
  USING (true);
INSERT INTO public.status_options (kind, code, label, description, sort_order) VALUES
  ('job_posting','draft','Draft','Not visible to candidates',10),
  ('job_posting','published','Published','Visible on public careers page',20),
  ('job_posting','internal_only','Internal only','Visible to employees on internal mobility',30),
  ('job_posting','closed','Closed','No longer accepting applications',40),
  ('job_posting','archived','Archived','Hidden from all listings',50),

  ('application','applied','Applied','Candidate has submitted an application',10),
  ('application','screening','Screening','Recruiter reviewing profile',20),
  ('application','interviewing','Interviewing','Interviews in progress',30),
  ('application','offered','Offered','Offer extended to candidate',40),
  ('application','hired','Hired','Candidate accepted and onboarded',50),
  ('application','rejected','Rejected','Application not moving forward',60),

  ('user_account','active','Active','Account can sign in and use the app',10),
  ('user_account','inactive','Inactive','Account temporarily disabled',20),
  ('user_account','suspended','Suspended','Account suspended by administrator',30)
ON CONFLICT (kind, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- [20260724144821_de55bbd7-ca52-4a88-a480-11e95d0c676e.sql]
DROP POLICY IF EXISTS "Public reads published postings" ON public.job_postings;
CREATE POLICY "Public reads published postings"
  ON public.job_postings FOR SELECT
  USING (status = 'published'::job_posting_status AND internal_only = false);
DROP POLICY IF EXISTS "Users update own attendance" ON public.attendance_records;
CREATE POLICY "Users update own attendance"
  ON public.attendance_records FOR UPDATE
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

-- [20260724201018_26f2d3a1-9c47-4f91-b6d3-7a0e6f1c9b25.sql]
BEGIN;
CREATE TABLE IF NOT EXISTS public.clerk_user_map (
  
  clerk_user_id TEXT PRIMARY KEY,
  
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  
  email TEXT UNIQUE,
  primary_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clerk_user_map_auth_user_id_idx
  ON public.clerk_user_map (auth_user_id);
CREATE INDEX IF NOT EXISTS clerk_user_map_email_idx
  ON public.clerk_user_map (email)
  WHERE email IS NOT NULL;
CREATE OR REPLACE FUNCTION public.touch_clerk_user_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS clerk_user_map_touch_updated_at
  ON public.clerk_user_map;
CREATE TRIGGER clerk_user_map_touch_updated_at
  BEFORE UPDATE ON public.clerk_user_map
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_clerk_user_map_updated_at();
ALTER TABLE public.clerk_user_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role manages clerk_user_map" ON public.clerk_user_map;
CREATE POLICY "service_role manages clerk_user_map"
  ON public.clerk_user_map
  FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "anon/authenticated denied on clerk_user_map" ON public.clerk_user_map;
CREATE POLICY "anon/authenticated denied on clerk_user_map"
  ON public.clerk_user_map
  FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);
COMMIT;