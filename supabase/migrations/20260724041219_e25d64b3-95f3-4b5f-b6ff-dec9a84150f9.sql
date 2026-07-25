-- Lock down SECURITY DEFINER trigger helpers so signed-in users cannot call them.
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_seeded_emails() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prune_rate_limits() FROM PUBLIC, anon, authenticated;
-- has_role must remain callable by authenticated: it is invoked from RLS policy
-- expressions evaluated in the caller's session (SELECT/INSERT/UPDATE/DELETE on
-- audit_logs, job_applications, job_postings, user_roles). Revoking EXECUTE
-- from authenticated would break every admin-scoped policy in the app.
-- We restrict it explicitly to authenticated (no anon, no PUBLIC).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;