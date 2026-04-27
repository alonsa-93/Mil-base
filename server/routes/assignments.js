/**
 * routes/assignments.js — Thin HTTP layer.
 *
 * All complex logic is in the DB RPC (assign_soldier_to_mission, remove_assignment).
 * This file is now 40 lines vs 160 before — same functionality, zero duplication.
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, Schemas, z } from '../middleware/validate.js';
import { assignmentService } from '../services/assignmentService.js';

const router = Router();

// ── POST /api/assignments ─────────────────────────────────────────────────────
router.post('/',
  requireAuth, requireRole('samal'),
  validate({ body: Schemas.createAssignment }),
  asyncHandler(async (req, res) => {
    const result = await assignmentService.create({
      ...req.body,
      assigned_by: req.user.id,
    });
    res.status(201).json(result);
  })
);

// ── DELETE /api/assignments/:id ───────────────────────────────────────────────
router.delete('/:id',
  requireAuth, requireRole('samal'),
  validate({ params: Schemas.idParam }),
  asyncHandler(async (req, res) => {
    await assignmentService.remove(req.params.id);
    res.json({ ok: true });
  })
);

export default router;
