import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    const { mission_id, soldier_id, role_in_mission = 'לוחם', force = false } = req.body;
    if (!mission_id || !soldier_id) return res.status(400).json({ error: 'שדות חסרים' });

    // Check mission exists
    const { data: missions, error: missionError } = await supabase
      .from('missions')
      .select('*')
      .eq('id', mission_id)
      .limit(1);

    if (missionError || !missions || missions.length === 0) {
      return res.status(404).json({ error: 'משימה לא נמצאה' });
    }

    const mission = missions[0];

    // Check soldier exists
    const { data: soldiers, error: soldierError } = await supabase
      .from('soldiers')
      .select('*')
      .eq('id', soldier_id)
      .limit(1);

    if (soldierError || !soldiers || soldiers.length === 0) {
      return res.status(404).json({ error: 'חייל לא נמצא' });
    }

    const soldier = soldiers[0];

    // Check duplicate
    const { data: dup } = await supabase
      .from('assignments')
      .select('id')
      .eq('mission_id', mission_id)
      .eq('soldier_id', soldier_id)
      .limit(1);

    if (dup && dup.length > 0) {
      return res.status(409).json({ error: 'החייל כבר משובץ למשימה זו' });
    }

    // Conflict check
    const { data: conflicts } = await supabase
      .from('assignments')
      .select('missions(title, start_time, end_time)')
      .eq('soldier_id', soldier_id)
      .neq('missions.status', 'בוטל')
      .neq('missions.id', mission_id)
      .lt('missions.start_time', mission.end_time)
      .gt('missions.end_time', mission.start_time)
      .limit(1);

    if (conflicts && conflicts.length > 0 && !force) {
      return res.status(409).json({
        error: `חפיפה עם משימה: ${conflicts[0].missions.title}`,
        conflict: conflicts[0]
      });
    }

    // Rest warning
    const { data: lastMissions } = await supabase
      .from('assignments')
      .select('missions(end_time)')
      .eq('soldier_id', soldier_id)
      .neq('missions.status', 'בוטל')
      .order('missions(end_time)', { ascending: false })
      .limit(1);

    const lastEnd = lastMissions && lastMissions[0]
      ? lastMissions[0].missions.end_time
      : soldier.last_mission_end;

    const hoursSince = lastEnd
      ? (new Date(mission.start_time) - new Date(lastEnd)) / 3600000
      : 9;

    const restWarning = hoursSince < 8;

    // Create assignment
    const { data: assignment, error: insertError } = await supabase
      .from('assignments')
      .insert({
        mission_id,
        soldier_id,
        role_in_mission,
        assigned_by: req.user.id,
        rest_warning: restWarning ? 1 : 0
      })
      .select();

    if (insertError) throw insertError;

    // Update soldier status
    await supabase
      .from('soldiers')
      .update({ status: 'במשימה' })
      .eq('id', soldier_id)
      .eq('status', 'זמין');

    res.status(201).json(assignment[0]);
  } catch (e) {
    console.error('Create assignment error:', e);
    res.status(500).json({ error: 'שגיאה בשיבוץ' });
  }
});

router.delete('/:id', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    // Get assignment to find soldier
    const { data: assignments, error: getError } = await supabase
      .from('assignments')
      .select('soldier_id')
      .eq('id', req.params.id)
      .limit(1);

    if (getError || !assignments || assignments.length === 0) {
      return res.status(404).json({ error: 'שיבוץ לא נמצא' });
    }

    const soldierId = assignments[0].soldier_id;

    // Delete assignment
    const { error: deleteError } = await supabase
      .from('assignments')
      .delete()
      .eq('id', req.params.id);

    if (deleteError) throw deleteError;

    // Reset soldier status to זמין if no other active assignments
    const { data: otherAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('soldier_id', soldierId)
      .limit(1);

    if (!otherAssignments || otherAssignments.length === 0) {
      await supabase
        .from('soldiers')
        .update({ status: 'זמין' })
        .eq('id', soldierId);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Delete assignment error:', e);
    res.status(500).json({ error: 'שגיאה במחיקת שיבוץ' });
  }
});

export default router;
