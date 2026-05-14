/**
 * soldierService.js — All soldier business logic.
 *
 * Routes call service functions; services call Supabase.
 * Routes never touch Supabase directly.
 *
 * Improvements over old routes:
 *   - .maybeSingle() instead of .limit(1) + data[0]
 *   - get_next_serial_num() RPC prevents serial number race conditions
 *   - mapSupabaseError() gives proper Hebrew error messages
 *   - seedDefaultEquipment uses bulk insert (1 query instead of 6)
 */

import { supabase } from '../supabase.js';
import { AppError, Errors, mapSupabaseError, assertExists } from '../lib/errors.js';

// Default equipment issued to every new soldier
const DEFAULT_EQUIPMENT = [
  { key: 'weapon',      label: 'נשק אישי' },
  { key: 'vest',        label: 'אפוד / ווסט' },
  { key: 'helmet',      label: 'קסדה' },
  { key: 'magazines',   label: '5 מחסניות' },
  { key: 'knee_pads',   label: 'ברכיות' },
  { key: 'medical_kit', label: 'חסם עורקים ותחבושת אישית' },
];

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Bulk-inserts default equipment records for a new soldier.
 * Uses a single INSERT ... VALUES (...),(...) instead of 6 sequential inserts.
 */
async function seedDefaultEquipment(soldierId) {
  const rows = DEFAULT_EQUIPMENT.map(item => ({
    soldier_id: soldierId,
    item_type:  item.key,
    status:     'missing',
  }));

  const { error } = await supabase.from('soldier_equipment').insert(rows);
  if (error) {
    // Non-fatal: soldier was created, equipment seed failed → log but don't throw
    console.error('seedDefaultEquipment failed:', error.message);
  }
}

// ─── Public service methods ───────────────────────────────────────────────────

export const soldierService = {

  async getAll() {
    const { data, error } = await supabase
      .from('soldiers')
      .select('*')
      .order('serial_num', { ascending: true })
      .order('full_name',  { ascending: true });

    if (error) throw mapSupabaseError(error);
    return data ?? [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('soldiers')
      .select('*')
      .eq('id', id)
      .maybeSingle();   // ← replaces .limit(1) + data[0]

    if (error) throw mapSupabaseError(error);
    return assertExists(data, 'חייל');
  },

  async create(fields) {
    const {
      personal_id, full_name, role = 'lohem', status = 'זמין', phone,
      company, team, gender = 'זכר',
      mil_shirt, mil_pants, mil_boots,
      civil_shirt, civil_pants,
      is_vegan = 0, is_vegetarian = 0,
      lactose_intolerant = 0, gluten_free = 0,
      nutrition_notes,
    } = fields;

    // ── Get next serial number via DB RPC (race-condition safe) ───────────────
    const { data: serialData, error: serialError } = await supabase
      .rpc('get_next_serial_num');

    if (serialError) throw mapSupabaseError(serialError);
    const serial_num = serialData;

    // ── Insert soldier ─────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('soldiers')
      .insert({
        serial_num, personal_id, full_name, role, status, phone,
        company, team, gender, mil_shirt, mil_pants, mil_boots,
        civil_shirt: civil_shirt || null,
        civil_pants: civil_pants || null,
        is_vegan, is_vegetarian, lactose_intolerant, gluten_free,
        nutrition_notes,
      })
      .select()
      .single();

    if (error) throw mapSupabaseError(error);

    // ── Seed default equipment (non-blocking) ─────────────────────────────────
    await seedDefaultEquipment(data.id);

    return data;
  },

  async update(id, fields) {
    const ALLOWED = [
      'personal_id', 'full_name', 'role', 'status', 'phone',
      'company', 'team', 'gender',
      'mil_shirt', 'mil_pants', 'mil_boots',
      'civil_shirt', 'civil_pants',
      'is_vegan', 'is_vegetarian', 'lactose_intolerant', 'gluten_free',
      'nutrition_notes', 'last_mission_end',
      'total_guard_hours', 'total_mission_hours',
    ];

    const updates = {};
    ALLOWED.forEach(f => { if (fields[f] !== undefined) updates[f] = fields[f]; });

    if (Object.keys(updates).length === 0) {
      // Nothing to update — return current record
      return this.getById(id);
    }

    const { data, error } = await supabase
      .from('soldiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    return data;
  },

  async bulkUpdateStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw Errors.badRequest('נדרש מערך מזהים');
    }

    const VALID_STATUSES = ['זמין', 'במשימה', 'מנוחה', 'חופשה', 'אחר'];
    if (!VALID_STATUSES.includes(status)) {
      throw Errors.badRequest('סטטוס לא חוקי');
    }

    const { error } = await supabase
      .from('soldiers')
      .update({ status })
      .in('id', ids);

    if (error) throw mapSupabaseError(error);
    return { ok: true, count: ids.length };
  },

  async bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw Errors.badRequest('נדרש מערך מזהים');
    }

    const { error } = await supabase
      .from('soldiers')
      .delete()
      .in('id', ids);

    if (error) throw mapSupabaseError(error);
    return { ok: true, count: ids.length };
  },
};
