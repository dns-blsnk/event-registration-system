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
