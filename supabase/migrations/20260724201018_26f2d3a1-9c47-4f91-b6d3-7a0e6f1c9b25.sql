-- Clerk authentication migration — Step 1: sidecar identity-mapping table.
--
-- Adds a public.clerk_user_map table that maps Clerk user IDs (opaque strings
-- like "user_2vX1A…") to existing Supabase auth.users UUIDs. This keeps Clerk
-- as the identity/authentication provider while leaving all application
-- user_id columns as uuid references auth.users(id) ON DELETE CASCADE —
-- no existing FKs, RLS policies, stored procedures, or triggers are touched.
--
-- The application keeps an auth.users row per Clerk user (minted by the
-- provisioning helper in Step 2) so that RLS expressions of the form
--   user_id = auth.uid()
-- continue to evaluate correctly. Clerk User IDs are stored verbatim in
-- clerk_user_map.clerk_user_id (TEXT, primary key); the FK relationship to
-- auth.users is preserved on the UUID side via auth_user_id.
--
-- This migration is reversible: see theDROP block at the bottom of the file.
-- (Down/DROP is intentionally not auto-applied because Supabase manages the
--  up direction only; the DROP is documented for manual rollback.)

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clerk_user_map (
  -- Clerk assigns opaque string IDs ("user_2vX1…"). TEXT, not UUID.
  clerk_user_id TEXT PRIMARY KEY,
  -- 1:1 link to auth.users(id). Existing FK pattern preserved exactly.
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Verified primary email at provisioning time. Unique so two Clerk IDs
  -- cannot be mapped to the same auth.users row by email.
  email TEXT UNIQUE,
  primary_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for reverse lookups (auth_user_id → clerk_user_id) — used during
-- staff directory renders and audit-log display in Step 11+.
CREATE INDEX IF NOT EXISTS clerk_user_map_auth_user_id_idx
  ON public.clerk_user_map (auth_user_id);

-- Index for email lookup — used by the provisioning helper to detect
-- "this Clerk identity is already mapped via a different Clerk user ID"
-- (rare but real when users reauth with a social after email/password).
CREATE INDEX IF NOT EXISTS clerk_user_map_email_idx
  ON public.clerk_user_map (email)
  WHERE email IS NOT NULL;

-- updated_at auto-maintenance trigger — matches the idiom used on other
-- Ciago tables (audit_logs.use_updated_at, etc.).
CREATE OR REPLACE FUNCTION public.touch_clerk_user_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clerk_user_map_touch_updated_at
  ON public.clerk_user_map;
CREATE TRIGGER clerk_user_map_touch_updated_at
  BEFORE UPDATE ON public.clerk_user_map
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_clerk_user_map_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Row Level Security — matches every other Ciago public.* table.
-- ----------------------------------------------------------------------------
ALTER TABLE public.clerk_user_map ENABLE ROW LEVEL SECURITY;

-- End-users (authenticated / anon) may NOT read or write this table directly.
-- Only the Supabase service_role is permitted to manage mappings; the
-- application never issues Clerk mapping writes from a per-user authenticated
-- client — it always goes via createServerFn → supabaseAdmin (Step 2+).
DROP POLICY IF EXISTS "service_role manages clerk_user_map" ON public.clerk_user_map;
CREATE POLICY "service_role manages clerk_user_map"
  ON public.clerk_user_map
  FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- Belt-and-suspenders: deny access to anon and authenticated roles explicitly.
-- (No policy exists for them, so default-deny already applies — but creating
-- this as a no-op clarifies intent and survives future policy sweeps.)
DROP POLICY IF EXISTS "anon/authenticated denied on clerk_user_map" ON public.clerk_user_map;
CREATE POLICY "anon/authenticated denied on clerk_user_map"
  ON public.clerk_user_map
  FOR ALL
  TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);

-- ----------------------------------------------------------------------------
-- 3. Grants — explicit per grant role to match the convention used in other
--    migrations. service_role has full access; anon/authenticated have none.
-- ----------------------------------------------------------------------------
GRANT ALL ON public.clerk_user_map TO service_role;
REVOKE ALL ON public.clerk_user_map FROM anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- Manual rollback (OFFLINE — only run if Step 0..14 are all reverted):
--   BEGIN;
--     DROP TRIGGER IF EXISTS clerk_user_map_touch_updated_at ON public.clerk_user_map;
--     DROP FUNCTION IF EXISTS public.touch_clerk_user_map_updated_at();
--     DROP TABLE IF EXISTS public.clerk_user_map CASCADE;
--   COMMIT;
-- ----------------------------------------------------------------------------
