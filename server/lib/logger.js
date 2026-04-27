/**
 * logger.js — Structured logging with pino.
 *
 * Why pino instead of console.log?
 *   - 5-10x faster than winston (async I/O, no string formatting in hot path)
 *   - Outputs JSON in production (parseable by Datadog, Loki, CloudWatch)
 *   - Human-readable in dev (pino-pretty)
 *   - Child loggers carry request context automatically
 *
 * SETUP: npm install pino pino-http
 * DEV:   npm install --save-dev pino-pretty
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Dev: pretty-print with colors (pino-pretty must be installed)
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize:        true,
        translateTime:   'HH:MM:ss',
        ignore:          'pid,hostname',
        messageFormat:   '{msg}',
      },
    },
  }),

  // Production: structured JSON (no formatting overhead)
  // Redact sensitive fields from logs automatically
  redact: {
    paths:  ['*.password', '*.token', '*.authorization', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },

  // Base fields included in every log entry
  base: {
    service: 'mil-base-api',
    env:     process.env.NODE_ENV || 'development',
  },

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// HTTP request logger middleware (pino-http)
// Logs every request: method, url, status, response time
// ─────────────────────────────────────────────────────────────────────────────
import pinoHttp from 'pino-http';

export const httpLogger = pinoHttp({
  logger,
  // Skip health check from logs (noisy)
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} → ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} → ${res.statusCode} | ${err.message}`,
});
