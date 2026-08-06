-- Add orangehrm_employee_id to employees table

ALTER TABLE IF EXISTS public.employees ADD COLUMN IF NOT EXISTS orangehrm_employee_id integer;
