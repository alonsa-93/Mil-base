import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database.js';
import { logAction } from '../middleware/audit.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'milbase-secret-2024';
const BYPASS_2FA = process.env.BYPASS_2FA === 'true';

// In-memory OTP store (dev only)
const otpStore = new Map();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'שדות חסרים' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });

  if (BYPASS_2FA) {
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    logAction({ userId: user.id, username: user.username, action: 'LOGIN', entityType: 'auth', ip: req.ip });
    return res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
  }

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(username, { otp, userId: user.id, expires: Date.now() + 5 * 60 * 1000 });
  console.log(`\n🔐 OTP for ${username}: ${otp}\n`);

  res.json({ requireOtp: true, message: 'קוד OTP נשלח' });
});

router.post('/verify-otp', (req, res) => {
  const { username, otp } = req.body;
  const record = otpStore.get(username);
  if (!record || record.otp !== otp || Date.now() > record.expires) {
    return res.status(401).json({ error: 'קוד OTP שגוי או פג תוקף' });
  }
  otpStore.delete(username);

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.userId);
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  logAction({ userId: user.id, username: user.username, action: 'LOGIN_2FA', entityType: 'auth', ip: req.ip });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
});

router.post('/change-password', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'לא מורשה' });
  let decoded;
  try { decoded = jwt.verify(auth.slice(7), JWT_SECRET); } catch { return res.status(401).json({ error: 'טוקן לא תקין' }); }

  const { oldPassword, newPassword } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
  if (!user || !bcrypt.compareSync(oldPassword, user.password))
    return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, decoded.id);
  res.json({ ok: true });
});

export default router;
