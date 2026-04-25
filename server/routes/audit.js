import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { entity_type, from, to, limit = 100 } = req.query;
    let query = supabase.from('audit_log').select('*');

    if (entity_type) query = query.eq('entity_type', entity_type);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get audit logs error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת יומן ביקורת' });
  }
});

export default router;
