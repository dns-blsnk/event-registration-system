import {
  ErrorCode,
  EventStatus,
  type CatalogEventDetail,
  type CatalogEventListItem,
} from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { orderByOf, type DateRange, type ListQuery } from '../../common/pagination/list-query.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EventBannerService } from '../events/event-banner.service.js';

import {
  CATALOG_LIST_INCLUDE,
  catalogDetailInclude,
  toCatalogEventDetail,
  toCatalogEventListItem,
} from './catalog-view.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma } from '../../generated/prisma/client.js';

export type CatalogSortField = 'startsAt' | 'title';

export interface CatalogFilters {
  city?: string | undefined;
  tagId?: string | undefined;
  startsAt?: DateRange | undefined;
}

const NOT_FOUND_MESSAGE = 'Event not found';

/**
 * What customers may see: published events that have not ended yet. Drafts, cancelled and
 * completed events never appear, and asking for one by id looks like a missing event.
 */
function visibleNow(now: Date): Prisma.EventWhereInput {
  return { status: EventStatus.PUBLISHED, endsAt: { gt: now } };
}

function filtersToWhere(
  filters: CatalogFilters,
  search: string | undefined,
): Prisma.EventWhereInput[] {
  return [
    filters.city === undefined ? {} : { city: { equals: filters.city, mode: 'insensitive' } },
    filters.tagId === undefined ? {} : { tags: { some: { tagId: filters.tagId } } },
    filters.startsAt === undefined ? {} : { startsAt: filters.startsAt },
    search === undefined
      ? {}
      : {
          OR: [
            { title: containsInsensitive(search) },
            { city: containsInsensitive(search) },
            { venue: containsInsensitive(search) },
          ],
        },
  ];
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly banners: EventBannerService,
  ) {}

  async list(
    query: ListQuery<CatalogSortField>,
    filters: CatalogFilters,
    now: Date = new Date(),
  ): Promise<ListResult<CatalogEventListItem>> {
    const where: Prisma.EventWhereInput = {
      AND: [visibleNow(now), ...filtersToWhere(filters, query.search)],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: CATALOG_LIST_INCLUDE,
        orderBy: orderByOf(query),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items: items.map((event) => toCatalogEventListItem(event, now)), total };
  }

  /** One visible event with its banner link, its sessions and the customer's own registrations. */
  async get(id: string, customerId: string, now: Date = new Date()): Promise<CatalogEventDetail> {
    const event = await this.prisma.event.findFirst({
      where: { AND: [{ id }, visibleNow(now)] },
      include: catalogDetailInclude(customerId),
    });
    if (event === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    return toCatalogEventDetail(event, await this.banners.urlOf(event.bannerKey), now);
  }
}
