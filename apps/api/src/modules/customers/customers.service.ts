import { ErrorCode, Role, type CustomerListItem } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { orderByOf, type ListQuery } from '../../common/pagination/list-query.js';
import { personSearch } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { eventScope } from '../events/event-scope.js';
import { registrationScope } from '../registrations/registration-scope.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma, User } from '../../generated/prisma/client.js';

export type CustomerSortField = 'name' | 'email' | 'createdAt' | 'registrationCount';

/** True when the actor's registration scope is unrestricted (admins); derived from the one scope rule. */
function seesAllRegistrations(actor: User): boolean {
  return Object.keys(eventScope(actor)).length === 0;
}

/**
 * A customer is anyone with the CUSTOMER role or anyone who booked a seat (a customer later promoted
 * to staff keeps their booking history). Organizers see only people who registered for one of
 * their events, cancelled registrations included: that is still their contact history.
 */
function customerScope(actor: User): Prisma.UserWhereInput {
  return seesAllRegistrations(actor)
    ? { OR: [{ role: Role.CUSTOMER }, { registrations: { some: {} } }] }
    : { registrations: { some: registrationScope(actor) } };
}

function customerSelect(actor: User) {
  return {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    _count: {
      select: {
        registrations: seesAllRegistrations(actor) ? true : { where: registrationScope(actor) },
      },
    },
  } satisfies Prisma.UserSelect;
}

type CustomerRow = Prisma.UserGetPayload<{ select: ReturnType<typeof customerSelect> }>;

function toCustomerListItem(row: CustomerRow): CustomerListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    registrationCount: row._count.registrations,
  };
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery<CustomerSortField>,
    actor: User,
  ): Promise<ListResult<CustomerListItem>> {
    const where: Prisma.UserWhereInput = {
      AND: [customerScope(actor), personSearch(query.search)],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: customerSelect(actor),
        orderBy: orderByOf(query, (field, direction) =>
          field === 'registrationCount' ? { registrations: { _count: direction } } : undefined,
        ),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(toCustomerListItem), total };
  }

  async get(id: string, actor: User): Promise<CustomerListItem> {
    const row = await this.prisma.user.findFirst({
      where: { AND: [{ id }, customerScope(actor)] },
      select: customerSelect(actor),
    });
    if (row === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'Customer not found');
    }
    return toCustomerListItem(row);
  }
}
