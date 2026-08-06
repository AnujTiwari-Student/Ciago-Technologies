-- Phase 1: Database Schema Foundation for OrangeHRM Full Lifecycle Integration
-- Version: 2.1 (Updated with Phase 0 verification results)
-- Date: 2026-08-01
--
-- CRITICAL: OrangeHRM Community v5.7 does NOT support DELETE employee API (405 Method Not Allowed)
-- Solution: Use TERMINATE employee API (200 OK verified)
-- Therefore: All "deletion" references replaced with "termination" terminology
--
-- Safety: This migration adds new tables and columns. Existing data is preserved.
-- Rollback: See rollback section at end of file.

-- =============================================================================
-- ENUMS
-- =============================================================================

-- OrangeHRM Record Status
-- Tracks the lifecycle of an OrangeHRM employee record
CREATE TYPE orangehrm_record_status AS ENUM (
  'ACTIVE',                    -- Employee is active in OrangeHRM
  'TERMINATED',                -- Employee terminated via termination API
  'RETENTION',                 -- Terminated employee retained as historical record
  'MANUAL_DELETION_REQUIRED',  -- Requires manual deletion via OrangeHRM UI
  'DELETED',                   -- Manually deleted via OrangeHRM UI (confirmed)
  'UNKNOWN'                    -- Status cannot be determined
);

-- OrangeHRM Termination Reasons
-- Distinguishes pre-hire rejection from employment termination
CREATE TYPE orangehrm_termination_reason AS ENUM (
  'PRE_HIRE_REJECTION',        -- Application rejected before employment
  'EMPLOYEE_RESIGNATION',      -- Employee resigned
  'ADMIN_TERMINATION',         -- Admin/HR terminated employment
  'CONTRACT_END',              -- Fixed-term contract ended
  'OFFBOARDING',               -- General offboarding process
  'OTHER'                      -- Other reason
);

-- ESS Account Status
-- Separate from employee record - tracks OrangeHRM system user
CREATE TYPE ess_account_status AS ENUM (
  'not_provisioned',           -- ESS not yet created
  'provisioning',              -- ESS creation in progress
  'setup_pending',             -- ESS created, awaiting password setup
  'needs_manual_password_setup', -- Password API not verified - manual setup required
  'active',                    -- ESS active and password set
  'disabled',                  -- ESS disabled (e.g. during offboarding)
  'failed',                    -- ESS provisioning failed
  'unknown'                    -- Status cannot be determined
);

-- OrangeHRM Provisioning State
-- Tracks the provisioning process for OrangeHRM employee creation
CREATE TYPE orangehrm_provisioning_state AS ENUM (
  'not_started',
  'pending',
  'processing',
  'succeeded',
  'failed',
  'needs_manual_review'
);

-- Offboarding Status
CREATE TYPE offboarding_status AS ENUM (
  'initiated',
  'exit_processing',
  'access_revocation',
  'offboarded',
  'purged'
);

-- Offboarding Reason
CREATE TYPE offboarding_reason AS ENUM (
  'resignation',
  'termination',
  'contract_end',
  'other'
);

-- External Provider Type
CREATE TYPE external_provider AS ENUM (
  'clickup',
  'microsoft_teams',
  'github'
);

-- External Access Provision Status
CREATE TYPE external_access_status AS ENUM (
  'pending',
  'invited',
  'active',
  'failed',
  'needs_manual_review'
);

-- Integration Event Status
CREATE TYPE integration_event_status AS ENUM (
  'pending',
  'claimed',
  'processing',
  'succeeded',
  'failed'
);

-- Background Verification Status
CREATE TYPE background_verification_status AS ENUM (
  'not_started',
  'pending',
  'passed',
  'failed',
  'waived'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Setup Tokens (Phase 5)
-- -----------------------------------------------------------------------------
-- One-time secure tokens for ESS password setup
-- Token is NEVER stored in plaintext - only SHA-256 hash
CREATE TABLE setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  application_id UUID NOT NULL,  -- References job_applications(id)
  user_id UUID NOT NULL,         -- References auth.users(id)

  -- Token data (NEVER store plaintext token)
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of token

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  used_from_ip TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys
  -- AUDIT REQUIREMENT: Use RESTRICT to preserve setup token history even if application is deleted
  -- Setup tokens contain security audit trail (when issued, when used, from what IP)
  CONSTRAINT setup_tokens_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE RESTRICT
);

