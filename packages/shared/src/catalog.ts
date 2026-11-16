import { EventStatus, type RegistrationStatus } from './domain.js';

import type { TagRef } from './events.js';

/** A published event as customers browse it. */
/** The only event status customers ever see in the catalog. */
export const CATALOG_EVENT_STATUS = EventStatus.PUBLISHED;

/**
 * Whether customers can open the event in the catalog: published and not ended yet. The API's
 * catalog query applies the same rule, so a link built from this never leads to "not found".
 */
export function isInCatalog(event: { status: EventStatus; endsAt: string }, now: Date): boolean {
  return event.status === CATALOG_EVENT_STATUS && new Date(event.endsAt).getTime() > now.getTime();
}

export interface CatalogEventListItem {
  id: string;
  title: string;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  tags: TagRef[];
  /** Sessions that have not started yet, the only ones that can be booked. */
  upcomingSessionsCount: number;
  /**
   * Free seats in upcoming sessions. Zero with upcoming sessions means bookings join waitlists;
   * zero without any means there is nothing left to book.
   */
  seatsLeft: number;
}

/** A session on the catalog page, with the viewer's own booking if there is one. */
export interface CatalogSession {
  id: string;
  title: string;
  speaker: string | null;
  room: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  seatsLeft: number;
  /** Share of seats taken, 0..1, computed by the API like the staff lists' fill rate. */
  fillRate: number;
  /** False once the session has started: it can no longer be booked. */
  isUpcoming: boolean;
  /** The viewer's registration for this session (one per customer and session), or null. */
  myRegistration: { id: string; status: RegistrationStatus } | null;
}

export interface CatalogEventDetail extends CatalogEventListItem {
  description: string;
  bannerUrl: string | null;
  organizerName: string;
  sessions: CatalogSession[];
}
