import { ErrorCode, type AppLogCategory, type AppLogLevel } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { omitUndefined } from '../../common/objects.js';
import { orderByOf, type DateRange, type ListQuery } from '../../common/pagination/list-query.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { AppLog, Prisma } from '../../generated/prisma/client.js';

export type AppLogSortField = 'createdAt';

export interface AppLogFilters {
  level?: AppLogLevel | undefined;
  category?: AppLogCategory | undefined;
  statusCode?: number | undefined;
  requestId?: string | undefined;
  createdAt?: DateRange | undefined;
}

/** Read side of the error and security journal (the admin "Logs" page). */
@Injectable()
export class AppLogsReadService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery<AppLogSortField>,
    filters: AppLogFilters,
  ): Promise<ListResult<AppLog>> {
    const where: Prisma.AppLogWhereInput = {
      AND: [
        omitUndefined({
          level: filters.level,
          category: filters.category,
          statusCode: filters.statusCode,
          requestId: filters.requestId,
        }),
        filters.createdAt === undefined ? {} : { createdAt: filters.createdAt },
        query.search === undefined
          ? {}
          : {
              OR: [
                { message: containsInsensitive(query.search) },
                { route: containsInsensitive(query.search) },
              ],
            },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appLog.findMany({
        where,
        orderBy: orderByOf(query),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.appLog.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string): Promise<AppLog> {
    const row = await this.prisma.appLog.findUnique({ where: { id } });
    if (row === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, 'Log entry not found');
    }
    return row;
  }
}
