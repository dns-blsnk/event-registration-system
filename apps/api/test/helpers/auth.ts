import request from 'supertest';

import { APP_CONFIG } from '../../src/config/config.module.js';
import { PasswordService } from '../../src/modules/auth/password.service.js';
import { sessionCookieName } from '../../src/modules/auth/session-cookie.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

import { createUser } from './factories.js';

import type { Config } from '../../src/config/config.schema.js';
import type { Role } from '@ers/shared';
import type { INestApplication } from '@nestjs/common';
import type TestAgent from 'supertest/lib/agent.js';

export const TEST_PASSWORD = 'correct horse battery';

export interface SignedInAgent {
  agent: TestAgent;
  csrfToken: string;
  userId: string;
  email: string;
}

/**
 * Creates a user with a known password and a live session, keeping the session cookie on the agent.
 * The session is created directly (the login endpoint itself is covered by the auth tests), so
 * suites that need many users do not run into the per-IP login throttle.
 */
export async function signedInAgent(
  app: INestApplication,
  role: Role = 'CUSTOMER',
): Promise<SignedInAgent> {
  const passwordHash = await app.get(PasswordService).hash(TEST_PASSWORD);
  const user = await createUser(app.get(PrismaService), { role, passwordHash });
  const session = await app.get(SessionService).create(user.id, {});
  const cookieName = sessionCookieName(app.get<Config>(APP_CONFIG));
  const agent = request.agent(app.getHttpServer()).set('Cookie', `${cookieName}=${session.token}`);
  return { agent, csrfToken: session.csrfToken, userId: user.id, email: user.email };
}
