import { Router } from 'express';
import { getDb } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  const { entity_type, from, to, limit = 100 } = req.query;
  let q = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (entity_type) { q += ' AND entity_type = ?'; params.push(entity_type); }
  if (from) { q += ' AND created_at >= ?'; params.push(from); }
  if (to) { q += ' AND created_at <= ?'; params.push(to); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(q).all(...params));
});

export default router;
