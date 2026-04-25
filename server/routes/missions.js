import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    let query = supabase.from('missions').select('*');

    if (from) query = query.gte('start_time', from);
    if (to) query = query.lte('start_time', to);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get missions error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת משימות' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missions')
      .select('*')
      .eq('id', req.params.id)
      .limit(1);

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }

    const mission = data[0];

    // Get assignments with soldier details
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('*, soldiers(full_name, personal_id, status, last_mission_end)')
      .eq('mission_id', req.params.id);

    if (assignError) throw assignError;
    res.json({ ...mission, assignments: assignments || [] });
  } catch (e) {
    console.error('Get mission error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת משימה' });
  }
});

router.post('/', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    const { title, description, location, start_time, end_time, urgency = 'רגיל', type = 'כללי', required_count = 1, vehicle, notes } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: 'שדות חובה חסרים' });
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ error: 'שעת סיום חייבת להיות אחרי שעת התחלה' });
    }

    const { data, error } = await supabase
      .from('missions')
      .insert({
        title,
        description,
        location,
        start_time,
        end_time,
        urgency,
        type,
        required_count,
        vehicle,
        notes,
        created_by: req.user.id
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (e) {
    console.error('Create mission error:', e);
    res.status(500).json({ error: 'שגיאה ביצירת משימה' });
  }
});

router.put('/:id', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    const fields = ['title', 'description', 'location', 'start_time', 'end_time', 'status', 'urgency', 'type', 'required_count', 'vehicle', 'notes'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length === 0) {
      const { data } = await supabase.from('missions').select('*').eq('id', req.params.id).limit(1);
      return res.json(data[0]);
    }

    const { data, error } = await supabase
      .from('missions')
      .update(updates)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (e) {
    console.error('Update mission error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון משימה' });
  }
});

router.delete('/:id', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('missions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete mission error:', e);
    res.status(500).json({ error: 'שגיאה במחיקת משימה' });
  }
});

export default router;
