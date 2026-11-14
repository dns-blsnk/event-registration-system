import { ALMOST_FULL_RATIO, ErrorCode, EventStatus, RegistrationStatus, Role } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { fieldError } from '../../common/errors/field-error.js';
import { omitUndefined } from '../../common/objects.js';
import { containsInsensitive } from '../../common/pagination/search.js';
import { isValidRange, isWithin, type TimeRange } from '../../domain/schedule.js';
import { Prisma, type Event, type Session, type User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { lockScopedEvent } from '../events/event-lock.js';
import { promoteFromWaitlist } from '../registrations/waitlist.js';

import { sessionScope } from './session-scope.js';
import { SESSION_INCLUDE, type SessionWithRelations } from './session-view.js';

import type { ListQuery } from '../../common/pagination/list-query.js';
import type { ListResult } from '../../common/pagination/list-result.js';
import type { CreateSessionDto } from './dto/create-session.dto.js';
import type { UpdateSessionDto } from './dto/update-session.dto.js';

export type SessionSortField = 'startsAt' | 'title' | 'capacity' | 'confirmedCount';

export interface SessionFilters {
  eventId?: string | undefined;
  almostFull?: boolean | undefined;
  startsFrom?: Date | undefined;
  startsTo?: Date | undefined;
}

const NOT_FOUND_MESSAGE = 'Session not found';
const LOCKED_EVENT_STATUSES: readonly EventStatus[] = [
  EventStatus.COMPLETED,
  EventStatus.CANCELLED,
];

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListQuery<SessionSortField>,
    filters: SessionFilters,
    actor: User,
  ): Promise<ListResult<SessionWithRelations>> {
    const almostFullIds = filters.almostFull === true ? await this.almostFullIds(actor) : undefined;
    const startsAt: Prisma.DateTimeFilter = omitUndefined({
      gte: filters.startsFrom,
      lte: filters.startsTo,
    });
    const where: Prisma.SessionWhereInput = {
      AND: [
        sessionScope(actor),
        filters.eventId === undefined ? {} : { eventId: filters.eventId },
        almostFullIds === undefined ? {} : { id: { in: almostFullIds } },
        Object.keys(startsAt).length === 0 ? {} : { startsAt },
        query.search === undefined
          ? {}
          : {
              OR: [
                { title: containsInsensitive(query.search) },
                { speaker: containsInsensitive(query.search) },
                { room: containsInsensitive(query.search) },
              ],
            },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.session.findMany({
        where,
        include: SESSION_INCLUDE,
        orderBy: [
          ...query.sort.map(({ field, direction }) => ({ [field]: direction })),
          { id: 'asc' },
        ],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.session.count({ where }),
    ]);
    return { items, total };
  }

  async get(id: string, actor: User): Promise<SessionWithRelations> {
    const session = await this.prisma.session.findFirst({
      where: { id, ...sessionScope(actor) },
      include: SESSION_INCLUDE,
    });
    if (session === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    return session;
  }

  /** Adds a session to an editable event; it must fit inside the event and start in the future. */
  async create(
    dto: CreateSessionDto,
    actor: User,
    now: Date = new Date(),
  ): Promise<SessionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, dto.eventId, actor);
      this.assertEventEditable(event);
      this.assertFits({ startsAt: dto.startsAt, endsAt: dto.endsAt }, event);
      if (dto.startsAt.getTime() <= now.getTime()) {
        throw fieldError('startsAt', 'The session must start in the future');
      }
      return tx.session.create({
        data: {
          eventId: dto.eventId,
          title: dto.title,
          speaker: dto.speaker ?? null,
          room: dto.room ?? null,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          capacity: dto.capacity,
        },
        include: SESSION_INCLUDE,
      });
    });
  }

  /**
   * Edits a session under locks on its event and its own row, so bookings and event changes cannot
   * interleave. Capacity can never drop below the seats already confirmed (the row lock makes this
   * check safe; the database CHECK backs it up). Once a session has started its schedule and
   * capacity are history; once it has ended it cannot change at all.
   */
  async update(
    id: string,
    dto: UpdateSessionDto,
    actor: User,
    now: Date = new Date(),
  ): Promise<SessionWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const { session, event } = await this.lockScopedSession(tx, id, actor);
      this.assertEditableNow(session, dto, now);
      const range = {
        startsAt: dto.startsAt ?? session.startsAt,
        endsAt: dto.endsAt ?? session.endsAt,
      };
      this.assertFits(range, event);
      if (
        dto.startsAt !== undefined &&
        dto.startsAt.getTime() !== session.startsAt.getTime() &&
        dto.startsAt <= now
      ) {
        throw fieldError('startsAt', 'The session cannot be moved into the past');
      }
      await this.assertMovable(tx, session, dto);
      if (dto.capacity !== undefined && dto.capacity < session.confirmedCount) {
        throw fieldError(
          'capacity',
          `Capacity cannot be lower than the ${String(session.confirmedCount)} seats already confirmed`,
        );
      }
      await tx.session.update({
        where: { id },
        data: omitUndefined({
          title: dto.title,
          speaker: dto.speaker,
          room: dto.room,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          capacity: dto.capacity,
        }),
      });
      if (dto.capacity !== undefined && dto.capacity > session.capacity) {
        // New seats go to the waitlist first, oldest booking first.
        await promoteFromWaitlist(tx, id, now);
      }
      return tx.session.findUniqueOrThrow({ where: { id }, include: SESSION_INCLUDE });
    });
  }

  /** Bookings are history: a session anyone registered for cannot be deleted. */
  async remove(id: string, actor: User): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockScopedSession(tx, id, actor);
      if ((await tx.registration.count({ where: { sessionId: id } })) > 0) {
        throw new DomainError(ErrorCode.CONFLICT, 'Sessions with registrations cannot be deleted');
      }
      await tx.session.delete({ where: { id } });
    });
  }

  /** Scope check, then locks the event row and the session row (in that order) and reads both. */
  private async lockScopedSession(
    tx: Prisma.TransactionClient,
    id: string,
    actor: User,
  ): Promise<{ session: Session; event: Event }> {
    const visible = await tx.session.findFirst({
      where: { id, ...sessionScope(actor) },
      select: { eventId: true },
    });
    if (visible === null) {
      throw new DomainError(ErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    const event = await lockScopedEvent(tx, visible.eventId, actor);
    this.assertEventEditable(event);
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${id}::uuid FOR UPDATE`;
    return { session: await tx.session.findUniqueOrThrow({ where: { id } }), event };
  }

  /**
   * Moving a booked session could silently give its attendees overlapping seats, so the time of a
   * session with active registrations is fixed; cancel it and create a new one instead.
   */
  private async assertMovable(
    tx: Prisma.TransactionClient,
    session: Session,
    dto: UpdateSessionDto,
  ): Promise<void> {
    const moves =
      (dto.startsAt !== undefined && dto.startsAt.getTime() !== session.startsAt.getTime()) ||
      (dto.endsAt !== undefined && dto.endsAt.getTime() !== session.endsAt.getTime());
    if (!moves) {
      return;
    }
    const active = await tx.registration.count({
      where: {
        sessionId: session.id,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] },
      },
    });
    if (active > 0) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Sessions with active registrations cannot be moved',
      );
    }
  }

  private assertEditableNow(session: Session, dto: UpdateSessionDto, now: Date): void {
    if (now.getTime() >= session.endsAt.getTime()) {
      throw new DomainError(ErrorCode.CONFLICT, 'Sessions that have ended cannot be changed');
    }
    const changesSchedule =
      dto.startsAt !== undefined || dto.endsAt !== undefined || dto.capacity !== undefined;
    if (now.getTime() >= session.startsAt.getTime() && changesSchedule) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'The time and capacity of a session cannot change once it has started',
      );
    }
  }

  private assertEventEditable(event: Event): void {
    if (LOCKED_EVENT_STATUSES.includes(event.status)) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'Sessions of completed or cancelled events cannot be changed',
      );
    }
  }

  private assertFits(range: TimeRange, event: Event): void {
    if (!isValidRange(range)) {
      throw fieldError('endsAt', 'The end must be after the start');
    }
    if (!isWithin(range, event)) {
      const field = range.startsAt.getTime() < event.startsAt.getTime() ? 'startsAt' : 'endsAt';
      throw fieldError(field, 'The session must take place within the event dates');
    }
  }

  /**
   * Ids of sessions at or above the almost-full ratio. The ratio needs a column-to-column comparison
   * Prisma cannot express, so this one predicate is raw SQL; the organizer clause only narrows the
   * result, the authoritative scope is still sessionScope in the Prisma query.
   */
  private async almostFullIds(actor: User): Promise<string[]> {
    const ownerFilter =
      actor.role === Role.ADMIN ? Prisma.empty : Prisma.sql`AND e.organizer_id = ${actor.id}::uuid`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id::text AS id FROM sessions s
      JOIN events e ON e.id = s.event_id
      WHERE s.confirmed_count >= s.capacity * ${ALMOST_FULL_RATIO}::float8 ${ownerFilter}`;
    return rows.map((row) => row.id);
  }
}
