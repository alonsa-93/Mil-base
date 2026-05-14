/**
 * routes/equipment.js — Thin HTTP layer.
 *
 * Fixes from original:
 *   - /gaps: removed broken RPC call + manual re-fetch → single query with lt filter
 *   - .limit(1) → .maybeSingle() where applicable
 *   - All errors routed through errorHandler via asyncHandler
 */

import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, Schemas, z } from '../middleware/validate.js';
import { mapSupabaseError, Errors } from '../lib/errors.js';

const router = Router();

// ── GET /api/equipment/items ──────────────────────────────────────────────────
router.get('/items',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('equipment_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name',     { ascending: true });

    if (error) throw mapSupabaseError(error);
    res.json(data ?? []);
  })
);

// ── POST /api/equipment/items ─────────────────────────────────────────────────
router.post('/items',
  requireAuth, requireRole('rasap'),
  validate({
    body: z.object({
      name:               z.string().min(1),
      category:           z.enum(['ציוד מגן', 'נשק', 'תקשורת', 'לוגיסטיקה', 'רפואה', 'אחר']),
      total_quantity:     z.number().int().min(0).default(0),
      available_quantity: z.number().int().min(0).default(0),
      min_required:       z.number().int().min(0).default(0),
      unit_of_measure:    z.string().default('יחידה'),
      notes:              z.string().max(500).optional().nullable(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('equipment_items')
      .insert(req.body)
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    res.status(201).json(data);
  })
);

// ── PUT /api/equipment/items/:id ──────────────────────────────────────────────
router.put('/items/:id',
  requireAuth, requireRole('rasap'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const ALLOWED = ['name', 'category', 'total_quantity', 'available_quantity', 'min_required', 'unit_of_measure', 'notes'];
    const updates = {};
    ALLOWED.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length === 0) {
      const { data, error } = await supabase
        .from('equipment_items').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw mapSupabaseError(error);
      if (!data) throw Errors.notFound('פריט ציוד');
      return res.json(data);
    }

    const { data, error } = await supabase
      .from('equipment_items')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    res.json(data);
  })
);

// ── DELETE /api/equipment/items/:id ──────────────────────────────────────────
router.delete('/items/:id',
  requireAuth, requireRole('mefaked'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('equipment_items')
      .delete()
      .eq('id', req.params.id);

    if (error) throw mapSupabaseError(error);
    res.json({ ok: true });
  })
);

// ── GET /api/equipment/soldier/:soldierId ─────────────────────────────────────
router.get('/soldier/all',
  requireAuth,
  asyncHandler(async (_req, res) => {
    // Get all soldiers with their equipment in a single joined query
    const { data, error } = await supabase
      .from('soldiers')
      .select('id, full_name, serial_num, soldier_equipment(item_type, status, updated_at)')
      .order('serial_num', { ascending: true });

    if (error) throw mapSupabaseError(error);

    // Reshape to { id, full_name, equipment: [...] }
    const result = (data ?? []).map(s => ({
      id:        s.id,
      full_name: s.full_name,
      serial_num: s.serial_num,
      equipment: s.soldier_equipment ?? [],
    }));

    res.json(result);
  })
);

router.get('/soldier/:soldierId',
  requireAuth,
  validate({
    params: z.object({ soldierId: z.string().regex(/^\d+$/).transform(Number) }),
  }),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('soldier_equipment')
      .select('*')
      .eq('soldier_id', req.params.soldierId);

    if (error) throw mapSupabaseError(error);
    res.json(data ?? []);
  })
);

