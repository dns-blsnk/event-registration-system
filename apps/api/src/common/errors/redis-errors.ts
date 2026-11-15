import { ErrorCode } from '@ers/shared';
import { MaxRetriesPerRequestError } from 'ioredis/built/errors/index.js';
import { CONNECTION_CLOSED_ERROR_MSG } from 'ioredis/built/utils/index.js';

import { DomainError } from './domain-error.js';

/** ioredis rejects a command with this when no reply comes within `commandTimeout`. */
const COMMAND_TIMED_OUT_MSG = 'Command timed out';
/** Redis refuses writes with this reply once it is full (the `noeviction` policy). */
const OUT_OF_MEMORY_PREFIX = 'OOM ';

/**
 * Redis cannot serve the request: unreachable after the allowed reconnect, no reply in time, the
 * connection closed under a pending command, or full. Other replies from a reachable Redis (wrong
 * type, bad script) are bugs and stay 500.
 */
function isUnavailable(error: unknown): boolean {
  if (error instanceof MaxRetriesPerRequestError) return true;
  if (!(error instanceof Error)) return false;
  return (
    error.message === COMMAND_TIMED_OUT_MSG ||
    error.message === CONNECTION_CLOSED_ERROR_MSG ||
    error.message.startsWith(OUT_OF_MEMORY_PREFIX)
  );
}

/** A Redis outage as the same 503 a database outage gives; undefined for anything else. */
export function translateRedisError(error: unknown): DomainError | undefined {
  if (!isUnavailable(error)) return undefined;
  const translated = new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Redis unavailable');
  translated.cause = error;
  return translated;
}