CREATE INDEX idx_setup_tokens_application_id ON setup_tokens(application_id);
CREATE INDEX idx_setup_tokens_user_id ON setup_tokens(user_id);
CREATE INDEX idx_setup_tokens_status ON setup_tokens(status);
CREATE INDEX idx_setup_tokens_expires_at ON setup_tokens(expires_at);

-- Ensure only one active (unused) token per application
-- NOTE: PostgreSQL partial indexes require IMMUTABLE predicates. now() is VOLATILE and cannot be used.
-- Solution: Enforce uniqueness on status='unused' only. Application logic must:
--   1. Check expiry BEFORE token consumption
--   2. Atomically transition expired tokens to 'expired' status
--   3. Atomically transition used tokens to 'used' status
-- This ensures only ONE 'unused' token exists per application at any time.
CREATE UNIQUE INDEX idx_setup_tokens_one_active_per_application
  ON setup_tokens(application_id)
  WHERE status = 'unused';

COMMENT ON TABLE setup_tokens IS 'One-time secure tokens for ESS password setup. Token is stored as SHA-256 hash only.';
COMMENT ON COLUMN setup_tokens.token_hash IS 'SHA-256 hash of the token. Never store plaintext token.';

-- -----------------------------------------------------------------------------
-- Integration Events (Phase 2+)
-- -----------------------------------------------------------------------------
-- Idempotent event processing with claiming pattern
CREATE TABLE integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_type TEXT NOT NULL,  -- e.g. 'orangehrm_employee_provision', 'rejection_cleanup', etc.
  idempotency_key TEXT NOT NULL UNIQUE,
  correlation_id TEXT,

  -- Target entity
  entity_type TEXT NOT NULL,  -- e.g. 'job_application', 'employee'
  entity_id UUID NOT NULL,

  -- Event claiming (for race condition protection)
  status integration_event_status NOT NULL DEFAULT 'pending',
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,  -- Worker/process ID
  processing_started_at TIMESTAMPTZ,

  -- Completion
  completed_at TIMESTAMPTZ,
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Retry tracking
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,

  -- Result data
  result_data JSONB,
  error_message TEXT,
  error_code TEXT,

  -- Metadata
  source TEXT,  -- e.g. 'webhook', 'manual', 'scheduled'
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_events_entity ON integration_events(entity_type, entity_id);
CREATE INDEX idx_integration_events_status ON integration_events(status);
CREATE INDEX idx_integration_events_event_type ON integration_events(event_type);
CREATE INDEX idx_integration_events_claimed_at ON integration_events(claimed_at);
CREATE INDEX idx_integration_events_next_retry_at ON integration_events(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE integration_events IS 'Idempotent event processing with claiming pattern for race condition protection.';

-- -----------------------------------------------------------------------------
-- Background Verifications (Phase 4)
-- -----------------------------------------------------------------------------
-- Manual background verification tracking (no automated provider)
CREATE TABLE background_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  application_id UUID NOT NULL UNIQUE,  -- One verification per application
  user_id UUID NOT NULL,

  -- Verification data
  status background_verification_status NOT NULL DEFAULT 'not_started',
  result TEXT,  -- 'passed', 'failed', 'waived'
  waive_reason TEXT,  -- Required if result = 'waived'
  notes TEXT,

  -- Verification metadata
  verified_by UUID,  -- Admin who performed verification
  verified_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- AUDIT REQUIREMENT: Use RESTRICT to preserve background verification history even if application is deleted
  -- Background verifications contain compliance records (who verified, when, what decision)
  CONSTRAINT background_verifications_application_id_fkey FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE RESTRICT
);

CREATE INDEX idx_background_verifications_application_id ON background_verifications(application_id);
CREATE INDEX idx_background_verifications_user_id ON background_verifications(user_id);
CREATE INDEX idx_background_verifications_status ON background_verifications(status);

COMMENT ON TABLE background_verifications IS 'Manual background verification tracking. No automated background check provider.';

