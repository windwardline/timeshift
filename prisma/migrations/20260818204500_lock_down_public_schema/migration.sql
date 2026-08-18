-- Lock the public schema away from Supabase's PostgREST roles.
--
-- Why this migration exists
-- ------------------------
-- TimeShift reaches Postgres only through Prisma over DATABASE_URL; it uses no
-- Supabase SDK (AGENTS.md §5). Supabase, however, still publishes every table in
-- the `public` schema through PostgREST, and its bootstrap grants ALL on new
-- tables in `public` to the `anon` and `authenticated` roles. `anon` is the role
-- behind a project's publishable key, so until this migration every table Prisma
-- created was world-readable and world-writable over HTTPS:
--
--   * "Session"."token"    -- live session cookies -> sign in as any user
--   * "LoginToken"."token" -- unconsumed magic links -> take over any account
--   * "User"."email"       -- the whole user list
--
-- That is what the Supabase advisories `rls_disabled_in_public` and
-- `sensitive_columns_exposed` flagged. Prisma does not model RLS or grants, so
-- neither is expressible in schema.prisma and both have to live here.
--
-- The fix is two independent layers; either alone would close the hole.
--   1. Row-Level Security on every table, with NO policies -> deny-all for every
--      role except the table owner. The owner (the `postgres` role Prisma
--      migrates and connects as) bypasses RLS, so the app is unaffected. FORCE
--      ROW LEVEL SECURITY is deliberately NOT set: that would lock out the
--      application's own connection.
--   2. Revoking the table grants PostgREST rides on, so the tables disappear
--      from the API surface entirely rather than merely returning zero rows.
--
-- `service_role` is intentionally left alone: it is reachable only with the
-- secret service key, never ships to a browser, and carries BYPASSRLS by design.
--
-- Every statement below is idempotent and guarded -- by role existence, and in
-- block 1b by table ownership -- so this migration is a no-op on a plain local/CI
-- Postgres where the Supabase roles do not exist, and cannot abort on a table it
-- does not own.

-- 1a. RLS on each modelled table. These lines are contract-tested against
--     schema.prisma by security-rls.test.ts: adding a model without adding its
--     line here fails CI.
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlightSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlightQueryCache" ENABLE ROW LEVEL SECURITY;

-- 1b. Safety net for anything in `public` that schema.prisma does not model --
--     notably Prisma's own `_prisma_migrations` bookkeeping table, which is
--     equally exposed and leaks the schema history.
--
--     The pg_has_role guard is load-bearing: ALTER TABLE requires ownership, so a
--     table in `public` owned by another role (an extension installed there, or
--     anything created by another tool) would raise `must be owner of table`,
--     abort the migration, and leave Prisma's history wedged on a live database.
--     Tables that fail the guard are skipped because they could never have been
--     altered from here anyway; they are not Prisma's and hold none of our data.
DO $$
DECLARE t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      AND pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- 2. Drop the PostgREST-facing grants, now and for every table Prisma creates
--    later. Without the ALTER DEFAULT PRIVILEGES half, the next `prisma migrate`
--    would silently hand `anon` a fresh publicly-readable table.
DO $$
DECLARE r text; obj record;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      -- Per-object and ownership-guarded, for the same reason block 1b is: the
      -- blanket `REVOKE ALL ON ALL TABLES IN SCHEMA public` aborts with
      -- `permission denied for table ...` on the first object the migrating role
      -- does not own, which would fail the migration on a live database. Objects
      -- that fail the guard are not ours and were never granted by us.
      FOR obj IN
        SELECT c.oid::regclass AS ident, c.relkind AS kind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          AND pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE')
      LOOP
        IF obj.kind = 'S' THEN
          EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I', obj.ident, r);
        ELSE
          EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', obj.ident, r);
        END IF;
      END LOOP;
      -- Removes the role's DIRECT schema grant only. `anon` still holds USAGE
      -- on `public` through the PUBLIC pseudo-role, which Postgres grants by
      -- default (PG15 revoked CREATE from PUBLIC; USAGE stayed). So this line is
      -- belt-and-braces, not load-bearing -- the table-level revoke below and
      -- the RLS above are what actually close the door. Revoking USAGE from
      -- PUBLIC outright would shut it fully but has a far wider blast radius
      -- across Supabase's own roles; that is an owner decision (AGENTS.md §11).
      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
