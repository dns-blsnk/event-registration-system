import { ErrorCode, Role } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
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
              { email: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: query.sort.map(({ field, direction }) => ({ [field]: direction })),
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
      throw new DomainError(ErrorCode.NOT_FOUND, 'User not found');
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

  /** A role change signs the user out everywhere, so the new permissions apply immediately. */
  async update(id: string, dto: UpdateUserDto, actor: User): Promise<User> {
    const user = await this.get(id);
    const isRoleChange = dto.role !== undefined && dto.role !== user.role;
    if (isRoleChange) {
      this.assertNotSelf(user, actor, 'You cannot change your own role');
      await this.assertNotLastAdmin(user);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(isRoleChange ? { role: dto.role } : {}),
      },
    });
    if (isRoleChange) {
      await this.sessions.revokeAllForUser(id);
    }
    return updated;
  }

  /** Deletes the account and its sessions. Organizers who own events cannot be deleted (409). */
  async remove(id: string, actor: User): Promise<void> {
    const user = await this.get(id);
    this.assertNotSelf(user, actor, 'You cannot delete your own account');
    await this.assertNotLastAdmin(user);
    await this.prisma.user.delete({ where: { id } });
  }

  private assertNotSelf(user: User, actor: User, message: string): void {
    if (user.id === actor.id) {
      throw new DomainError(ErrorCode.CONFLICT, message);
    }
  }

  /** Keeps at least one admin, so the system can never lock itself out of user management. */
  private async assertNotLastAdmin(user: User): Promise<void> {
    if (user.role !== Role.ADMIN) {
      return;
    }
    const admins = await this.prisma.user.count({ where: { role: Role.ADMIN } });
    if (admins <= 1) {
      throw new DomainError(ErrorCode.CONFLICT, 'At least one admin must remain');
    }
  }
}
