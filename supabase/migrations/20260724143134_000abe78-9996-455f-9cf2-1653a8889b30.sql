
-- Seed departments
INSERT INTO public.departments (name, code, description) VALUES
  ('Engineering','ENG','Product Engineering & Platform'),
  ('Operations','OPS','Business & Delivery Operations'),
  ('Human Resources','HR','People Operations'),
  ('Management','MGMT','Leadership & Strategy'),
  ('Product','PROD','Product Management'),
  ('Design','DES','Design & UX'),
  ('Finance','FIN','Finance & Accounting'),
  ('Sales','SALES','Sales & Growth'),
  ('Marketing','MKT','Marketing & Brand'),
  ('Customer Support','CS','Customer Support'),
  ('Legal','LEGAL','Legal & Compliance'),
  ('IT Infrastructure','IT','IT & Infrastructure')
ON CONFLICT (name) DO NOTHING;

-- Employment types lookup
CREATE TABLE IF NOT EXISTS public.employment_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.employment_types TO anon, authenticated;
GRANT ALL ON public.employment_types TO service_role;
ALTER TABLE public.employment_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read employment types" ON public.employment_types;
CREATE POLICY "Public read employment types" ON public.employment_types
  FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.employment_types(code,label,sort_order) VALUES
  ('full_time','Full-time',1),
  ('part_time','Part-time',2),
  ('internship','Internship',3),
  ('apprenticeship','Apprenticeship',4),
  ('contractor','Contractor',5)
ON CONFLICT (code) DO NOTHING;

-- Job posting status enum migration
DROP POLICY IF EXISTS "Public reads active postings" ON public.job_postings;
ALTER TYPE public.job_posting_status RENAME TO job_posting_status_old;
CREATE TYPE public.job_posting_status AS ENUM ('draft','published','internal_only','closed','archived');
ALTER TABLE public.job_postings ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.job_postings
  ALTER COLUMN status TYPE public.job_posting_status USING (
    CASE status::text
      WHEN 'active' THEN 'published'
      WHEN 'paused' THEN 'draft'
      WHEN 'closed' THEN 'closed'
      ELSE 'draft'
    END
  )::public.job_posting_status;
ALTER TABLE public.job_postings
  ALTER COLUMN status SET DEFAULT 'draft'::public.job_posting_status;
DROP TYPE public.job_posting_status_old;
CREATE POLICY "Public reads published postings" ON public.job_postings
  FOR SELECT TO anon, authenticated
  USING (status = 'published'::public.job_posting_status);

-- Job application status migration
ALTER TABLE public.job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;
UPDATE public.job_applications SET status = CASE status
  WHEN 'in_queue' THEN 'applied'
  WHEN 'under_review' THEN 'screening'
  WHEN 'offer_extended' THEN 'offered'
  WHEN 'rejected' THEN 'rejected'
  ELSE 'applied'
END;
ALTER TABLE public.job_applications ALTER COLUMN status SET DEFAULT 'applied';
ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('applied','screening','interviewing','offered','hired','rejected'));

-- Employees account_status
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_account_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_account_status_check
  CHECK (account_status IN ('active','inactive','suspended'));
