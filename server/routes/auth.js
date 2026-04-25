import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'milbase-secret-2024';
const BYPASS_2FA = process.env.BYPASS_2FA === 'true';

// In-memory OTP store (dev only)
const otpStore = new Map();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'שדות חסרים' });

  try {
    // Query Supabase for user
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    const user = users[0];
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
    }

    if (BYPASS_2FA) {
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Log action
      await supabase.from('audit_log').insert({
        user_id: user.id,
        username: user.username,
        action: 'LOGIN',
        entity_type: 'auth',
        ip: req.ip
      });

      return res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(username, { otp, userId: user.id, expires: Date.now() + 5 * 60 * 1000 });
    console.log(`\n🔐 OTP for ${username}: ${otp}\n`);

    res.json({ requireOtp: true, message: 'קוד OTP נשלח' });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { username, otp } = req.body;
  const record = otpStore.get(username);

  if (!record || record.otp !== otp || Date.now() > record.expires) {
    return res.status(401).json({ error: 'קוד OTP שגוי או פג תוקף' });
  }
  otpStore.delete(username);

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', record.userId)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }

    const user = users[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    await supabase.from('audit_log').insert({
      user_id: user.id,
      username: user.username,
      action: 'LOGIN_2FA',
      entity_type: 'auth',
      ip: req.ip
    });

    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
  } catch (e) {
    console.error('OTP verify error:', e);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

router.post('/change-password', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'לא מורשה' });

  let decoded;
  try {
    const jwt_module = await import('jsonwebtoken');
    decoded = jwt_module.default.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'טוקן לא תקין' });
  }

  const { oldPassword, newPassword } = req.body;

  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }

    const user = users[0];
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await supabase
      .from('users')
      .update({ password: hash })
      .eq('id', decoded.id);

    res.json({ ok: true });
  } catch (e) {
    console.error('Change password error:', e);
    res.status(500).json({ error: 'שגיאה בשינוי סיסמה' });
  }
});

export default router;
