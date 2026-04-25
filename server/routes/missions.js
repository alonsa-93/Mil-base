import { Router } from 'express';
import { getDb } from '../database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { from, to, status } = req.query;
  let q = 'SELECT * FROM missions WHERE 1=1';
  const params = [];
  if (from) { q += ' AND start_time >= ?'; params.push(from); }
  if (to) { q += ' AND start_time <= ?'; params.push(to); }
  if (status) { q += ' AND status = ?'; params.push(status); }
  q += ' ORDER BY start_time ASC';
  res.json(db.prepare(q).all(...params));
});

router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!mission) return res.status(404).json({ error: 'לא נמצא' });

  const assignments = db.prepare(`
    SELECT a.*, s.full_name, s.personal_id, s.status as soldier_status, s.last_mission_end
    FROM assignments a
    JOIN soldiers s ON a.soldier_id = s.id
    WHERE a.mission_id = ?
  `).all(req.params.id);

  res.json({ ...mission, assignments });
});

router.post('/', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const { title, description, location, start_time, end_time, urgency = 'רגיל', type = 'כללי', required_count = 1, vehicle, notes } = req.body;
  if (!title || !start_time || !end_time) return res.status(400).json({ error: 'שדות חובה חסרים' });
  if (new Date(start_time) >= new Date(end_time)) return res.status(400).json({ error: 'שעת סיום חייבת להיות אחרי שעת התחלה' });

  const result = db.prepare(`
    INSERT INTO missions (title,description,location,start_time,end_time,urgency,type,required_count,vehicle,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(title, description, location, start_time, end_time, urgency, type, required_count, vehicle, notes, req.user.id);

  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(result.lastInsertRowid);
  logAction({ userId: req.user.id, username: req.user.username, action: 'CREATE_MISSION', entityType: 'missions', entityId: mission.id, newValue: mission, ip: req.ip });
  req.io?.emit('mission:created', mission);
  res.status(201).json(mission);
});

router.put('/:id', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'לא נמצא' });

  const fields = ['title','description','location','start_time','end_time','status','urgency','type','required_count','vehicle','notes'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (Object.keys(updates).length === 0) return res.json(old);
  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE missions SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id);

  const updated = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  logAction({ userId: req.user.id, username: req.user.username, action: 'UPDATE_MISSION', entityType: 'missions', entityId: req.params.id, oldValue: old, newValue: updated, ip: req.ip });
  req.io?.emit('mission:updated', updated);
  res.json(updated);
});

router.delete('/:id', requireAuth, requireRole('mefaked'), (req, res) => {
  const db = getDb();
  const old = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'לא נמצא' });

  db.prepare('DELETE FROM missions WHERE id = ?').run(req.params.id);
  logAction({ userId: req.user.id, username: req.user.username, action: 'DELETE_MISSION', entityType: 'missions', entityId: req.params.id, oldValue: old, ip: req.ip });
  req.io?.emit('mission:deleted', { id: parseInt(req.params.id) });
  res.json({ ok: true });
});

// Auto-scheduler: suggest soldiers for a mission
router.post('/:id/suggest', requireAuth, requireRole('samal'), (req, res) => {
  const db = getDb();
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(req.params.id);
  if (!mission) return res.status(404).json({ error: 'לא נמצא' });

  const missionStart = new Date(mission.start_time);
  const REST_HOURS = 8;

  // Get all available soldiers not already assigned
  const assigned = db.prepare('SELECT soldier_id FROM assignments WHERE mission_id = ?').all(req.params.id).map(r => r.soldier_id);
  let soldiers = db.prepare(`SELECT * FROM soldiers WHERE status = 'זמין'`).all()
    .filter(s => !assigned.includes(s.id));

  // Check for conflicts (overlapping missions)
  const withConflict = soldiers.map(s => {
    const conflict = db.prepare(`
      SELECT m.start_time, m.end_time FROM assignments a
      JOIN missions m ON a.mission_id = m.id
      WHERE a.soldier_id = ? AND m.status != 'בוטל'
        AND m.start_time < ? AND m.end_time > ?
    `).get(s.id, mission.end_time, mission.start_time);

    const lastMission = db.prepare(`
      SELECT MAX(m.end_time) as last_end FROM assignments a
      JOIN missions m ON a.mission_id = m.id
      WHERE a.soldier_id = ? AND m.status != 'בוטל'
    `).get(s.id);

    const lastEnd = lastMission?.last_end || s.last_mission_end;
    const hoursSinceRest = lastEnd
      ? (missionStart - new Date(lastEnd)) / 3600000
      : REST_HOURS + 1;

    // Fairness: total hours in last 30 days
    const thirtyDaysAgo = new Date(missionStart.getTime() - 30 * 24 * 3600000).toISOString();
    const hoursRow = db.prepare(`
      SELECT COALESCE(SUM(
        (julianday(m.end_time) - julianday(m.start_time)) * 24
      ), 0) as hours
      FROM assignments a JOIN missions m ON a.mission_id = m.id
      WHERE a.soldier_id = ? AND m.start_time >= ? AND m.status != 'בוטל'
    `).get(s.id, thirtyDaysAgo);

    return {
      ...s,
      hasConflict: !!conflict,
      conflictDetails: conflict,
      hoursSinceRest: Math.floor(hoursSinceRest),
      hasRestWarning: hoursSinceRest < REST_HOURS,
      monthlyHours: Math.round(hoursRow.hours * 10) / 10,
    };
  });

  // Filter out conflicts
  const available = withConflict.filter(s => !s.hasConflict);

  // Sort: no rest warning first, then by monthly hours (fairness)
  available.sort((a, b) => {
    if (a.hasRestWarning !== b.hasRestWarning) return a.hasRestWarning ? 1 : -1;
    return a.monthlyHours - b.monthlyHours;
  });

  res.json({ suggestions: available, allWithConflict: withConflict });
});

export default router;
