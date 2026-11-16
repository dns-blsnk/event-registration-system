import { randomUUID } from 'node:crypto';

import {
  AUTH_PROVIDER_PATHS,
  ErrorCode,
  GITHUB_SIGN_IN_ERROR_PARAM,
  NAME_MAX_LENGTH,
} from '@ers/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../../src/common/errors/domain-error.js';
import { APP_CONFIG, loadConfig } from '../../src/config/config.module.js';
import { GithubClient, type GithubProfile } from '../../src/modules/auth/github/github-client.js';
import { SessionService } from '../../src/modules/auth/session/session.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { signedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createUser } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

const ADMIN = 'http://localhost:5173';
const CALLBACK = `/api${AUTH_PROVIDER_PATHS.githubCallback}`;
const STATE_COOKIE = 'github_oauth';

/** Stands in for GitHub: hands out whatever profile the test sets, or fails like GitHub would. */
class FakeGithub {
  profile: GithubProfile | Error = { id: '1', name: 'Nobody', email: undefined };
  lastExchange: unknown;

  exchangeCode(input: unknown): Promise<string> {
    this.lastExchange = input;
    return Promise.resolve('gho_token');
  }

  fetchProfile(): Promise<GithubProfile> {
    return this.profile instanceof Error
      ? Promise.reject(this.profile)
      : Promise.resolve(this.profile);
  }
}

function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'] as string[] | string | undefined;
  if (header === undefined) return [];
  return Array.isArray(header) ? header : [header];
}

function cookieValue(response: request.Response, name: string): string | undefined {
  const cookie = setCookies(response).find((entry) => entry.startsWith(`${name}=`));
  return cookie?.split(';')[0]?.slice(name.length + 1);
}

function locationOf(response: request.Response): string {
  return String(response.headers.location);
}

function githubId(): string {
  return randomUUID();
}

function profile(overrides: Partial<GithubProfile> = {}): GithubProfile {
  return { id: githubId(), name: 'Gita Hub', email: `gh-${randomUUID()}@test.local`, ...overrides };
}

