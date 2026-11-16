import { ErrorCode, RegistrationStatus } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../../common/errors/domain-error.js';
import {
  orderByOf,
  type DateRange,
  type ListQuery,
} from '../../../common/pagination/list-query.js';
import { containsInsensitive } from '../../../common/pagination/search.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { BookingService } from '../booking.service.js';
import { waitlistPositions } from '../waitlist.js';

import { MY_REGISTRATION_INCLUDE, toMyRegistration } from './my-registration-view.js';

import type { ListResult } from '../../../common/pagination/list-result.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { MyRegistration } from '@ers/shared';

export type MyRegistrationSortField = 'createdAt';

export interface MyRegistrationFilters {
  status?: RegistrationStatus | undefined;
  /** When the session starts. */
  startsAt?: DateRange | undefined;
}

/** The session side of the filters, as one relation filter: the start days and the title search. */
function sessionWhereOf(
  search: string | undefined,
  startsAt: DateRange | undefined,
): Prisma.SessionWhereInput {
  return {
    ...(startsAt === undefined ? {} : { startsAt }),
    ...(search === undefined
      ? {}
      : {
          OR: [
            { title: containsInsensitive(search) },
            { event: { title: containsInsensitive(search) } },
          ],
        }),
  };
}

/** The customer's own rows; `q` matches the session or event title, so "React" finds both. */
function whereOf(
  customerId: string,
  search: string | undefined,
  filters: MyRegistrationFilters,
): Prisma.RegistrationWhereInput {
  return {
    customerId,
    ...(filters.status === undefined ? {} : { status: filters.status }),
    session: sessionWhereOf(search, filters.startsAt),
  };
}

/** "My registrations": always limited to the signed-in customer. */
@Injectable()
export class MyRegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingService,
  ) {}

  /** Books the session for the customer and returns the booking as the customer sees it. */
  async book({
    customerId,
    sessionId,
  }: {
    customerId: string;
    sessionId: string;
  }): Promise<MyRegistration> {
    const registration = await this.booking.book(sessionId, customerId);
    return this.getOwn(customerId, registration.id);
  }

  /** Cancels one of the customer's own bookings and returns it as the customer sees it. */
  async cancel(customerId: string, id: string): Promise<MyRegistration> {
    await this.booking.cancel(id, { scope: { customerId }, byStaff: false });
    return this.getOwn(customerId, id);
  }

  /** One of the customer's own bookings; another customer's answers 404, as if it did not exist. */
  async getOwn(customerId: string, id: string): Promise<MyRegistration> {
    const registration = await this.get(customerId, id);
    if (registration === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'Registration not found');
    }
    return registration;
  }

  async list(
    customerId: string,
    query: ListQuery<MyRegistrationSortField>,
    filters: MyRegistrationFilters,
  ): Promise<ListResult<MyRegistration>> {
    const where = whereOf(customerId, query.search, filters);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.registration.findMany({
        where,
        include: MY_REGISTRATION_INCLUDE,
        orderBy: orderByOf(query),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.registration.count({ where }),
    ]);
    const positions = await waitlistPositions(this.prisma, rows);
    const items = rows.map((row) => toMyRegistration(row, positions.get(row.id) ?? null));
    return { items, total };
  }

  private async get(customerId: string, id: string): Promise<MyRegistration | null> {
    const row = await this.prisma.registration.findFirst({
      where: { id, customerId },
      include: MY_REGISTRATION_INCLUDE,
    });
    if (row === null) {
      return null;
    }
    return toMyRegistration(row, (await waitlistPositions(this.prisma, [row])).get(row.id) ?? null);
  }
}
