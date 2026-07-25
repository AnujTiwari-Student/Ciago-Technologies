
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_soft_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS job_applications_soft_deleted_idx
  ON public.job_applications (is_soft_deleted, deleted_at);

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-soft-deleted-applications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-soft-deleted-applications',
  '0 3 * * *',
  $$DELETE FROM public.job_applications WHERE is_soft_deleted = true AND deleted_at < NOW() - INTERVAL '5 days'$$
);
