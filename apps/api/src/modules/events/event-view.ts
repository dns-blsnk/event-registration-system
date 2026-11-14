import { fillRate } from '../../domain/capacity.js';

import type { Prisma } from '../../generated/prisma/client.js';
import type { EventDetail, EventListItem } from '@ers/shared';

/** What every event query loads: organizer, tags and per-session seat numbers. */
export const EVENT_INCLUDE = {
  organizer: { select: { id: true, name: true } },
  tags: {
    select: { tag: { select: { id: true, name: true } } },
    orderBy: { tag: { name: 'asc' } },
  },
  sessions: { select: { capacity: true, confirmedCount: true } },
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

export function toEventListItem(event: EventWithRelations): EventListItem {
  const capacity = event.sessions.reduce((sum, session) => sum + session.capacity, 0);
  const confirmedCount = event.sessions.reduce((sum, session) => sum + session.confirmedCount, 0);
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: event.status,
    organizer: event.organizer,
    tags: event.tags.map(({ tag }) => tag),
    sessionsCount: event.sessions.length,
    capacity,
    confirmedCount,
    fillRate: fillRate({ capacity, confirmedCount }),
  };
}

export function toEventDetail(event: EventWithRelations, bannerUrl: string | null): EventDetail {
  return {
    ...toEventListItem(event),
    description: event.description,
    bannerUrl,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
