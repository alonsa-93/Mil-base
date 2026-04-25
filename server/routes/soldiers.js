import { Router } from 'express';
import { getDb, seedDefaultEquipment } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const soldiers = db.prepare('SELECT * FROM soldiers ORDER BY serial_num ASC, full_name ASC').all();
  res.json(soldiers);
});

router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const soldier = db.prepare('SELECT * FROM soldiers WHERE id = ?').get(req.params.id);
  if (!soldier) return res.status(404).json({ error: 'לא נמצא' });
  res.json(soldier);
});

router.post('/', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const {
    personal_id, full_name, role = 'lohem', status = 'זמין', phone,
    company, team, gender = 'זכר',
    mil_shirt, mil_pants, mil_boots,
    is_vegan = 0, is_vegetarian = 0, lactose_intolerant = 0, gluten_free = 0, nutrition_notes
  } = req.body;

  if (!personal_id || !full_name || !phone || !company || !team || !role || !status)
    return res.status(400).json({ error: 'שדות חובה חסרים' });

  // Auto serial_num
  const maxSerial = db.prepare('SELECT MAX(serial_num) as m FROM soldiers').get();
  const serial_num = (maxSerial?.m || 0) + 1;

  const result = db.prepare(`
    INSERT INTO soldiers (serial_num,personal_id,full_name,role,status,phone,company,team,gender,
      mil_shirt,mil_pants,mil_boots,
      is_vegan,is_vegetarian,lactose_intolerant,gluten_free,nutrition_notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(serial_num, personal_id, full_name, role, status, phone, company, team, gender,
    mil_shirt, mil_pants, mil_boots,
    is_vegan, is_vegetarian, lactose_intolerant, gluten_free, nutrition_notes);

  seedDefaultEquipment(result.lastInsertRowid);

  const soldier = db.prepare('SELECT * FROM soldiers WHERE id = ?').get(result.lastInsertRowid);
  logAction({ userId: req.user.id, username: req.user.username, action: 'CREATE_SOLDIER', entityType: 'soldiers', entityId: soldier.id, newValue: soldier, ip: req.ip });

  req.io?.emit('soldier:created', soldier);
  res.status(201).json(soldier);
});

router.put('/:id', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM soldiers WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'לא נמצא' });

  const fields = [
    'personal_id','full_name','role','status','phone','company','team','gender',
    'mil_shirt','mil_pants','mil_boots',
    'is_vegan','is_vegetarian','lactose_intolerant','gluten_free','nutrition_notes',
    'last_mission_end','total_guard_hours','total_mission_hours'
  ];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0) return res.json(old);

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE soldiers SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  const updated = db.prepare('SELECT * FROM soldiers WHERE id = ?').get(req.params.id);
  logAction({ userId: req.user.id, username: req.user.username, action: 'UPDATE_SOLDIER', entityType: 'soldiers', entityId: req.params.id, oldValue: old, newValue: updated, ip: req.ip });

  req.io?.emit('soldier:updated', updated);
  res.json(updated);
});

// Bulk status update
router.put('/bulk/status', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !ids.length || !status) return res.status(400).json({ error: 'שדות חסרים' });

  const stmt = db.prepare('UPDATE soldiers SET status = ? WHERE id = ?');
  const update = db.transaction(() => ids.forEach(id => stmt.run(status, id)));
  update();

  logAction({ userId: req.user.id, username: req.user.username, action: 'BULK_STATUS_UPDATE', entityType: 'soldiers', newValue: { ids, status }, ip: req.ip });
  req.io?.emit('soldier:bulk_updated', { ids, status });
  res.json({ ok: true, count: ids.length });
});

// Bulk delete
router.delete('/bulk', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'שדות חסרים' });

  const stmt = db.prepare('DELETE FROM soldiers WHERE id = ?');
  const del = db.transaction(() => ids.forEach(id => stmt.run(id)));
  del();

  logAction({ userId: req.user.id, username: req.user.username, action: 'BULK_DELETE_SOLDIERS', entityType: 'soldiers', newValue: { ids }, ip: req.ip });
  req.io?.emit('soldier:bulk_deleted', { ids });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM soldiers WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'לא נמצא' });

  db.prepare('DELETE FROM soldiers WHERE id = ?').run(req.params.id);
  logAction({ userId: req.user.id, username: req.user.username, action: 'DELETE_SOLDIER', entityType: 'soldiers', entityId: req.params.id, oldValue: old, ip: req.ip });

  req.io?.emit('soldier:deleted', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

router.get('/:id/missions', requireAuth, (req, res) => {
  const db = getDb();
  const assignments = db.prepare(`
    SELECT a.*, m.title, m.start_time, m.end_time, m.type, m.status
    FROM assignments a
    JOIN missions m ON a.mission_id = m.id
    WHERE a.soldier_id = ?
    ORDER BY m.start_time DESC
    LIMIT 50
  `).all(req.params.id);
  res.json(assignments);
});

export default router;
