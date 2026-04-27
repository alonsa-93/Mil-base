/**
 * routes/audit.js — Audit log read endpoint.
 * Thin route; DB triggers (03_audit_triggers.sql) handle writes automatically.
 */

import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, z } from '../middleware/validate.js';
import { mapSupabaseError } from '../lib/errors.js';

const router = Router();

router.get('/',
  requireAuth, requireRole('mefaked'),
  validate({
    query: z.object({
      entity_type: z.string().optional(),
      from:        z.string().optional(),
      to:          z.string().optional(),
      user_id:     z.string().regex(/^\d+$/).transform(Number).optional(),
      limit:       z.string().regex(/^\d+$/).transform(Number).default('100'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { entity_type, from, to, user_id, limit } = req.query;

    let q = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));   // hard cap at 500

    if (entity_type) q = q.eq('entity_type', entity_type);
    if (from)        q = q.gte('created_at', from);
    if (to)          q = q.lte('created_at', to);
    if (user_id)     q = q.eq('user_id', user_id);

    const { data, error } = await q;
    if (error) throw mapSupabaseError(error);
    res.json(data ?? []);
  })
);

export default router;
