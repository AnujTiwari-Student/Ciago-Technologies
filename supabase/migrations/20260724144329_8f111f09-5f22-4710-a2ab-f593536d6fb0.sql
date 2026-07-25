
CREATE TABLE IF NOT EXISTS public.status_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('job_posting','application','user_account')),
  code text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, code)
);

GRANT SELECT ON public.status_options TO anon, authenticated;
GRANT ALL ON public.status_options TO service_role;

ALTER TABLE public.status_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_options readable by everyone"
  ON public.status_options FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.status_options (kind, code, label, description, sort_order) VALUES
  ('job_posting','draft','Draft','Not visible to candidates',10),
  ('job_posting','published','Published','Visible on public careers page',20),
  ('job_posting','internal_only','Internal only','Visible to employees on internal mobility',30),
  ('job_posting','closed','Closed','No longer accepting applications',40),
  ('job_posting','archived','Archived','Hidden from all listings',50),

  ('application','applied','Applied','Candidate has submitted an application',10),
  ('application','screening','Screening','Recruiter reviewing profile',20),
  ('application','interviewing','Interviewing','Interviews in progress',30),
  ('application','offered','Offered','Offer extended to candidate',40),
  ('application','hired','Hired','Candidate accepted and onboarded',50),
  ('application','rejected','Rejected','Application not moving forward',60),

  ('user_account','active','Active','Account can sign in and use the app',10),
  ('user_account','inactive','Inactive','Account temporarily disabled',20),
  ('user_account','suspended','Suspended','Account suspended by administrator',30)
ON CONFLICT (kind, code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
