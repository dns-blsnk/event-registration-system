import { Action, can, ErrorCode, Resource, Role } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeEmail } from '../auth/email.js';
import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';

import type { ListQuery } from '../../common/pagination/list-query.js';
import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

export type UserSortField = 'createdAt' | 'name' | 'email' | 'role';

export interface UserFilters {
  role?: Role | undefined;
}

const NOT_FOUND_MESSAGE = 'User not found';

/** Lock waits can queue behind other user-management writes; allow for that, then fail as 409. */
const LOCKING_TRANSACTION = { maxWait: 5000, timeout: 15_000 } as const;

/**
 * Admin-only user management. Role changes and deletions lock the admin rows and re-read the target
 * and the actor inside the transaction, so concurrent requests run one after another and
 * the last admin can never be removed.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async list(query: ListQuery<UserSortField>, filters: UserFilters): Promise<ListResult<User>> {
    const where: Prisma.UserWhereInput = {
      ...(filters.role === undefined ? {} : { role: filters.role }),
      ...(query.search === undefined
        ? {}
        : {
            OR: [
              { email: containsInsensitive(query.search) },
              { name: containsInsensitive(query.search) },
            ],
          }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        // id as tiebreaker keeps offset pagination stable when sort values repeat.
        orderBy: [
          ...query.sort.map(({ field, direction }) => ({ [field]: direction })),
          { id: 'asc' },
        ],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (user === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    return user;
  }

  /** Admin-created accounts may have any role. A duplicate email is a 409 (unique index). */
  async create(dto: CreateUserDto): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: normalizeEmail(dto.email),
        name: dto.name,
        role: dto.role,
        passwordHash: await this.passwords.hash(dto.password),
      },
    });
  }

  /**
   * Updates name and/or role. The route needs users:edit; an actual role change additionally needs
   * users:change-role, checked here because one PATCH can carry both kinds of change. A role change
   * signs the user out everywhere in the same transaction, so the new permissions apply at once.
   */
  async update(id: string, dto: UpdateUserDto, actor: User): Promise<User> {
    const nameData = dto.name === undefined ? {} : { name: dto.name };
    const role = dto.role;
    if (role === undefined) {
      return this.prisma.user.update({ where: { id }, data: nameData });
    }
    return this.prisma.$transaction(async (tx) => {
      const { target, actorNow } = await this.lockAndRead(tx, id, actor.id);
      if (target.role === role) {
        return tx.user.update({ where: { id }, data: nameData });
      }
      if (id === actor.id) {
        throw new DomainError(ErrorCode.CONFLICT, 'You cannot change your own role');
      }
      // Re-checked under the lock: the actor may have been demoted while this request waited.
      if (!can(actorNow.role, Resource.USERS, Action.CHANGE_ROLE)) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'You do not have permission to change roles');
      }
      await this.assertNotLastAdmin(tx, target);
      const updated = await tx.user.update({ where: { id }, data: { ...nameData, role } });
      await this.sessions.revokeAllForUser(id, undefined, tx);
      return updated;
    }, LOCKING_TRANSACTION);
  }

  /** Deletes the account and its sessions (cascade). */
  async remove(id: string, actor: User): Promise<void> {
    if (id === actor.id) {
      throw new DomainError(ErrorCode.CONFLICT, 'You cannot delete your own account');
    }
    await this.prisma.$transaction(async (tx) => {
      const { target, actorNow } = await this.lockAndRead(tx, id, actor.id);
      if (!can(actorNow.role, Resource.USERS, Action.DELETE)) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'You do not have permission to delete users');
      }
      await this.assertNotLastAdmin(tx, target);
      await tx.user.delete({ where: { id } });
    }, LOCKING_TRANSACTION);
  }

  /**
   * Locks every admin row plus the target and the actor in one ordered statement (no deadlocks),
   * then reads both. Concurrent role changes or deletions wait here, so each one sees the result of
   * the previous one. FOR NO KEY UPDATE does not block inserts that reference users (e.g. logins).
   * Admin rows are few and user-management writes are rare, so locking the whole set is cheap.
   */
  private async lockAndRead(
    tx: Prisma.TransactionClient,
    targetId: string,
    actorId: string,
  ): Promise<{ target: User; actorNow: User }> {
    await tx.$queryRaw`
      SELECT id FROM users
      WHERE role = ${Role.ADMIN}::"Role" OR id IN (${targetId}::uuid, ${actorId}::uuid)
      ORDER BY id
      FOR NO KEY UPDATE`;
    const [target, actorNow] = await Promise.all([
      tx.user.findUnique({ where: { id: targetId } }),
      tx.user.findUnique({ where: { id: actorId } }),
    ]);
    if (target === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    if (actorNow === null) {
      throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }
    return { target, actorNow };
  }

  /** Keeps at least one admin, so the system can never lock itself out of user management. */
  private async assertNotLastAdmin(tx: Prisma.TransactionClient, target: User): Promise<void> {
    if (target.role !== Role.ADMIN) {
      return;
    }
    const admins = await tx.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) {
      throw new DomainError(ErrorCode.CONFLICT, 'At least one admin must remain');
    }
  }
}
