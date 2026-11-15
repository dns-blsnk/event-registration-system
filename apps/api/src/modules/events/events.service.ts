import { ErrorCode, EventStatus, hasAdminPowers, Role } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { fieldError } from '../../common/errors/field-error.js';
import { omitUndefined } from '../../common/objects.js';
import { orderByOf, type DateRange, type ListQuery } from '../../common/pagination/list-query.js';
import { isValidRange } from '../../domain/schedule.js';
import { assertEventEditable } from '../../domain/status-transitions.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { EVENT_NOT_FOUND_MESSAGE, lockScopedEvent } from './event-lock.js';
import { eventScope } from './event-scope.js';
import { eventTextFilters } from './event-text-filters.js';
import { EVENT_INCLUDE, type EventWithRelations } from './event-view.js';
import { makeSlug } from './slug.js';

import type { ListResult } from '../../common/pagination/list-result.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';

export type EventSortField = 'startsAt' | 'title' | 'city' | 'status' | 'createdAt';

export interface EventFilters {
  status?: EventStatus | undefined;
  city?: string | undefined;
  tagId?: string | undefined;
  organizerId?: string | undefined;
  startsAt?: DateRange | undefined;
}

function filtersToWhere(
  filters: EventFilters,
  search: string | undefined,
): Prisma.EventWhereInput[] {
  return [
    filters.status === undefined ? {} : { status: filters.status },
    filters.tagId === undefined ? {} : { tags: { some: { tagId: filters.tagId } } },
    filters.organizerId === undefined ? {} : { organizerId: filters.organizerId },
    filters.startsAt === undefined ? {} : { startsAt: filters.startsAt },
    ...eventTextFilters(filters.city, search),
  ];
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery<EventSortField>,
    filters: EventFilters,
    actor: User,
  ): Promise<ListResult<EventWithRelations>> {
    const where: Prisma.EventWhereInput = {
      AND: [eventScope(actor), ...filtersToWhere(filters, query.search)],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        orderBy: orderByOf(query),
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total };
  }

  /** Scoped lookup: an organizer asking for someone else's event gets the same 404 as for a missing one. */
  async get(id: string, actor: User): Promise<EventWithRelations> {
    const event = await this.prisma.event.findFirst({
      where: { id, ...eventScope(actor) },
      include: EVENT_INCLUDE,
    });
    if (event === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, EVENT_NOT_FOUND_MESSAGE);
    }
    return event;
  }

  /** New events start as DRAFT, owned by the creator (admins may assign an organizer). */
  async create(
    dto: CreateEventDto,
    actor: User,
    now: Date = new Date(),
  ): Promise<EventWithRelations> {
    this.assertDates(dto.startsAt, dto.endsAt);
    if (dto.startsAt.getTime() <= now.getTime()) {
      throw fieldError('startsAt', 'The event must start in the future');
    }
    const organizerId = await this.resolveOrganizer(dto.organizerId, actor);
    const tagIds = await this.assertTagsExist(this.prisma, dto.tagIds ?? []);
    return this.prisma.event.create({
      data: {
        title: dto.title,
        slug: makeSlug(dto.title),
        description: dto.description,
        venue: dto.venue,
        city: dto.city,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        status: EventStatus.DRAFT,
        organizerId,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: EVENT_INCLUDE,
    });
  }

  /**
   * Edits details of a draft or published event. Runs under a lock on the event row, so a
   * concurrent cancel or session change cannot slip in between the checks and the write.
   */
  async update(
    id: string,
    dto: UpdateEventDto,
    actor: User,
    now: Date = new Date(),
  ): Promise<EventWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, id, actor);
      assertEventEditable(event);
      const startsAt = dto.startsAt ?? event.startsAt;
      const endsAt = dto.endsAt ?? event.endsAt;
      this.assertDates(startsAt, endsAt);
      if (
        dto.startsAt !== undefined &&
        dto.startsAt.getTime() !== event.startsAt.getTime() &&
        dto.startsAt <= now
      ) {
        throw fieldError('startsAt', 'The event cannot be moved into the past');
      }
      await this.assertSessionsFit(tx, id, startsAt, endsAt);
      if (dto.tagIds !== undefined) {
        const tagIds = await this.assertTagsExist(tx, dto.tagIds);
        await tx.eventTag.deleteMany({ where: { eventId: id } });
        await tx.eventTag.createMany({ data: tagIds.map((tagId) => ({ eventId: id, tagId })) });
      }
      return tx.event.update({
        where: { id },
        data: omitUndefined({
          title: dto.title,
          description: dto.description,
          venue: dto.venue,
          city: dto.city,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
        }),
        include: EVENT_INCLUDE,
      });
    });
  }

  private assertDates(startsAt: Date, endsAt: Date): void {
    if (!isValidRange({ startsAt, endsAt })) {
      throw fieldError('endsAt', 'The end must be after the start');
    }
  }

  private async assertSessionsFit(
    tx: Prisma.TransactionClient,
    eventId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const outside = await tx.session.count({
      where: { eventId, OR: [{ startsAt: { lt: startsAt } }, { endsAt: { gt: endsAt } }] },
    });
    if (outside > 0) {
      throw fieldError('startsAt', 'Some sessions would fall outside the new event dates');
    }
  }

  private async resolveOrganizer(requested: string | undefined, actor: User): Promise<string> {
    if (requested === undefined || requested === actor.id) {
      return actor.id;
    }
    if (!hasAdminPowers(actor.role)) {
      throw fieldError('organizerId', 'Only admins can create events for another organizer');
    }
    const organizer = await this.prisma.user.findUnique({
      where: { id: requested },
      select: { role: true },
    });
    if (organizer === null || organizer.role === Role.CUSTOMER) {
      throw fieldError('organizerId', 'The organizer must be an existing organizer or admin');
    }
    return requested;
  }

  /** Returns the de-duplicated tag ids, or fails if any of them does not exist. */
  private async assertTagsExist(
    client: Prisma.TransactionClient,
    tagIds: readonly string[],
  ): Promise<string[]> {
    const unique = [...new Set(tagIds)];
    if (unique.length === 0) {
      return unique;
    }
    const found = await client.tag.count({ where: { id: { in: unique } } });
    if (found !== unique.length) {
      throw fieldError('tagIds', 'Some tags do not exist');
    }
    return unique;
  }
}
