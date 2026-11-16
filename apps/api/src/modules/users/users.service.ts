import {
  Action,
  ADMIN_ROLES,
  can,
  ErrorCode,
  EVENT_OWNER_ROLES,
  Resource,
  Role,
  roleChangeRefusal,
  roleGrantRefusal,
  userManagementRefusal,
} from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { orderByOf, type ListQuery } from '../../common/pagination/list-query.js';
import { personSearch } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeEmail } from '../auth/email.js';
import { PasswordService } from '../auth/local/password.service.js';
import { SessionService } from '../identity/session.service.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

export type UserSortField = 'createdAt' | 'name' | 'email' | 'role';

export interface UserFilters {
  role?: Role | undefined;
  /** Only users who can own an event (admins and organizers), for the events owner filter. */
  canOrganize?: boolean;
}

const NOT_FOUND_MESSAGE = 'User not found';

/** Lock waits can queue behind other user-management writes; allow for that, then fail as 409. */
const LOCKING_TRANSACTION = { maxWait: 5000, timeout: 15_000 } as const;

/** A refusal from the shared user-management rules becomes a 403. */
function assertAllowed(refusal: string | undefined): void {
  if (refusal !== undefined) {
    throw new DomainError(ErrorCode.FORBIDDEN, refusal);
  }
}

/**
 * Admin-only user management, with admins and super admins managed by super admins only (shared
 * rules in @ers/shared). Role changes and deletions lock the admin rows and re-read the target and
 * the actor inside the transaction, so concurrent requests run one after another and the last
 * super admin can never be removed.
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
      AND: [
        filters.role === undefined ? {} : { role: filters.role },
        filters.canOrganize === true ? { role: { in: [...EVENT_OWNER_ROLES] } } : {},
      ],
      ...personSearch(query.search),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: orderByOf(query),
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

  /**
   * Admins create organizers and customers; only a super admin creates admins. A duplicate email
   * is a 409 (unique index).
   */
  async create(dto: CreateUserDto, actor: User): Promise<User> {
    // Read again, not taken from the session: the actor may have been demoted a moment ago.
    const actorNow = await this.prisma.user.findUnique({ where: { id: actor.id } });
    if (actorNow === null) {
      throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Sign in required');
    }
    assertAllowed(roleGrantRefusal(actorNow.role, dto.role));
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
    // Anyone may rename their own account, which needs no lock.
    if (id === actor.id && role === undefined) {
      return this.prisma.user.update({ where: { id }, data: nameData });
    }
    return this.prisma.$transaction(async (tx) => {
      const { target, actorNow } = await this.lockAndRead(tx, id, actor.id);
      if (role === undefined || target.role === role) {
        // Any other account only within the rules, checked on the roles as they are now.
        if (id !== actor.id) {
          assertAllowed(userManagementRefusal(actorNow.role, target.role));
        }
        return tx.user.update({ where: { id }, data: nameData });
      }
      if (id === actor.id) {
        throw new DomainError(ErrorCode.CONFLICT, 'You cannot change your own role');
      }
      // Re-checked under the lock: the actor may have been demoted while this request waited.
      if (!can(actorNow.role, Resource.USERS, Action.CHANGE_ROLE)) {
        throw new DomainError(ErrorCode.FORBIDDEN, 'You do not have permission to change roles');
      }
      assertAllowed(roleChangeRefusal(actorNow.role, target.role, role));
      await this.assertNotLastSuperAdmin(tx, target);
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
      assertAllowed(userManagementRefusal(actorNow.role, target.role));
      await this.assertNotLastSuperAdmin(tx, target);
      await this.assertHasNoHistory(tx, id);
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
      WHERE role = ANY(${[...ADMIN_ROLES]}::"Role"[]) OR id IN (${targetId}::uuid, ${actorId}::uuid)
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

  /** Events and bookings are history: their owner cannot be deleted, only demoted. */
  private async assertHasNoHistory(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const [events, registrations] = await Promise.all([
      tx.event.count({ where: { organizerId: id } }),
      tx.registration.count({ where: { customerId: id } }),
    ]);
    if (events > 0 || registrations > 0) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'This user owns events or has registrations and cannot be deleted',
      );
    }
  }

  /**
   * Keeps at least one super admin, so the system can never lock itself out of managing admins.
   * Plain admins need no such guard: only a super admin can demote or delete them.
   */
  private async assertNotLastSuperAdmin(tx: Prisma.TransactionClient, target: User): Promise<void> {
    if (target.role !== Role.SUPER_ADMIN) {
      return;
    }
    const superAdmins = await tx.user.count({ where: { role: Role.SUPER_ADMIN } });
    if (superAdmins <= 1) {
      throw new DomainError(ErrorCode.CONFLICT, 'At least one super admin must remain');
    }
  }
}
