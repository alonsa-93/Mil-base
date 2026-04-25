import { Router } from 'express';
import { getDb } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

router.post('/', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const { mission_id, soldier_id, role_in_mission = 'לוחם', force = false } = req.body;
  if (!mission_id || !soldier_id) return res.status(400).json({ error: 'שדות חסרים' });

  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(mission_id);
  if (!mission) return res.status(404).json({ error: 'משימה לא נמצאה' });

  const soldier = db.prepare('SELECT * FROM soldiers WHERE id = ?').get(soldier_id);
  if (!soldier) return res.status(404).json({ error: 'חייל לא נמצא' });

  // Check duplicate
  const dup = db.prepare('SELECT id FROM assignments WHERE mission_id = ? AND soldier_id = ?').get(mission_id, soldier_id);
  if (dup) return res.status(409).json({ error: 'החייל כבר משובץ למשימה זו' });

  // Conflict check
  const conflict = db.prepare(`
    SELECT m.title, m.start_time, m.end_time FROM assignments a
    JOIN missions m ON a.mission_id = m.id
    WHERE a.soldier_id = ? AND m.status != 'בוטל' AND m.id != ?
      AND m.start_time < ? AND m.end_time > ?
  `).get(soldier_id, mission_id, mission.end_time, mission.start_time);

  if (conflict && !force)
    return res.status(409).json({ error: `חפיפה עם משימה: ${conflict.title}`, conflict });

  // Rest warning
  const lastMission = db.prepare(`
    SELECT MAX(m.end_time) as last_end FROM assignments a
    JOIN missions m ON a.mission_id = m.id
    WHERE a.soldier_id = ? AND m.status != 'בוטל'
  `).get(soldier_id);
  const lastEnd = lastMission?.last_end || soldier.last_mission_end;
  const hoursSince = lastEnd ? (new Date(mission.start_time) - new Date(lastEnd)) / 3600000 : 9;
  const restWarning = hoursSince < 8;

  const result = db.prepare(`
    INSERT INTO assignments (mission_id, soldier_id, role_in_mission, assigned_by, rest_warning)
    VALUES (?, ?, ?, ?, ?)
  `).run(mission_id, soldier_id, role_in_mission, req.user.id, restWarning ? 1 : 0);

  // Update soldier status
  db.prepare(`UPDATE soldiers SET status = 'במשימה' WHERE id = ? AND status = 'זמין'`).run(soldier_id);

  const assignment = db.prepare(`
    SELECT a.*, s.full_name, s.personal_id FROM assignments a
    JOIN soldiers s ON a.soldier_id = s.id WHERE a.id = ?
  `).get(result.lastInsertRowid);

  logAction({ userId: req.user.id, username: req.user.username, action: 'ASSIGN_SOLDIER', entityType: 'assignments', entityId: result.lastInsertRowid, newValue: { mission_id, soldier_id }, ip: req.ip });
  req.io?.emit('assignment:created', { ...assignment, mission_id, restWarning });
  res.status(201).json({ ...assignment, restWarning, hoursSinceLastMission: Math.floor(hoursSince) });
});

router.delete('/:id', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const a = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'לא נמצא' });

  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);

  // Check if soldier has other active missions
  const otherMissions = db.prepare(`
    SELECT COUNT(*) as cnt FROM assignments a
    JOIN missions m ON a.mission_id = m.id
    WHERE a.soldier_id = ? AND m.status IN ('מתוכנן','פעיל')
  `).get(a.soldier_id);

  if (otherMissions.cnt === 0) {
    db.prepare(`UPDATE soldiers SET status = 'זמין' WHERE id = ? AND status = 'במשימה'`).run(a.soldier_id);
  }

  logAction({ userId: req.user.id, username: req.user.username, action: 'UNASSIGN_SOLDIER', entityType: 'assignments', entityId: req.params.id, oldValue: a, ip: req.ip });
  req.io?.emit('assignment:deleted', { id: parseInt(req.params.id), soldier_id: a.soldier_id, mission_id: a.mission_id });
  res.json({ ok: true });
});

export default router;
