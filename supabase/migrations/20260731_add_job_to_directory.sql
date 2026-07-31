-- Add job_id, job_title, and doc counts to list_directory() output

CREATE OR REPLACE FUNCTION public.list_directory()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  role app_role,
  is_admin boolean,
  department public.dept_type,
  designation text,
  team_name text,
  doj date,
  employment_type text,
  work_model text,
  work_location text,
  base_salary numeric,
  salary_currency text,
  probation_status text,
  background_check_status text,
  doc_verification_status text,
  reporting_manager_id uuid,
  reporting_hr_id uuid,
  job_id uuid,
  job_title text,
  docs_approved_count integer,
  docs_total_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT (public.has_role(_actor,'admin') OR public.has_role(_actor,'hr')) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    p.full_name,
    COALESCE(
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id=u.id
        ORDER BY CASE ur.role
          WHEN 'admin' THEN 1 WHEN 'hr' THEN 2 WHEN 'manager' THEN 3
          WHEN 'employee' THEN 4 WHEN 'user' THEN 5 ELSE 6 END LIMIT 1),
      'user'::app_role
    ),
    public.is_admin_user(u.id),
    e.department, e.designation, e.team_name, e.doj, e.employment_type,
    e.work_model, e.work_location, e.base_salary, COALESCE(e.salary_currency,'INR'),
    COALESCE(e.probation_status,'under_review'),
    COALESCE(e.background_check_status,'not_started'),
    COALESCE(e.doc_verification_status,'pending'),
    e.reporting_manager_id, e.reporting_hr_id,
    ja.role_id, ja.role_title,
    COALESCE((
      SELECT COUNT(*)::integer FROM public.onboarding_documents od
      WHERE od.onboarding_id = (SELECT obr.id FROM public.onboarding_records obr WHERE obr.user_id = u.id LIMIT 1)
        AND od.superseded_at IS NULL AND od.status = 'approved'
    ), 0),
    COALESCE((
      SELECT COUNT(*)::integer FROM public.onboarding_documents od
      WHERE od.onboarding_id = (SELECT obr.id FROM public.onboarding_records obr WHERE obr.user_id = u.id LIMIT 1)
        AND od.superseded_at IS NULL
    ), 0),
    u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id=u.id
  LEFT JOIN public.employees e ON e.user_id=u.id
  LEFT JOIN public.job_applications ja ON ja.user_id=u.id AND ja.status='hired'
  ORDER BY u.created_at DESC;
END; $$;
