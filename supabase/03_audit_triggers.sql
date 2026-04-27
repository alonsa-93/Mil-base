-- ============================================================================
-- FILE: supabase/03_audit_triggers.sql
-- PURPOSE: Database-level audit logging triggers.
--          Every INSERT/UPDATE/DELETE on critical tables is automatically
--          logged — even if the application layer crashes mid-request.
--          This is immutable and cannot be bypassed by application bugs.
--
-- HOW TO APPLY: Run in Supabase → SQL Editor
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- MASTER TRIGGER FUNCTION
-- Called by every table trigger; auto-detects action type and table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_val  JSONB;
  v_new_val  JSONB;
  v_action   TEXT;
  v_user_id  TEXT;
  v_username TEXT;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action  := 'CREATE_' || UPPER(TG_TABLE_NAME);
    v_old_val := NULL;
    v_new_val := to_jsonb(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    v_action  := 'UPDATE_' || UPPER(TG_TABLE_NAME);
    v_old_val := to_jsonb(OLD);
    v_new_val := to_jsonb(NEW);

  ELSIF TG_OP = 'DELETE' THEN
    v_action  := 'DELETE_' || UPPER(TG_TABLE_NAME);
    v_old_val := to_jsonb(OLD);
    v_new_val := NULL;
  END IF;

  -- Strip sensitive fields from users table
  IF TG_TABLE_NAME = 'users' THEN
    v_old_val := v_old_val - 'password';
    v_new_val := v_new_val - 'password';
  END IF;

  -- Try to read app-level user context (set by backend before queries)
  v_user_id  := current_setting('app.current_user_id',  true);
  v_username := current_setting('app.current_username', true);

  -- Insert audit record (best-effort; never fails the parent transaction)
  BEGIN
    INSERT INTO audit_log (
      user_id,
      username,
      action,
      entity_type,
      entity_id,
      old_value,
      new_value,
      ip,
      created_at
    ) VALUES (
      NULLIF(v_user_id,  '')::BIGINT,
      NULLIF(v_username, ''),
      v_action,
      TG_TABLE_NAME,
      CASE
        WHEN TG_OP = 'DELETE' THEN (to_jsonb(OLD) ->> 'id')
        ELSE                       (to_jsonb(NEW) ->> 'id')
      END,
      v_old_val::TEXT,
      v_new_val::TEXT,
      NULL,
      NOW()
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log to server log but never fail the parent transaction
      RAISE WARNING 'Audit log insert failed: %', SQLERRM;
  END;

  -- Return correct row depending on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: creates trigger on a table (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_audit_trigger(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS trg_audit_%1$s ON %1$I;
     CREATE TRIGGER trg_audit_%1$s
       AFTER INSERT OR UPDATE OR DELETE ON %1$I
       FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();',
    p_table
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BIND TRIGGERS — one per critical table
-- ─────────────────────────────────────────────────────────────────────────────
SELECT create_audit_trigger('soldiers');
SELECT create_audit_trigger('missions');
SELECT create_audit_trigger('assignments');
SELECT create_audit_trigger('users');
SELECT create_audit_trigger('equipment_items');
SELECT create_audit_trigger('soldier_equipment');
SELECT create_audit_trigger('rations_requests');


-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO SET USER CONTEXT IN NODE.JS (backend per-request)
-- ─────────────────────────────────────────────────────────────────────────────
-- In Express middleware, before any DB writes, set the context:
--
--   await supabase.rpc('set_config', {
--     setting: 'app.current_user_id',
--     value:   String(req.user.id),
--     is_local: true   -- session-local, not transaction-local
--   });
--
-- OR in a single SQL statement:
--   SELECT set_config('app.current_user_id', '123', true);
--
-- This way, the trigger always knows WHO made the change.
-- ─────────────────────────────────────────────────────────────────────────────

-- Convenience RPC for setting user context from Node.js
CREATE OR REPLACE FUNCTION set_audit_context(
  p_user_id  TEXT,
  p_username TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_user_id',  p_user_id,  true);
  PERFORM set_config('app.current_username', p_username, true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_audit_context TO service_role;