describe('GitHub sign-in', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const github = new FakeGithub();

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [
        { provide: GithubClient, useValue: github },
        {
          provide: APP_CONFIG,
          useValue: {
            ...loadConfig(),
            github: { clientId: 'test-client-id', clientSecret: 'test-client-secret' },
          },
        },
      ],
    });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    github.profile = profile();
  });

  /** Starts a sign-in like a browser would and returns GitHub's redirect back, with its cookie. */
  async function returnFromGithub(): Promise<request.Response> {
    const start = await request(app.getHttpServer()).get('/api/auth/github').expect(302);
    const state = new URL(locationOf(start)).searchParams.get('state') ?? '';
    const cookie = cookieValue(start, STATE_COOKIE) ?? '';
    return request(app.getHttpServer())
      .get(CALLBACK)
      .query({ code: 'the-code', state })
      .set('Cookie', `${STATE_COOKIE}=${cookie}`)
      .expect(302);
  }

  function failureLocation(error: string): string {
    return `${ADMIN}/login?${GITHUB_SIGN_IN_ERROR_PARAM}=${error}`;
  }

  describe('GET /api/auth/providers', () => {
    it('reports GitHub as available when it is configured', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/providers').expect(200);

      expect(response.body).toEqual({ github: true });
    });
  });

  describe('GET /api/auth/github', () => {
    it('redirects to GitHub with a callback on the admin origin and sets a short-lived state cookie', async () => {
      const response = await request(app.getHttpServer()).get('/api/auth/github').expect(302);

      const location = new URL(locationOf(response));
      expect(location.host).toBe('github.com');
      expect(location.searchParams.get('client_id')).toBe('test-client-id');
      expect(location.searchParams.get('redirect_uri')).toBe(`${ADMIN}${CALLBACK}`);
      const cookie = setCookies(response).find((entry) => entry.startsWith(`${STATE_COOKIE}=`));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Max-Age=600/);
    });
  });

  describe('GET /api/auth/github/callback', () => {
    it('creates a customer for a new GitHub account, starts a session and opens the admin', async () => {
      const newAccount = profile();
      github.profile = newAccount;
      const response = await returnFromGithub();

      expect(locationOf(response)).toBe(`${ADMIN}/`);
      expect(cookieValue(response, 'sid')).toBeTruthy();
      const user = await prisma.user.findUniqueOrThrow({ where: { githubId: newAccount.id } });
      expect(user).toMatchObject({ role: 'CUSTOMER', name: 'Gita Hub', passwordHash: null });
    });

    it('passes the PKCE verifier from the cookie and the same callback URL to GitHub', async () => {
      await returnFromGithub();

      expect(github.lastExchange).toEqual({
        code: 'the-code',
        verifier: expect.any(String),
        redirectUri: `${ADMIN}${CALLBACK}`,
      });
    });

    it('signs a returning GitHub account in as the same user, whatever its email is now', async () => {
      const existing = await createUser(prisma, { githubId: githubId(), role: 'ORGANIZER' });
      github.profile = profile({ id: existing.githubId ?? '', email: 'changed@test.local' });

      const response = await returnFromGithub();

      const session = await app.get(SessionService).validate(cookieValue(response, 'sid') ?? '');
      expect(session?.user.id).toBe(existing.id);
      expect(session?.user.role).toBe('ORGANIZER');
    });

    it('refuses, and never links, an email that already has an account (signup does not verify emails)', async () => {
      const existing = await createUser(prisma, { role: 'ADMIN', passwordHash: 'set-by-someone' });
      github.profile = profile({ email: existing.email.toUpperCase() });

      const response = await returnFromGithub();

      expect(locationOf(response)).toBe(failureLocation('email-in-use'));
      expect(cookieValue(response, 'sid')).toBeUndefined();
      const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
      expect(unchanged.githubId).toBeNull();
    });

    it('cuts a GitHub name longer than the name column holds', async () => {
      const account = profile({ name: 'N'.repeat(NAME_MAX_LENGTH + 30) });
      github.profile = account;

      await returnFromGithub();

      const user = await prisma.user.findUniqueOrThrow({ where: { githubId: account.id } });
      expect(user.name).toHaveLength(NAME_MAX_LENGTH);
    });

    it('refuses a GitHub account without a verified primary email', async () => {
      github.profile = profile({ email: undefined });

      const response = await returnFromGithub();

      expect(locationOf(response)).toBe(failureLocation('no-verified-email'));
      expect(cookieValue(response, 'sid')).toBeUndefined();
    });

    it('sends the user back to retry when GitHub fails', async () => {
      github.profile = new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'GitHub sign-in failed');

      const response = await returnFromGithub();

      expect(locationOf(response)).toBe(failureLocation('failed'));
      expect(cookieValue(response, 'sid')).toBeUndefined();
    });

    it('refuses a return whose state does not match the cookie (login CSRF)', async () => {
      const response = await request(app.getHttpServer())
        .get(CALLBACK)
        .query({ code: 'the-code', state: 'attacker-state' })
        .set('Cookie', `${STATE_COOKIE}=victim-state.verifier`)
        .expect(302);

      expect(locationOf(response)).toBe(failureLocation('failed'));
      expect(cookieValue(response, 'sid')).toBeUndefined();
    });

    it('refuses a return without the state cookie', async () => {
      const response = await request(app.getHttpServer())
        .get(CALLBACK)
        .query({ code: 'the-code', state: 'any' })
        .expect(302);

      expect(locationOf(response)).toBe(failureLocation('failed'));
    });

    it('refuses a return without a code, e.g. when the user cancels on GitHub', async () => {
      const start = await request(app.getHttpServer()).get('/api/auth/github').expect(302);
      const state = new URL(locationOf(start)).searchParams.get('state') ?? '';

      const response = await request(app.getHttpServer())
        .get(CALLBACK)
        .query({ error: 'access_denied', state })
        .set('Cookie', `${STATE_COOKIE}=${cookieValue(start, STATE_COOKIE) ?? ''}`)
        .expect(302);

      expect(locationOf(response)).toBe(failureLocation('failed'));
    });

    it('clears the state cookie, so a return cannot be replayed', async () => {
      const response = await returnFromGithub();

      expect(cookieValue(response, STATE_COOKIE)).toBe('');
    });

    it('ends the session the browser had before, so a planted session never gets signed in', async () => {
      const planted = await signedInAgent(app);
      const before = await app.get(SessionService).create(planted.userId, {});
      const start = await request(app.getHttpServer()).get('/api/auth/github').expect(302);
      const state = new URL(locationOf(start)).searchParams.get('state') ?? '';

      await request(app.getHttpServer())
        .get(CALLBACK)
        .query({ code: 'the-code', state })
        .set('Cookie', [
          `${STATE_COOKIE}=${cookieValue(start, STATE_COOKIE) ?? ''}`,
          `sid=${before.token}`,
        ])
        .expect(302);

      await expect(app.get(SessionService).validate(before.token)).resolves.toBeNull();
    });
  });
});

describe('GitHub sign-in when it is not configured', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports GitHub as unavailable', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/providers').expect(200);

    expect(response.body).toEqual({ github: false });
  });

  it('answers 404 to a sign-in start', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/github').expect(404);

    expect(response.body.code).toBe(ErrorCode.NOT_FOUND);
  });
});
