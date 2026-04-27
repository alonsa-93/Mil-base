/**
 * logger.js — Structured logging with pino.
 *
 * Dev:        pretty-printed with colors (requires pino-pretty devDependency)
 * Production: raw JSON — parseable by Vercel logs, Datadog, etc.
 */

import pino from 'pino';
import pinoHttp from 'pino-http';

const isVercel = process.env.VERCEL === '1';
const isDev    = process.env.NODE_ENV !== 'production' && !isVercel;

// pino-pretty transport — only in local dev, optional
const transport = isDev
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
  : undefined;

export const logger = pino({
  level:     process.env.LOG_LEVEL || 'info',
  transport,
  redact: {
    paths:  ['*.password', '*.token', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
  base: { service: 'mil-base-api' },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export const httpLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
