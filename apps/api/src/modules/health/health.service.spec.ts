import { describe, expect, it } from 'vitest';

import { HealthService } from './health.service.js';

import type { Config } from '../../config/config.schema.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RedisService } from '../../redis/redis.service.js';

const reachableDatabase = { $queryRaw: () => Promise.resolve([1]) } as unknown as PrismaService;
const reachableRedis = { ping: () => Promise.resolve('PONG') } as unknown as RedisService;
const deadRedis = {
  ping: () => Promise.reject(new Error('Connection is closed.')),
} as unknown as RedisService;

describe('HealthService', () => {
  it('reports the commit of the running build, so a deploy can wait for the new one', async () => {
    const service = new HealthService(reachableDatabase, reachableRedis, {
      version: 'a1b2c3d',
    } as Config);

    expect((await service.check()).version).toBe('a1b2c3d');
  });

  it('reports no version where the host gives none', async () => {
    const service = new HealthService(reachableDatabase, reachableRedis, {
      version: undefined,
    } as Config);

    expect((await service.check()).version).toBeNull();
  });

  it('is degraded when Redis does not answer, even with the database up', async () => {
    const service = new HealthService(reachableDatabase, deadRedis, {} as Config);

    expect(await service.check()).toMatchObject({
      status: 'degraded',
      checks: { database: 'up', redis: 'down' },
    });
  });
});
