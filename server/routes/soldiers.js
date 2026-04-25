import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const DEFAULT_EQUIPMENT_ITEMS = [
  { key:'weapon', label:'נשק אישי' },
  { key:'vest', label:'אפוד / ווסט' },
  { key:'helmet', label:'קסדה' },
  { key:'magazines', label:'5 מחסניות' },
  { key:'knee_pads', label:'ברכיות' },
  { key:'medical_kit', label:'חסם עורקים ותחבושת אישית' },
];

async function seedDefaultEquipment(soldierId) {
  for (const item of DEFAULT_EQUIPMENT_ITEMS) {
    await supabase.from('soldier_equipment').insert({
      soldier_id: soldierId,
      item_type: item.key,
      status: 'missing'
    }).select();
  }
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soldiers')
      .select('*')
      .order('serial_num', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get soldiers error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת חיילים' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soldiers')
      .select('*')
      .eq('id', req.params.id)
      .limit(1);

    if (error || !data || data.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }
    res.json(data[0]);
  } catch (e) {
    console.error('Get soldier error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת חייל' });
  }
});

router.post('/', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    const {
      personal_id, full_name, role = 'lohem', status = 'זמין', phone,
      company, team, gender = 'זכר',
      mil_shirt, mil_pants, mil_boots,
      is_vegan = 0, is_vegetarian = 0, lactose_intolerant = 0, gluten_free = 0, nutrition_notes
    } = req.body;

    if (!personal_id || !full_name || !phone || !company || !team || !role || !status) {
      return res.status(400).json({ error: 'שדות חובה חסרים' });
    }

    // Get max serial number
    const { data: maxData, error: maxError } = await supabase
      .from('soldiers')
      .select('serial_num')
      .order('serial_num', { ascending: false })
      .limit(1);

    const serial_num = (maxData && maxData[0]?.serial_num) ? maxData[0].serial_num + 1 : 1;

    const { data, error } = await supabase
      .from('soldiers')
      .insert({
        serial_num,
        personal_id,
        full_name,
        role,
        status,
        phone,
        company,
        team,
        gender,
        mil_shirt,
        mil_pants,
        mil_boots,
        is_vegan,
        is_vegetarian,
        lactose_intolerant,
        gluten_free,
        nutrition_notes
      })
      .select();

    if (error) throw error;

    const soldier = data[0];
    await seedDefaultEquipment(soldier.id);

    res.status(201).json(soldier);
  } catch (e) {
    console.error('Create soldier error:', e);
    res.status(500).json({ error: 'שגיאה ביצירת חייל' });
  }
});

router.put('/:id', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    const { data: oldData, error: oldError } = await supabase
      .from('soldiers')
      .select('*')
      .eq('id', req.params.id)
      .limit(1);

    if (oldError || !oldData || oldData.length === 0) {
      return res.status(404).json({ error: 'לא נמצא' });
    }

    const fields = [
      'personal_id','full_name','role','status','phone','company','team','gender',
      'mil_shirt','mil_pants','mil_boots',
      'is_vegan','is_vegetarian','lactose_intolerant','gluten_free','nutrition_notes',
      'last_mission_end','total_guard_hours','total_mission_hours'
    ];

    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length === 0) {
      return res.json(oldData[0]);
    }

    const { data, error } = await supabase
      .from('soldiers')
      .update(updates)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (e) {
    console.error('Update soldier error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון חייל' });
  }
});

router.put('/bulk/status', requireAuth, requireRole('samal'), async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length || !status) {
      return res.status(400).json({ error: 'שדות חסרים' });
    }

    const { error } = await supabase
      .from('soldiers')
      .update({ status })
      .in('id', ids);

    if (error) throw error;
    res.json({ ok: true, count: ids.length });
  } catch (e) {
    console.error('Bulk status update error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון סטטוס' });
  }
});

router.delete('/bulk', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: 'שדות חסרים' });
    }

    const { error } = await supabase
      .from('soldiers')
      .delete()
      .in('id', ids);

    if (error) throw error;
    res.json({ ok: true, count: ids.length });
  } catch (e) {
    console.error('Bulk delete error:', e);
    res.status(500).json({ error: 'שגיאה במחיקה' });
  }
});

export default router;
