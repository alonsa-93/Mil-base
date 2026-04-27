/**
 * validate.js — Zod request validation middleware.
 *
 * SETUP: npm install zod
 *
 * USAGE in routes:
 *   import { validate, z } from '../middleware/validate.js';
 *
 *   router.post('/', validate({
 *     body: z.object({
 *       title:      z.string().min(1, 'כותרת חובה'),
 *       start_time: z.string().datetime(),
 *       end_time:   z.string().datetime(),
 *       urgency:    z.enum(['רגיל', 'דחוק', 'חירום']).default('רגיל'),
 *     })
 *   }), asyncHandler(missionService.create));
 */

import { z, ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export { z };

/**
 * @param {Object} schemas
 * @param {ZodSchema} [schemas.body]   - validates req.body
 * @param {ZodSchema} [schemas.query]  - validates req.query
 * @param {ZodSchema} [schemas.params] - validates req.params
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        // Format Zod issues into a readable Hebrew message
        const messages = err.issues.map(i => {
          const field = i.path.join('.');
          return field ? `${field}: ${i.message}` : i.message;
        });
        return next(new AppError(messages.join(' | '), 400, 'VALIDATION_ERROR'));
      }
      next(err);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Zod schemas (reused across routes)
// ─────────────────────────────────────────────────────────────────────────────

export const Schemas = {
  // Numeric path param (e.g. /soldiers/:id)
  idParam: z.object({
    id: z.string().regex(/^\d+$/, 'מזהה חייב להיות מספר').transform(Number),
  }),

  // Soldiers
  createSoldier: z.object({
    personal_id:        z.string().min(1, 'מספר אישי חובה').max(20),
    full_name:          z.string().min(2, 'שם מלא חובה').max(100),
    phone:              z.string().min(9, 'טלפון לא תקין').max(15),
    company:            z.enum(['א', 'ב', 'ג']),
    team:               z.string().min(1, 'צוות חובה').max(50),
    role:               z.enum(['lohem', 'samal', 'rasap', 'mefaked', 'magad']).default('lohem'),
    status:             z.enum(['זמין', 'במשימה', 'מנוחה', 'חופשה', 'אחר']).default('זמין'),
    gender:             z.enum(['זכר', 'נקבה', 'אחר']).default('זכר'),
    mil_shirt:          z.string().optional(),
    mil_pants:          z.string().optional(),
    mil_boots:          z.string().optional(),
    is_vegan:           z.number().int().min(0).max(1).default(0),
    is_vegetarian:      z.number().int().min(0).max(1).default(0),
    lactose_intolerant: z.number().int().min(0).max(1).default(0),
    gluten_free:        z.number().int().min(0).max(1).default(0),
    nutrition_notes:    z.string().max(500).optional().nullable(),
  }),

  // Missions
  createMission: z.object({
    title:          z.string().min(1, 'כותרת חובה').max(200),
    start_time:     z.string().min(1, 'זמן התחלה חובה'),
    end_time:       z.string().min(1, 'זמן סיום חובה'),
    urgency:        z.enum(['רגיל', 'דחוק', 'חירום']).default('רגיל'),
    type:           z.enum(['כללי', 'שמירה', 'סיור', 'אבטחה', 'לוגיסטיקה', 'אימון', 'אחר']).default('כללי'),
    required_count: z.number().int().min(1).default(1),
    description:    z.string().max(1000).optional().nullable(),
    location:       z.string().max(200).optional().nullable(),
    vehicle:        z.string().max(100).optional().nullable(),
    notes:          z.string().max(1000).optional().nullable(),
  }).refine(
    (data) => new Date(data.start_time) < new Date(data.end_time),
    { message: 'שעת סיום חייבת להיות אחרי שעת התחלה', path: ['end_time'] }
  ),

  // Assignments
  createAssignment: z.object({
    mission_id:       z.number().int().positive(),
    soldier_id:       z.number().int().positive(),
    role_in_mission:  z.string().default('לוחם'),
    force:            z.boolean().default(false),
  }),

  // Users (admin)
  createUser: z.object({
    username:  z.string().min(3, 'שם משתמש מינימום 3 תווים').max(50).regex(/^[a-zA-Z0-9_]+$/, 'שם משתמש: אותיות/מספרים/קו_תחתון בלבד'),
    password:  z.string().min(6, 'סיסמה מינימום 6 תווים'),
    full_name: z.string().min(2).max(100),
    role:      z.enum(['lohem', 'samal', 'rasap', 'mefaked', 'magad']),
    phone:     z.string().max(15).optional().nullable(),
  }),

  // Rations
  createRation: z.object({
    date:                z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין (YYYY-MM-DD)'),
    meal_type:           z.enum(['ארוחת בוקר', 'ארוחת צהריים', 'ארוחת ערב']),
    total_count:         z.number().int().min(0).default(0),
    vegan_count:         z.number().int().min(0).default(0),
    vegetarian_count:    z.number().int().min(0).default(0),
    lactose_free_count:  z.number().int().min(0).default(0),
    gluten_free_count:   z.number().int().min(0).default(0),
    notes:               z.string().max(500).optional().nullable(),
  }),
};
