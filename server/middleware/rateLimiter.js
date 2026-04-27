/**
 * rateLimiter.js — Per-route rate limiters.
 *
 * Tighter limits on sensitive endpoints (login, user creation).
 * Broader limits on regular API traffic.
 */

import rateLimit from 'express-rate-limit';

// ── Response builder ──────────────────────────────────────────────────────────
const hebrewMessage = (msg) => ({ error: msg });

// ── 1. Auth endpoints (strictest) ────────────────────────────────────────────
// 10 attempts per 15 minutes per IP — brute-force protection
export const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,  // 15 minutes
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          hebrewMessage('יותר מדי ניסיונות כניסה. נסה שוב בעוד 15 דקות.'),
  skipSuccessfulRequests: true,       // only count failed attempts
});

// ── 2. OTP endpoint ───────────────────────────────────────────────────────────
// 5 attempts per 5 minutes — OTP brute-force protection
export const otpLimiter = rateLimit({
  windowMs:        5 * 60 * 1000,   // 5 minutes
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         hebrewMessage('יותר מדי ניסיונות אימות. נסה שוב בעוד 5 דקות.'),
});

// ── 3. Write operations (mutations) ──────────────────────────────────────────
// 60 write requests per minute per IP
export const writeLimiter = rateLimit({
  windowMs:        60 * 1000,        // 1 minute
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         hebrewMessage('יותר מדי בקשות. נסה שוב עוד מעט.'),
});

// ── 4. General API ────────────────────────────────────────────────────────────
// 300 requests per minute per IP (read-heavy dashboard)
export const generalLimiter = rateLimit({
  windowMs:        60 * 1000,        // 1 minute
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         hebrewMessage('יותר מדי בקשות. נסה שוב עוד מעט.'),
});

// ── 5. Admin operations ───────────────────────────────────────────────────────
// 20 requests per minute — extra protection on /api/users
export const adminLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         hebrewMessage('יותר מדי פעולות ניהול. נסה שוב עוד מעט.'),
});
