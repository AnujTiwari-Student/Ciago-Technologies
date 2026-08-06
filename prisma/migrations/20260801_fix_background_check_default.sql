-- Migration: Fix background_check_status default value
-- Issue: Default was "pending" but constraint only allows: not_started, in_progress, cleared, flagged
-- Date: 2026-08-01

-- Change default from "pending" to "not_started" to match the constraint
ALTER TABLE IF EXISTS public.employees
  ALTER COLUMN background_check_status SET DEFAULT 'not_started';

-- Update any existing rows that might have "pending" (if any exist)
UPDATE public.employees
SET background_check_status = 'not_started'
WHERE background_check_status = 'pending';

-- Verify the change
COMMENT ON COLUMN public.employees.background_check_status IS
  'Background check status. Valid values: not_started, in_progress, cleared, flagged. Default: not_started';
