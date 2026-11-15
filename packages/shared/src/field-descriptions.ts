import { APP_LOG_RETENTION_DAYS, type AppLogCategory, type AppLogLevel } from './app-logs.js';
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
  search: { label: 'Search', help: 'Matches the title or venue.' },
  city: { label: 'City', help: 'Matches part of the city name.' },
  tag: { label: 'Tag', help: 'Only events with this tag.' },
  startsFrom: { label: 'Starts from', help: 'Events starting on or after this day.' },
  startsTo: { label: 'Starts until', help: 'Events starting on or before this day (whole day).' },
  organizer: { label: 'Organizer', help: 'Only this organizer’s events.' },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the sessions list that are not fields of a session. */
export const SESSION_LIST_CONTROLS = {
  search: { label: 'Search', help: 'Matches the title, speaker or room.' },
  almostFull: {
    label: 'Almost full',
    help: `Only sessions with at least ${formatPercent(ALMOST_FULL_RATIO)} of seats taken; their seats bar is red.`,
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
  customerEmail: { label: 'Email', help: 'The email of the customer who booked.' },
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
    help: 'Admin manages everything; only a super admin grants or takes away admin roles. Organizer manages own events; customer books seats.',
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
  SUPER_ADMIN: 'Super admin',
  ADMIN: 'Admin',
  ORGANIZER: 'Organizer',
  CUSTOMER: 'Customer',
};

export const APP_LOG_FIELDS = {
  createdAt: {
    label: 'Time',
    help: `When it happened; entries are kept ${String(APP_LOG_RETENTION_DAYS)} days.`,
  },
  level: {
    label: 'Level',
    help: 'Error: something broke on the server. Warn: refused on purpose.',
  },
  category: {
    label: 'Category',
    help: 'Error: server failures. Security: failed sign-ins, refused access, rejected uploads.',
  },
  requestId: {
    label: 'Request id',
    help: 'Shown to the user with every error; paste it here to find the entry.',
  },
  method: { label: 'Method', help: 'HTTP method of the request.' },
  route: { label: 'Route', help: 'The route pattern that was called, without the query string.' },
  statusCode: { label: 'Status', help: 'HTTP status code of the response.' },
  errorCode: { label: 'Error code', help: 'The API error code the client received.' },
  message: { label: 'Message', help: 'What went wrong, without secrets or request bodies.' },
  user: { label: 'User', help: 'Who made the request, if signed in.' },
  durationMs: { label: 'Duration', help: 'How long the request took, in milliseconds.' },
  stack: { label: 'Stack', help: 'Where in the code the error was thrown (server errors only).' },
  ip: { label: 'IP', help: 'Client address as seen through the trusted proxies.' },
  userAgent: { label: 'User agent', help: 'Browser or client that made the request.' },
  context: { label: 'Context', help: 'Extra structured details recorded with the entry.' },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the logs list that are not fields of an entry. */
export const APP_LOG_LIST_CONTROLS = {
  search: { label: 'Search', help: 'Matches the message or the route.' },
} as const satisfies Record<string, FieldDescription>;

export const APP_LOG_LEVEL_LABELS: Readonly<Record<AppLogLevel, string>> = {
  WARN: 'Warn',
  ERROR: 'Error',
};

export const APP_LOG_CATEGORY_LABELS: Readonly<Record<AppLogCategory, string>> = {
  ERROR: 'Error',
  SECURITY: 'Security',
};

export const TAG_FIELDS = {
  name: { label: 'Name', help: 'Short topic label; unique regardless of letter case.' },
  eventCount: { label: 'Events', help: 'How many events use the tag.' },
} as const satisfies Record<string, FieldDescription>;

export const CUSTOMER_FIELDS = {
  name: { label: 'Name', help: 'The customer’s name.' },
  email: { label: 'Email', help: 'Sign-in email of the customer.' },
  createdAt: { label: 'Joined', help: 'When the customer created the account.' },
  registrationCount: {
    label: 'Registrations',
    help: 'Bookings you can see: all of them for admins, those for your events for organizers.',
  },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the tags list that are not fields of a tag. */
export const TAG_LIST_CONTROLS = {
  search: { label: 'Search', help: 'Matches the name.' },
} as const satisfies Record<string, FieldDescription>;

/** Controls of the customers list; people are searched the same way as on the users list. */
export const CUSTOMER_LIST_CONTROLS = {
  search: USER_LIST_CONTROLS.search,
} as const satisfies Record<string, FieldDescription>;

/** The self sign-up form: new accounts are always customers. */
export const SIGNUP_FIELDS = {
  name: { label: 'Name', help: 'How organizers will see you on your bookings.' },
  email: { label: 'Email', help: 'You will sign in with it.' },
  password: {
    label: 'Password',
    help: `At least ${String(PASSWORD_MIN_LENGTH)} characters.`,
  },
} as const satisfies Record<string, FieldDescription>;

/** The error a new password below the minimum gets, distinct from the help text it replaces. */
export const PASSWORD_TOO_SHORT_MESSAGE = `Too short: use at least ${String(PASSWORD_MIN_LENGTH)} characters`;

/** The catalog as customers see it: only what they can read and act on. */
export const CATALOG_FIELDS = {
  title: { label: 'Title', help: 'Name of the event.' },
  description: { label: 'Description', help: 'What the event is about.' },
  city: { label: 'City', help: 'Where the event takes place; the list can be filtered by it.' },
  venue: { label: 'Venue', help: 'The place inside the city.' },
  startsAt: { label: 'Starts', help: 'When the event begins, in your time zone.' },
  seatsLeft: {
    label: 'Seats left',
    help: 'Free seats in sessions that have not started; at zero you can still join the waitlist.',
  },
} as const satisfies Record<string, FieldDescription>;

/** Headings of the fact cards at the top of an event page (staff and customer alike). */
export const EVENT_PAGE_LABELS = {
  when: 'When',
  where: 'Where',
  /** Before the end time, under the start time. */
  until: 'until',
  organizer: 'Organizer',
} as const;

/** A customer's own bookings. */
export const MY_REGISTRATION_FIELDS = {
  event: { label: 'Event', help: 'The event you booked.' },
  session: { label: 'Session', help: 'The talk or workshop your seat is in.' },
  status: {
    label: 'Status',
    help: 'Confirmed holds a seat; waitlisted waits for one (your place is shown); cancelled can be booked again.',
  },
  createdAt: { label: 'Booked', help: 'When you made the booking.' },
} as const satisfies Record<string, FieldDescription>;
