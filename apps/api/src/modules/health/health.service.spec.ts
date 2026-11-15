import { describe, expect, it } from 'vitest';

import { HealthService } from './health.service.js';

import type { Config } from '../../config/config.schema.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const reachableDatabase = { $queryRaw: () => Promise.resolve([1]) } as unknown as PrismaService;

describe('HealthService', () => {
  it('reports the commit of the running build, so a deploy can wait for the new one', async () => {
    const service = new HealthService(reachableDatabase, { version: 'a1b2c3d' } as Config);

    expect((await service.check()).version).toBe('a1b2c3d');
  });

  it('reports no version where the host gives none', async () => {
    const service = new HealthService(reachableDatabase, { version: undefined } as Config);

    expect((await service.check()).version).toBeNull();
  });
});
