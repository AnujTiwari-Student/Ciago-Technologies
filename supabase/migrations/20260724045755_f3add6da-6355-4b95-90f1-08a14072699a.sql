
-- 1. Add human-readable job code to job_postings
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

-- Backfill existing rows without a code
UPDATE public.job_postings
SET job_code = 'CGT-' ||
    upper(substring(regexp_replace(coalesce(department,''), '[^A-Za-z]', '', 'g') from 1 for 3)) ||
    '-' || lpad(nextval('public.job_postings_code_seq')::text, 4, '0')
WHERE job_code IS NULL;

-- 2. Indexes for cooldown + per-role lookups
CREATE INDEX IF NOT EXISTS job_applications_role_created_idx
  ON public.job_applications (role_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_user_role_idx
  ON public.job_applications (user_id, role_id, created_at DESC);

-- 3. Concurrency-safe apply RPC with advisory lock + re-check
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
GRANT EXECUTE ON FUNCTION public.apply_for_role(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- 4. Scheduled hard-delete of any application older than 90 days
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hard-delete-applications-90d') THEN
    PERFORM cron.unschedule('hard-delete-applications-90d');
  END IF;
END $$;

SELECT cron.schedule(
  'hard-delete-applications-90d',
  '15 3 * * *',
  $$ DELETE FROM public.job_applications WHERE created_at < now() - interval '90 days'; $$
);
