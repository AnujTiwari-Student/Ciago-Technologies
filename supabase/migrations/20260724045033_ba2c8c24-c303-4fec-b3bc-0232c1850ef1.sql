DO $$ BEGIN PERFORM cron.unschedule('purge-soft-deleted-applications'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'purge-soft-deleted-applications',
  '0 3 * * *',
  $$DELETE FROM public.job_applications WHERE is_soft_deleted = true AND deleted_at < NOW() - INTERVAL '90 days'$$
);