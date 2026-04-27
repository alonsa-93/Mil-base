-- ============================================================================
-- FILE: supabase/01_rls_policies.sql
-- PURPOSE: Row Level Security — deny all anonymous access.
--          Backend uses SERVICE_ROLE_KEY which bypasses RLS entirely.
--          RLS is defense-in-depth: protects against direct API abuse.
--
-- HOW TO APPLY: Run this in Supabase → SQL Editor
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldiers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE soldier_equipment  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rations_requests   ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- DROP EXISTING POLICIES (idempotent re-run)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- DENY ALL — Default-deny for anon role
-- The service_role key bypasses RLS automatically (Supabase behavior).
-- No policy = no access for any other role.
-- ─────────────────────────────────────────────────────────────────────────────

-- users: block everything (contains passwords)
CREATE POLICY "deny_all_users"
  ON users FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- soldiers
CREATE POLICY "deny_all_soldiers"
  ON soldiers FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- missions
CREATE POLICY "deny_all_missions"
  ON missions FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- assignments
CREATE POLICY "deny_all_assignments"
  ON assignments FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- equipment_items
CREATE POLICY "deny_all_equipment_items"
  ON equipment_items FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- equipment_assignments
CREATE POLICY "deny_all_equipment_assignments"
  ON equipment_assignments FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- soldier_equipment
CREATE POLICY "deny_all_soldier_equipment"
  ON soldier_equipment FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- audit_log (especially sensitive)
CREATE POLICY "deny_all_audit_log"
  ON audit_log FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- rations_requests
CREATE POLICY "deny_all_rations_requests"
  ON rations_requests FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE ON REALTIME
-- ─────────────────────────────────────────────────────────────────────────────
-- With deny-all RLS, Supabase Realtime postgres_changes will not work
-- for the anon/authenticated roles via the frontend anon key.
--
-- To enable frontend Realtime properly, you have two options:
--
-- OPTION A (Recommended — secure): Integrate Supabase Auth.
--   Exchange your custom JWT for a Supabase Auth session.
--   Then use auth.uid() in policies for fine-grained access.
--
-- OPTION B (Simple — slightly less secure): Allow SELECT-only on
--   realtime tables for authenticated role, secured by JWT validation.
--   Uncomment the block below if you choose Option B:
--
-- DROP POLICY IF EXISTS "deny_all_soldiers" ON soldiers;
-- CREATE POLICY "allow_read_soldiers"
--   ON soldiers FOR SELECT
--   TO authenticated
--   USING (true);
--
-- DROP POLICY IF EXISTS "deny_all_missions" ON missions;
-- CREATE POLICY "allow_read_missions"
--   ON missions FOR SELECT
--   TO authenticated
--   USING (true);
--
-- DROP POLICY IF EXISTS "deny_all_assignments" ON assignments;
-- CREATE POLICY "allow_read_assignments"
--   ON assignments FOR SELECT
--   TO authenticated
--   USING (true);
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE users IS 'RLS: deny-all. Backend uses service_role key.';
COMMENT ON TABLE soldiers IS 'RLS: deny-all. Backend uses service_role key.';
COMMENT ON TABLE missions IS 'RLS: deny-all. Backend uses service_role key.';
COMMENT ON TABLE assignments IS 'RLS: deny-all. Backend uses service_role key.';
COMMENT ON TABLE audit_log IS 'RLS: deny-all. Immutable via DB trigger.';
