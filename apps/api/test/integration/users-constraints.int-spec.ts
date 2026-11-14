import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createUser } from '../helpers/factories.js';

import type { INestApplication } from '@nestjs/common';

describe('users table constraints', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['Mixed@Example.com', ' padded@example.com'])(
    'rejects a non-normalised email (%p) at the database level',
    async (email) => {
      await expect(createUser(prisma, { email })).rejects.toThrow();
    },
  );

  it('rejects a duplicate email', async () => {
    const existing = await createUser(prisma);

    await expect(createUser(prisma, { email: existing.email })).rejects.toThrow();
  });
});
