-- Create service_account_mappings table for tracking provisioned accounts

CREATE TABLE service_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
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

CREATE INDEX idx_service_mappings_employee_id ON service_account_mappings(employee_id);
CREATE INDEX idx_service_mappings_status ON service_account_mappings(status);

-- Enable RLS
ALTER TABLE service_account_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all mappings
CREATE POLICY "service_mappings_admin_all" ON service_account_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Users can view their own mapping (read-only)
CREATE POLICY "service_mappings_self_read" ON service_account_mappings FOR SELECT TO authenticated
  USING (employee_id = auth.uid());
