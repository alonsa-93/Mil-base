/**
 * server/index.js — Local development entry point.
 * Calls app.listen(). NOT used on Vercel (api/index.js is used instead).
 */

import { app, logger } from './app.js';
import { initDb } from './supabase.js';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      logger.info(`🚀 Mil&Base API ready → http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
