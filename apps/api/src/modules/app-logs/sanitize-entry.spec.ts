import { describe, expect, it } from 'vitest';

import {
  cleanMultiline,
  cleanText,
  FIELD_LIMITS,
  redactSecrets,
  sanitizeEntry,
} from './sanitize-entry.js';

const USER_ID = '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60';

describe('cleanText', () => {
  it('keeps short clean text unchanged', () => {
    expect(cleanText('all good', 20)).toBe('all good');
  });

  it('replaces control characters, including newlines, so a value cannot forge a log line', () => {
    expect(cleanText('x\n2026-11-14 ERROR admin login ok\r\u0000', 100)).toBe(
      'x 2026-11-14 ERROR admin login ok  ',
    );
  });

  it('truncates to the limit with a mark', () => {
    const result = cleanText('x'.repeat(30), 10);

    expect(result).toHaveLength(10);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('cleanMultiline', () => {
  it('keeps newlines and tabs so stack traces stay readable', () => {
    expect(cleanMultiline('Error: x\n\tat a\u0000', 50)).toBe('Error: x\n\tat a');
  });
});

describe('redactSecrets', () => {
  it('masks credentials in connection strings', () => {
    expect(redactSecrets('connect to postgresql://ers:s3cret@db.example.com:5432/ers failed')).toBe(
      'connect to postgresql://[redacted]@db.example.com:5432/ers failed',
    );
  });

  it.each(['password=hunter2', 'token: abc.def', 'api_key=xyz', 'secret = shh'])(
    'masks "%s"',
    (text) => {
      expect(redactSecrets(text)).toContain('[redacted]');
      expect(redactSecrets(text)).not.toMatch(/hunter2|abc\.def|xyz|shh/);
    },
  );

  it('leaves ordinary text alone', () => {
    expect(redactSecrets('Session is full')).toBe('Session is full');
  });
});

describe('sanitizeEntry', () => {
  it('truncates every text field to its column size', () => {
    const entry = sanitizeEntry({
      level: 'ERROR',
      category: 'ERROR',
      message: 'm'.repeat(5000),
      stack: 's'.repeat(20_000),
      route: 'r'.repeat(1000),
      userAgent: 'u'.repeat(1000),
    });

    expect(entry.message).toHaveLength(FIELD_LIMITS.message);
    expect(entry.stack).toHaveLength(FIELD_LIMITS.stack);
    expect(entry.route).toHaveLength(FIELD_LIMITS.route);
    expect(entry.userAgent).toHaveLength(FIELD_LIMITS.userAgent);
  });

  it('leaves absent optional fields absent', () => {
    expect(sanitizeEntry({ level: 'WARN', category: 'SECURITY', message: 'denied' })).toEqual({
      level: 'WARN',
      category: 'SECURITY',
      message: 'denied',
    });
  });

  it('keeps valid numbers and ids', () => {
    const entry = sanitizeEntry({
      level: 'WARN',
      category: 'SECURITY',
      message: 'x',
      statusCode: 403,
      durationMs: 12,
      userId: USER_ID,
    });

    expect(entry).toMatchObject({ statusCode: 403, durationMs: 12, userId: USER_ID });
  });

  it('drops values that would not fit their column', () => {
    const entry = sanitizeEntry({
      level: 'WARN',
      category: 'SECURITY',
      message: 'x',
      statusCode: 70_000,
      durationMs: -1,
      userId: 'not-a-uuid',
    });

    expect(entry).not.toHaveProperty('statusCode');
    expect(entry).not.toHaveProperty('durationMs');
    expect(entry).not.toHaveProperty('userId');
  });

  it('cleans string values inside context, which jsonb would otherwise reject', () => {
    const entry = sanitizeEntry({
      level: 'WARN',
      category: 'SECURITY',
      message: 'upload rejected',
      context: { filename: 'evil\u0000.png', size: 10, note: 'x'.repeat(2000) },
    });

    expect(entry.context?.filename).toBe('evil .png');
    expect(entry.context?.size).toBe(10);
    expect(String(entry.context?.note)).toHaveLength(FIELD_LIMITS.contextValue);
  });
});
