
-- 1) Extend the app_role enum with 'employee'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'employee'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'employee';
  END IF;
END $$;

-- 2) employee_tasks
CREATE TABLE IF NOT EXISTS public.employee_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'to_do' CHECK (status IN ('to_do','in_progress','blocked','done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_tasks TO authenticated;
GRANT ALL ON public.employee_tasks TO service_role;
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_read_own_tasks" ON public.employee_tasks
  FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_insert_own_tasks" ON public.employee_tasks
  FOR INSERT TO authenticated
  WITH CHECK (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_update_own_tasks" ON public.employee_tasks
  FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "employees_delete_own_tasks" ON public.employee_tasks
  FOR DELETE TO authenticated
  USING (assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER employee_tasks_set_updated_at
BEFORE UPDATE ON public.employee_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_employee_tasks_assignee ON public.employee_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_employee_tasks_status ON public.employee_tasks(status);

-- 3) timesheets
CREATE TABLE IF NOT EXISTS public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  hours_logged numeric(4,2) NOT NULL CHECK (hours_logged >= 0 AND hours_logged <= 24),
  project_reference text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timesheets TO authenticated;
GRANT ALL ON public.timesheets TO service_role;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_read_own" ON public.timesheets
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "timesheets_insert_own" ON public.timesheets
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "timesheets_update_own" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "timesheets_delete_own" ON public.timesheets
  FOR DELETE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER timesheets_set_updated_at
BEFORE UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON public.timesheets(employee_id, date DESC);

-- 4) referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_name text NOT NULL,
  candidate_email text NOT NULL,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  referral_status text NOT NULL DEFAULT 'pending' CHECK (referral_status IN ('pending','interviewing','hired','rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_read_own" ON public.referrals
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "referrals_insert_own" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());
CREATE POLICY "referrals_update_admin" ON public.referrals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "referrals_delete_own_or_admin" ON public.referrals
  FOR DELETE TO authenticated
  USING (employee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER referrals_set_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_referrals_employee ON public.referrals(employee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_job_posting ON public.referrals(job_posting_id);
