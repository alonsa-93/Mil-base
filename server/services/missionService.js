/**
 * missionService.js — Mission business logic.
 *
 * Key improvements:
 *   - GET /:id uses get_mission_with_assignments RPC → 1 query instead of 2
 *   - POST /:id/suggest uses suggest_soldiers_for_mission RPC → 1 query
 *   - .maybeSingle() replaces .limit(1) + data[0]
 *   - Validation moved to validate.js middleware (Zod)
 */

import { supabase } from '../supabase.js';
import { Errors, mapSupabaseError, assertExists } from '../lib/errors.js';

export const missionService = {

  async getAll({ from, to, status } = {}) {
    let q = supabase
      .from('missions')
      .select('*')
      .order('start_time', { ascending: true });

    if (from)   q = q.gte('start_time', from);
    if (to)     q = q.lte('start_time', to);
    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw mapSupabaseError(error);
    return data ?? [];
  },

  async getById(id) {
    // Single RPC call returns mission + assignments (replaces 2 queries)
    const { data, error } = await supabase
      .rpc('get_mission_with_assignments', { p_mission_id: id });

    if (error) throw mapSupabaseError(error);
    return assertExists(data, 'משימה');
  },

  async create(fields, userId) {
    const {
      title, description, location,
      start_time, end_time,
      urgency = 'רגיל', type = 'כללי',
      required_count = 1, vehicle, notes,
    } = fields;

    // Time validation (also in Zod schema, but double-check here)
    if (new Date(start_time) >= new Date(end_time)) {
      throw Errors.badRequest('שעת סיום חייבת להיות אחרי שעת התחלה');
    }

    const { data, error } = await supabase
      .from('missions')
      .insert({
        title, description, location,
        start_time, end_time,
        urgency, type, required_count,
        vehicle, notes,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    return data;
  },

  async update(id, fields) {
    const ALLOWED = [
      'title', 'description', 'location',
      'start_time', 'end_time', 'status',
      'urgency', 'type', 'required_count',
      'vehicle', 'notes',
    ];

    const updates = {};
    ALLOWED.forEach(f => { if (fields[f] !== undefined) updates[f] = fields[f]; });

    // No fields to update → return current
    if (Object.keys(updates).length === 0) {
      return this.getById(id);
    }

    const { data, error } = await supabase
      .from('missions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('missions')
      .delete()
      .eq('id', id);

    if (error) throw mapSupabaseError(error);
    return { ok: true };
  },

  async suggestSoldiers(missionId) {
    // DB function handles: conflict check, rest warning, monthly hours sort
    const { data, error } = await supabase
      .rpc('suggest_soldiers_for_mission', {
        p_mission_id: missionId,
        p_limit:      15,
      });

    if (error) throw mapSupabaseError(error);
    if (!data || data.error) throw Errors.notFound('משימה');
    return data;
  },
};
