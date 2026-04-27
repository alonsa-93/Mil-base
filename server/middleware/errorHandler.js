/**
 * errorHandler.js — Centralized Express error handler.
 *
 * MUST be registered LAST in index.js:
 *   app.use(errorHandler);
 *
 * Handles:
 *   - AppError (our structured errors) → use .status and .message
 *   - Supabase errors (with .code) → map to AppError
 *   - Unknown errors → 500 with generic Hebrew message
 *   - Logs all 5xx errors with full stack trace
 */

import { AppError, mapSupabaseError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let appError;

  // ── 1. Already an AppError ─────────────────────────────────────────────────
  if (err.isAppError) {
    appError = err;

  // ── 2. Supabase / PostgreSQL error (has .code property) ───────────────────
  } else if (err.code && (err.details !== undefined || err.hint !== undefined)) {
    appError = mapSupabaseError(err);

  // ── 3. JWT errors ──────────────────────────────────────────────────────────
  } else if (err.name === 'JsonWebTokenError') {
    appError = new AppError('טוקן לא תקין', 401, 'INVALID_TOKEN');

  } else if (err.name === 'TokenExpiredError') {
    appError = new AppError('הטוקן פג תוקף', 401, 'TOKEN_EXPIRED');

  // ── 4. Express body-parser errors ─────────────────────────────────────────
  } else if (err.type === 'entity.parse.failed') {
    appError = new AppError('JSON לא תקין בגוף הבקשה', 400, 'INVALID_JSON');

  // ── 5. Unknown error ───────────────────────────────────────────────────────
  } else {
    appError = new AppError('שגיאת שרת פנימית', 500, 'INTERNAL');
  }

  // ── Log 5xx errors with full context ──────────────────────────────────────
  if (appError.status >= 500) {
    logger.error({
      err,
      req: {
        method: req.method,
        url:    req.originalUrl,
        ip:     req.ip,
        userId: req.user?.id,
      },
    }, `Server error: ${err.message}`);
  } else if (appError.status >= 400) {
    logger.warn({
      code:   appError.code,
      status: appError.status,
      url:    req.originalUrl,
      userId: req.user?.id,
    }, `Client error: ${appError.message}`);
  }

  // ── Send response ──────────────────────────────────────────────────────────
  res.status(appError.status).json({
    error: appError.message,
    ...(appError.code  ? { code: appError.code }   : {}),
    // Only include stack in development
    ...(process.env.NODE_ENV !== 'production' && appError.status >= 500
      ? { stack: err.stack }
      : {}),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// asyncHandler — wraps async route handlers so we never need try/catch
// in routes. Unhandled promise rejections go to errorHandler automatically.
//
// USAGE:
//   router.get('/', asyncHandler(async (req, res) => {
//     const data = await someService.getAll();
//     res.json(data);
//   }));
// ─────────────────────────────────────────────────────────────────────────────
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
