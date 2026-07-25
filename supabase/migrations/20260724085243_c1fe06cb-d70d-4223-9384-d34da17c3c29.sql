
-- 1) Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read departments" ON public.departments;
CREATE POLICY "Staff can read departments" ON public.departments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'hr')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
);

DROP POLICY IF EXISTS "Admins manage departments" ON public.departments;
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_departments_updated_at ON public.departments;
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.departments (name, code, description) VALUES
  ('Engineering', 'ENG', 'Product Engineering & Platform'),
  ('Human Resources', 'HR', 'People Operations'),
  ('Operations', 'OPS', 'Business & Delivery Operations')
ON CONFLICT (code) DO NOTHING;

-- 2) Attach department to role assignments
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_roles_department_idx ON public.user_roles(department_id);

-- 3) Job posting track type + department
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_track_type') THEN
    CREATE TYPE public.job_track_type AS ENUM ('standard', 'manager_track', 'hr_track');
  END IF;
END $$;

ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS track_type public.job_track_type NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- 4) Admin-only promotion function
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  _target_user_id uuid,
  _new_role public.app_role,
  _department_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles' USING ERRCODE = '42501';
  END IF;
  IF _new_role NOT IN ('employee','manager','hr','admin') THEN
    RAISE EXCEPTION 'Unsupported role %', _new_role USING ERRCODE = '22023';
  END IF;

  -- Remove existing staff roles for this user (keeps 'user' baseline outside user_roles table).
  DELETE FROM public.user_roles
    WHERE user_id = _target_user_id
      AND role IN ('employee','manager','hr','admin');

  INSERT INTO public.user_roles (user_id, role, department_id)
  VALUES (_target_user_id, _new_role, _department_id)
  ON CONFLICT (user_id, role) DO UPDATE SET department_id = EXCLUDED.department_id;

  INSERT INTO public.audit_logs (actor_id, action, target_resource, details)
  VALUES (
    _actor,
    'role.updated',
    _target_user_id::text,
    jsonb_build_object('new_role', _new_role, 'department_id', _department_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role, uuid) TO authenticated;
