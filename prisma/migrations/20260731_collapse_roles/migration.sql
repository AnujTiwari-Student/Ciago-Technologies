-- Migration: Collapse user roles to admin/user only
-- Removes employee, hr, manager, moderator role values per new-architecture.md §3.1

BEGIN;

-- Step 1: Migrate existing rows to new role values
UPDATE user_roles SET role = 'user' WHERE role = 'employee';
UPDATE user_roles SET role = 'admin' WHERE role = 'hr';
UPDATE user_roles SET role = 'admin' WHERE role = 'manager';
UPDATE user_roles SET role = 'admin' WHERE role = 'moderator';

-- Step 2: Remove duplicate rows created by the collapse
-- (e.g., user had both 'admin' and 'hr' → now two 'admin' rows)
DELETE FROM user_roles a
USING user_roles b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.role = b.role;

-- Step 3: Remove old enum values from the app_role type
-- PostgreSQL requires recreating the enum to remove values
ALTER TABLE user_roles ALTER COLUMN role TYPE text;
ALTER TABLE job_postings ALTER COLUMN track_type TYPE text;

DROP TYPE IF EXISTS app_role;
CREATE TYPE app_role AS ENUM ('admin', 'user');

ALTER TABLE user_roles ALTER COLUMN role TYPE app_role USING role::app_role;

-- Step 4: Collapse JobTrackType to standard only
UPDATE job_postings SET track_type = 'standard' WHERE track_type IN ('manager_track', 'hr_track');

DROP TYPE IF EXISTS job_track_type;
CREATE TYPE job_track_type AS ENUM ('standard');

ALTER TABLE job_postings ALTER COLUMN track_type TYPE job_track_type USING track_type::job_track_type;

COMMIT;
