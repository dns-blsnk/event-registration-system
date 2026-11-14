import { API_PREFIX } from '@ers/shared';

import { HEALTH_ROUTE } from '../../modules/health/health.controller.js';

import { requestIdOf } from './request-id.js';

import type { Config } from '../../config/config.schema.js';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'pino-http';

const HEALTH_PATH = `/${API_PREFIX}/${HEALTH_ROUTE}`;
const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'ticket', 'apiKey', 'secret'];
const MAX_REDACT_DEPTH = 4;

/** `key`, `*.key`, `*.*.key`, ... so sensitive keys are hidden at any realistic depth. */
function atAnyDepth(key: string): string[] {
  return Array.from({ length: MAX_REDACT_DEPTH }, (_, depth) =>
    [...Array<string>(depth).fill('*'), key].join('.'),
  );
}

/** Never written to logs (OWASP Logging Cheat Sheet). */
export const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  ...SENSITIVE_KEYS.flatMap(atAnyDepth),
];

/** Path without query string: queries can carry personal data. Uses originalUrl because mounted middleware rewrites url. */
export function pathOf(req: IncomingMessage & { originalUrl?: string }): string {
  return (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
}

export function buildPinoHttpOptions(config: Config): Options {
  return {
    level: config.logLevel,
    genReqId: (req) => requestIdOf(req),
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    autoLogging: { ignore: (req) => pathOf(req) === HEALTH_PATH },
    // Access log only: server errors are logged once, with the stack, by the exception filter.
    customLogLevel: () => 'info',
    serializers: {
      req: (req: IncomingMessage & { id: string; method: string; originalUrl?: string }) => ({
        id: req.id,
        method: req.method,
        path: pathOf(req),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    ...(config.nodeEnv === 'development'
      ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
      : {}),
  };
}
