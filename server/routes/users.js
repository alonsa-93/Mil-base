import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, username, full_name, role, phone, created_at FROM users ORDER BY role DESC, full_name').all());
});

router.post('/', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  const { username, password, full_name, role, phone } = req.body;
  if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'שדות חובה חסרים' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const r = db.prepare('INSERT INTO users (username, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?)').run(username, hash, full_name, role, phone);
    const user = db.prepare('SELECT id, username, full_name, role, phone, created_at FROM users WHERE id = ?').get(r.lastInsertRowid);
    logAction({ userId: req.user.id, username: req.user.username, action: 'CREATE_USER', entityType: 'users', entityId: user.id, newValue: { username, role }, ip: req.ip });
    res.status(201).json(user);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'שם משתמש כבר קיים' });
    throw e;
  }
});

router.put('/:id', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  const { full_name, role, phone, password } = req.body;
  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (role !== undefined) updates.role = role;
  if (phone !== undefined) updates.phone = phone;
  if (password) updates.password = bcrypt.hashSync(password, 10);

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' });
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT id, username, full_name, role, phone, created_at FROM users WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAuth, requireRole('magad'), (req, res) => {
  const db = getDb();
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
