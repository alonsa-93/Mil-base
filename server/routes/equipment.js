import { Router } from 'express';
import { getDb, DEFAULT_EQUIPMENT_ITEMS, seedDefaultEquipment } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

// ─── Inventory items ──────────────────────────────────────────────────────────

router.get('/items', requireAuth, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM equipment_items ORDER BY category, name').all());
});

router.post('/items', requireAuth, requireRole('rasap'), (req, res) => {
  const db = getDb();
  const { name, category, total_quantity, available_quantity, min_required, unit_of_measure, notes } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'שדות חובה חסרים' });
  const r = db.prepare(`
    INSERT INTO equipment_items (name,category,total_quantity,available_quantity,min_required,unit_of_measure,notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(name, category, total_quantity ?? 0, available_quantity ?? 0, min_required ?? 0, unit_of_measure ?? 'יחידה', notes);
  res.status(201).json(db.prepare('SELECT * FROM equipment_items WHERE id = ?').get(r.lastInsertRowid));
});

router.put('/items/:id', requireAuth, requireRole('rasap'), (req, res) => {
  const db = getDb();
  const fields = ['name','category','total_quantity','available_quantity','min_required','unit_of_measure','notes'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' });
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE equipment_items SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json(db.prepare('SELECT * FROM equipment_items WHERE id = ?').get(req.params.id));
});

router.delete('/items/:id', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM equipment_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Equipment assignments (issue/return) ─────────────────────────────────────

router.get('/assignments', requireAuth, (req, res) => {
  const db = getDb();
  const { soldier_id } = req.query;
  let q = `SELECT ea.*, s.full_name, s.personal_id, ei.name as item_name, ei.category
           FROM equipment_assignments ea
           JOIN soldiers s ON ea.soldier_id = s.id
           JOIN equipment_items ei ON ea.item_id = ei.id`;
  const params = [];
  if (soldier_id) { q += ' WHERE ea.soldier_id = ?'; params.push(soldier_id); }
  q += ' ORDER BY ea.issued_at DESC';
  res.json(db.prepare(q).all(...params));
});

router.post('/issue', requireAuth, requireRole('rasap'), (req, res) => {
  const db = getDb();
  const { soldier_id, item_id, quantity = 1 } = req.body;
  if (!soldier_id || !item_id) return res.status(400).json({ error: 'שדות חסרים' });

  const item = db.prepare('SELECT * FROM equipment_items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'פריט לא נמצא' });
  if (item.available_quantity < quantity) return res.status(400).json({ error: 'אין מספיק מלאי' });

  const r = db.prepare(`
    INSERT INTO equipment_assignments (soldier_id, item_id, quantity, issued_by) VALUES (?, ?, ?, ?)
  `).run(soldier_id, item_id, quantity, req.user.id);

  db.prepare('UPDATE equipment_items SET available_quantity = available_quantity - ? WHERE id = ?').run(quantity, item_id);

  logAction({ userId: req.user.id, username: req.user.username, action: 'ISSUE_EQUIPMENT', entityType: 'equipment', entityId: r.lastInsertRowid, newValue: { soldier_id, item_id, quantity }, ip: req.ip });
  req.io?.emit('equipment:updated');
  res.status(201).json({ id: r.lastInsertRowid });
});

router.post('/return/:id', requireAuth, requireRole('rasap'), (req, res) => {
  const db = getDb();
  const ea = db.prepare('SELECT * FROM equipment_assignments WHERE id = ?').get(req.params.id);
  if (!ea) return res.status(404).json({ error: 'לא נמצא' });
  if (ea.status === 'הוחזר') return res.status(400).json({ error: 'הציוד כבר הוחזר' });

  db.prepare(`UPDATE equipment_assignments SET status = 'הוחזר', returned_at = datetime('now','localtime') WHERE id = ?`).run(req.params.id);
  db.prepare('UPDATE equipment_items SET available_quantity = available_quantity + ? WHERE id = ?').run(ea.quantity, ea.item_id);

  logAction({ userId: req.user.id, username: req.user.username, action: 'RETURN_EQUIPMENT', entityType: 'equipment', entityId: req.params.id, ip: req.ip });
  req.io?.emit('equipment:updated');
  res.json({ ok: true });
});

// ─── Gaps ─────────────────────────────────────────────────────────────────────

router.get('/gaps', requireAuth, (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM equipment_items').all();
  const gaps = items
    .filter(i => i.available_quantity < i.min_required)
    .map(i => ({ ...i, gap: i.min_required - i.available_quantity }));
  res.json(gaps);
});

// ─── Soldier personal equipment (checklist) ───────────────────────────────────

router.get('/soldier/:soldierIdOrAll', requireAuth, (req, res) => {
  const db = getDb();
  const { soldierIdOrAll } = req.params;

  if (soldierIdOrAll === 'all') {
    // Return all soldiers with their equipment summary
    const soldiers = db.prepare('SELECT id, full_name, personal_id, company, team FROM soldiers ORDER BY serial_num ASC').all();
    const result = soldiers.map(s => {
      const items = db.prepare('SELECT * FROM soldier_equipment WHERE soldier_id = ?').all(s.id);
      // Seed if missing
      if (items.length === 0) {
        seedDefaultEquipment(s.id);
        return { ...s, equipment: DEFAULT_EQUIPMENT_ITEMS.map(i => ({ item_type: i.key, label: i.label, status: 'missing' })) };
      }
      const itemMap = {};
      items.forEach(i => { itemMap[i.item_type] = i.status; });
      return {
        ...s,
        equipment: DEFAULT_EQUIPMENT_ITEMS.map(i => ({ item_type: i.key, label: i.label, status: itemMap[i.key] || 'missing' }))
      };
    });
    return res.json(result);
  }

  const soldierId = parseInt(soldierIdOrAll);
  let items = db.prepare('SELECT * FROM soldier_equipment WHERE soldier_id = ?').all(soldierId);
  if (items.length === 0) {
    seedDefaultEquipment(soldierId);
    items = db.prepare('SELECT * FROM soldier_equipment WHERE soldier_id = ?').all(soldierId);
  }
  const itemMap = {};
  items.forEach(i => { itemMap[i.item_type] = i; });
  const result = DEFAULT_EQUIPMENT_ITEMS.map(def => ({
    item_type: def.key,
    label: def.label,
    status: itemMap[def.key]?.status || 'missing',
    updated_at: itemMap[def.key]?.updated_at,
  }));
  res.json(result);
});

router.put('/soldier/:soldierId/:itemType', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const { soldierId, itemType } = req.params;
  const { status } = req.body;
  const VALID = ['missing', 'issued', 'returned'];
  if (!VALID.includes(status)) return res.status(400).json({ error: 'סטטוס לא תקין' });

  db.prepare(`
    INSERT INTO soldier_equipment (soldier_id, item_type, status, updated_at, updated_by)
    VALUES (?, ?, ?, datetime('now','localtime'), ?)
    ON CONFLICT(soldier_id, item_type) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(soldierId, itemType, status, req.user.id);

  logAction({ userId: req.user.id, username: req.user.username, action: 'UPDATE_SOLDIER_EQUIPMENT', entityType: 'soldier_equipment', entityId: parseInt(soldierId), newValue: { itemType, status }, ip: req.ip });
  req.io?.emit('equipment:soldier_updated', { soldierId: parseInt(soldierId), itemType, status });
  res.json({ ok: true });
});

export default router;
