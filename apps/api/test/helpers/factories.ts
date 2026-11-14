import { randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient, User } from '../../src/generated/prisma/client.js';

/** Creates a user with a unique email; tests never depend on each other's data. */
export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: `user-${randomUUID()}@test.local`,
      name: 'Test User',
      role: 'CUSTOMER',
      ...overrides,
    },
  });
}
