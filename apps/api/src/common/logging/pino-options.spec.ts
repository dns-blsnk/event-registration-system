import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { TEST_ENV } from '../../../test/helpers/test-env.js';
import { parseConfig } from '../../config/config.schema.js';

import { buildPinoHttpOptions, pathOf, REDACTED_PATHS } from './pino-options.js';

function captureLogger(): { logger: pino.Logger; lines: string[] } {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return {
    logger: pino({ redact: { paths: REDACTED_PATHS, censor: '[redacted]' } }, stream),
    lines,
  };
}

describe('log redaction', () => {
  it('never writes cookies, auth or CSRF headers', () => {
    const { logger, lines } = captureLogger();

    logger.info({
      req: { headers: { cookie: 'sid=abc', authorization: 'Bearer x', 'x-csrf-token': 'csrf-1' } },
      res: { headers: { 'set-cookie': 'sid=new' } },
    });

    const line = lines.join('');
    for (const secret of ['sid=abc', 'Bearer x', 'csrf-1', 'sid=new']) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain('[redacted]');
  });

  it('never writes passwords, tokens, tickets or API keys inside logged objects', () => {
    const { logger, lines } = captureLogger();

    logger.info({
      body: { password: 'p@ss', passwordHash: 'h', token: 't', ticket: 'k', apiKey: 'a' },
    });

    expect(lines.join('')).not.toMatch(/p@ss|"h"|"t"|"k"|"a"/);
  });

  it('hides sensitive keys at the top level', () => {
    const { logger, lines } = captureLogger();

    logger.info({ password: 'top-secret', apiKey: 'key-1' });

    expect(lines.join('')).not.toMatch(/top-secret|key-1/);
  });

  it('never writes the arguments of a failed Redis command, which can hold chat text', () => {
    const { logger, lines } = captureLogger();

    logger.error({
      err: { message: 'OOM', command: { name: 'rpush', args: ['chat:u:c', 'my question'] } },
    });

    expect(lines.join('')).not.toContain('my question');
  });

  it('hides sensitive keys nested several levels deep', () => {
    const { logger, lines } = captureLogger();

    logger.info({ dto: { user: { credentials: { password: 'deep-secret' } } } });

    expect(lines.join('')).not.toContain('deep-secret');
  });
});

describe('buildPinoHttpOptions', () => {
  const options = buildPinoHttpOptions(parseConfig({ ...TEST_ENV, LOG_LEVEL: 'warn' }));

  it('uses the configured level and JSON output outside development', () => {
    expect(options.level).toBe('warn');
    expect(options).not.toHaveProperty('transport');
  });

  it('pretty-prints only in development', () => {
    const devOptions = buildPinoHttpOptions(parseConfig({ ...TEST_ENV, NODE_ENV: 'development' }));

    expect(devOptions.transport).toMatchObject({ target: 'pino-pretty' });
  });

  it('writes access lines at info, leaving error logs to the exception filter', () => {
    const level = options.customLogLevel;

    expect(level?.({} as never, { statusCode: 503 } as never, new Error('x'))).toBe('info');
    expect(level?.({} as never, { statusCode: 404 } as never, undefined)).toBe('info');
  });

  it('skips access logs for health checks, with or without a query string', () => {
    const autoLogging = options.autoLogging as { ignore: (req: unknown) => boolean };

    expect(autoLogging.ignore({ originalUrl: '/api/health', url: '/' })).toBe(true);
    expect(autoLogging.ignore({ originalUrl: '/api/health?probe=1', url: '/' })).toBe(true);
    expect(autoLogging.ignore({ originalUrl: '/api/events', url: '/' })).toBe(false);
  });

  it('logs the request path without the query string', () => {
    const serialize = options.serializers?.req as (req: unknown) => unknown;

    expect(
      serialize({ id: '1', method: 'GET', url: '/', originalUrl: '/api/events?email=a@b.co' }),
    ).toEqual({
      id: '1',
      method: 'GET',
      path: '/api/events',
    });
  });
});

describe('pathOf', () => {
  it('prefers originalUrl because mounted middleware rewrites url', () => {
    expect(pathOf({ originalUrl: '/api/events?x=1', url: '/' } as never)).toBe('/api/events');
  });

  it('falls back to url when originalUrl is missing', () => {
    expect(pathOf({ url: '/api/health?x=1' } as never)).toBe('/api/health');
  });
});
