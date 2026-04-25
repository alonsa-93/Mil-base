import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initDb } from './supabase.js';

import authRoutes from './routes/auth.js';
import soldiersRoutes from './routes/soldiers.js';
import missionsRoutes from './routes/missions.js';
import assignmentsRoutes from './routes/assignments.js';
import equipmentRoutes from './routes/equipment.js';
import rationsRoutes from './routes/rations.js';
import auditRoutes from './routes/audit.js';
import usersRoutes from './routes/users.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Rate limiting
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'יותר מדי ניסיונות, נסה שוב מאוחר יותר' } }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/soldiers', soldiersRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/rations', rationsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => console.log(`\n🚀 Mil&Base server running on http://localhost:${PORT}\n`));
