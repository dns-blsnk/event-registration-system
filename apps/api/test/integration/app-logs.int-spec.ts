import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppLogRetentionService } from '../../src/modules/app-logs/app-log-retention.service.js';
import { AppLogService } from '../../src/modules/app-logs/app-log.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { ErrorsFixtureController } from '../fixtures/errors-fixture.controller.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

const DAY_MS = 86_400_000;

describe('app log journal', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let appLogs: AppLogService;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [ErrorsFixtureController] });
    prisma = app.get(PrismaService);
    appLogs = app.get(AppLogService);
    await app.get(AppLogRetentionService).whenStartupPurgeDone();
  });

  beforeEach(async () => {
    await prisma.appLog.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores a 500 with its request id, real cause and stack', async () => {
    const response = await request(app.getHttpServer()).get('/api/test-errors/crash').expect(500);
    await appLogs.flush();

    const entry = await prisma.appLog.findFirstOrThrow({
      where: { requestId: response.body.requestId },
    });
    expect(entry).toMatchObject({
      level: 'ERROR',
      category: 'ERROR',
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      method: 'GET',
      route: '/api/test-errors/crash',
      message: 'database password is hunter2',
    });
    expect(entry.stack).toContain('Error: database password is hunter2');
  });

  it('does not store ordinary client errors', async () => {
    await request(app.getHttpServer()).get('/api/test-errors/conflict').expect(409);
    await request(app.getHttpServer()).get('/api/nope').expect(404);
    await appLogs.flush();

    expect(await prisma.appLog.findMany({ select: { message: true, statusCode: true } })).toEqual(
      [],
    );
  });

  it('purges entries older than seven days and keeps newer ones', async () => {
    const now = new Date();
    await prisma.appLog.createMany({
      data: [
        {
          level: 'ERROR',
          category: 'ERROR',
          message: 'old',
          createdAt: new Date(now.getTime() - 8 * DAY_MS),
        },
        {
          level: 'ERROR',
          category: 'ERROR',
          message: 'recent',
          createdAt: new Date(now.getTime() - 6 * DAY_MS),
        },
      ],
    });

    const deleted = await app.get(AppLogRetentionService).purgeExpired(now);

    expect(deleted).toBe(1);
    expect((await prisma.appLog.findMany()).map((entry) => entry.message)).toEqual(['recent']);
  });
});
