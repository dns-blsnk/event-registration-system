import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';

import { RegistrationStatusService } from './registration-status.service.js';

import type { User } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { BookingService } from './booking.service.js';
import type { PinoLogger } from 'nestjs-pino';

const admin = { id: 'admin', role: 'ADMIN' } as User;

function setup(cancel: ReturnType<typeof vi.fn>): {
  service: RegistrationStatusService;
  error: ReturnType<typeof vi.fn>;
} {
  const logger = { setContext: vi.fn(), info: vi.fn(), error: vi.fn() };
  const service = new RegistrationStatusService(
    {} as PrismaService,
    { cancel } as unknown as BookingService,
    logger as unknown as PinoLogger,
  );
  return { service, error: logger.error };
}

describe('RegistrationStatusService.bulkChange', () => {
  it('reports an unexpected error on its row, logs it and carries on', async () => {
    const cancel = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('boom'))
      .mockResolvedValueOnce({ status: 'CANCELLED' });
    const { service, error } = setup(cancel);

    const results = await service.bulkChange(['a', 'b'], 'CANCELLED', admin);

    expect(results).toEqual([
      { id: 'a', ok: false, code: 'INTERNAL_ERROR', message: 'Unexpected error, not changed' },
      { id: 'b', ok: true, status: 'CANCELLED' },
    ]);
    expect(error).toHaveBeenCalledOnce();
  });

  it('stops touching the database once it is unavailable and marks the rest as not processed', async () => {
    const cancel = vi
      .fn()
      .mockResolvedValueOnce({ status: 'CANCELLED' })
      .mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }));
    const { service } = setup(cancel);

    const results = await service.bulkChange(['a', 'b', 'c'], 'CANCELLED', admin);

    expect(results.map((result) => (result.ok ? 'ok' : result.code))).toEqual([
      'ok',
      'SERVICE_UNAVAILABLE',
      'SERVICE_UNAVAILABLE',
    ]);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('reports a business rejection without logging it as an error', async () => {
    const cancel = vi
      .fn()
      .mockRejectedValueOnce(
        new DomainError('SESSION_STARTED', 'This session has already started'),
      );
    const { service, error } = setup(cancel);

    const results = await service.bulkChange(['a'], 'CANCELLED', admin);

    expect(results).toEqual([
      { id: 'a', ok: false, code: 'SESSION_STARTED', message: 'This session has already started' },
    ]);
    expect(error).not.toHaveBeenCalled();
  });
});
