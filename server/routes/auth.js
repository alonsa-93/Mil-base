/**
 * routes/auth.js — Authentication endpoints.
 *
 * Improvements:
 *   - requireAuth middleware for /change-password (no more inline JWT decode)
 *   - .maybeSingle() instead of .limit(1) + data[0]
 *   - asyncHandler + errorHandler replaces try/catch per route
 *   - Stricter rate limiters (loginLimiter, otpLimiter)
 *   - Zod validation on input fields
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { loginLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import { validate, z } from '../middleware/validate.js';
import { Errors, mapSupabaseError } from '../lib/errors.js';
import { logAction } from '../middleware/audit.js';

const router = Router();
const JWT_SECRET  = process.env.JWT_SECRET;
const BYPASS_2FA  = process.env.BYPASS_2FA === 'true';

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET is not set in environment');
  process.exit(1);
}

// In-memory OTP store — dev only.
// Production: use Redis with TTL or Supabase table with expires_at.
const otpStore = new Map();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login',
  loginLimiter,
  validate({
    body: z.object({
      username: z.string().min(1, 'שם משתמש חובה'),
      password: z.string().min(1, 'סיסמה חובה'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();   // ← replaces .limit(1) + null check

    if (error) throw mapSupabaseError(error);

    // Use constant-time compare to prevent timing attacks
    const validPassword = user && await bcrypt.compare(password, user.password);
    if (!user || !validPassword) {
      throw Errors.badRequest('שם משתמש או סיסמה שגויים');
    }

    if (BYPASS_2FA) {
      const token = signToken(user);

      // Audit log (non-blocking)
      logAction({
        userId: user.id, username: user.username,
        action: 'LOGIN', entityType: 'auth', ip: req.ip,
      });

      return res.json({ token, user: sanitizeUser(user) });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(username, {
      otp,
      userId:  user.id,
      expires: Date.now() + 5 * 60 * 1000,   // 5 minutes
    });

    // In production: send via SMS/email instead of console
    console.log(`\n🔐 OTP for ${username}: ${otp}\n`);

    res.json({ requireOtp: true, message: 'קוד OTP נשלח' });
  })
);

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
router.post('/verify-otp',
  otpLimiter,
  validate({
    body: z.object({
      username: z.string().min(1),
      otp:      z.string().length(6, 'קוד OTP חייב להיות 6 ספרות'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { username, otp } = req.body;
    const record = otpStore.get(username);

    if (!record || record.otp !== otp || Date.now() > record.expires) {
      throw Errors.badRequest('קוד OTP שגוי או פג תוקף');
    }
    otpStore.delete(username);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', record.userId)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    if (!user) throw Errors.notFound('משתמש');

    const token = signToken(user);

    logAction({
      userId: user.id, username: user.username,
      action: 'LOGIN_2FA', entityType: 'auth', ip: req.ip,
    });

    res.json({ token, user: sanitizeUser(user) });
  })
);

// ── POST /api/auth/change-password ────────────────────────────────────────────
router.post('/change-password',
  requireAuth,          // ← uses shared middleware, no more inline JWT decode
  validate({
    body: z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(6, 'סיסמה חדשה מינימום 6 תווים'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw mapSupabaseError(error);
    if (!user) throw Errors.notFound('משתמש');

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw Errors.badRequest('סיסמה נוכחית שגויה');

    const hash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hash })
      .eq('id', req.user.id);

    if (updateError) throw mapSupabaseError(updateError);
    res.json({ ok: true });
  })
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function sanitizeUser(user) {
  return { id: user.id, username: user.username, role: user.role, full_name: user.full_name };
}

export default router;
