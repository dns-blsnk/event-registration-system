import { PASSWORD_MIN_LENGTH } from './auth.js';
import { ALMOST_FULL_RATIO, type EventStatus, type RegistrationStatus } from './domain.js';
import { formatPercent } from './format.js';

import type { Role } from './roles.js';

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

export const REGISTRATION_FIELDS = {
  customer: { label: 'Customer', help: 'Who booked the seat.' },
  session: { label: 'Session', help: 'The session the seat is in.' },
  event: { label: 'Event', help: 'The event the session belongs to.' },
  status: {
    label: 'Status',
    help: 'Confirmed holds a seat; waitlisted waits for one; attended and cancelled are final.',
  },
  createdAt: { label: 'Booked', help: 'When the customer made the booking.' },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the registrations list that are not fields of a registration. */
export const REGISTRATION_LIST_CONTROLS = {
  search: { label: 'Search', help: "Matches the customer's name or email." },
} as const satisfies Record<string, FieldDescription>;

export const REGISTRATION_STATUS_LABELS: Readonly<Record<RegistrationStatus, string>> = {
  CONFIRMED: 'Confirmed',
  WAITLISTED: 'Waitlisted',
  CANCELLED: 'Cancelled',
  ATTENDED: 'Attended',
};

export const USER_FIELDS = {
  name: { label: 'Name', help: 'Shown in the admin and on bookings.' },
  email: { label: 'Email', help: 'Used to sign in; unique, stored in lower case.' },
  role: {
    label: 'Role',
    help: 'Admin manages everything; organizer manages own events; customer books seats.',
  },
  password: {
    label: 'Password',
    help: `At least ${String(PASSWORD_MIN_LENGTH)} characters; the user can change it later.`,
  },
  createdAt: { label: 'Created', help: 'When the account was created.' },
} as const satisfies Record<string, FieldDescription>;

/** Shown instead of the role help on one's own account: the API refuses changing one's own role. */
export const OWN_ROLE_LOCKED_HELP = 'You cannot change your own role.';

/** Controls of the users list that are not fields of a user. */
export const USER_LIST_CONTROLS = {
  search: { label: 'Search', help: 'Matches the name or email.' },
} as const satisfies Record<string, FieldDescription>;

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Admin',
  ORGANIZER: 'Organizer',
  CUSTOMER: 'Customer',
};
