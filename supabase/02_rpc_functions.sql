-- ============================================================================
-- FILE: supabase/02_rpc_functions.sql
-- PURPOSE: Move critical business logic into the database.
--          Benefits:
--            1. Atomic transactions — no partial-write bugs
--            2. Race-condition prevention via FOR UPDATE row locks
--            3. Single round-trip instead of 5-7 sequential queries
--            4. Logic lives where the data lives
--
-- HOW TO APPLY: Run in Supabase → SQL Editor
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION 1: assign_soldier_to_mission
-- Replaces the entire POST /api/assignments route logic.
-- Handles: duplicate check, conflict detection, rest warning, status update.
-- Uses FOR UPDATE row lock on soldier → prevents race conditions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_soldier_to_mission(
  p_mission_id      BIGINT,
  p_soldier_id      BIGINT,
  p_role_in_mission TEXT    DEFAULT 'לוחם',
  p_assigned_by     BIGINT  DEFAULT NULL,
  p_force           BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission        missions%ROWTYPE;
  v_soldier        soldiers%ROWTYPE;
  v_conflict_title TEXT;
  v_last_end       TIMESTAMPTZ;
  v_hours_since    NUMERIC;
  v_rest_warning   BOOLEAN := FALSE;
  v_assignment_id  BIGINT;
BEGIN
  -- ── 1. Validate mission exists ────────────────────────────────────────────
  SELECT * INTO v_mission
  FROM missions
  WHERE id = p_mission_id
  FOR KEY SHARE;          -- shared key lock: mission won't be deleted mid-transaction

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'mission_not_found');
  END IF;

  IF v_mission.status = 'בוטל' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'mission_cancelled');
  END IF;

  -- ── 2. Validate soldier exists & lock row ─────────────────────────────────
  SELECT * INTO v_soldier
  FROM soldiers
  WHERE id = p_soldier_id
  FOR UPDATE;             -- exclusive lock: prevents concurrent double-assignment

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'soldier_not_found');
  END IF;

  -- ── 3. Duplicate prevention ───────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM assignments
    WHERE mission_id = p_mission_id
      AND soldier_id = p_soldier_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_assignment');
  END IF;

  -- ── 4. Time-overlap conflict check ───────────────────────────────────────
  -- Checks if soldier has ANY other non-cancelled mission that overlaps
  -- the requested mission time window.
  IF NOT p_force THEN
    SELECT m.title INTO v_conflict_title
    FROM assignments a
    JOIN missions m ON m.id = a.mission_id
    WHERE a.soldier_id = p_soldier_id
      AND m.id        != p_mission_id
      AND m.status    != 'בוטל'
      AND m.start_time < v_mission.end_time   -- overlap condition: B.start < A.end
      AND m.end_time   > v_mission.start_time -- overlap condition: B.end > A.start
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok',             false,
        'error',          'conflict',
        'conflict_title', v_conflict_title
      );
    END IF;
  END IF;

  -- ── 5. 8-hour rest validation ─────────────────────────────────────────────
  -- Gets the most recent mission end time for this soldier.
  -- Falls back to soldiers.last_mission_end if no assignment history.
  SELECT GREATEST(m.end_time, COALESCE(v_soldier.last_mission_end, '-infinity'::TIMESTAMPTZ))
  INTO v_last_end
  FROM assignments a
  JOIN missions m ON m.id = a.mission_id
  WHERE a.soldier_id = p_soldier_id
    AND m.status    != 'בוטל'
  ORDER BY m.end_time DESC
  LIMIT 1;

  -- Fallback: no assignment history, use soldiers table field
  IF v_last_end IS NULL THEN
    v_last_end := v_soldier.last_mission_end;
  END IF;

  IF v_last_end IS NOT NULL THEN
    v_hours_since := EXTRACT(EPOCH FROM (v_mission.start_time - v_last_end)) / 3600.0;
    v_rest_warning := v_hours_since < 8;
  END IF;

  -- ── 6. Insert assignment ──────────────────────────────────────────────────
  INSERT INTO assignments (
    mission_id,
    soldier_id,
    role_in_mission,
    assigned_by,
    rest_warning
  )
  VALUES (
    p_mission_id,
    p_soldier_id,
    p_role_in_mission,
    p_assigned_by,
    CASE WHEN v_rest_warning THEN 1 ELSE 0 END
  )
  RETURNING id INTO v_assignment_id;

  -- ── 7. Update soldier status ──────────────────────────────────────────────
  -- Only flip to 'במשימה' if currently 'זמין' — respect other statuses.
  UPDATE soldiers
  SET status = 'במשימה'
  WHERE id     = p_soldier_id
    AND status = 'זמין';

  RETURN jsonb_build_object(
    'ok',            true,
    'assignment_id', v_assignment_id,
    'rest_warning',  v_rest_warning,
    'hours_since',   ROUND(COALESCE(v_hours_since, 99)::NUMERIC, 1)
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Race condition: another request inserted the same assignment concurrently
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_assignment');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION 2: remove_assignment
-- Replaces DELETE /api/assignments/:id logic.
-- Atomically deletes and resets soldier status if no remaining active missions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION remove_assignment(
  p_assignment_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_soldier_id   BIGINT;
  v_active_count INT;
BEGIN
  -- Get soldier_id (and lock the row)
  SELECT soldier_id INTO v_soldier_id
  FROM assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Delete assignment
  DELETE FROM assignments WHERE id = p_assignment_id;

  -- Count remaining active assignments for this soldier
  SELECT COUNT(*) INTO v_active_count
  FROM assignments a
  JOIN missions m ON m.id = a.mission_id
  WHERE a.soldier_id = v_soldier_id
    AND m.status IN ('פעיל', 'מתוכנן');

  -- Reset to 'זמין' only if no active/planned missions remain
  IF v_active_count = 0 THEN
    UPDATE soldiers
    SET status = 'זמין'
    WHERE id     = v_soldier_id
      AND status = 'במשימה';
  END IF;

  RETURN jsonb_build_object('ok', true, 'soldier_id', v_soldier_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION 3: get_next_serial_num
-- Prevents race condition in serial_num generation for new soldiers.
-- Uses advisory lock so concurrent inserts serialize correctly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_next_serial_num()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  -- pg_advisory_xact_lock: transaction-level lock, auto-released on commit/rollback
  -- Key 99001 is arbitrary; just needs to be consistent across all callers.
  PERFORM pg_advisory_xact_lock(99001);

  SELECT COALESCE(MAX(serial_num), 0) + 1
  INTO v_next
  FROM soldiers;

  RETURN v_next;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION 4: get_mission_with_assignments
-- Returns a mission + its assignments in ONE query instead of two.
-- Replaces the two-step GET /api/missions/:id pattern.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_mission_with_assignments(
  p_mission_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission    JSONB;
  v_assigns    JSONB;
BEGIN
  SELECT row_to_json(m.*)::JSONB
  INTO v_mission
  FROM missions m
  WHERE m.id = p_mission_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',           a.id,
        'soldier_id',   a.soldier_id,
        'full_name',    s.full_name,
        'personal_id',  s.personal_id,
        'status',       s.status,
        'role_in_mission', a.role_in_mission,
        'rest_warning', a.rest_warning,
        'assigned_at',  a.assigned_at
      )
      ORDER BY a.assigned_at
    ),
    '[]'::JSONB
  )
  INTO v_assigns
  FROM assignments a
  JOIN soldiers s ON s.id = a.soldier_id
  WHERE a.mission_id = p_mission_id;

  RETURN v_mission || jsonb_build_object('assignments', v_assigns);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION 5: suggest_soldiers_for_mission
-- Returns ranked soldier suggestions for a mission (fairness algorithm).
-- Replaces the in-memory suggestion logic in Calendar.jsx.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION suggest_soldiers_for_mission(
  p_mission_id BIGINT,
  p_limit      INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission     missions%ROWTYPE;
  v_suggestions JSONB;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'mission_not_found');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',              s.id,
        'full_name',       s.full_name,
        'personal_id',     s.personal_id,
        'status',          s.status,
        'monthly_hours',   COALESCE(stats.monthly_hours, 0),
        'has_rest_warning',
          CASE
            WHEN last_end.end_time IS NOT NULL
              AND EXTRACT(EPOCH FROM (v_mission.start_time - last_end.end_time)) / 3600 < 8
            THEN true
            ELSE false
          END,
        'hours_since_rest',
          ROUND(
            COALESCE(
              EXTRACT(EPOCH FROM (v_mission.start_time - last_end.end_time)) / 3600,
              99
            )::NUMERIC,
            1
          )
      )
      ORDER BY COALESCE(stats.monthly_hours, 0) ASC  -- fairness: least hours first
    ),
    '[]'::JSONB
  )
  INTO v_suggestions
  FROM soldiers s
  -- Exclude already-assigned soldiers
  WHERE s.status = 'זמין'
    AND NOT EXISTS (
      SELECT 1 FROM assignments a2
      WHERE a2.mission_id = p_mission_id
        AND a2.soldier_id = s.id
    )
    -- Exclude conflicting soldiers
    AND NOT EXISTS (
      SELECT 1
      FROM assignments a3
      JOIN missions m3 ON m3.id = a3.mission_id
      WHERE a3.soldier_id = s.id
        AND m3.id         != p_mission_id
        AND m3.status     != 'בוטל'
        AND m3.start_time  < v_mission.end_time
        AND m3.end_time    > v_mission.start_time
    )
  -- Monthly hours (last 30 days)
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(
      EXTRACT(EPOCH FROM LEAST(m.end_time, NOW()) - GREATEST(m.start_time, NOW() - INTERVAL '30 days')) / 3600
    ), 0) AS monthly_hours
    FROM assignments a
    JOIN missions m ON m.id = a.mission_id
    WHERE a.soldier_id = s.id
      AND m.start_time > NOW() - INTERVAL '30 days'
      AND m.status    != 'בוטל'
  ) stats ON true
  -- Most recent mission end time (for rest warning)
  LEFT JOIN LATERAL (
    SELECT m.end_time
    FROM assignments a
    JOIN missions m ON m.id = a.mission_id
    WHERE a.soldier_id = s.id
      AND m.status    != 'בוטל'
    ORDER BY m.end_time DESC
    LIMIT 1
  ) last_end ON true
  LIMIT p_limit;

  RETURN jsonb_build_object('suggestions', v_suggestions);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION 6: get_rations_demand
