import { describe, expect, it, vi } from 'vitest';

import { Prisma, type User } from '../../../generated/prisma/client.js';

import { GithubSignInService, type GithubCallback } from './github-sign-in.service.js';

import type { PrismaService } from '../../../prisma/prisma.service.js';
import type { SessionService } from '../../identity/index.js';
import type { GithubClient } from './github-client.js';
import type { PinoLogger } from 'nestjs-pino';

const PROFILE = { id: '77', name: 'Gita', email: 'gita@test.local' };
const CREATED_BY_OTHER_TAB = { id: 'user-1', githubId: '77' } as User;
const CALLBACK: GithubCallback = {
  code: 'the-code',
  state: 's',
  stateCookie: 's.verifier',
  redirectUri: 'http://x/cb',
  meta: {},
  previousToken: undefined,
};

const github = {
  exchangeCode: () => Promise.resolve('token'),
  fetchProfile: () => Promise.resolve(PROFILE),
} as unknown as GithubClient;
const sessions = {
  create: () => Promise.resolve({ token: 't', csrfToken: 'c', expiresAt: new Date() }),
  revoke: vi.fn(),
} as unknown as SessionService;
const logger = { setContext: vi.fn(), info: vi.fn(), warn: vi.fn() } as unknown as PinoLogger;

describe('GithubSignInService', () => {
  it('signs in with the account a second tab created at the same moment', async () => {
    const lookups = [null, null, CREATED_BY_OTHER_TAB];
    const prisma = {
      user: {
        findUnique: () => Promise.resolve(lookups.shift() ?? null),
        create: () =>
          Promise.reject(
            new Prisma.PrismaClientKnownRequestError('unique', {
              code: 'P2002',
              clientVersion: '7.10.1',
            }),
          ),
      },
    } as unknown as PrismaService;

    const result = await new GithubSignInService(github, prisma, sessions, logger).complete(
      CALLBACK,
    );

    expect(typeof result === 'string' ? result : result.user).toBe(CREATED_BY_OTHER_TAB);
  });
});
