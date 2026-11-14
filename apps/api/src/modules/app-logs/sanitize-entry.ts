import type { AppLogEntry } from './app-log-entry.js';

/** Column limits from the app_logs table. */
export const FIELD_LIMITS = {
  message: 2000,
  stack: 8000,
  requestId: 64,
  method: 10,
  route: 512,
  errorCode: 64,
  userRole: 16,
  ip: 64,
  userAgent: 512,
  contextValue: 500,
} as const;

const MIN_HTTP_STATUS = 100;
const MAX_HTTP_STATUS = 599;
const MAX_INT32 = 2_147_483_647;
const TRUNCATION_MARK = '…';
const REDACTED = '[redacted]';

// Single-line fields: every control character, including newlines, so a value cannot forge a line.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
// Stack traces keep newlines and tabs.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS_EXCEPT_LINES = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_CREDENTIALS = /:\/\/[^\s:/@]+:[^\s@]+@/g;
const SECRET_ASSIGNMENTS = /\b(password|passwd|secret|token|api[_-]?key)(\s*[=:]\s*)\S+/gi;

function truncate(value: string, limit: number): string {
  return value.length <= limit
    ? value
    : value.slice(0, limit - TRUNCATION_MARK.length) + TRUNCATION_MARK;
}

/** Masks credentials that driver and library error messages sometimes echo. */
export function redactSecrets(value: string): string {
  return value
    .replace(URL_CREDENTIALS, `://${REDACTED}@`)
    .replace(SECRET_ASSIGNMENTS, `$1$2${REDACTED}`);
}

export function cleanText(value: string, limit: number): string {
  return truncate(redactSecrets(value.replace(CONTROL_CHARS, ' ')), limit);
}

export function cleanMultiline(value: string, limit: number): string {
  return truncate(redactSecrets(value.replace(CONTROL_CHARS_EXCEPT_LINES, '')), limit);
}

function inRange(value: number | undefined, min: number, max: number): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

function cleanContext(
  context: NonNullable<AppLogEntry['context']>,
): NonNullable<AppLogEntry['context']> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      cleanText(key, FIELD_LIMITS.errorCode),
      typeof value === 'string' ? cleanText(value, FIELD_LIMITS.contextValue) : value,
    ]),
  );
}

type TextField = 'requestId' | 'method' | 'route' | 'errorCode' | 'userRole' | 'ip' | 'userAgent';
const TEXT_FIELDS: readonly TextField[] = [
  'requestId',
  'method',
  'route',
  'errorCode',
  'userRole',
  'ip',
  'userAgent',
];

/**
 * Makes an entry safe to store: no control characters (no forged lines), credentials masked,
 * every field within its column type, so a single entry can never fail the insert.
 */
export function sanitizeEntry(entry: AppLogEntry): AppLogEntry {
  const result: AppLogEntry = {
    level: entry.level,
    category: entry.category,
    message: cleanText(entry.message, FIELD_LIMITS.message),
  };
  for (const field of TEXT_FIELDS) {
    const value = entry[field];
    if (value !== undefined) {
      result[field] = cleanText(value, FIELD_LIMITS[field]);
    }
  }
  if (entry.stack !== undefined) {
    result.stack = cleanMultiline(entry.stack, FIELD_LIMITS.stack);
  }
  const statusCode = inRange(entry.statusCode, MIN_HTTP_STATUS, MAX_HTTP_STATUS);
  if (statusCode !== undefined) {
    result.statusCode = statusCode;
  }
  const durationMs = inRange(entry.durationMs, 0, MAX_INT32);
  if (durationMs !== undefined) {
    result.durationMs = durationMs;
  }
  if (entry.userId !== undefined && UUID.test(entry.userId)) {
    result.userId = entry.userId;
  }
  if (entry.context !== undefined) {
    result.context = cleanContext(entry.context);
  }
  return result;
}
