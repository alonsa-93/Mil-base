import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const DEFAULT_EQUIPMENT_ITEMS = [
  { key: 'weapon', label: 'נשק אישי' },
  { key: 'vest', label: 'אפוד / ווסט' },
  { key: 'helmet', label: 'קסדה' },
  { key: 'magazines', label: '5 מחסניות' },
  { key: 'knee_pads', label: 'ברכיות' },
  { key: 'medical_kit', label: 'חסם עורקים ותחבושת אישית' },
];

// ─── Inventory items ──────────────────────────────────────────────────────────

router.get('/items', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get equipment items error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת ציוד' });
  }
});

router.post('/items', requireAuth, requireRole('rasap'), async (req, res) => {
  try {
    const { name, category, total_quantity, available_quantity, min_required, unit_of_measure, notes } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'שדות חובה חסרים' });

    const { data, error } = await supabase
      .from('equipment_items')
      .insert({
        name,
        category,
        total_quantity: total_quantity ?? 0,
        available_quantity: available_quantity ?? 0,
        min_required: min_required ?? 0,
        unit_of_measure: unit_of_measure ?? 'יחידה',
        notes
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (e) {
    console.error('Create equipment item error:', e);
    res.status(500).json({ error: 'שגיאה ביצירת פריט' });
  }
});

router.put('/items/:id', requireAuth, requireRole('rasap'), async (req, res) => {
  try {
    const fields = ['name', 'category', 'total_quantity', 'available_quantity', 'min_required', 'unit_of_measure', 'notes'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (Object.keys(updates).length === 0) {
      const { data } = await supabase.from('equipment_items').select('*').eq('id', req.params.id).limit(1);
      return res.json(data[0]);
    }

    const { data, error } = await supabase
      .from('equipment_items')
      .update(updates)
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (e) {
    console.error('Update equipment item error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון פריט' });
  }
});

router.delete('/items/:id', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('equipment_items')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete equipment item error:', e);
    res.status(500).json({ error: 'שגיאה במחיקת פריט' });
  }
});

// ─── Soldier Equipment (Personal Equipment Status) ────────────────────────────

router.get('/soldier/:soldierId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('soldier_equipment')
      .select('*')
      .eq('soldier_id', req.params.soldierId);

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get soldier equipment error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת ציוד אישי' });
  }
});

router.put('/soldier/:soldierId/:itemType', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['missing', 'issued', 'returned'].includes(status)) {
      return res.status(400).json({ error: 'סטטוס לא תקין' });
    }

    const { data, error } = await supabase
      .from('soldier_equipment')
      .update({ status, updated_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('soldier_id', req.params.soldierId)
      .eq('item_type', req.params.itemType)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (e) {
    console.error('Update soldier equipment error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון ציוד אישי' });
  }
});

// ─── Gaps ───────────────────────────────────────────────────────────────────

router.get('/gaps', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment_items')
      .select('id, name, category, available_quantity, min_required')
      .lt('available_quantity', supabase.rpc('min_required'));

    if (error) throw error;

    // Manually filter since RPC might not work
    const { data: items } = await supabase.from('equipment_items').select('*');
    const gaps = items?.filter(item => item.available_quantity < item.min_required) || [];

    res.json(gaps);
  } catch (e) {
    console.error('Get equipment gaps error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת פערים' });
  }
});

export default router;
