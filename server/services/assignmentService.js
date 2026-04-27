/**
 * assignmentService.js — Assignment business logic via DB RPCs.
 *
 * All complex logic (conflict detection, rest warning, status update)
 * now lives in the DB functions (02_rpc_functions.sql).
 *
 * This service is a thin translation layer:
 *   - Calls the RPC
 *   - Maps RPC result codes to AppError
 *   - Returns clean data to the route
 *
 * Benefits vs old route code:
 *   - 7 sequential queries → 1 RPC call (atomic)
 *   - Race condition on concurrent assignments → prevented by DB FOR UPDATE lock
 *   - Conflict detection logic → tested once in DB, not duplicated in Node.js
 */

import { supabase } from '../supabase.js';
import { AppError, Errors, mapSupabaseError } from '../lib/errors.js';

// RPC result code → AppError mapping
const RPC_ERROR_MAP = {
  mission_not_found:  () => Errors.notFound('משימה'),
  mission_cancelled:  () => new AppError('לא ניתן לשבץ למשימה שבוטלה', 409, 'MISSION_CANCELLED'),
  soldier_not_found:  () => Errors.notFound('חייל'),
  duplicate_assignment: () => new AppError('החייל כבר משובץ למשימה זו', 409, 'DUPLICATE'),
  not_found:          () => Errors.notFound('שיבוץ'),
};

function handleRpcError(result) {
  const errFn = RPC_ERROR_MAP[result.error];
  if (errFn) throw errFn();

  if (result.error === 'conflict') {
    throw new AppError(
      `חפיפה עם משימה: ${result.conflict_title || 'לא ידוע'}`,
      409,
      'CONFLICT'
    );
  }

  // Unknown RPC error
  throw new AppError(result.error || 'שגיאה בשיבוץ', 500, 'RPC_ERROR');
}

export const assignmentService = {

  /**
   * Create assignment — delegates entirely to DB RPC.
   * @returns {{ assignment_id, rest_warning, hours_since }}
   */
  async create({ mission_id, soldier_id, role_in_mission = 'לוחם', force = false, assigned_by }) {
    const { data, error } = await supabase.rpc('assign_soldier_to_mission', {
      p_mission_id:      mission_id,
      p_soldier_id:      soldier_id,
      p_role_in_mission: role_in_mission,
      p_assigned_by:     assigned_by,
      p_force:           force,
    });

    if (error) throw mapSupabaseError(error);
    if (!data.ok) handleRpcError(data);

    return {
      assignment_id: data.assignment_id,
      rest_warning:  data.rest_warning,
      hours_since:   data.hours_since,
    };
  },

  /**
   * Remove assignment — delegates to DB RPC.
   * Atomically deletes and resets soldier status if needed.
   */
  async remove(assignmentId) {
    const { data, error } = await supabase.rpc('remove_assignment', {
      p_assignment_id: assignmentId,
    });

    if (error) throw mapSupabaseError(error);
    if (!data.ok) handleRpcError(data);

    return { ok: true };
  },
};
