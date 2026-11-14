import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PermissionsFixtureController } from '../fixtures/permissions-fixture.controller.js';
import { signedInAgent } from '../helpers/auth.js';
import { createTestApp } from '../helpers/create-test-app.js';

import type { Role } from '@ers/shared';
import type { INestApplication } from '@nestjs/common';

type Expectation = Record<Role, number>;

const ROLES = ['ADMIN', 'ORGANIZER', 'CUSTOMER'] as const;

const MATRIX: [string, 'get' | 'post', Expectation][] = [
  ['/api/test-permissions/users', 'get', { ADMIN: 200, ORGANIZER: 403, CUSTOMER: 403 }],
  ['/api/test-permissions/events', 'post', { ADMIN: 201, ORGANIZER: 201, CUSTOMER: 403 }],
  ['/api/test-permissions/my-registrations', 'get', { ADMIN: 403, ORGANIZER: 403, CUSTOMER: 200 }],
  ['/api/test-permissions/signed-in', 'get', { ADMIN: 200, ORGANIZER: 200, CUSTOMER: 200 }],
  ['/api/test-permissions/undeclared', 'get', { ADMIN: 403, ORGANIZER: 403, CUSTOMER: 403 }],
];

describe('permission guard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [PermissionsFixtureController] });
  });

  afterAll(async () => {
    await app.close();
  });

  for (const [path, method, expected] of MATRIX) {
    for (const role of ROLES) {
      it(`${method.toUpperCase()} ${path} as ${role} answers ${String(expected[role])}`, async () => {
        const { agent, csrfToken } = await signedInAgent(app, role);
        const call =
          method === 'get' ? agent.get(path) : agent.post(path).set('x-csrf-token', csrfToken);

        await call.expect(expected[role]);
      });
    }
  }

  it('answers 403 with the FORBIDDEN code', async () => {
    const { agent } = await signedInAgent(app, 'CUSTOMER');

    const response = await agent.get('/api/test-permissions/users').expect(403);

    expect(response.body).toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have permission to do this',
    });
  });

  it('answers 401 to anonymous requests before checking permissions', async () => {
    await request(app.getHttpServer()).get('/api/test-permissions/users').expect(401);
  });
});
