import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { supabase } from '../supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, role, phone, created_at')
      .order('role', { ascending: false })
      .order('full_name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    console.error('Get users error:', e);
    res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
  }
});

router.post('/', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { username, password, full_name, role, phone } = req.body;
    if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'שדות חובה חסרים' });

    const hash = bcrypt.hashSync(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        password: hash,
        full_name,
        role,
        phone
      })
      .select('id, username, full_name, role, phone, created_at');

    if (error) {
      if (error.message.includes('unique') || error.code === '23505') {
        return res.status(409).json({ error: 'שם משתמש כבר קיים' });
      }
      throw error;
    }

    const user = data[0];
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      action: 'CREATE_USER',
      entityType: 'users',
      entityId: user.id,
      newValue: { username, role },
      ip: req.ip
    });

    res.status(201).json(user);
  } catch (e) {
    console.error('Create user error:', e);
    res.status(500).json({ error: 'שגיאה ביצירת משתמש' });
  }
});

router.put('/:id', requireAuth, requireRole('mefaked'), async (req, res) => {
  try {
    const { full_name, role, phone, password } = req.body;
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role !== undefined) updates.role = role;
    if (phone !== undefined) updates.phone = phone;
    if (password) updates.password = bcrypt.hashSync(password, 10);

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'אין שדות לעדכון' });

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, username, full_name, role, phone, created_at');

    if (error) throw error;
    res.json(data[0]);
  } catch (e) {
    console.error('Update user error:', e);
    res.status(500).json({ error: 'שגיאה בעדכון משתמש' });
  }
});

router.delete('/:id', requireAuth, requireRole('magad'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ error: 'שגיאה במחיקת משתמש' });
  }
});

export default router;
