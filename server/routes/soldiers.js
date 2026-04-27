/**
 * routes/soldiers.js — Thin HTTP layer. No business logic here.
 *
 * Pattern: validate → call service → return result
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, Schemas, z } from '../middleware/validate.js';
import { soldierService } from '../services/soldierService.js';

const router = Router();

// ── GET /api/soldiers ─────────────────────────────────────────────────────────
router.get('/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = await soldierService.getAll();
    res.json(data);
  })
);

// ── GET /api/soldiers/:id ─────────────────────────────────────────────────────
router.get('/:id',
  requireAuth,
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const data = await soldierService.getById(req.params.id);
    res.json(data);
  })
);

// ── POST /api/soldiers ────────────────────────────────────────────────────────
router.post('/',
  requireAuth, requireRole('samal'),
  validate({ body: Schemas.createSoldier }),
  asyncHandler(async (req, res) => {
    const soldier = await soldierService.create(req.body);
    res.status(201).json(soldier);
  })
);

// ── PUT /api/soldiers/bulk/status ─────────────────────────────────────────────
// NOTE: must be defined BEFORE /:id or Express matches 'bulk' as an id
router.put('/bulk/status',
  requireAuth, requireRole('samal'),
  validate({
    body: z.object({
      ids:    z.array(z.number().int().positive()).min(1),
      status: z.enum(['זמין', 'במשימה', 'מנוחה', 'חופשה', 'אחר']),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await soldierService.bulkUpdateStatus(req.body.ids, req.body.status);
    res.json(result);
  })
);

// ── DELETE /api/soldiers/bulk ─────────────────────────────────────────────────
router.delete('/bulk',
  requireAuth, requireRole('mefaked'),
  validate({
    body: z.object({
      ids: z.array(z.number().int().positive()).min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const result = await soldierService.bulkDelete(req.body.ids);
    res.json(result);
  })
);

// ── PUT /api/soldiers/:id ─────────────────────────────────────────────────────
router.put('/:id',
  requireAuth, requireRole('samal'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const updated = await soldierService.update(req.params.id, req.body);
    res.json(updated);
  })
);

export default router;
