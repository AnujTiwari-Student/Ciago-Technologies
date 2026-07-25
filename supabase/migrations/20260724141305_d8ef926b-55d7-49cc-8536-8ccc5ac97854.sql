
-- 1. dept_type enum
DO $$ BEGIN
  CREATE TYPE public.dept_type AS ENUM (
    'engineering','operations','human_resource','management','product','design',
    'finance','sales','marketing','customer_support','legal','it_infrastructure'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. employees (unified record; one row per user)
CREATE TABLE IF NOT EXISTS public.employees (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  work_email text,
  personal_email text,
  contact_number text,
  address text,
  department public.dept_type,
  team_name text,
  designation text,
  reporting_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporting_hr_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  doj date,
  employment_type text CHECK (employment_type IN ('full_time','part_time','contractor','intern','probation')),
  base_salary numeric(14,2),
  salary_currency text NOT NULL DEFAULT 'INR',
  work_model text CHECK (work_model IN ('onsite','remote','hybrid')),
  work_location text,
  probation_months smallint CHECK (probation_months IS NULL OR probation_months BETWEEN 0 AND 24),
  probation_status text NOT NULL DEFAULT 'under_review' CHECK (probation_status IN ('under_review','confirmed','extended')),
  background_check_status text NOT NULL DEFAULT 'not_started' CHECK (background_check_status IN ('not_started','in_progress','cleared','flagged')),
  doc_verification_status text NOT NULL DEFAULT 'pending' CHECK (doc_verification_status IN ('pending','verified','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Helper: is a target user an admin?
CREATE OR REPLACE FUNCTION public.is_admin_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;

-- Policies: employees
CREATE POLICY "employees_self_read" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "employees_manager_read" ON public.employees FOR SELECT TO authenticated
  USING (reporting_manager_id = auth.uid() OR reporting_hr_id = auth.uid());
CREATE POLICY "employees_admin_all" ON public.employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_hr_read_non_admin" ON public.employees FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE POLICY "employees_hr_write_non_admin" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE POLICY "employees_hr_update_non_admin" ON public.employees FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id))
  WITH CHECK (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_employees_dept ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_hr ON public.employees(reporting_hr_id);

-- 3. identity_documents
CREATE TABLE IF NOT EXISTS public.identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('pan','aadhaar','passport')),
  doc_number text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  feedback text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_documents TO authenticated;
GRANT ALL ON public.identity_documents TO service_role;
ALTER TABLE public.identity_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idoc_self_rw" ON public.identity_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "idoc_admin_all" ON public.identity_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "idoc_hr_read" ON public.identity_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));
CREATE POLICY "idoc_hr_update" ON public.identity_documents FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id))
  WITH CHECK (public.has_role(auth.uid(),'hr') AND NOT public.is_admin_user(user_id));

CREATE TRIGGER trg_idoc_updated_at BEFORE UPDATE ON public.identity_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Guard: prevent HR from managing admin roles via user_roles table
-- Existing user_roles policies allow admins full control; we add a hard block for HR touching admin.
CREATE OR REPLACE FUNCTION public.prevent_hr_admin_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN RETURN NEW; END IF; -- backend/service_role
  IF public.has_role(_actor,'admin') THEN RETURN COALESCE(NEW, OLD); END IF;
  IF public.has_role(_actor,'hr') THEN
    IF (TG_OP='INSERT' AND NEW.role='admin')
       OR (TG_OP='UPDATE' AND (NEW.role='admin' OR OLD.role='admin'))
       OR (TG_OP='DELETE' AND OLD.role='admin') THEN
      RAISE EXCEPTION 'HR users cannot modify System Admin accounts' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_hr_admin_role_change ON public.user_roles;
CREATE TRIGGER trg_prevent_hr_admin_role_change
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_hr_admin_role_change();

-- 5. Directory RPC: aggregated list of all users for the User Management dashboard
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
    e.reporting_manager_id, e.reporting_hr_id, u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id=u.id
  LEFT JOIN public.employees e ON e.user_id=u.id
  ORDER BY u.created_at DESC;
END; $$;

GRANT EXECUTE ON FUNCTION public.list_directory() TO authenticated;
