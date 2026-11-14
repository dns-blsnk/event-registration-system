import type { EventStatus } from './domain.js';

export const EVENT_TITLE_MAX_LENGTH = 200;
export const EVENT_DESCRIPTION_MAX_LENGTH = 5000;
export const EVENT_VENUE_MAX_LENGTH = 200;
export const EVENT_CITY_MAX_LENGTH = 100;
export const EVENT_MAX_TAGS = 10;

export interface TagRef {
  id: string;
  name: string;
}

/** An event row in admin lists, with seat statistics across its sessions. */
export interface EventListItem {
  id: string;
  title: string;
  slug: string;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  organizer: { id: string; name: string };
  tags: TagRef[];
  sessionsCount: number;
  capacity: number;
  confirmedCount: number;
  /** Share of seats taken across all sessions, 0..1. */
  fillRate: number;
}

export interface EventDetail extends EventListItem {
  description: string;
  createdAt: string;
  updatedAt: string;
}
