/**
 * routes/rations.js — Thin route layer.
 *
 * Improvement: /demand now uses get_rations_demand() RPC —
 * DB calculates counts instead of fetching all soldiers to Node.js.
 */

import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, Schemas, z } from '../middleware/validate.js';
import { mapSupabaseError } from '../lib/errors.js';

const router = Router();

// ── GET /api/rations ──────────────────────────────────────────────────────────
router.get('/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('rations_requests')
      .select('*')
      .order('date',       { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw mapSupabaseError(error);
    res.json(data ?? []);
  })
);

// ── GET /api/rations/demand ───────────────────────────────────────────────────
// IMPROVED: DB function calculates demand → 1 query, no full table fetch
router.get('/demand',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.rpc('get_rations_demand');
    if (error) throw mapSupabaseError(error);
    res.json(data);
  })
);

// ── POST /api/rations ─────────────────────────────────────────────────────────
router.post('/',
  requireAuth, requireRole('rasap'),
  validate({ body: Schemas.createRation }),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('rations_requests')
      .insert({ ...req.body, created_by: req.user.id })
      .select()
      .single();

    if (error) throw mapSupabaseError(error);
    res.status(201).json(data);
  })
);

// ── DELETE /api/rations/:id ───────────────────────────────────────────────────
router.delete('/:id',
  requireAuth, requireRole('rasap'),
  validate({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  }),
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('rations_requests')
      .delete()
      .eq('id', req.params.id);

    if (error) throw mapSupabaseError(error);
    res.json({ ok: true });
  })
);

export default router;
