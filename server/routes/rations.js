import { Router } from 'express';
import { getDb } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM rations_requests ORDER BY date DESC, created_at DESC').all());
});

// Generate ration demand based on current soldiers
router.get('/demand', requireAuth, (req, res) => {
  const db = getDb();
  const soldiers = db.prepare(`SELECT * FROM soldiers WHERE status NOT IN ('חופשה')`).all();

  const demand = {
    total: soldiers.length,
    vegan: soldiers.filter(s => s.is_vegan).length,
    vegetarian: soldiers.filter(s => s.is_vegetarian && !s.is_vegan).length,
    lactose_free: soldiers.filter(s => s.lactose_intolerant).length,
    gluten_free: soldiers.filter(s => s.gluten_free).length,
    standard: soldiers.filter(s => !s.is_vegan && !s.is_vegetarian).length,
    soldiers,
  };
  res.json(demand);
});

router.post('/', requireAuth, requireRole('rasap'), (req, res) => {
  const db = getDb();
  const { date, meal_type, total_count, vegan_count, vegetarian_count, lactose_free_count, gluten_free_count, notes } = req.body;
  if (!date || !meal_type) return res.status(400).json({ error: 'שדות חובה חסרים' });

  const r = db.prepare(`
    INSERT INTO rations_requests (date,meal_type,total_count,vegan_count,vegetarian_count,lactose_free_count,gluten_free_count,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(date, meal_type, total_count, vegan_count ?? 0, vegetarian_count ?? 0, lactose_free_count ?? 0, gluten_free_count ?? 0, notes, req.user.id);

  res.status(201).json(db.prepare('SELECT * FROM rations_requests WHERE id = ?').get(r.lastInsertRowid));
});

router.delete('/:id', requireAuth, requireRole('rasap'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM rations_requests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
