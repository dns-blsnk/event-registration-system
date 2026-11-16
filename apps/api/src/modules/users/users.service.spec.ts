import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../common/errors/domain-error.js';

import { UsersService } from './users.service.js';

import type { User } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { PasswordService } from '../auth/local/password.service.js';
import type { SessionService } from '../identity/session.service.js';

function user(id: string, role: User['role']): User {
  return { id, role, email: `${id}@x.co`, name: id } as User;
}

const actor = user('actor', 'ADMIN');
const owner = user('owner', 'SUPER_ADMIN');

function setup(
  target: User,
  adminCount: number,
  actorNow: User = actor,
  history: { events: number; registrations: number } = { events: 0, registrations: 0 },
): {
  service: UsersService;
  tx: { $queryRaw: ReturnType<typeof vi.fn>; user: Record<string, ReturnType<typeof vi.fn>> };
  revokeAllForUser: ReturnType<typeof vi.fn>;
} {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === actorNow.id ? actorNow : target),
      ),
      count: vi.fn().mockResolvedValue(adminCount),
      update: vi.fn().mockResolvedValue(target),
      delete: vi.fn().mockResolvedValue(target),
    },
    event: { count: vi.fn().mockResolvedValue(history.events) },
    registration: { count: vi.fn().mockResolvedValue(history.registrations) },
  };
  const prisma = {
    ...tx,
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  };
  const revokeAllForUser = vi.fn();
  const service = new UsersService(
    prisma as unknown as PrismaService,
    {} as PasswordService,
    { revokeAllForUser } as unknown as SessionService,
  );
  return { service, tx, revokeAllForUser };
}

async function messageOf(run: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof DomainError ? error.message : 'OTHER';
  }
  return undefined;
}

describe('UsersService role changes', () => {
  it('locks admin rows and re-reads the target before changing a role', async () => {
    const { service, tx } = setup(user('target', 'CUSTOMER'), 2);

    await service.update('target', { role: 'ORGANIZER' }, actor);

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { id: 'target' } });
    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { id: 'actor' } });
  });

  it('signs the user out in the same transaction', async () => {
    const { service, tx, revokeAllForUser } = setup(user('target', 'CUSTOMER'), 2);

    await service.update('target', { role: 'ORGANIZER' }, actor);

    expect(revokeAllForUser).toHaveBeenCalledWith('target', undefined, tx);
  });

  it('refuses to demote the only super admin', async () => {
    const { service } = setup(user('only', 'SUPER_ADMIN'), 1, owner);

    expect(await messageOf(() => service.update('only', { role: 'CUSTOMER' }, owner))).toBe(
      'At least one super admin must remain',
    );
  });

  it('lets a super admin demote another super admin while one remains', async () => {
    const { service } = setup(user('second', 'SUPER_ADMIN'), 2, owner);

    expect(
      await messageOf(() => service.update('second', { role: 'ORGANIZER' }, owner)),
    ).toBeUndefined();
  });

  it('does not let an admin demote another admin', async () => {
    const { service } = setup(user('other', 'ADMIN'), 2);

    expect(await messageOf(() => service.update('other', { role: 'CUSTOMER' }, actor))).toBe(
      'Only a super admin can change or delete an admin',
    );
  });

  it('does not let an admin grant an admin role', async () => {
    const { service } = setup(user('target', 'ORGANIZER'), 2);

    expect(await messageOf(() => service.update('target', { role: 'ADMIN' }, actor))).toBe(
      'Only a super admin can grant an admin role',
    );
  });

  it('refuses a role change from a role without the change-role permission', async () => {
    const organizer = user('org', 'ORGANIZER');
    const { service } = setup(user('target', 'CUSTOMER'), 2, organizer);

    expect(await messageOf(() => service.update('target', { role: 'ADMIN' }, organizer))).toBe(
      'You do not have permission to change roles',
    );
  });

  it('refuses a role change from an admin who was demoted while the request waited', async () => {
    const { service } = setup(user('target', 'CUSTOMER'), 2, user('actor', 'CUSTOMER'));

    expect(await messageOf(() => service.update('target', { role: 'ADMIN' }, actor))).toBe(
      'You do not have permission to change roles',
    );
  });

  it('lets an admin save their own profile with an unchanged role', async () => {
    const { service } = setup(actor, 2);

    expect(
      await messageOf(() => service.update('actor', { name: 'New', role: 'ADMIN' }, actor)),
    ).toBeUndefined();
  });

  it('refuses a change of the actor own role', async () => {
    const { service } = setup(actor, 2);

    expect(await messageOf(() => service.update('actor', { role: 'CUSTOMER' }, actor))).toBe(
      'You cannot change your own role',
    );
  });

  it('does not sign anyone out when the role does not actually change', async () => {
    const { service, revokeAllForUser } = setup(user('target', 'ORGANIZER'), 2);

    await service.update('target', { role: 'ORGANIZER' }, actor);

    expect(revokeAllForUser).not.toHaveBeenCalled();
  });
});

describe('UsersService deletion', () => {
  it('refuses to delete the only super admin', async () => {
    const { service } = setup(user('only', 'SUPER_ADMIN'), 1, owner);

    expect(await messageOf(() => service.remove('only', owner))).toBe(
      'At least one super admin must remain',
    );
  });

  it('does not let an admin delete another admin', async () => {
    const { service } = setup(user('other', 'ADMIN'), 2);

    expect(await messageOf(() => service.remove('other', actor))).toBe(
      'Only a super admin can change or delete an admin',
    );
  });

  it('answers 404 when the user disappeared before the lock', async () => {
    const { service, tx } = setup(user('gone', 'CUSTOMER'), 2);
    tx.user.findUnique?.mockResolvedValue(null);

    expect(await messageOf(() => service.remove('gone', actor))).toBe('User not found');
  });
});

describe('UsersService history protection', () => {
  it.each([
    ['owns events', { events: 2, registrations: 0 }],
    ['has registrations', { events: 0, registrations: 1 }],
  ])('refuses to delete a user who %s', async (_label, history) => {
    const { service, tx } = setup(user('target', 'CUSTOMER'), 2, actor, history);

    expect(await messageOf(() => service.remove('target', actor))).toBe(
      'This user owns events or has registrations and cannot be deleted',
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it('deletes a user without history', async () => {
    const { service, tx } = setup(user('target', 'CUSTOMER'), 2);

    await service.remove('target', actor);

    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'target' } });
  });
});
