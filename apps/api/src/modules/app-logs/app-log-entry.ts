import type { AppLogCategory, AppLogLevel } from '@ers/shared';

/** What callers record. Everything except level, category and message is optional context. */
export interface AppLogEntry {
  level: AppLogLevel;
  category: AppLogCategory;
  message: string;
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  errorCode?: string;
  stack?: string;
  userId?: string;
  userRole?: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
  /** Allow-listed, non-sensitive fields only. */
  context?: Record<string, string | number | boolean | null>;
}
