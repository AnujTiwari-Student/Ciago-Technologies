
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

GRANT SELECT ON public.employment_types TO anon, authenticated;
GRANT ALL ON public.employment_types TO service_role;

GRANT SELECT ON public.status_options TO anon, authenticated;
GRANT ALL ON public.status_options TO service_role;
