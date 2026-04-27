/**
 * errors.js — Centralized error types and Supabase error mapping.
 *
 * AppError is a structured error with an HTTP status code.
 * Routes throw AppError; the centralized errorHandler catches it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AppError — the only error type routes should throw
// ─────────────────────────────────────────────────────────────────────────────
export class AppError extends Error {
  /**
   * @param {string} message   - Hebrew error message for the client
   * @param {number} status    - HTTP status code (default 500)
   * @param {string} [code]    - Machine-readable code (for frontend switch)
   */
  constructor(message, status = 500, code = null) {
    super(message);
    this.name      = 'AppError';
    this.status    = status;
    this.code      = code;
    this.isAppError = true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Common pre-built errors (DRY — reuse across services)
// ─────────────────────────────────────────────────────────────────────────────
export const Errors = {
  notFound:      (what = 'הרשומה')  => new AppError(`${what} לא נמצא`, 404, 'NOT_FOUND'),
  unauthorized:                       () => new AppError('לא מורשה',         401, 'UNAUTHORIZED'),
  forbidden:                          () => new AppError('אין הרשאה',         403, 'FORBIDDEN'),
  badRequest:    (msg = 'בקשה שגויה') => new AppError(msg,                    400, 'BAD_REQUEST'),
  conflict:      (msg = 'ניגוד נתונים') => new AppError(msg,                  409, 'CONFLICT'),
  internal:      (msg = 'שגיאת שרת')  => new AppError(msg,                    500, 'INTERNAL'),
};

// ─────────────────────────────────────────────────────────────────────────────
// mapSupabaseError — converts raw Supabase/PostgreSQL errors to AppError
// ─────────────────────────────────────────────────────────────────────────────

// PostgreSQL error codes → HTTP status + Hebrew message
const PG_CODE_MAP = {
  '23505': { status: 409, message: 'הרשומה כבר קיימת (כפילות)' },   // unique_violation
  '23503': { status: 409, message: 'קשר לרשומה אחרת לא תקין' },    // foreign_key_violation
  '23502': { status: 400, message: 'שדה חובה חסר' },                // not_null_violation
  '23514': { status: 400, message: 'ערך לא חוקי (CHECK constraint)' }, // check_violation
  '22001': { status: 400, message: 'הערך ארוך מדי' },               // string_data_right_truncation
  '42501': { status: 403, message: 'אין הרשאת גישה לטבלה' },        // insufficient_privilege
  'PGRST116': { status: 404, message: 'לא נמצא' },                  // PostgREST: no rows returned
  'PGRST301': { status: 429, message: 'יותר מדי בקשות' },           // PostgREST: rate limit
};

/**
 * Converts a Supabase error object into an AppError.
 * @param   {Object} supabaseError  - error object from { data, error } destructure
 * @returns {AppError}
 */
export function mapSupabaseError(supabaseError) {
  if (!supabaseError) return Errors.internal();

  const { code, message, details, hint } = supabaseError;

  // Known PG / PostgREST code
  if (code && PG_CODE_MAP[code]) {
    const mapped = PG_CODE_MAP[code];
    return new AppError(mapped.message, mapped.status, code);
  }

  // Unique constraint (sometimes arrives without code, just message)
  if (message?.includes('unique') || message?.includes('duplicate')) {
    return new AppError('הרשומה כבר קיימת', 409, '23505');
  }

  // Row not found (PostgREST single() returns this)
  if (message?.includes('0 rows') || message?.includes('JSON object requested')) {
    return Errors.notFound();
  }

  // Default: preserve message but set 500
  return new AppError(message || 'שגיאת מסד נתונים', 500, code || 'DB_ERROR');
}

// ─────────────────────────────────────────────────────────────────────────────
// assertExists — throws 404 if a Supabase row is null
// Replaces the repetitive pattern:  if (!data || data.length === 0) return 404
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {*}      data    - result from Supabase (single row or null)
 * @param {string} [what]  - Hebrew name for 404 message
 */
export function assertExists(data, what = 'הרשומה') {
  if (!data) throw Errors.notFound(what);
  return data;
}
