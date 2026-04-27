/**
 * routes/users.js — User management.
 * Thin route layer; no business logic.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, Schemas, z } from '../middleware/validate.js';
import { mapSupabaseError, Errors } from '../lib/errors.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

const SELECT_SAFE = 'id, username, full_name, role, phone, created_at';

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/',
  requireAuth, requireRole('mefaked'),
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select(SELECT_SAFE)
      .order('role',      { ascending: false })
      .order('full_name', { ascending: true });

    if (error) throw mapSupabaseError(error);
    res.json(data ?? []);
  })
);

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/',
  requireAuth, requireRole('mefaked'),
  validate({ body: Schemas.createUser }),
  asyncHandler(async (req, res) => {
    const { username, password, full_name, role, phone } = req.body;
    const hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert({ username, password: hash, full_name, role, phone })
      .select(SELECT_SAFE)
      .single();

    if (error) throw mapSupabaseError(error);

    // Audit (non-blocking)
    logAction({
      userId: req.user.id, username: req.user.username,
      action: 'CREATE_USER', entityType: 'users',
      entityId: data.id, newValue: { username, role }, ip: req.ip,
    });

    res.status(201).json(data);
  })
);

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
router.put('/:id',
  requireAuth, requireRole('mefaked'),
  validate({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
    body: z.object({
      full_name: z.string().min(2).max(100).optional(),
      role:      z.enum(['lohem', 'samal', 'rasap', 'mefaked', 'magad']).optional(),
      phone:     z.string().max(15).optional().nullable(),
      password:  z.string().min(6).optional(),
    }).refine(d => Object.keys(d).length > 0, { message: 'אין שדות לעדכון' }),
  }),
  asyncHandler(async (req, res) => {
    const { full_name, role, phone, password } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role      !== undefined) updates.role      = role;
    if (phone     !== undefined) updates.phone     = phone;
    if (password)                updates.password  = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select(SELECT_SAFE)
      .single();

    if (error) throw mapSupabaseError(error);
    res.json(data);
  })
);

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id',
  requireAuth, requireRole('magad'),
  validate({
    params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      throw Errors.badRequest('לא ניתן למחוק את עצמך');
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw mapSupabaseError(error);
    res.json({ ok: true });
  })
);

export default router;
