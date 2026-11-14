import { CSRF_HEADER } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { signedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

describe('chat ticket API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['ADMIN', 'ORGANIZER', 'CUSTOMER'] as const)(
    'gives a %s a one-time ticket',
    async (role) => {
      const { agent, csrfToken } = await signedInAgent(app, role);

      const response = await agent.post('/api/chat/ticket').set(CSRF_HEADER, csrfToken).expect(200);

      expect(response.body.ticket).toMatch(/^[\w-]{40,}$/);
      expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    },
  );

  it('refuses a ticket without a session', async () => {
    const { default: request } = await import('supertest');

    await request(app.getHttpServer()).post('/api/chat/ticket').expect(401);
  });

  it('refuses a ticket without the CSRF token', async () => {
    const { agent } = await signedInAgent(app, 'CUSTOMER');

    const response = await agent.post('/api/chat/ticket').expect(403);

    expect(response.body.code).toBe('CSRF_INVALID');
  });
});
