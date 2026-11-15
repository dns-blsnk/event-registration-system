import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppLogService } from '../../src/modules/app-logs/app-log.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent, TEST_PASSWORD } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { INestApplication } from '@nestjs/common';

function uniqueEmail(): string {
  return `auth-${randomUUID()}@test.local`;
}

function setCookieOf(response: request.Response): string {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(header) ? header.join('; ') : (header ?? '');
}

describe('auth API', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/signup', () => {
    it('creates a customer, starts a session and never returns the password hash', async () => {
      const email = uniqueEmail();
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email, name: 'Anna', password: TEST_PASSWORD })
        .expect(201);

      expect(response.body.user).toEqual({
        id: expect.any(String),
        email,
        name: 'Anna',
        role: 'CUSTOMER',
      });
      expect(response.body.csrfToken).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(response.body)).not.toMatch(/argon2|passwordHash/);
      const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('sets an HttpOnly, SameSite=Lax session cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: uniqueEmail(), name: 'Anna', password: TEST_PASSWORD })
        .expect(201);

      const cookie = setCookieOf(response);
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
    });

    it('cannot be used to pick a role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: uniqueEmail(), name: 'Mallory', password: TEST_PASSWORD, role: 'ADMIN' })
        .expect(400);

      expect(response.body.details).toEqual([
        { field: 'role', messages: ['property role should not exist'] },
      ]);
    });

    it('rejects an email that is already taken, ignoring case', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email, name: 'A', password: TEST_PASSWORD });

      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: email.toUpperCase(), name: 'B', password: TEST_PASSWORD })
        .expect(409);

      expect(response.body.code).toBe('CONFLICT');
    });

    it.each([
      ['a short password', { password: 'short' }, 'password'],
      ['an invalid email', { email: 'nope' }, 'email'],
      ['an empty name', { name: '' }, 'name'],
      ['a name of only spaces', { name: '   ' }, 'name'],
    ])('rejects %s', async (_label, override, field) => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: uniqueEmail(), name: 'Anna', password: TEST_PASSWORD, ...override })
        .expect(400);

      const details = response.body.details as { field: string }[];
      expect(details.map((detail) => detail.field)).toEqual([field]);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with the email in any case', async () => {
      const { email } = await signedInAgent(app);

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: email.toUpperCase(), password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.user.email).toBe(email);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const { email } = await signedInAgent(app);

      const wrongPassword = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'wrong password!' })
        .expect(401);
      const unknownEmail = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: uniqueEmail(), password: 'wrong password!' })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
      expect(setCookieOf(wrongPassword)).toBe('');
    });

    it('records a failed login in the security journal', async () => {
      const appLogs = app.get(AppLogService);
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: uniqueEmail(), password: 'wrong password!' })
        .expect(401);
      await appLogs.flush();

      const entry = await prisma.appLog.findFirstOrThrow({
        where: { requestId: response.body.requestId },
      });
      expect(entry).toMatchObject({
        category: 'SECURITY',
        level: 'WARN',
        statusCode: 401,
        route: '/api/auth/login',
      });
    });

    it('keeps the current session when a login attempt fails', async () => {
      const { agent, email } = await signedInAgent(app);

      await agent.post('/api/auth/login').send({ email, password: 'wrong password!' }).expect(401);

      await agent.get('/api/auth/me').expect(200);
    });

    it('replaces any session the browser already had (no session fixation)', async () => {
      const { agent, email } = await signedInAgent(app);
      const before = await agent.get('/api/auth/me').expect(200);

      await agent.post('/api/auth/login').send({ email, password: TEST_PASSWORD }).expect(200);
      const after = await agent.get('/api/auth/me').expect(200);

      expect(after.body.csrfToken).not.toBe(before.body.csrfToken);
      expect(await prisma.authSession.count({ where: { userId: after.body.user.id } })).toBe(1);
    });

    it('blocks an account after five failed attempts from one client', async () => {
      const email = uniqueEmail();
      const attempts = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        attempts.push(
          await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email, password: 'wrong password!' }),
        );
      }

      expect(attempts.slice(0, 5).every((response) => response.status === 401)).toBe(true);
      expect(attempts[5]?.status).toBe(429);
      expect(attempts[5]?.body.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /api/auth/session', () => {
    it('returns the signed-in user and the CSRF token', async () => {
      const { agent, csrfToken, userId } = await signedInAgent(app, 'ORGANIZER');

      const response = await agent.get('/api/auth/session').expect(200);

      expect(response.body).toEqual({
        user: expect.objectContaining({ id: userId, role: 'ORGANIZER' }),
        csrfToken,
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('answers 200 with no one for a visitor, so the sign-in page sees no error', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/session').expect(200);

      expect(response.body).toEqual({ user: null, csrfToken: null });
    });

    it('answers no one for an expired session', async () => {
      const { agent, userId } = await signedInAgent(app);
      await prisma.authSession.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });

      const response = await agent.get('/api/auth/session').expect(200);

      expect(response.body).toEqual({ user: null, csrfToken: null });
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the signed-in user and the CSRF token', async () => {
      const { agent, csrfToken, userId } = await signedInAgent(app, 'ORGANIZER');

      const response = await agent.get('/api/auth/me').expect(200);

      expect(response.body).toEqual({
        user: expect.objectContaining({ id: userId, role: 'ORGANIZER' }),
        csrfToken,
      });
    });

    it('answers 401 without a session and does not journal it', async () => {
      const appLogs = app.get(AppLogService);
      const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
      await appLogs.flush();

      expect(response.body.code).toBe('UNAUTHENTICATED');
      expect(await prisma.appLog.count({ where: { requestId: response.body.requestId } })).toBe(0);
    });

    it('treats an expired session as routine: 401, cookie cleared, not journaled', async () => {
      const { agent, userId } = await signedInAgent(app);
      await prisma.authSession.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
      const appLogs = app.get(AppLogService);

      const response = await agent.get('/api/auth/me').expect(401);
      await appLogs.flush();

      expect(setCookieOf(response)).toMatch(/sid=;/);
      expect(await prisma.appLog.count({ where: { requestId: response.body.requestId } })).toBe(0);
    });

    it('answers 401 for a forged session cookie and journals it', async () => {
      const appLogs = app.get(AppLogService);
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'sid=forged-token')
        .expect(401);
      await appLogs.flush();

      expect(
        await prisma.appLog.count({
          where: { requestId: response.body.requestId, category: 'SECURITY' },
        }),
      ).toBe(1);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('requires the CSRF token', async () => {
      const { agent } = await signedInAgent(app);

      const response = await agent.post('/api/auth/logout').expect(403);

      expect(response.body.code).toBe('CSRF_INVALID');
      await agent.get('/api/auth/me').expect(200);
    });

    it('clears the cookie even when the session has already expired', async () => {
      const { agent, userId } = await signedInAgent(app);
      await prisma.authSession.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });

      const response = await agent.post('/api/auth/logout').expect(204);

      expect(setCookieOf(response)).toMatch(/sid=;/);
    });

    it('ends the session and clears the cookie', async () => {
      const { agent, csrfToken } = await signedInAgent(app);

      const response = await agent
        .post('/api/auth/logout')
        .set('x-csrf-token', csrfToken)
        .expect(204);

      expect(setCookieOf(response)).toMatch(/sid=;/);
      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('cross-site protection', () => {
    it('rejects a login posted from a foreign origin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('Origin', 'https://evil.example')
        .send({ email: uniqueEmail(), password: TEST_PASSWORD })
        .expect(403);

      expect(response.body.code).toBe('CSRF_INVALID');
    });

    it('allows CORS with credentials only for the admin origin', async () => {
      const allowed = await request(app.getHttpServer())
        .options('/api/auth/me')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');
      const denied = await request(app.getHttpServer())
        .options('/api/auth/me')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');

      expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');
      expect(denied.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    });

    it('sends security headers', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });
  });
});
