import { ErrorCode } from '@ers/shared';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';
import { Prisma } from '../../generated/prisma/client.js';

import { ChatFailures } from './chat-failures.js';

import type { AppLogEntry } from '../app-logs/app-log-entry.js';
import type { AppLogService } from '../app-logs/app-log.service.js';
import type { PinoLogger } from 'nestjs-pino';

function failures(): { service: ChatFailures; entries: AppLogEntry[] } {
  const entries: AppLogEntry[] = [];
  const journal = {
    record: (entry: AppLogEntry) => entries.push(entry),
  } as unknown as AppLogService;
  const logger = { setContext: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as PinoLogger;
  return { service: new ChatFailures(journal, logger), entries };
}

describe('ChatFailures', () => {
  it('passes the safe message of a provider failure to the user and journals its cause', () => {
    const { service, entries } = failures();
    const error = new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'Assistant unavailable');
    error.cause = new Error('upstream 529');

    expect(service.record('user-1', error)).toEqual({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'Assistant unavailable',
    });
    expect(entries[0]).toMatchObject({
      level: 'ERROR',
      category: 'ERROR',
      route: '/chat',
      errorCode: ErrorCode.SERVICE_UNAVAILABLE,
      userId: 'user-1',
      message: 'chat answer failed: upstream 529',
    });
  });

  it('hides the details of a crash from the user but journals them with the stack', () => {
    const { service, entries } = failures();

    const failure = service.record('user-1', new TypeError('cannot read x'));

    expect(failure.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(failure.message).not.toContain('cannot read x');
    expect(entries[0]?.message).toBe('chat answer failed: cannot read x');
    expect(entries[0]?.stack).toContain('TypeError');
  });

  it('keeps a busy provider (429) out of the error journal', () => {
    const { service, entries } = failures();

    const failure = service.record('user-1', new DomainError(ErrorCode.RATE_LIMITED, 'Busy'));

    expect(failure).toEqual({ code: ErrorCode.RATE_LIMITED, message: 'Busy' });
    expect(entries).toHaveLength(0);
  });

  it('reports a database outage as unavailable, as the HTTP API does', () => {
    const { service, entries } = failures();
    const outage = new Prisma.PrismaClientInitializationError("Can't reach database", '7.10.1');

    expect(service.record('user-1', outage).code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(entries[0]?.errorCode).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('names the step that failed, so a failed check is not logged as a failed answer', () => {
    const { service, entries } = failures();

    service.record('user-1', new Error('Command timed out'), 'chat message limit check failed');

    expect(entries[0]?.message).toBe('chat message limit check failed: Command timed out');
  });

  it('still reports when something that is not an Error was thrown', () => {
    const { service, entries } = failures();

    expect(service.record('user-1', Object.create(null)).code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(entries[0]?.message).toContain('not an Error');
  });

  it('journals a crashed handshake as a server error without a user', () => {
    const { service, entries } = failures();

    service.recordHandshakeCrash(new Error('database is down'));

    expect(entries[0]).toMatchObject({
      level: 'ERROR',
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'chat handshake failed: database is down',
    });
    expect(entries[0]).not.toHaveProperty('userId');
  });
});