-- -----------------------------------------------------------------------------
-- Offboarding Records (Phase 7 & 8)
-- -----------------------------------------------------------------------------
-- Offboarding lifecycle tracking
CREATE TABLE offboarding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  employee_id UUID NOT NULL,  -- References employees(user_id)
  user_id UUID NOT NULL,
  resignation_id UUID,  -- References resignations(id) if applicable

  -- Offboarding details
  reason offboarding_reason NOT NULL,
  status offboarding_status NOT NULL DEFAULT 'initiated',
  initiated_by UUID,  -- Admin who initiated (if not resignation)
  last_working_day DATE,

  -- Timestamps
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_processing_started_at TIMESTAMPTZ,
  access_revocation_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Purge tracking
  purge_eligible_at TIMESTAMPTZ,  -- Explicit: completed_at + 30 days
  purged_at TIMESTAMPTZ,

  -- Legal/compliance
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  legal_hold_reason TEXT,
  legal_hold_set_by UUID,
  legal_hold_set_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_offboarding_records_employee_id ON offboarding_records(employee_id);
CREATE INDEX idx_offboarding_records_user_id ON offboarding_records(user_id);
CREATE INDEX idx_offboarding_records_status ON offboarding_records(status);
CREATE INDEX idx_offboarding_records_purge_eligible ON offboarding_records(purge_eligible_at) WHERE status = 'offboarded' AND legal_hold = false;

COMMENT ON TABLE offboarding_records IS 'Offboarding lifecycle tracking with 30-day retention and purge eligibility.';
COMMENT ON COLUMN offboarding_records.purge_eligible_at IS 'Explicit timestamp: completed_at + 30 days. Not calculated at query time.';

-- -----------------------------------------------------------------------------
-- Offboarding Tasks (Phase 7)
-- -----------------------------------------------------------------------------
-- Granular offboarding task tracking
CREATE TABLE offboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  offboarding_id UUID NOT NULL,

  -- Task details
  task_type TEXT NOT NULL,  -- e.g. 'disable_ess', 'revoke_clickup', 'terminate_orangehrm'
  task_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),

  -- Execution
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Result
  result_data JSONB,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT offboarding_tasks_offboarding_id_fkey FOREIGN KEY (offboarding_id) REFERENCES offboarding_records(id) ON DELETE CASCADE
);

CREATE INDEX idx_offboarding_tasks_offboarding_id ON offboarding_tasks(offboarding_id);
CREATE INDEX idx_offboarding_tasks_status ON offboarding_tasks(status);
CREATE INDEX idx_offboarding_tasks_task_type ON offboarding_tasks(task_type);

COMMENT ON TABLE offboarding_tasks IS 'Granular task tracking for offboarding process.';

-- -----------------------------------------------------------------------------
-- External Access Provisions (Phase 9)
-- -----------------------------------------------------------------------------
-- External provider access provisioning (ClickUp, Teams, GitHub)
CREATE TABLE external_access_provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  employee_id UUID NOT NULL,  -- References employees(user_id)
  user_id UUID NOT NULL,

  -- Provider details
  provider external_provider NOT NULL,
  status external_access_status NOT NULL DEFAULT 'pending',

  -- External identities
  external_user_id TEXT,  -- Provider's user ID
  invitation_id TEXT,     -- Provider's invitation ID

  -- Provisioning metadata
  correlation_id TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Provider-specific configuration
  provider_config JSONB,  -- e.g. {"team_id": "...", "role": "..."}

  -- Completion
  provisioned_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  error_code TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_access_provisions_employee_id ON external_access_provisions(employee_id);
CREATE INDEX idx_external_access_provisions_user_id ON external_access_provisions(user_id);
CREATE INDEX idx_external_access_provisions_provider ON external_access_provisions(provider);
CREATE INDEX idx_external_access_provisions_status ON external_access_provisions(status);

-- Ensure one active provision per employee per provider
CREATE UNIQUE INDEX idx_external_access_provisions_one_per_employee_provider
  ON external_access_provisions(employee_id, provider)
  WHERE status IN ('pending', 'invited', 'active');

COMMENT ON TABLE external_access_provisions IS 'External provider access provisioning. Each provider is independently retryable.';

