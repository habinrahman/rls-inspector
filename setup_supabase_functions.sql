-- =============================================================================
-- RLS Inspector — Supabase Helper Functions
-- =============================================================================
-- The RLS Inspector tool talks to Supabase using only your project's *anon*
-- key. PostgREST does not expose system catalogs (pg_class, pg_policies) or
-- the auth schema by default, so we install four small read-only helpers
-- here and grant them to the anon role.
--
-- INSTALL:  Paste the entire file into the Supabase SQL Editor and run it.
--           It is idempotent — safe to run multiple times.
-- UNINSTALL: Run the DROP block at the bottom of this file.
--
-- =============================================================================
-- ⚠️  SECURITY NOTICE — READ BEFORE DEPLOYING
-- =============================================================================
-- These functions use SECURITY DEFINER and are granted to the `anon` role.
-- That means *anyone* who has your project URL + anon public key can:
--
--   • List every table in the `public` schema + see whether RLS is on
--   • Read the full text of every RLS policy
--   • See up to 50 user ids + email addresses from auth.users
--   • Get the TOTAL row count (RLS-bypassed) of any public table
--
-- That's fine for a DEV or STAGING project you're debugging.
-- DO NOT deploy this into a production project handling real user data
-- without changing the GRANTs from `anon` to `authenticated` and adding a
-- proper auth flow to the tool.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1.  get_all_tables()
--     Returns every base table in the `public` schema along with its RLS
--     state and the number of policies attached to it. The Inspector uses
--     this to populate the "Table" dropdown.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_tables()
RETURNS TABLE (
  name         TEXT,
  rls_enabled  BOOLEAN,
  policy_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    c.relname::TEXT                                       AS name,
    c.relrowsecurity                                      AS rls_enabled,
    COALESCE(p.policy_count, 0)::BIGINT                   AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN (
    SELECT tablename, COUNT(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) p ON p.tablename = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'      -- ordinary tables only
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.get_all_tables() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_all_tables() TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2.  get_table_policies(table_name TEXT)
--     Returns all RLS policies attached to a given public-schema table.
--     This is the meat of the Inspector — it powers the policy visualizer
--     and the issue detector.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_policies(table_name TEXT)
RETURNS TABLE (
  policyname  TEXT,
  cmd         TEXT,
  qual        TEXT,
  with_check  TEXT,
  roles       TEXT[],
  permissive  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p.policyname::TEXT,
    p.cmd::TEXT,
    p.qual::TEXT,
    p.with_check::TEXT,
    p.roles::TEXT[],
    p.permissive::TEXT
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename  = get_table_policies.table_name
  ORDER BY p.cmd, p.policyname;
$$;

REVOKE ALL ON FUNCTION public.get_table_policies(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_table_policies(TEXT) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3.  get_auth_users(max_count INT DEFAULT 50)
--     Returns recent users from auth.users so you can "test as" them in
--     the Inspector. Capped at 200 by the function itself. max_count is
--     optional — `SELECT get_auth_users()` works.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_users(max_count INT DEFAULT 50)
RETURNS TABLE (
  id    UUID,
  email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.id, u.email::TEXT
  FROM auth.users u
  ORDER BY u.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(max_count, 50), 200), 1);
$$;

REVOKE ALL ON FUNCTION public.get_auth_users(INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_auth_users(INT) TO anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4.  get_table_row_count(table_name TEXT)
--     Returns the TOTAL row count of a public-schema table (RLS bypassed,
--     because it runs as the function owner). Used in the visualizer to
--     show the "X / Y rows" denominator. Returns NULL on error.
--     The format(%I) call quotes the identifier so this is injection-safe.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_table_row_count(table_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  result BIGINT;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM public.%I', get_table_row_count.table_name) INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_table_row_count(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_table_row_count(TEXT) TO anon, authenticated;


-- =============================================================================
-- VERIFY INSTALLATION
-- =============================================================================
-- Run these in the SQL Editor after deploying to make sure everything works.
--
--   SELECT * FROM public.get_all_tables() LIMIT 5;
--   SELECT * FROM public.get_table_policies('your_table_name');
--   SELECT * FROM public.get_auth_users(10);
--   SELECT public.get_table_row_count('your_table_name');
--
-- =============================================================================


-- =============================================================================
-- UNINSTALL — uncomment and run to fully remove the helpers
-- =============================================================================
-- DROP FUNCTION IF EXISTS public.get_all_tables();
-- DROP FUNCTION IF EXISTS public.get_table_policies(TEXT);
-- DROP FUNCTION IF EXISTS public.get_auth_users(INT);
-- DROP FUNCTION IF EXISTS public.get_table_row_count(TEXT);
