import { ErrorCode, type RegistrationStatus } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { registrationScope } from './registration-scope.js';
import { REGISTRATION_INCLUDE, type RegistrationWithRelations } from './registration-view.js';

import type { ListQuery } from '../../common/pagination/list-query.js';
import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma, User } from '../../generated/prisma/client.js';

export type RegistrationSortField = 'createdAt' | 'status';

export interface RegistrationFilters {
  status?: RegistrationStatus | undefined;
  sessionId?: string | undefined;
  eventId?: string | undefined;
  customerId?: string | undefined;
}

/** Read side of registrations for staff, always scoped to what the actor may see. */
@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery<RegistrationSortField>,
    filters: RegistrationFilters,
    actor: User,
  ): Promise<ListResult<RegistrationWithRelations>> {
    const where: Prisma.RegistrationWhereInput = {
      AND: [
        registrationScope(actor),
        filters.status === undefined ? {} : { status: filters.status },
        filters.sessionId === undefined ? {} : { sessionId: filters.sessionId },
        filters.eventId === undefined ? {} : { session: { eventId: filters.eventId } },
        filters.customerId === undefined ? {} : { customerId: filters.customerId },
        query.search === undefined
          ? {}
          : {
              customer: {
                OR: [
                  { name: containsInsensitive(query.search) },
                  { email: containsInsensitive(query.search) },
                ],
              },
            },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        include: REGISTRATION_INCLUDE,
        orderBy: [
          ...query.sort.map(({ field, direction }) => ({ [field]: direction })),
          { id: 'asc' },
        ],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.registration.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string, actor: User): Promise<RegistrationWithRelations> {
    const registration = await this.prisma.registration.findFirst({
      where: { AND: [{ id }, registrationScope(actor)] },
      include: REGISTRATION_INCLUDE,
    });
    if (registration === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'Registration not found');
    }
    return registration;
  }
}
