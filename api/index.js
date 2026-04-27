/**
 * api/index.js — Vercel Serverless Function entry point.
 *
 * Vercel invokes this file for all /api/* requests.
 * It exports the Express app as the default export.
 * app.listen() is NOT called here — Vercel manages the HTTP server.
 */

import { app } from '../server/app.js';

export default app;
