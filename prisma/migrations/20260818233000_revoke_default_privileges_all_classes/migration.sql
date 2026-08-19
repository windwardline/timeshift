-- Finish the default-privileges half of the public-schema lockdown.
--
-- `20260818204500_lock_down_public_schema` revoked default privileges on TABLES
-- and SEQUENCES. `pg_default_acl` holds one row per (role, schema, object
-- class), and Supabase's bootstrap also grants defaults on FUNCTIONS -- so that
-- row survived the lockdown. Two consequences, one of each kind:
--
--   Security: the surviving entry means the next function created in `public`
--   by the migrating role is granted EXECUTE to `anon`, and PostgREST publishes
--   a `public` function as an RPC endpoint. No such function exists today; the
--   point of a default-privileges revoke is precisely the object that does not
--   exist yet.
--
--   Operational: `scripts/verify-lockdown.mjs` and the verification query in
--   `docs/supabase-lockdown.sql` both read `pg_default_acl` for `anon` and
--   `authenticated` without filtering by object class. The FUNCTIONS row made a
--   fully locked-down database report a problem, which `secure-database.sh`
--   turns into a hard failure -- skipping the credential rotation that is part
--   of the fix. Revoking the whole surface is what makes those checks true,
--   rather than narrowing the checks to match a partial revoke.
--
-- TYPES is included for the same reason TABLES and SEQUENCES are: it is a class
-- `pg_default_acl` can hold in a schema, so leaving it out leaves a row the
-- verifiers would flag. Object class 'n' (schemas) is stored with no namespace
-- and so is never reached by an `IN SCHEMA public` sweep.
--
-- Same shape as the original: guarded on the role existing, and issued through
-- `format`/`%I` per role. `ALTER DEFAULT PRIVILEGES` only ever alters entries
-- owned by the role running it -- Supabase's own `supabase_admin` entries are
-- untouched here and remain harmless, because a default-ACL entry governs only
-- the objects its owner creates, and migrations do not run as that role.
-- Spelled out one class per statement rather than looped over a class array:
-- the set of classes covered is the whole point of this migration, and
-- security-rls.test.ts asserts each one by name so a future class cannot be
-- dropped from the sweep without CI saying so.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TYPES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
