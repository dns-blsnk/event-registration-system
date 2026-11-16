import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseConfig } from '../../src/config/config.schema.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { DatabaseFixtureController } from '../fixtures/database-fixture.controller.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { DEAD_DATABASE_URL, TEST_ENV } from '../helpers/test-env.js';

import type { INestApplication } from '@nestjs/common';

describe('a request when the database is down', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const deadPrisma = new PrismaService(
      parseConfig({ ...TEST_ENV, DATABASE_URL: DEAD_DATABASE_URL }),
    );
    app = await createTestApp({
      controllers: [DatabaseFixtureController],
      overrides: [{ provide: PrismaService, useValue: deadPrisma }],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 503 SERVICE_UNAVAILABLE with a request id and no connection details', async () => {
    const response = await request(app.getHttpServer()).get('/api/test-db/count').expect(503);

    expect(response.body).toMatchObject({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is temporarily unavailable. Please try again shortly.',
    });
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(JSON.stringify(response.body)).not.toMatch(/5999|localhost|ECONNREFUSED/);
  });
});

describe('a request when the database is up', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [DatabaseFixtureController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the query normally', async () => {
    const response = await request(app.getHttpServer()).get('/api/test-db/count').expect(200);

    expect(response.body).toEqual({ logs: expect.any(Number) });
  });
});
