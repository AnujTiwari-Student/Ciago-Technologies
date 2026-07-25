
-- 1) PROFILES: owner-only SELECT
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) STORAGE.OBJECTS: avatars owner-only read
DROP POLICY IF EXISTS "Authenticated read avatars" ON storage.objects;
CREATE POLICY "Users can read own avatar"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) project_estimates: revoke public INSERT; only service_role writes via server fn
DROP POLICY IF EXISTS "Anyone can submit an estimate" ON public.project_estimates;
REVOKE INSERT ON public.project_estimates FROM anon, authenticated;
REVOKE SELECT ON public.project_estimates FROM anon, authenticated;

-- 4) resource_downloads: same
DROP POLICY IF EXISTS "Anyone can request a resource" ON public.resource_downloads;
REVOKE INSERT ON public.resource_downloads FROM anon, authenticated;
REVOKE SELECT ON public.resource_downloads FROM anon, authenticated;

-- 5) rate_limits table for sliding-window enforcement
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limits_bucket_key_time_idx
  ON public.rate_limits (bucket, key, occurred_at DESC);

-- Server-role only (never exposed to clients)
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limits_id_seq TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies granted to anon/authenticated → all client access denied.

-- 6) Prune old rate-limit rows (best-effort helper; called from app or cron)
CREATE OR REPLACE FUNCTION public.prune_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE occurred_at < now() - interval '1 day';
$$;
REVOKE ALL ON FUNCTION public.prune_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_rate_limits() TO service_role;

-- 7) Lock down grant_admin_for_seeded_emails: only trigger context needs it
REVOKE ALL ON FUNCTION public.grant_admin_for_seeded_emails() FROM PUBLIC, anon, authenticated;