-- Calculates dietary demand in DB instead of fetching all soldiers to Node.js.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_rations_demand()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total',       COUNT(*),
    'vegan',       COUNT(*) FILTER (WHERE is_vegan      = 1),
    'vegetarian',  COUNT(*) FILTER (WHERE is_vegetarian = 1 AND is_vegan = 0),
    'lactose_free',COUNT(*) FILTER (WHERE lactose_intolerant = 1),
    'gluten_free', COUNT(*) FILTER (WHERE gluten_free   = 1),
    'standard',    COUNT(*) FILTER (WHERE is_vegan = 0 AND is_vegetarian = 0)
  )
  INTO v_result
  FROM soldiers
  WHERE status != 'חופשה';

  RETURN v_result;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- GRANT EXECUTE to authenticated role (frontend, if needed in future)
-- Backend (service_role) can always call these.
-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION assign_soldier_to_mission    TO service_role;
GRANT EXECUTE ON FUNCTION remove_assignment            TO service_role;
GRANT EXECUTE ON FUNCTION get_next_serial_num          TO service_role;
GRANT EXECUTE ON FUNCTION get_mission_with_assignments TO service_role;
GRANT EXECUTE ON FUNCTION suggest_soldiers_for_mission TO service_role;
GRANT EXECUTE ON FUNCTION get_rations_demand           TO service_role;
