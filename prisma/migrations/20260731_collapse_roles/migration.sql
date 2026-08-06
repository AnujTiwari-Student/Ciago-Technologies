-- Migration: Collapse user roles to admin/user only
-- Removes employee, hr, manager, moderator role values per new-architecture.md §3.1

DO $$
BEGIN
  -- Only run if tables exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN

    -- Step 1: Migrate existing rows to new role values
    UPDATE public.user_roles SET role = 'user' WHERE role = 'employee';
    UPDATE public.user_roles SET role = 'admin' WHERE role = 'hr';
    UPDATE public.user_roles SET role = 'admin' WHERE role = 'manager';
    UPDATE public.user_roles SET role = 'admin' WHERE role = 'moderator';

    -- Step 2: Remove duplicate rows created by the collapse
    DELETE FROM public.user_roles a
    USING public.user_roles b
    WHERE a.id > b.id
      AND a.user_id = b.user_id
      AND a.role = b.role;

    -- Step 3: Remove old enum values from the app_role type
    ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;

  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_postings') THEN
    ALTER TABLE public.job_postings ALTER COLUMN track_type TYPE text;

    -- Step 4: Collapse JobTrackType to standard only
    UPDATE public.job_postings SET track_type = 'standard' WHERE track_type IN ('manager_track', 'hr_track');
  END IF;

  -- Recreate types (safe to do even if tables don't exist yet)
  DROP TYPE IF EXISTS public.app_role;
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');

  DROP TYPE IF EXISTS public.job_track_type;
  CREATE TYPE public.job_track_type AS ENUM ('standard');

  -- Apply types to tables if they exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_postings') THEN
    ALTER TABLE public.job_postings ALTER COLUMN track_type TYPE public.job_track_type USING track_type::public.job_track_type;
  END IF;

END $$;
