-- Remove premature role elevation from complete_onboarding.
-- Candidates should only receive the 'employee' (or manager/hr) role
-- when HR explicitly approves paperwork AND assigns a DOJ.
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

-- New: HR/admin-callable RPC to grant the correct staff role once DOJ is assigned.
-- Grants role based on the linked job_postings.job_track_type:
--   'hr_track'      -> hr
--   'manager_track' -> manager
--   otherwise       -> employee
-- HR-track candidates require the actor to be an admin.
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
GRANT EXECUTE ON FUNCTION public.finalize_onboarding_role(uuid) TO authenticated;