-- ============================================================================
-- FILE: supabase/04_realtime_setup.sql
-- PURPOSE: Enable Supabase Realtime on critical tables.
--          Realtime uses PostgreSQL logical replication (wal_level = logical).
--          Frontend subscribes via @supabase/supabase-js postgres_changes.
--
-- SECURITY NOTE:
--   With deny-all RLS (01_rls_policies.sql), realtime events will only
--   be delivered when using SERVICE_ROLE_KEY or after Supabase Auth integration.
--   See frontend hook comments for how to handle this correctly.
--
-- HOW TO APPLY: Run in Supabase → SQL Editor
-- ============================================================================

-- Enable realtime publication for specific tables
-- (Supabase creates 'supabase_realtime' publication automatically;
--  ALTER it to add tables if it exists, otherwise CREATE it.)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    -- Add tables to existing publication
    ALTER PUBLICATION supabase_realtime
      ADD TABLE soldiers, missions, assignments, equipment_items, soldier_equipment;
  ELSE
    -- Create publication
    CREATE PUBLICATION supabase_realtime
      FOR TABLE soldiers, missions, assignments, equipment_items, soldier_equipment;
  END IF;
END $$;

-- Set replica identity to FULL for UPDATE/DELETE events to include old row data
-- This allows the frontend to know WHAT changed, not just that a change occurred.
ALTER TABLE soldiers        REPLICA IDENTITY FULL;
ALTER TABLE missions        REPLICA IDENTITY FULL;
ALTER TABLE assignments     REPLICA IDENTITY FULL;
ALTER TABLE equipment_items REPLICA IDENTITY FULL;
ALTER TABLE soldier_equipment REPLICA IDENTITY FULL;
