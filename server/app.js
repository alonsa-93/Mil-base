/**
 * app.js — Express application factory.
 *
 * Exports the app WITHOUT calling app.listen().
 * This allows the same app to be used in two contexts:
 *   1. Local dev:  server/index.js  calls app.listen()
 *   2. Vercel:     api/index.js     exports the app as a serverless handler
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { logger, httpLogger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';

import authRoutes        from './routes/auth.js';
import soldiersRoutes    from './routes/soldiers.js';
import missionsRoutes    from './routes/missions.js';
import assignmentsRoutes from './routes/assignments.js';
import equipmentRoutes   from './routes/equipment.js';
import rationsRoutes     from './routes/rations.js';
import auditRoutes       from './routes/audit.js';
import usersRoutes       from './routes/users.js';

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allows:
//   - Any origin listed explicitly in FRONTEND_URL (comma-separated)
//   - When running on Vercel: any *.vercel.app subdomain (preview deployments
//     get a unique URL per commit, so hard-coding them isn't practical)
//   - Same-origin / server-to-server requests (no Origin header)
const explicitOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
const isVercel        = process.env.VERCEL === '1';

function isOriginAllowed(origin) {
  if (!origin) return true;                        // server-to-server / curl
  if (explicitOrigins.includes(origin)) return true;
  if (isVercel && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // Reject as a structured 403 rather than throwing — otherwise the
      // generic errorHandler reports "internal server error" which masks
      // the real cause.
      callback(null, false);
    }
  },
  credentials: true,
}));

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── HTTP request logging (skip on Vercel — stdout is captured differently) ──
if (process.env.VERCEL !== '1') {
  app.use(httpLogger);
}

// ─── Global rate limit ────────────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/soldiers',    soldiersRoutes);
app.use('/api/missions',    missionsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/equipment',   equipmentRoutes);
app.use('/api/rations',     rationsRoutes);
app.use('/api/audit',       auditRoutes);
app.use('/api/users',       usersRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const { supabase } = await import('./supabase.js');
    const { error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected', time: new Date().toISOString() });
  }
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'הנתיב לא נמצא' });
});

// ─── Centralized error handler — must be last ─────────────────────────────────
app.use(errorHandler);

export { app, logger };