// ── PUT /api/equipment/soldier/:soldierId/:itemType ───────────────────────────
router.put('/soldier/:soldierId/:itemType',
  requireAuth,
  validate({
    body:   z.object({ status: z.enum(['missing', 'issued', 'returned']) }),
    params: z.object({
      soldierId: z.string().regex(/^\d+$/).transform(Number),
      itemType:  z.string().min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('soldier_equipment')
      .update({
        status:     req.body.status,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('soldier_id', req.params.soldierId)
      .eq('item_type',  req.params.itemType)
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    res.json(data);
  })
);

// ── GET /api/equipment/gaps ───────────────────────────────────────────────────
// FIXED: Original code had a broken .rpc() call followed by a redundant
// full re-fetch. Now: single query, filter in JS.
// Note: PostgREST does not support column-to-column comparisons (a < b)
// via the SDK directly, so we filter in Node after a single SELECT.
router.get('/gaps',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('equipment_items')
      .select('id, name, category, available_quantity, min_required, total_quantity');

    if (error) throw mapSupabaseError(error);

    const gaps = (data ?? [])
      .filter(item => item.available_quantity < item.min_required)
      .map(item => ({
        ...item,
        gap: item.min_required - item.available_quantity,
      }));

    res.json(gaps);
  })
);

// ── GET /api/equipment/assignments ────────────────────────────────────────────
// Returns active equipment issuances with joined soldier + item names so
// the frontend can render a single table without N+1 lookups.
router.get('/assignments',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('equipment_assignments')
      .select(`
        id, quantity, status, issued_at, returned_at,
        soldier:soldiers(id, full_name, personal_id),
        item:equipment_items(id, name, category)
      `)
      .order('issued_at', { ascending: false });

    if (error) throw mapSupabaseError(error);

    const flat = (data ?? []).map(a => ({
      id:          a.id,
      quantity:    a.quantity,
      status:      a.status,
      issued_at:   a.issued_at,
      returned_at: a.returned_at,
      soldier_id:  a.soldier?.id,
      full_name:   a.soldier?.full_name,
      personal_id: a.soldier?.personal_id,
      item_id:     a.item?.id,
      item_name:   a.item?.name,
      category:    a.item?.category,
    }));

    res.json(flat);
  })
);

// ── POST /api/equipment/issue ─────────────────────────────────────────────────
// Issues N units of an item to a soldier. Decrements available_quantity
// and creates an `equipment_assignments` row with status='הונפק'.
//
// Note: we attempt the atomic RPC `fn_issue_equipment` first (defined in
// supabase/02_rpc_functions.sql) — if it's missing in this environment we
// fall back to a 2-step write. Either path returns the new assignment.
router.post('/issue',
  requireAuth, requireRole('rasap'),
  validate({
    body: z.object({
      soldier_id: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
      item_id:    z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
      quantity:   z.number().int().min(1).default(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { soldier_id, item_id, quantity } = req.body;

    // Try atomic RPC first
    const rpcAttempt = await supabase.rpc('fn_issue_equipment', {
      p_soldier_id: soldier_id, p_item_id: item_id, p_quantity: quantity, p_issued_by: req.user.id,
    });
    if (!rpcAttempt.error && rpcAttempt.data) {
      return res.status(201).json(rpcAttempt.data);
    }

    // ── Fallback: 2-step write ────────────────────────────────────────────────
    const { data: item, error: itemErr } = await supabase
      .from('equipment_items')
      .select('id, available_quantity')
      .eq('id', item_id)
      .maybeSingle();

    if (itemErr) throw mapSupabaseError(itemErr);
    if (!item) throw Errors.notFound('פריט ציוד');
    if (item.available_quantity < quantity) throw Errors.badRequest('אין מספיק במלאי');

    const { error: decErr } = await supabase
      .from('equipment_items')
      .update({ available_quantity: item.available_quantity - quantity })
      .eq('id', item_id);
    if (decErr) throw mapSupabaseError(decErr);

    const { data: assignment, error: insErr } = await supabase
      .from('equipment_assignments')
      .insert({
        soldier_id, item_id, quantity,
        status: 'הונפק',
        issued_by: req.user.id,
      })
      .select()
      .single();

    if (insErr) throw mapSupabaseError(insErr);
    res.status(201).json(assignment);
  })
);

// ── POST /api/equipment/return/:id ────────────────────────────────────────────
// Returns issued equipment to inventory. Marks the assignment as 'הוחזר'
// and increments equipment_items.available_quantity by the assignment's quantity.
router.post('/return/:id',
  requireAuth, requireRole('rasap'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const { data: assignment, error: aErr } = await supabase
      .from('equipment_assignments')
      .select('id, item_id, quantity, status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (aErr) throw mapSupabaseError(aErr);
    if (!assignment) throw Errors.notFound('הנפקה');
    if (assignment.status === 'הוחזר') throw Errors.badRequest('הציוד כבר הוחזר');

    // Increment inventory
    const { data: item, error: itemErr } = await supabase
      .from('equipment_items')
      .select('available_quantity')
      .eq('id', assignment.item_id)
      .maybeSingle();

    if (itemErr) throw mapSupabaseError(itemErr);

    const { error: incErr } = await supabase
      .from('equipment_items')
      .update({ available_quantity: (item?.available_quantity ?? 0) + assignment.quantity })
      .eq('id', assignment.item_id);
    if (incErr) throw mapSupabaseError(incErr);

    // Mark returned
    const { data: updated, error: upErr } = await supabase
      .from('equipment_assignments')
      .update({ status: 'הוחזר', returned_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (upErr) throw mapSupabaseError(upErr);

    res.json(updated);
  })
);

export default router;
