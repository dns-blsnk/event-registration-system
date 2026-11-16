import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseConfig } from '../../src/config/config.schema.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { RedisService } from '../../src/redis/redis.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { silentLogger } from '../helpers/silent-logger.js';
import { DEAD_DATABASE_URL, DEAD_REDIS_URL, TEST_ENV } from '../helpers/test-env.js';

import type { INestApplication } from '@nestjs/common';

describe('GET /api/health', () => {
  describe('when the database is reachable', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('reports every dependency as up', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        checks: { database: 'up', redis: 'up' },
        uptimeSeconds: expect.any(Number),
        version: null,
      });
    });

    it('is served only under the /api prefix', async () => {
      await request(app.getHttpServer()).get('/health').expect(404);
    });
  });

  describe('when the database is down', () => {
    let app: INestApplication;
    let deadPrisma: PrismaService;

    beforeAll(async () => {
      deadPrisma = new PrismaService(
        parseConfig({
          ...TEST_ENV,
          DATABASE_URL: DEAD_DATABASE_URL,
        }),
      );
      app = await createTestApp({ overrides: [{ provide: PrismaService, useValue: deadPrisma }] });
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers 503 so uptime checks and deploy smoke tests fail', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(503);

      expect(response.body).toMatchObject({ status: 'degraded', checks: { database: 'down' } });
    });
  });

  describe('when Redis is down', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const deadRedis = new RedisService(
        parseConfig({ ...TEST_ENV, REDIS_URL: DEAD_REDIS_URL }),
        silentLogger,
      );
      app = await createTestApp({ overrides: [{ provide: RedisService, useValue: deadRedis }] });
    });

    afterAll(async () => {
      await app.close();
    });

    it('answers 503 so uptime checks and deploy smoke tests fail', async () => {
      const response = await request(app.getHttpServer()).get('/api/health').expect(503);

      expect(response.body).toMatchObject({
        status: 'degraded',
        checks: { database: 'up', redis: 'down' },
      });
    });
  });
});
