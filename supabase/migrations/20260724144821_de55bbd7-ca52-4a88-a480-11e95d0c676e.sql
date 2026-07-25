
-- 1) job_postings: exclude internal_only from public listing
DROP POLICY IF EXISTS "Public reads published postings" ON public.job_postings;
CREATE POLICY "Public reads published postings"
  ON public.job_postings FOR SELECT
  USING (status = 'published'::job_posting_status AND internal_only = false);

-- 2) attendance_records: replace WITH CHECK (true) with the same owner/role guard
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

-- 3) Lock down SECURITY DEFINER functions from anon/public.
-- Trigger-only helpers: revoke from everyone (triggers run regardless of EXECUTE grants).
REVOKE ALL ON FUNCTION public.grant_admin_for_seeded_emails() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_employee_for_seeded_emails() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_hr_admin_role_change() FROM PUBLIC, anon, authenticated;

-- Maintenance helper: service_role only.
REVOKE ALL ON FUNCTION public.prune_rate_limits() FROM PUBLIC, anon, authenticated;

-- Callable helpers: revoke from anon/PUBLIC, keep authenticated (needed by RLS + server fns).
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.apply_for_role(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_for_role(text, text, text, text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.complete_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.finalize_onboarding_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_onboarding_role(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, app_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, app_role, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_directory() TO authenticated, service_role;
