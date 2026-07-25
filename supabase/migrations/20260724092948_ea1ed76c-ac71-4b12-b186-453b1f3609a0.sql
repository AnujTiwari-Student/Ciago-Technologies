
-- Slice 4: internal mobility flag + resignations

ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS internal_only BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.resignations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_on DATE NOT NULL DEFAULT CURRENT_DATE,
  last_working_day DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.resignations TO authenticated;
GRANT ALL ON public.resignations TO service_role;

ALTER TABLE public.resignations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees manage own resignation" ON public.resignations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "HR admin manager can view resignations" ON public.resignations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "HR admin can decide resignations" ON public.resignations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE TRIGGER trg_resignations_updated_at
  BEFORE UPDATE ON public.resignations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_resignations_user ON public.resignations(user_id);
CREATE INDEX IF NOT EXISTS idx_resignations_status ON public.resignations(status);