-- -----------------------------------------------------------------------------
-- External Access Revocation Events (Phase 7 & 9)
-- -----------------------------------------------------------------------------
-- Decouples offboarding (Phase 7) from provider implementations (Phase 9)
CREATE TABLE external_access_revocation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  offboarding_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  user_id UUID NOT NULL,

  -- Provider details
  provider external_provider NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),

  -- External identities
  external_user_id TEXT,

  -- Execution
  attempt_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Completion
  revoked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  error_code TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- AUDIT REQUIREMENT: Use RESTRICT to preserve revocation event history even if offboarding record is deleted
  -- Revocation events contain security audit trail (when revoked, which provider, success/failure)
  CONSTRAINT external_access_revocation_events_offboarding_id_fkey FOREIGN KEY (offboarding_id) REFERENCES offboarding_records(id) ON DELETE RESTRICT
);

CREATE INDEX idx_external_access_revocation_events_offboarding_id ON external_access_revocation_events(offboarding_id);
CREATE INDEX idx_external_access_revocation_events_employee_id ON external_access_revocation_events(employee_id);
CREATE INDEX idx_external_access_revocation_events_provider ON external_access_revocation_events(provider);
CREATE INDEX idx_external_access_revocation_events_status ON external_access_revocation_events(status);

COMMENT ON TABLE external_access_revocation_events IS 'Decouples offboarding from provider revocation implementations. Phase 7 creates events, Phase 9 processes them.';

-- -----------------------------------------------------------------------------
-- Access Role Mappings (Phase 9)
-- -----------------------------------------------------------------------------
-- Maps Ciago roles to external provider roles
CREATE TABLE access_role_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Mapping
  role_name TEXT NOT NULL,  -- Ciago role/designation
  provider external_provider NOT NULL,
  provider_role TEXT NOT NULL,  -- Provider-specific role identifier

  -- Metadata
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT access_role_mappings_unique UNIQUE (role_name, provider)
);

CREATE INDEX idx_access_role_mappings_role_name ON access_role_mappings(role_name);
CREATE INDEX idx_access_role_mappings_provider ON access_role_mappings(provider);

COMMENT ON TABLE access_role_mappings IS 'Maps Ciago roles/designations to external provider roles.';

-- =============================================================================
-- ALTER EXISTING TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- job_applications table
-- -----------------------------------------------------------------------------
-- Add OrangeHRM lifecycle tracking fields

ALTER TABLE IF EXISTS public.job_applications
  ADD COLUMN IF NOT EXISTS orangehrm_employee_id INT,
  ADD COLUMN IF NOT EXISTS orangehrm_provisioning_state orangehrm_provisioning_state NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS orangehrm_provisioning_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS orangehrm_provisioning_succeeded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS orangehrm_record_status orangehrm_record_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS orangehrm_terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS orangehrm_termination_reason orangehrm_termination_reason,
  ADD COLUMN IF NOT EXISTS lifecycle_version INT NOT NULL DEFAULT 1;

-- UNIQUE constraint: one OrangeHRM employee cannot be mapped to multiple ACTIVE applications
-- Terminated/rejected employees retain mapping for audit trail
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_orangehrm_employee_active
  ON public.job_applications(orangehrm_employee_id)
  WHERE orangehrm_employee_id IS NOT NULL AND orangehrm_record_status = 'ACTIVE';

-- Index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_job_applications_orangehrm_employee_id ON public.job_applications(orangehrm_employee_id)
  WHERE orangehrm_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_applications_orangehrm_record_status ON public.job_applications(orangehrm_record_status);
CREATE INDEX IF NOT EXISTS idx_job_applications_lifecycle_version ON public.job_applications(lifecycle_version);

COMMENT ON COLUMN public.job_applications.orangehrm_employee_id IS 'OrangeHRM employee ID (empNumber). Preserved even after termination for audit trail.';
COMMENT ON COLUMN public.job_applications.orangehrm_record_status IS 'OrangeHRM record lifecycle status. TERMINATED means employee was terminated via termination API (NOT deleted - DELETE API unsupported).';
COMMENT ON COLUMN public.job_applications.orangehrm_terminated_at IS 'Timestamp when OrangeHRM employee was terminated. Replaces orangehrm_deleted_at (DELETE API unsupported).';
COMMENT ON COLUMN public.job_applications.orangehrm_termination_reason IS 'Reason for termination. PRE_HIRE_REJECTION for rejected candidates, distinct from employment termination.';
COMMENT ON COLUMN public.job_applications.lifecycle_version IS 'Optimistic concurrency control version. Increment on each lifecycle state transition.';

