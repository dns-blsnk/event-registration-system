import type { PinoLogger } from 'nestjs-pino';

/** For services built by hand in tests, outside Nest DI. */
export const silentLogger = {
  setContext: () => undefined,
  info: () => undefined,
  warn: () => undefined,
} as unknown as PinoLogger;
