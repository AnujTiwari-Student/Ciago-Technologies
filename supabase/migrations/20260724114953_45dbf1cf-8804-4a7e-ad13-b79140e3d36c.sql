
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
