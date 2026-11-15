import { SessionPhase, sessionPhase } from '@ers/shared';

import { fillRate, seatsLeft } from '../../domain/capacity.js';
import { EVENT_TAGS_INCLUDE } from '../events/event-view.js';

import type { Prisma } from '../../generated/prisma/client.js';
import type { CatalogEventDetail, CatalogEventListItem } from '@ers/shared';

/** What a catalog row needs: tags, and per session its times and seat numbers. */
export const CATALOG_LIST_INCLUDE = {
  tags: EVENT_TAGS_INCLUDE,
  sessions: { select: { startsAt: true, endsAt: true, capacity: true, confirmedCount: true } },
} satisfies Prisma.EventInclude;

export type CatalogListEvent = Prisma.EventGetPayload<{ include: typeof CATALOG_LIST_INCLUDE }>;

/** The detail page adds the organizer's name and each session with the viewer's own booking. */
export function catalogDetailInclude(customerId: string) {
  return {
    tags: EVENT_TAGS_INCLUDE,
    organizer: { select: { name: true } },
    sessions: {
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      include: {
        registrations: { where: { customerId }, select: { id: true, status: true } },
      },
    },
  } satisfies Prisma.EventInclude;
}

export type CatalogDetailEvent = Prisma.EventGetPayload<{
  include: ReturnType<typeof catalogDetailInclude>;
}>;

function isUpcoming(session: { startsAt: Date; endsAt: Date }, now: Date): boolean {
  return sessionPhase(session, now) === SessionPhase.UPCOMING;
}

export function toCatalogEventListItem(
  event: CatalogListEvent | CatalogDetailEvent,
  now: Date,
): CatalogEventListItem {
  // Seats in sessions that already started cannot be booked, so they are not "left".
  const upcoming = event.sessions.filter((session) => isUpcoming(session, now));
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    tags: event.tags.map(({ tag }) => tag),
    upcomingSessionsCount: upcoming.length,
    seatsLeft: upcoming.reduce((sum, session) => sum + seatsLeft(session), 0),
  };
}

export function toCatalogEventDetail(
  event: CatalogDetailEvent,
  bannerUrl: string | null,
  now: Date,
): CatalogEventDetail {
  return {
    ...toCatalogEventListItem(event, now),
    description: event.description,
    bannerUrl,
    organizerName: event.organizer.name,
    sessions: event.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      speaker: session.speaker,
      room: session.room,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
      capacity: session.capacity,
      seatsLeft: seatsLeft(session),
      fillRate: fillRate(session),
      isUpcoming: isUpcoming(session, now),
      myRegistration: session.registrations[0] ?? null,
    })),
  };
}
