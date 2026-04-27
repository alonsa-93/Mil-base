/**
 * routes/missions.js — Thin HTTP layer. No business logic here.
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, Schemas, z } from '../middleware/validate.js';
import { missionService } from '../services/missionService.js';

const router = Router();

// ── GET /api/missions ─────────────────────────────────────────────────────────
router.get('/',
  requireAuth,
  validate({
    query: z.object({
      from:   z.string().optional(),
      to:     z.string().optional(),
      status: z.enum(['מתוכנן', 'פעיל', 'הסתיים', 'בוטל']).optional(),
    }).optional(),
  }),
  asyncHandler(async (req, res) => {
    const missions = await missionService.getAll(req.query);
    res.json(missions);
  })
);

// ── GET /api/missions/:id ─────────────────────────────────────────────────────
router.get('/:id',
  requireAuth,
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const mission = await missionService.getById(req.params.id);
    res.json(mission);
  })
);

// ── POST /api/missions ────────────────────────────────────────────────────────
router.post('/',
  requireAuth, requireRole('samal'),
  validate({ body: Schemas.createMission }),
  asyncHandler(async (req, res) => {
    const mission = await missionService.create(req.body, req.user.id);
    res.status(201).json(mission);
  })
);

// ── POST /api/missions/:id/suggest ───────────────────────────────────────────
// Auto-scheduler: returns ranked soldier suggestions
router.post('/:id/suggest',
  requireAuth, requireRole('samal'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const result = await missionService.suggestSoldiers(req.params.id);
    res.json(result);
  })
);

// ── PUT /api/missions/:id ─────────────────────────────────────────────────────
router.put('/:id',
  requireAuth, requireRole('samal'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    const updated = await missionService.update(req.params.id, req.body);
    res.json(updated);
  })
);

// ── DELETE /api/missions/:id ──────────────────────────────────────────────────
router.delete('/:id',
  requireAuth, requireRole('mefaked'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    await missionService.delete(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