-- -----------------------------------------------------------------------------
-- employees table
-- -----------------------------------------------------------------------------
-- Add ESS, OrangeHRM termination, and offboarding tracking fields

ALTER TABLE IF EXISTS public.employees
  ADD COLUMN IF NOT EXISTS orangehrm_system_user_id INT,
  ADD COLUMN IF NOT EXISTS ess_account_status ess_account_status NOT NULL DEFAULT 'not_provisioned',
  ADD COLUMN IF NOT EXISTS orangehrm_record_status orangehrm_record_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS orangehrm_terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS orangehrm_termination_reason orangehrm_termination_reason,
  ADD COLUMN IF NOT EXISTS offboarding_status offboarding_status,
  ADD COLUMN IF NOT EXISTS offboarding_initiated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_working_day DATE,
  ADD COLUMN IF NOT EXISTS offboarding_reason offboarding_reason;

-- UNIQUE constraints: canonical 1:1 mappings
-- Only ACTIVE employees enforce uniqueness - terminated employees retain mapping for audit
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_orangehrm_employee_active
  ON public.employees(orangehrm_employee_id)
  WHERE orangehrm_employee_id IS NOT NULL AND orangehrm_record_status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_orangehrm_system_user
  ON public.employees(orangehrm_system_user_id)
  WHERE orangehrm_system_user_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_orangehrm_employee_id ON public.employees(orangehrm_employee_id)
  WHERE orangehrm_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_ess_account_status ON public.employees(ess_account_status);
CREATE INDEX IF NOT EXISTS idx_employees_orangehrm_record_status ON public.employees(orangehrm_record_status);
CREATE INDEX IF NOT EXISTS idx_employees_offboarding_status ON public.employees(offboarding_status);

COMMENT ON COLUMN public.employees.orangehrm_system_user_id IS 'OrangeHRM system user ID (ESS). Separate from orangehrm_employee_id. Employee record ≠ System user.';
COMMENT ON COLUMN public.employees.ess_account_status IS 'ESS/System user lifecycle status. Separate from employee record.';
COMMENT ON COLUMN public.employees.orangehrm_record_status IS 'OrangeHRM employee record lifecycle status. TERMINATED means employee was terminated via termination API (NOT deleted - DELETE API unsupported).';
COMMENT ON COLUMN public.employees.orangehrm_terminated_at IS 'Timestamp when OrangeHRM employee was terminated during offboarding.';
COMMENT ON COLUMN public.employees.orangehrm_termination_reason IS 'Reason for employment termination. Distinct from PRE_HIRE_REJECTION (which is on job_applications).';

-- =============================================================================
-- DATA VALIDATION
-- =============================================================================

-- Check for existing duplicate orangehrm_employee_id on job_applications
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT orangehrm_employee_id, COUNT(*) as cnt
    FROM job_applications
    WHERE orangehrm_employee_id IS NOT NULL
    GROUP BY orangehrm_employee_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate orangehrm_employee_id values in job_applications. Manual remediation required before unique constraint can be safely applied.', duplicate_count;
    -- Note: Unique constraint with WHERE clause added above will not fail if duplicates exist
    -- because constraint only applies to orangehrm_record_status = 'ACTIVE'
  END IF;
END $$;

-- Check for existing duplicate orangehrm_employee_id on employees
DO $$
DECLARE
  duplicate_count INT;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT orangehrm_employee_id, COUNT(*) as cnt
    FROM employees
    WHERE orangehrm_employee_id IS NOT NULL
    GROUP BY orangehrm_employee_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate orangehrm_employee_id values in employees. Manual remediation required before unique constraint can be safely applied.', duplicate_count;
    -- Note: Unique constraint with WHERE clause added above will not fail if duplicates exist
    -- because constraint only applies to orangehrm_record_status = 'ACTIVE'
  END IF;
