import { readFileSync } from 'node:fs';

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

  describe('the migration that gives an existing database its super admin', () => {
    const promotion = readFileSync(
      new URL(
        '../../prisma/migrations/20261115213000_promote_first_super_admin/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const ROLLED_BACK = 'rolled back';

    /** Runs the migration on a scene set up inside a transaction that is always rolled back. */
    async function promoteIn(
      scene: (tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0]) => Promise<string>,
    ): Promise<string[]> {
      let promoted: string[] = [];
      await prisma
        .$transaction(async (tx) => {
          const marker = await scene(tx);
          await tx.$executeRawUnsafe(promotion);
          promoted = (
            await tx.user.findMany({
              where: { role: 'SUPER_ADMIN', name: marker },
              select: { email: true },
            })
          ).map((user) => user.email);
          throw new Error(ROLLED_BACK);
        })
        .catch((error: unknown) => {
          if (!(error instanceof Error) || error.message !== ROLLED_BACK) throw error;
        });
      return promoted;
    }

    it('promotes the longest-standing admin when there is no super admin', async () => {
      const promoted = await promoteIn(async (tx) => {
        await tx.user.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { role: 'ADMIN' } });
        await tx.user.updateMany({ where: { role: 'ADMIN' }, data: { createdAt: new Date() } });
        await tx.user.create({
          data: {
            email: 'first-admin@test.local',
            name: 'scene',
            role: 'ADMIN',
            createdAt: new Date('2000-01-01'),
          },
        });
        return 'scene';
      });

      expect(promoted).toEqual(['first-admin@test.local']);
    });

    it('changes nothing when a super admin already exists', async () => {
      const promoted = await promoteIn(async (tx) => {
        await tx.user.create({
          data: { email: 'owner-exists@test.local', name: 'other', role: 'SUPER_ADMIN' },
        });
        await tx.user.create({
          data: {
            email: 'old-admin@test.local',
            name: 'scene',
            role: 'ADMIN',
            createdAt: new Date('2000-01-01'),
          },
        });
        return 'scene';
      });

      expect(promoted).toEqual([]);
    });
  });
});
