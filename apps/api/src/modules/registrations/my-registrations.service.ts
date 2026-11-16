import { RegistrationStatus } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { orderByOf, type DateRange, type ListQuery } from '../../common/pagination/list-query.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { MY_REGISTRATION_INCLUDE, toMyRegistration } from './my-registration-view.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma } from '../../generated/prisma/client.js';
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

/** Read side of "My registrations": always limited to the signed-in customer. */
@Injectable()
export class MyRegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const positions = await this.waitlistPositions(rows);
    const items = rows.map((row) => toMyRegistration(row, positions.get(row.id) ?? null));
    return { items, total };
  }

  async get(customerId: string, id: string): Promise<MyRegistration | null> {
    const row = await this.prisma.registration.findFirst({
      where: { id, customerId },
      include: MY_REGISTRATION_INCLUDE,
    });
    if (row === null) {
      return null;
    }
    return toMyRegistration(row, (await this.waitlistPositions([row])).get(row.id) ?? null);
  }

  /** 1-based queue position of each waitlisted row among its session's waitlist, in one query. */
  private async waitlistPositions(
    rows: readonly { id: string; status: RegistrationStatus }[],
  ): Promise<Map<string, number>> {
    const ids = rows
      .filter((row) => row.status === RegistrationStatus.WAITLISTED)
      .map((row) => row.id);
    if (ids.length === 0) {
      return new Map();
    }
    const positions = await this.prisma.$queryRaw<{ id: string; position: number }[]>`
      SELECT r.id::text AS id, (
        SELECT count(*)::int FROM registrations w
        WHERE w.session_id = r.session_id AND w.status = 'WAITLISTED'
          AND (w.created_at, w.id) < (r.created_at, r.id)
      ) + 1 AS position
      FROM registrations r WHERE r.id = ANY(${ids}::uuid[])`;
    return new Map(positions.map((entry) => [entry.id, entry.position]));
  }
}
