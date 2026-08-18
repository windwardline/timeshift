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
-- Every statement below is idempotent and guarded, so this migration is a no-op
-- on a plain local/CI Postgres where the Supabase roles do not exist.

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
DO $$
DECLARE t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- 2. Drop the PostgREST-facing grants, now and for every table Prisma creates
--    later. Without the ALTER DEFAULT PRIVILEGES half, the next `prisma migrate`
--    would silently hand `anon` a fresh publicly-readable table.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;
