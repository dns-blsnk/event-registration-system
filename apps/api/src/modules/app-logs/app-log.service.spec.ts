import { describe, expect, it, vi } from 'vitest';

import {
  AppLogService,
  BUFFER_CAPACITY,
  FLUSH_BATCH_SIZE,
  MAX_ENTRIES_PER_MINUTE,
} from './app-log.service.js';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AppLogEntry } from './app-log-entry.js';
import type { PinoLogger } from 'nestjs-pino';

const ENTRY: AppLogEntry = { level: 'ERROR', category: 'ERROR', message: 'boom', statusCode: 500 };

function createService(
  createMany = vi.fn().mockResolvedValue({ count: 1 }),
  create = vi.fn().mockResolvedValue({}),
): {
  service: AppLogService;
  createMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
} {
  const warn = vi.fn();
  const service = new AppLogService(
    { appLog: { createMany, create } } as unknown as PrismaService,
    { warn, setContext: vi.fn() } as unknown as PinoLogger,
  );
  return { service, createMany, create, warn };
}

describe('AppLogService', () => {
  it('buffers entries and writes them in one batch on flush', async () => {
    const { service, createMany } = createService();
    service.record(ENTRY);
    service.record({ ...ENTRY, message: 'second' });

    expect(createMany).not.toHaveBeenCalled();
    await service.flush();

    expect(createMany).toHaveBeenCalledOnce();
    expect(createMany.mock.calls[0]?.[0]).toEqual({
      data: [ENTRY, { ...ENTRY, message: 'second' }],
    });
    expect(service.pendingCount).toBe(0);
  });

  it('splits large backlogs into batches', async () => {
    const { service, createMany } = createService();
    for (let index = 0; index < FLUSH_BATCH_SIZE + 1; index += 1) {
      service.record(ENTRY);
    }

    await service.flush();

    expect(createMany).toHaveBeenCalledTimes(2);
  });

  it('keeps entries when the database is down and writes them once it is back', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const createMany = vi.fn().mockRejectedValueOnce(refused).mockResolvedValue({ count: 1 });
    const { service, warn } = createService(createMany);
    service.record(ENTRY);

    await service.flush();
    expect(service.pendingCount).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ pending: 1 }),
      'app log flush failed, will retry',
    );

    await service.flush();
    expect(service.pendingCount).toBe(0);
    expect(createMany).toHaveBeenCalledTimes(2);
  });

  it('never throws to the caller, even when persisting fails', async () => {
    const { service } = createService(
      vi.fn().mockRejectedValue(new Error('down')),
      vi.fn().mockRejectedValue(new Error('down')),
    );
    service.record(ENTRY);

    await expect(service.flush()).resolves.toBeUndefined();
  });

  it('sanitizes entries before buffering', async () => {
    const { service, createMany } = createService();
    service.record({ ...ENTRY, message: 'evil\r\nfake line' });

    await service.flush();

    expect(createMany.mock.calls[0]?.[0].data[0].message).toBe('evil  fake line');
  });

  it('does not let a bad entry block the journal: writes the rest one by one', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('invalid input syntax'))
      .mockResolvedValue({});
    const { service, createMany, warn } = createService(
      vi.fn().mockRejectedValue(new Error('invalid input syntax')),
      create,
    );
    service.record({ ...ENTRY, message: 'bad' });
    service.record({ ...ENTRY, message: 'good' });

    await service.flush();

    expect(createMany).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledTimes(2);
    expect(service.pendingCount).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      { rejected: 1, batch: 2 },
      'app log batch had invalid entries',
    );
  });

  it('keeps a separate budget per category so a security flood cannot hide server errors', async () => {
    const { service, createMany } = createService();
    for (let index = 0; index < MAX_ENTRIES_PER_MINUTE + 10; index += 1) {
      service.record({ level: 'WARN', category: 'SECURITY', message: '401' });
    }
    service.record(ENTRY);

    await service.flush();

    const rows = createMany.mock.calls.flatMap(
      (call: unknown[]) => (call[0] as { data: AppLogEntry[] }).data,
    );
    expect(rows.filter((row) => row.category === 'ERROR')).toHaveLength(1);
  });

  it('caps entries per minute and reports what it skipped', async () => {
    const { service, createMany, warn } = createService();
    for (let index = 0; index < MAX_ENTRIES_PER_MINUTE + 5; index += 1) {
      service.record(ENTRY);
    }

    await service.flush();

    const written = createMany.mock.calls.reduce(
      (sum: number, call: unknown[]) => sum + (call[0] as { data: unknown[] }).data.length,
      0,
    );
    expect(written).toBe(Math.min(MAX_ENTRIES_PER_MINUTE, BUFFER_CAPACITY));
    expect(warn).toHaveBeenCalledWith(
      { dropped: 0, skipped: 5 },
      'app log entries lost (buffer full or rate limit)',
    );
  });

  it('includes entries recorded while another flush is already running', async () => {
    let release: () => void = () => undefined;
    const createMany = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => {
              resolve({ count: 1 });
            };
          }),
      )
      .mockResolvedValue({ count: 1 });
    const { service } = createService(createMany);
    service.record(ENTRY);
    const first = service.flush();

    service.record({ ...ENTRY, message: 'late' });
    const second = service.flush();
    release();
    await Promise.all([first, second]);

    expect(service.pendingCount).toBe(0);
    expect(createMany).toHaveBeenCalledTimes(2);
  });

  it('shares one flush between concurrent callers', async () => {
    const { service, createMany } = createService();
    service.record(ENTRY);

    await Promise.all([service.flush(), service.flush()]);

    expect(createMany).toHaveBeenCalledOnce();
  });
});
