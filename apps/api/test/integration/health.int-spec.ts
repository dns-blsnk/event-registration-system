import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the service as up', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({ status: 'ok', uptimeSeconds: expect.any(Number) });
  });

  it('is served only under the /api prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
