import type { Role } from './roles.js';

/** How long the error and security journal keeps entries. */
export const APP_LOG_RETENTION_DAYS = 7;

export const AppLogCategory = {
  ERROR: 'ERROR',
  SECURITY: 'SECURITY',
} as const;

export type AppLogCategory = (typeof AppLogCategory)[keyof typeof AppLogCategory];

export const AppLogLevel = {
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;

export type AppLogLevel = (typeof AppLogLevel)[keyof typeof AppLogLevel];

/** A journal row as the admin "Logs" list shows it. */
export interface AppLogListItem {
  id: string;
  createdAt: string;
  level: AppLogLevel;
  category: AppLogCategory;
  requestId: string | null;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  errorCode: string | null;
  message: string;
  userId: string | null;
  userRole: Role | null;
  durationMs: number | null;
}

/** One journal entry with everything recorded for it, for ADMIN only. */
export interface AppLogDetail extends AppLogListItem {
  stack: string | null;
  ip: string | null;
  userAgent: string | null;
  context: unknown;
}
