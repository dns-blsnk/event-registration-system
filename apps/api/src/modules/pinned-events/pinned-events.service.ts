import { ErrorCode, MAX_PINNED_EVENTS } from '@ers/shared';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { eventScope } from '../events/event-scope.js';
import { EVENT_INCLUDE, type EventWithRelations } from '../events/event-view.js';

import type { User } from '../../generated/prisma/client.js';

/**
 * Events a staff member keeps on their dashboard. Only events they may see can be pinned, and
 * the list is filtered by the same scope, so an organizer never gets another organizer's event
 * back (for example after the event changed hands).
 */
@Injectable()
export class PinnedEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The actor's pinned events, soonest first. */
  async list(actor: User): Promise<EventWithRelations[]> {
    return this.prisma.event.findMany({
      where: { AND: [eventScope(actor), { pinnedBy: { some: { userId: actor.id } } }] },
      include: EVENT_INCLUDE,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
  }

  /** Pins an event the actor may see; pinning it again changes nothing. */
  async pin(actor: User, eventId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { AND: [eventScope(actor), { id: eventId }] },
        select: { id: true },
      });
      if (event === null) throw new DomainError(ErrorCode.NOT_FOUND, 'Event not found');
      // Only pins the actor can still see count: one that fell out of scope (a role change) can
      // neither be seen nor removed in the admin, so it must not block new pins.
      const visiblePins = await tx.pinnedEvent.count({
        where: { userId: actor.id, eventId: { not: eventId }, event: eventScope(actor) },
      });
      if (visiblePins >= MAX_PINNED_EVENTS) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          `You can pin up to ${String(MAX_PINNED_EVENTS)} events. Unpin one first.`,
        );
      }
      // Skips an existing pin instead of failing, so two tabs pinning at once both succeed.
      await tx.pinnedEvent.createMany({
        data: [{ userId: actor.id, eventId }],
        skipDuplicates: true,
      });
    });
  }

  /** Unpins an event; unpinning one that is not pinned changes nothing. */
  async unpin(actor: User, eventId: string): Promise<void> {
    await this.prisma.pinnedEvent.deleteMany({ where: { userId: actor.id, eventId } });
  }
}
