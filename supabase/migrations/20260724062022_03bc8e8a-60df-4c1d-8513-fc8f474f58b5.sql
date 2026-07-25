
-- job_postings.required_onboarding_docs
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS required_onboarding_docs text[] NOT NULL DEFAULT ARRAY['aadhaar','pan','bank_details']::text[];

-- onboarding_records: DOJ, verification, step, feedback
ALTER TABLE public.onboarding_records
  ADD COLUMN IF NOT EXISTS doj date,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS current_step smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rejection_feedback text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- onboarding_documents
CREATE TABLE IF NOT EXISTS public.onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.onboarding_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  doc_key text NOT NULL,
  storage_path text NOT NULL,
  original_filename text,
  status text NOT NULL DEFAULT 'pending',
  feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (onboarding_id, doc_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_documents TO authenticated;
GRANT ALL ON public.onboarding_documents TO service_role;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own docs" ON public.onboarding_documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own docs" ON public.onboarding_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own docs while pending" ON public.onboarding_documents FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status IN ('pending','changes_requested')) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff read all docs" ON public.onboarding_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "Staff review docs" ON public.onboarding_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_onboarding_documents_updated
  BEFORE UPDATE ON public.onboarding_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- interview_slots
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL,
  proposed_by uuid NOT NULL,
  slot_at timestamptz NOT NULL,
  location text,
  notes text,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_slots TO authenticated;
GRANT ALL ON public.interview_slots TO service_role;
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidate reads own slots" ON public.interview_slots FOR SELECT TO authenticated USING (auth.uid() = candidate_user_id);
CREATE POLICY "Candidate selects a slot" ON public.interview_slots FOR UPDATE TO authenticated USING (auth.uid() = candidate_user_id) WITH CHECK (auth.uid() = candidate_user_id);
CREATE POLICY "Staff manages slots" ON public.interview_slots FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_interview_slots_updated
  BEFORE UPDATE ON public.interview_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type text NOT NULL DEFAULT 'pto',
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employees manage own leave" ON public.leave_requests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage all leave" ON public.leave_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE TRIGGER trg_leave_requests_updated
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- HR access on existing tables
CREATE POLICY "HR read all applications" ON public.job_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR update applications" ON public.job_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR manage postings" ON public.job_postings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read onboarding" ON public.onboarding_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR update onboarding" ON public.onboarding_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read referrals" ON public.referrals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read user_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));
CREATE POLICY "HR read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr'));

-- Storage RLS for onboarding-docs bucket
CREATE POLICY "Users upload own onboarding docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'onboarding-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own onboarding docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own onboarding docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'onboarding-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Staff read all onboarding docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'onboarding-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')));
