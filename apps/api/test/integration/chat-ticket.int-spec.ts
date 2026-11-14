import { CSRF_HEADER } from '@ers/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ANTHROPIC_CLIENT } from '../../src/modules/chat/chat-answer.service.js';
import { signedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

/** Any object stands in for the client here: the ticket only needs to know a model is configured. */
const configuredClient = { messages: {} };

describe('chat ticket API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [{ provide: ANTHROPIC_CLIENT, useValue: configuredClient }],
    });
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

  it('reports the chat as available when a model is configured', async () => {
    const { agent } = await signedInAgent(app, 'ORGANIZER');

    expect((await agent.get('/api/chat/status').expect(200)).body).toEqual({ isAvailable: true });
  });

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

describe('chat ticket API without a model key', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ overrides: [{ provide: ANTHROPIC_CLIENT, useValue: undefined }] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the chat as unavailable, so the admin can say so up front', async () => {
    const { agent } = await signedInAgent(app, 'CUSTOMER');

    expect((await agent.get('/api/chat/status').expect(200)).body).toEqual({ isAvailable: false });
  });

  it('answers 503 for a ticket', async () => {
    const { agent, csrfToken } = await signedInAgent(app, 'CUSTOMER');

    const response = await agent.post('/api/chat/ticket').set(CSRF_HEADER, csrfToken).expect(503);

    expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
  });
});
