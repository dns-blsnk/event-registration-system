import { RegistrationStatus, type SessionListItem } from '@ers/shared';

import { fillRate, seatsLeft } from '../../domain/capacity.js';

import type { Prisma } from '../../generated/prisma/client.js';

/** What every session query loads: its event title and the waitlist size. */
export const SESSION_INCLUDE = {
  event: { select: { title: true } },
  _count: { select: { registrations: { where: { status: RegistrationStatus.WAITLISTED } } } },
} satisfies Prisma.SessionInclude;

export type SessionWithRelations = Prisma.SessionGetPayload<{ include: typeof SESSION_INCLUDE }>;

export function toSessionListItem(session: SessionWithRelations): SessionListItem {
  return {
    id: session.id,
    eventId: session.eventId,
    eventTitle: session.event.title,
    title: session.title,
    speaker: session.speaker,
    room: session.room,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    capacity: session.capacity,
    confirmedCount: session.confirmedCount,
    seatsLeft: seatsLeft(session),
    fillRate: fillRate(session),
    waitlistCount: session._count.registrations,
  };
}
