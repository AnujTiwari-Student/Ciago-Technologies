-- Create service_account_mappings table for tracking provisioned accounts

CREATE TABLE IF NOT EXISTS public.service_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  github_username text,
  teams_email text,
  clickup_username text,
  orangehrm_user_id integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'failed')),
  provisioned_at timestamptz,
  deprovisioned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraint if employees table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    ALTER TABLE public.service_account_mappings
      ADD CONSTRAINT fk_service_mappings_employee
      FOREIGN KEY (employee_id) REFERENCES public.employees(user_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_mappings_employee_id ON public.service_account_mappings(employee_id);
CREATE INDEX IF NOT EXISTS idx_service_mappings_status ON public.service_account_mappings(status);

-- Enable RLS
ALTER TABLE IF EXISTS public.service_account_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all mappings (only create if auth schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'auth')
     AND EXISTS (SELECT FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth'))
     AND EXISTS (SELECT FROM pg_proc WHERE proname = 'has_role' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN

    BEGIN
      CREATE POLICY "service_mappings_admin_all" ON public.service_account_mappings FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;

    -- Policy: Users can view their own mapping (read-only)
    BEGIN
      CREATE POLICY "service_mappings_self_read" ON public.service_account_mappings FOR SELECT TO authenticated
        USING (employee_id = auth.uid());
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;

  END IF;
END $$;
