-- Close the PostgREST RPC surface the previous migration only claimed to close.
--
-- `20260818233000` revoked default privileges ON FUNCTIONS from `anon` and
-- `authenticated` by name. That does not stop the exposure it was written for.
-- Postgres grants EXECUTE on every newly created function to the `PUBLIC`
-- pseudo-role as a built-in default, `anon` is a member of `PUBLIC`, and `anon`
-- keeps USAGE on this schema through `PUBLIC` as well -- `20260818204500` says
-- so in its own comment. Supabase publishes a `public` function as an RPC
-- endpoint, so the two together are a callable API.
--
-- Measured, not assumed. On a database with every earlier lockdown migration
-- applied, a SECURITY DEFINER function created in `public` returned a user's
-- email address to `anon`. SECURITY DEFINER runs as its owner, so RLS -- which
-- the owner bypasses -- is not a second line of defence here. That is the
-- ordinary shape of a helper function, not a contrived one.
--
-- 1. Future functions: stop the built-in default before it is ever applied.
--
--    NOT schema-qualified, and that is the whole point. The obvious spelling --
--    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM
--    PUBLIC` -- writes no `pg_default_acl` row and changes nothing: a new
--    function still comes out with `proacl` NULL and `anon` still holds EXECUTE.
--    Verified on Postgres 16.13. A schema-scoped default-ACL entry is layered on
--    TOP of the built-in defaults; the built-in PUBLIC grant is database-wide, so
--    only a database-wide revoke can subtract it. The database-wide form does
--    write the entry (`{postgres=X/postgres}`, `defaclnamespace = 0`) and a
--    function created afterwards reports `anon` EXECUTE as false.
--
--    Database-wide sounds broader than it is: like every ALTER DEFAULT
--    PRIVILEGES, it governs only objects created by the role running it. This
--    app creates objects in `public` and nowhere else; Supabase's own schemas are
--    created by its internal roles, which this does not touch.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 2. Functions that already exist. None ship with this app today, so this is for
--    anything created before the line above landed.
--
--    Guarded twice. Ownership, because a blanket revoke aborts on the first
--    object the migrating role does not own, which would fail the migration on a
--    live database. And extension membership, because revoking EXECUTE from
--    PUBLIC on an extension's functions (pgcrypto, uuid-ossp and friends, which
--    Supabase may install into `public`) would break every other role that calls
--    them -- a far wider blast radius than this migration is entitled to.
--
--    The owner keeps EXECUTE regardless: REVOKE ... FROM PUBLIC does not touch
--    the owner's own privileges, so the app, which connects as the owner, is
--    unaffected.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS ident
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_catalog.pg_has_role(current_user, p.proowner, 'USAGE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.classid = 'pg_proc'::regclass AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.ident);
  END LOOP;
END
$$;
