import request from 'supertest';

import { PasswordService } from '../../src/modules/auth/password.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

import { createUser } from './factories.js';

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

/** Creates a user with a known password and logs in through the API, keeping the session cookie. */
export async function signedInAgent(
  app: INestApplication,
  role: Role = 'CUSTOMER',
): Promise<SignedInAgent> {
  const passwordHash = await app.get(PasswordService).hash(TEST_PASSWORD);
  const user = await createUser(app.get(PrismaService), { role, passwordHash });
  const agent = request.agent(app.getHttpServer());
  const response = await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD })
    .expect(200);
  return { agent, csrfToken: response.body.csrfToken, userId: user.id, email: user.email };
}
