-- Migration: Enhance onboarding emergency contact with structured fields
-- Created: 2026-08-01
-- This migration doesn't alter the schema but documents the expected JSON structure
-- for the emergency_contact JSONB column in onboarding_records table.
--
-- Expected structure:
-- {
--   "name": "Full Name",
--   "relationship": "Father|Mother|Spouse|Sibling|Son|Daughter|Guardian|Friend|Other",
--   "phone": "+91 1234567890",
--   "alternate_phone": "+91 9876543210",  -- optional
--   "email": "emergency@example.com",      -- optional
--   "address": "Full address of emergency contact"  -- optional
-- }
--
-- No schema changes needed as the column already supports JSONB.
-- This is a documentation migration to ensure frontend and backend consistency.

-- Verify the column exists and is JSONB type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'onboarding_records'
      AND column_name = 'emergency_contact'
      AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'emergency_contact column does not exist or is not JSONB type';
  END IF;
END $$;

-- Add a comment documenting the expected structure
COMMENT ON COLUMN onboarding_records.emergency_contact IS
'Emergency contact details as JSONB. Expected keys: name (required), relationship (required, enum), phone (required), alternate_phone (optional), email (optional), address (optional)';
