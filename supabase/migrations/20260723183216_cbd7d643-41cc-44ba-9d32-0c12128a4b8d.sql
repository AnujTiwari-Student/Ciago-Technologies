
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
GRANT INSERT ON public.project_estimates TO anon, authenticated;
GRANT ALL ON public.project_estimates TO service_role;
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
GRANT INSERT ON public.resource_downloads TO anon, authenticated;
GRANT ALL ON public.resource_downloads TO service_role;
ALTER TABLE public.resource_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can request a resource" ON public.resource_downloads;
CREATE POLICY "Anyone can request a resource" ON public.resource_downloads
  FOR INSERT TO anon, authenticated WITH CHECK (true);
