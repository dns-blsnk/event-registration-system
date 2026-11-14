import { ErrorCode, EventStatus, RegistrationStatus } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { assertEventTransition } from '../../domain/status-transitions.js';
import { PrismaService } from '../../prisma/prisma.service.js';

import { EventBannerService } from './event-banner.service.js';
import { lockEventSessions, lockScopedEvent } from './event-lock.js';
import { EVENT_INCLUDE, type EventWithRelations } from './event-view.js';

import type { User } from '../../generated/prisma/client.js';

/** Status changes of an event: publish, complete, cancel, and admin deletion. */
@Injectable()
export class EventLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly banners: EventBannerService,
  ) {}

  /** DRAFT -> PUBLISHED: must not have started and needs at least one session. */
  async publish(id: string, actor: User, now: Date = new Date()): Promise<EventWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, id, actor);
      assertEventTransition(event.status, EventStatus.PUBLISHED, { startsAt: event.startsAt, now });
      if ((await tx.session.count({ where: { eventId: id } })) === 0) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Add at least one session before publishing the event',
        );
      }
      return tx.event.update({
        where: { id },
        data: { status: EventStatus.PUBLISHED },
        include: EVENT_INCLUDE,
      });
    });
  }

  /** PUBLISHED -> COMPLETED, once the event has started. */
  async complete(id: string, actor: User, now: Date = new Date()): Promise<EventWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, id, actor);
      assertEventTransition(event.status, EventStatus.COMPLETED, { startsAt: event.startsAt, now });
      return tx.event.update({
        where: { id },
        data: { status: EventStatus.COMPLETED },
        include: EVENT_INCLUDE,
      });
    });
  }

  /**
   * Cancels the event before it ends, together with every active registration. Seats held by
   * attendees already marked ATTENDED stay counted; everything else is freed. Session rows are locked
   * so a booking running at the same moment waits and then sees the cancelled event.
   */
  async cancel(id: string, actor: User, now: Date = new Date()): Promise<EventWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, id, actor);
      assertEventTransition(event.status, EventStatus.CANCELLED, {
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        now,
      });
      await lockEventSessions(tx, id);
      await tx.registration.updateMany({
        where: {
          session: { eventId: id },
          status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.WAITLISTED] },
        },
        data: { status: RegistrationStatus.CANCELLED, cancelledAt: now },
      });
      await tx.$executeRaw`
        UPDATE sessions s
        SET confirmed_count = (
          SELECT count(*) FROM registrations r
          WHERE r.session_id = s.id AND r.status = ${RegistrationStatus.ATTENDED}::"RegistrationStatus"
        )
        WHERE s.event_id = ${id}::uuid`;
      return tx.event.update({
        where: { id },
        data: { status: EventStatus.CANCELLED },
        include: EVENT_INCLUDE,
      });
    });
  }

  /** Admin only. Bookings are history, so an event anyone registered for is cancelled, never deleted. */
  async remove(id: string, actor: User): Promise<void> {
    const bannerKey = await this.prisma.$transaction(async (tx) => {
      const event = await lockScopedEvent(tx, id, actor);
      await lockEventSessions(tx, id);
      const registrations = await tx.registration.count({ where: { session: { eventId: id } } });
      if (registrations > 0) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          'Events with registrations cannot be deleted. Cancel the event instead.',
        );
      }
      await tx.event.delete({ where: { id } });
      return event.bannerKey;
    });
    await this.banners.deleteQuietly(bannerKey);
  }
}
