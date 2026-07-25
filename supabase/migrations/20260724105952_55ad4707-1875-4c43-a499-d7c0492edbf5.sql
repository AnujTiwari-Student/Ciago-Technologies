
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