END $$;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Update schema version tracking (if exists)
-- This is a placeholder - adjust based on project's version tracking approach

COMMENT ON SCHEMA public IS 'Phase 1 migration complete: OrangeHRM lifecycle foundation v2.1 - includes Phase 0 verification results (termination API, not deletion API)';

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================
-- To rollback this migration, execute the following SQL:
--
-- -- Drop new tables (in reverse order of creation)
-- DROP TABLE IF EXISTS access_role_mappings CASCADE;
-- DROP TABLE IF EXISTS external_access_revocation_events CASCADE;
-- DROP TABLE IF EXISTS external_access_provisions CASCADE;
-- DROP TABLE IF EXISTS offboarding_tasks CASCADE;
-- DROP TABLE IF EXISTS offboarding_records CASCADE;
-- DROP TABLE IF EXISTS background_verifications CASCADE;
-- DROP TABLE IF EXISTS integration_events CASCADE;
-- DROP TABLE IF EXISTS setup_tokens CASCADE;
--
-- -- Revert job_applications table
-- DROP INDEX IF EXISTS idx_job_applications_lifecycle_version;
-- DROP INDEX IF EXISTS idx_job_applications_orangehrm_record_status;
-- DROP INDEX IF EXISTS idx_job_applications_orangehrm_employee_id;
-- DROP INDEX IF EXISTS idx_job_applications_orangehrm_employee_active;
-- ALTER TABLE job_applications
--   DROP COLUMN IF EXISTS lifecycle_version,
--   DROP COLUMN IF EXISTS orangehrm_termination_reason,
--   DROP COLUMN IF EXISTS orangehrm_terminated_at,
--   DROP COLUMN IF EXISTS orangehrm_record_status,
--   DROP COLUMN IF EXISTS orangehrm_provisioning_succeeded_at,
--   DROP COLUMN IF EXISTS orangehrm_provisioning_attempted_at,
--   DROP COLUMN IF EXISTS orangehrm_provisioning_state,
--   DROP COLUMN IF EXISTS orangehrm_employee_id;
--
-- -- Revert employees table
-- DROP INDEX IF EXISTS idx_employees_offboarding_status;
-- DROP INDEX IF EXISTS idx_employees_orangehrm_record_status;
-- DROP INDEX IF EXISTS idx_employees_ess_account_status;
-- DROP INDEX IF EXISTS idx_employees_orangehrm_employee_id;
-- DROP INDEX IF EXISTS idx_employees_orangehrm_system_user;
-- DROP INDEX IF EXISTS idx_employees_orangehrm_employee_active;
-- ALTER TABLE employees
--   DROP COLUMN IF EXISTS offboarding_reason,
--   DROP COLUMN IF EXISTS last_working_day,
--   DROP COLUMN IF EXISTS offboarding_completed_at,
--   DROP COLUMN IF EXISTS offboarding_initiated_at,
--   DROP COLUMN IF EXISTS offboarding_status,
--   DROP COLUMN IF EXISTS orangehrm_termination_reason,
--   DROP COLUMN IF EXISTS orangehrm_terminated_at,
--   DROP COLUMN IF EXISTS orangehrm_record_status,
--   DROP COLUMN IF EXISTS ess_account_status,
--   DROP COLUMN IF EXISTS orangehrm_system_user_id;
--
-- -- Drop enums
-- DROP TYPE IF EXISTS background_verification_status CASCADE;
-- DROP TYPE IF EXISTS integration_event_status CASCADE;
-- DROP TYPE IF EXISTS external_access_status CASCADE;
-- DROP TYPE IF EXISTS external_provider CASCADE;
-- DROP TYPE IF EXISTS offboarding_reason CASCADE;
-- DROP TYPE IF EXISTS offboarding_status CASCADE;
-- DROP TYPE IF EXISTS orangehrm_provisioning_state CASCADE;
-- DROP TYPE IF EXISTS ess_account_status CASCADE;
-- DROP TYPE IF EXISTS orangehrm_termination_reason CASCADE;
-- DROP TYPE IF EXISTS orangehrm_record_status CASCADE;
