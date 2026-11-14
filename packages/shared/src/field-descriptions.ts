import { ALMOST_FULL_RATIO, type EventStatus } from './domain.js';
import { formatPercent } from './format.js';

/**
 * Label and help text of a field. The admin shows them in forms and tables, and the AI help chat
 * reads the same text, so what a field means is written down exactly once.
 */
export interface FieldDescription {
  label: string;
  help: string;
}

export const EVENT_FIELDS = {
  title: { label: 'Title', help: 'Public name of the event, shown in the catalog and on tickets.' },
  description: {
    label: 'Description',
    help: 'What the event is about; plain text, shown on the event page.',
  },
  city: { label: 'City', help: 'City where the event takes place; used by the city filter.' },
  venue: { label: 'Venue', help: 'Address or name of the place inside the city.' },
  startsAt: {
    label: 'Starts',
    help: 'When the event begins. A published event cannot move into the past.',
  },
  endsAt: {
    label: 'Ends',
    help: 'When the event ends; must be after the start. Every session fits inside these dates.',
  },
  status: {
    label: 'Status',
    help: 'Draft is hidden from customers; Published takes bookings; Completed and Cancelled are final.',
  },
  organizer: {
    label: 'Organizer',
    help: 'The organizer who owns the event and sees its bookings.',
  },
  tags: { label: 'Tags', help: 'Topics used to group and filter events; up to 10.' },
  sessionsCount: { label: 'Sessions', help: 'Number of sessions (talks, workshops) in the event.' },
  fillRate: {
    label: 'Filled',
    help: 'Share of seats taken across all sessions, confirmed and attended bookings.',
  },
} as const satisfies Record<string, FieldDescription>;

export const SESSION_FIELDS = {
  event: { label: 'Event', help: 'The event this session belongs to.' },
  title: { label: 'Title', help: 'Name of the talk or workshop.' },
  speaker: { label: 'Speaker', help: 'Who leads the session; optional.' },
  room: { label: 'Room', help: 'Where in the venue it happens; optional.' },
  startsAt: {
    label: 'Starts',
    help: 'Must be inside the event dates and in the future when created.',
  },
  endsAt: { label: 'Ends', help: 'Must be after the start and inside the event dates.' },
  capacity: {
    label: 'Capacity',
    help: 'Seats available; never lower than the seats already confirmed.',
  },
  confirmedCount: { label: 'Confirmed', help: 'Seats taken by confirmed and attended bookings.' },
  seatsLeft: {
    label: 'Seats left',
    help: 'Capacity minus confirmed seats; at zero new bookings join the waitlist.',
  },
  waitlistCount: {
    label: 'Waitlist',
    help: 'People waiting; the oldest is promoted when a seat frees up.',
  },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the events list that are not fields of an event. */
export const EVENT_LIST_CONTROLS = {
  search: { label: 'Search', help: 'Matches the title, city or venue.' },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the sessions list that are not fields of a session. */
export const SESSION_LIST_CONTROLS = {
  search: { label: 'Search', help: 'Matches the title, speaker or room.' },
  almostFull: {
    label: 'Almost full',
    help: `Only sessions with at least ${formatPercent(ALMOST_FULL_RATIO)} of seats taken.`,
  },
} as const satisfies Record<string, FieldDescription>;

export const EVENT_STATUS_LABELS: Readonly<Record<EventStatus, string>> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
