import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rations_requests')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get rations requests error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת בקשות קציצות' });
  }
});

// Generate ration demand based on current soldiers
router.get('/demand', requireAuth, async (req, res) => {
  try {
    const { data: soldiers, error } = await supabase
      .from('soldiers')
      .select('*')
      .neq('status', 'חופשה');

    if (error) throw error;

    const demand = {
      total: soldiers?.length || 0,
      vegan: soldiers?.filter(s => s.is_vegan).length || 0,
      vegetarian: soldiers?.filter(s => s.is_vegetarian && !s.is_vegan).length || 0,
      lactose_free: soldiers?.filter(s => s.lactose_intolerant).length || 0,
      gluten_free: soldiers?.filter(s => s.gluten_free).length || 0,
      standard: soldiers?.filter(s => !s.is_vegan && !s.is_vegetarian).length || 0,
      soldiers,
    };
    res.json(demand);
  } catch (e) {
    console.error('Get rations demand error:', e);
    res.status(500).json({ error: 'שגיאה בחישוב דרישת קציצות' });
  }
});

router.post('/', requireAuth, requireRole('rasap'), async (req, res) => {
  try {
    const { date, meal_type, total_count, vegan_count, vegetarian_count, lactose_free_count, gluten_free_count, notes } = req.body;
    if (!date || !meal_type) return res.status(400).json({ error: 'שדות חובה חסרים' });

    const { data, error } = await supabase
      .from('rations_requests')
      .insert({
        date,
        meal_type,
        total_count: total_count ?? 0,
        vegan_count: vegan_count ?? 0,
        vegetarian_count: vegetarian_count ?? 0,
        lactose_free_count: lactose_free_count ?? 0,
        gluten_free_count: gluten_free_count ?? 0,
        notes,
        created_by: req.user.id
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (e) {
    console.error('Create rations request error:', e);
    res.status(500).json({ error: 'שגיאה ביצירת בקשת קציצות' });
  }
});

router.delete('/:id', requireAuth, requireRole('rasap'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('rations_requests')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete rations request error:', e);
    res.status(500).json({ error: 'שגיאה במחיקת בקשת קציצות' });
  }
});

export default router;
