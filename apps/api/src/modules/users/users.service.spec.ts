import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';

import { UsersService } from './users.service.js';

import type { User } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { PasswordService } from '../auth/password.service.js';
import type { SessionService } from '../auth/session.service.js';

function user(id: string, role: User['role']): User {
  return { id, role, email: `${id}@x.co`, name: id } as User;
}

function serviceWith(target: User, adminCount: number): UsersService {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(target),
      count: vi.fn().mockResolvedValue(adminCount),
      update: vi.fn().mockResolvedValue(target),
      delete: vi.fn().mockResolvedValue(target),
    },
  };
  return new UsersService(
    prisma as unknown as PrismaService,
    {} as PasswordService,
    { revokeAllForUser: vi.fn() } as unknown as SessionService,
  );
}

async function messageOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof DomainError ? error.message : 'OTHER';
  }
  return undefined;
}

const actor = user('actor', 'ADMIN');

describe('UsersService last-admin protection', () => {
  it('refuses to demote the only admin', async () => {
    const service = serviceWith(user('only', 'ADMIN'), 1);

    expect(await messageOf(() => service.update('only', { role: 'CUSTOMER' }, actor))).toBe(
      'At least one admin must remain',
    );
  });

  it('refuses to delete the only admin', async () => {
    const service = serviceWith(user('only', 'ADMIN'), 1);

    expect(await messageOf(() => service.remove('only', actor))).toBe(
      'At least one admin must remain',
    );
  });

  it('allows demoting an admin when another admin remains', async () => {
    const service = serviceWith(user('second', 'ADMIN'), 2);

    expect(
      await messageOf(() => service.update('second', { role: 'ORGANIZER' }, actor)),
    ).toBeUndefined();
  });
});
