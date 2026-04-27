import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { initDb } from './supabase.js';
import { logger, httpLogger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';

import authRoutes       from './routes/auth.js';
import soldiersRoutes   from './routes/soldiers.js';
import missionsRoutes   from './routes/missions.js';
import assignmentsRoutes from './routes/assignments.js';
import equipmentRoutes  from './routes/equipment.js';
import rationsRoutes    from './routes/rations.js';
import auditRoutes      from './routes/audit.js';
import usersRoutes      from './routes/users.js';

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,   // handled separately if needed
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) in development
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// ─── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── HTTP request logging ─────────────────────────────────────────────────────
app.use(httpLogger);

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
    const { error } = await (await import('./supabase.js')).supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    res.json({ ok: true, db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected', time: new Date().toISOString() });
  }
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'הנתיב לא נמצא' });
});

// ─── Centralized error handler — MUST be last ─────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      logger.info(`🚀 Mil&Base API ready on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
