import { Faker, en } from '@faker-js/faker';

import { overlaps } from '../../src/domain/schedule.js';

import type { EventStatus, RegistrationStatus, Role } from '@ers/shared';

/** How much demo data to generate. Defaults match the plan: a realistic, list-heavy admin. */
export interface SeedSizes {
  organizers: number;
  customers: number;
  events: number;
  sessionsPerEvent: number;
  registrations: number;
  tags: number;
}

export const DEFAULT_SIZES: SeedSizes = {
  organizers: 25,
  customers: 3000,
  events: 300,
  sessionsPerEvent: 5,
  registrations: 30_000,
  tags: 20,
};

export interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Demo accounts get a password; generated people cannot sign in. */
  isDemo: boolean;
  createdAt: Date;
}

export interface SeedEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  venue: string;
  city: string;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  organizerId: string;
  tagIds: string[];
  createdAt: Date;
}

export interface SeedSession {
  id: string;
  eventId: string;
  title: string;
  speaker: string | null;
  room: string | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  confirmedCount: number;
  createdAt: Date;
}

export interface SeedRegistration {
  id: string;
  sessionId: string;
  customerId: string;
  status: RegistrationStatus;
  createdAt: Date;
  cancelledAt: Date | null;
}

export interface SeedPlan {
  users: SeedUser[];
  tags: { id: string; name: string }[];
  events: SeedEvent[];
  sessions: SeedSession[];
  registrations: SeedRegistration[];
}

export const DEMO_EMAILS = {
  admin: 'admin@demo.test',
  organizer: 'organizer@demo.test',
  customer: 'customer@demo.test',
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const PAST_DAYS = 60;
const FUTURE_DAYS = 120;
const MAX_EVENT_DAYS = 3;
/** 07:00 UTC is 9:00 in Central Europe and 9:00-10:00 in Eastern Europe, where the demo cities are. */
const FIRST_SESSION_HOUR_UTC = 7;
const SESSION_SLOT_HOURS = 2;
const SLOTS_PER_DAY = 6;
/** Accounts exist well before the earliest possible booking (events start up to PAST_DAYS back). */
const ACCOUNT_AGE_DAYS = { min: 2 * PAST_DAYS + 1, max: 2 * PAST_DAYS + 365 } as const;
/** Events are created before bookings can start, which is up to PAST_DAYS before a session. */
const EVENT_LEAD_DAYS = { min: PAST_DAYS + 1, max: PAST_DAYS + 30 } as const;
/** A share of small rooms fills up, so full sessions, waitlists and "almost full" have data. */
const SMALL_ROOM = { min: 5, max: 15 } as const;
const LARGE_ROOM = { min: 20, max: 120 } as const;
const CITIES = ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro', 'Warsaw', 'Berlin', 'Tallinn'];
const ROOMS = ['Main Hall', 'Room A', 'Room B', 'Workshop 1', 'Workshop 2', null];
const EVENT_KINDS = ['Summit', 'Conference', 'Meetup', 'Festival', 'Forum'];
const TAG_WORDS = [
  'AI',
  'Cloud',
  'Design',
  'DevOps',
  'Frontend',
  'Backend',
  'Mobile',
  'Security',
  'Data',
  'Product',
  'Startups',
  'Career',
  'Music',
  'Art',
  'Health',
  'Finance',
  'Education',
  'Gaming',
  'Robotics',
  'Open Source',
  'Blockchain',
  'UX',
  'Testing',
  'Leadership',
];

/** Chance of each outcome, picked so every status shows up in lists and filters. */
const SHARE = {
  draftFuture: 0.1,
  cancelledEvent: 0.08,
  cancelledRegistration: 0.1,
  noShow: 0.15,
  speakerless: 0.2,
  smallRoom: 0.35,
} as const;

function startOfDay(date: Date): Date {
  return new Date(Math.floor(date.getTime() / DAY_MS) * DAY_MS);
}

function capitalize(text: string): string {
  return text.replace(/^./, (letter) => letter.toUpperCase());
}

function makeUsers(faker: Faker, sizes: SeedSizes, now: Date): SeedUser[] {
  const accountDate = (): Date =>
    new Date(now.getTime() - faker.number.int(ACCOUNT_AGE_DAYS) * DAY_MS);
  const demo = (email: string, name: string, role: Role): SeedUser => ({
    id: faker.string.uuid(),
    email,
    name,
    role,
    isDemo: true,
    createdAt: accountDate(),
  });
  const person = (role: Role, index: number): SeedUser => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      id: faker.string.uuid(),
      // The index keeps generated emails unique; example.com never delivers mail.
      email: `${firstName}.${lastName}.${String(index)}@example.com`
        .toLowerCase()
        .replace(/[^a-z0-9.@]/g, ''),
      name: `${firstName} ${lastName}`,
      role,
      isDemo: false,
      createdAt: accountDate(),
    };
  };
  return [
    demo(DEMO_EMAILS.admin, 'Demo Admin', 'ADMIN'),
    demo(DEMO_EMAILS.organizer, 'Demo Organizer', 'ORGANIZER'),
    demo(DEMO_EMAILS.customer, 'Demo Customer', 'CUSTOMER'),
    ...Array.from({ length: sizes.organizers }, (_, index) => person('ORGANIZER', index)),
    ...Array.from({ length: sizes.customers }, (_, index) =>
      person('CUSTOMER', sizes.organizers + index),
    ),
  ];
}

function eventStatus(faker: Faker, startsAt: Date, endsAt: Date, now: Date): EventStatus {
  if (faker.number.float() < SHARE.cancelledEvent) {
    return 'CANCELLED';
  }
  if (endsAt <= now) {
    return 'COMPLETED';
  }
  if (startsAt > now && faker.number.float() < SHARE.draftFuture) {
    return 'DRAFT';
  }
  return 'PUBLISHED';
}

function makeEvent(
  faker: Faker,
  {
    index,
    now,
    organizerIds,
    tagIds,
  }: { index: number; now: Date; organizerIds: string[]; tagIds: string[] },
): SeedEvent {
  const dayOffset = faker.number.int({ min: -PAST_DAYS, max: FUTURE_DAYS });
  const startsAt = new Date(startOfDay(now).getTime() + dayOffset * DAY_MS);
  const endsAt = new Date(
    startsAt.getTime() + faker.number.int({ min: 1, max: MAX_EVENT_DAYS }) * DAY_MS,
  );
  const title = capitalize(
    `${faker.company.catchPhraseAdjective()} ${faker.word.noun()} ${faker.helpers.arrayElement(EVENT_KINDS)}`,
  );
  return {
    id: faker.string.uuid(),
    title,
    slug: `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${String(index)}`,
    description: faker.lorem.paragraphs(2),
    venue: `${faker.location.street()} ${faker.location.buildingNumber()}`,
    city: faker.helpers.arrayElement(CITIES),
    startsAt,
    endsAt,
    status: eventStatus(faker, startsAt, endsAt, now),
    organizerId: faker.helpers.arrayElement(organizerIds),
    tagIds: faker.helpers.arrayElements(tagIds, { min: 0, max: 3 }),
    createdAt: new Date(
      Math.min(now.getTime(), startsAt.getTime()) - faker.number.int(EVENT_LEAD_DAYS) * DAY_MS,
    ),
  };
}

/** Sessions sit inside their event in two-hour slots, at most SLOTS_PER_DAY a day, so a day never overflows. */
function makeSessions(faker: Faker, event: SeedEvent, count: number): SeedSession[] {
  const days = Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / DAY_MS);
  return Array.from({ length: Math.min(count, days * SLOTS_PER_DAY) }, (_, index) => {
    const day = index % days;
    const slot = Math.floor(index / days);
    const startsAt = new Date(
      event.startsAt.getTime() +
        day * DAY_MS +
        (FIRST_SESSION_HOUR_UTC + slot * SESSION_SLOT_HOURS) * HOUR_MS,
    );
    const lengthHours = faker.helpers.arrayElement([1, SESSION_SLOT_HOURS]);
    return {
      id: faker.string.uuid(),
      eventId: event.id,
      title: capitalize(faker.company.buzzPhrase()),
      speaker: faker.number.float() < SHARE.speakerless ? null : faker.person.fullName(),
      room: faker.helpers.arrayElement(ROOMS),
      startsAt,
      endsAt: new Date(startsAt.getTime() + lengthHours * HOUR_MS),
      capacity: faker.number.int(faker.number.float() < SHARE.smallRoom ? SMALL_ROOM : LARGE_ROOM),
      confirmedCount: 0,
      createdAt: event.createdAt,
    };
  });
}

interface BookingState {
  now: Date;
  pairs: Set<string>;
  confirmedByCustomer: Map<string, SeedSession[]>;
}

/**
 * Decides one booking the way the API would: a seat while seats are free and the customer has no
 * overlapping confirmed session, the waitlist when full (future sessions only), and history
 * statuses for events that are over or cancelled. Returns undefined when the API would refuse.
 */
function decideStatus(
  faker: Faker,
  { session, event, customerId }: { session: SeedSession; event: SeedEvent; customerId: string },
  state: BookingState,
): RegistrationStatus | undefined {
  if (event.status === 'CANCELLED' || faker.number.float() < SHARE.cancelledRegistration) {
    return 'CANCELLED';
  }
  const hasStarted = session.startsAt <= state.now;
  const confirmed = state.confirmedByCustomer.get(customerId) ?? [];
  if (confirmed.some((other) => overlaps(other, session))) {
    return undefined;
  }
  if (session.confirmedCount >= session.capacity) {
    return hasStarted ? undefined : 'WAITLISTED';
  }
  session.confirmedCount += 1;
  state.confirmedByCustomer.set(customerId, [...confirmed, session]);
  return hasStarted && faker.number.float() >= SHARE.noShow ? 'ATTENDED' : 'CONFIRMED';
}

export function groupBySession(
  registrations: readonly SeedRegistration[],
): Map<string, SeedRegistration[]> {
  const groups = new Map<string, SeedRegistration[]>();
  for (const registration of registrations) {
    groups.set(registration.sessionId, [
      ...(groups.get(registration.sessionId) ?? []),
      registration,
    ]);
  }
  return groups;
}

/** A cancelled event cancelled all its bookings at one moment, just before it would have started. */
function eventCancelledAt(event: SeedEvent, now: Date): Date {
  return new Date(Math.min(now.getTime(), event.startsAt.getTime()) - HOUR_MS);
}

/**
 * Booking times rise with booking order inside each session, as they would through the API: the
 * waitlist (ordered by createdAt) never looks older than the seats taken before it. All times fall
 * in the PAST_DAYS before the session (or before now) and leave room for a cancellation after.
 */
function assignBookingTimes(
  faker: Faker,
  {
    registrations,
    sessions,
    now,
  }: { registrations: SeedRegistration[]; sessions: Map<string, SeedSession>; now: Date },
): void {
  for (const [sessionId, booked] of groupBySession(registrations)) {
    const session = sessions.get(sessionId);
    if (session === undefined) {
      continue;
    }
    const latest = Math.min(now.getTime(), session.startsAt.getTime()) - 2 * HOUR_MS;
    const earliest = latest - PAST_DAYS * DAY_MS;
    const times = booked
      .map(() => faker.number.int({ min: earliest, max: latest }))
      .sort((a, b) => a - b);
    booked.forEach((registration, index) => {
      registration.createdAt = new Date(times[index] ?? latest);
    });
  }
}

function assignCancellationTimes({
  registrations,
  sessions,
  events,
  now,
}: {
  registrations: SeedRegistration[];
  sessions: Map<string, SeedSession>;
  events: Map<string, SeedEvent>;
  now: Date;
}): void {
  for (const registration of registrations) {
    if (registration.status !== 'CANCELLED') {
      continue;
    }
    const event = events.get(sessions.get(registration.sessionId)?.eventId ?? '');
    registration.cancelledAt =
      event?.status === 'CANCELLED'
        ? eventCancelledAt(event, now)
        : new Date(registration.createdAt.getTime() + HOUR_MS);
  }
}

function makeRegistrations(
  faker: Faker,
  {
    sizes,
    now,
    customers,
    sessions,
    events,
  }: {
    sizes: SeedSizes;
    now: Date;
    customers: SeedUser[];
    sessions: SeedSession[];
    events: Map<string, SeedEvent>;
  },
): SeedRegistration[] {
  const bookable = sessions.filter((session) => events.get(session.eventId)?.status !== 'DRAFT');
  if (bookable.length === 0 || customers.length === 0) {
    return [];
  }
  const state: BookingState = { now, pairs: new Set(), confirmedByCustomer: new Map() };
  const registrations: SeedRegistration[] = [];
  const maxAttempts = sizes.registrations * 3;
  for (
    let attempt = 0;
    attempt < maxAttempts && registrations.length < sizes.registrations;
    attempt += 1
  ) {
    const session = faker.helpers.arrayElement(bookable);
    const customer = faker.helpers.arrayElement(customers);
    const event = events.get(session.eventId);
    const pair = `${session.id}:${customer.id}`;
    if (event === undefined || state.pairs.has(pair)) {
      continue;
    }
    const status = decideStatus(faker, { session, event, customerId: customer.id }, state);
    if (status === undefined) {
      continue;
    }
    state.pairs.add(pair);
    // Times are set below, once the booking order inside each session is known.
    registrations.push({
      id: faker.string.uuid(),
      sessionId: session.id,
      customerId: customer.id,
      status,
      createdAt: now,
      cancelledAt: null,
    });
  }
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  assignBookingTimes(faker, { registrations, sessions: sessionsById, now });
  assignCancellationTimes({ registrations, sessions: sessionsById, events, now });
  return registrations;
}

/**
 * Builds the whole demo dataset in memory. Deterministic for a given seed and `now`, and it keeps
 * every invariant the API enforces, so the admin shows data the API itself could have produced.
 */
export function generateSeedPlan({
  seed,
  now,
  sizes = DEFAULT_SIZES,
}: {
  seed: number;
  now: Date;
  sizes?: SeedSizes;
}): SeedPlan {
  if (sizes.tags > TAG_WORDS.length) {
    throw new Error(`At most ${String(TAG_WORDS.length)} tags are available`);
  }
  const faker = new Faker({ locale: [en] });
  faker.seed(seed);
  const users = makeUsers(faker, sizes, now);
  const tags = TAG_WORDS.slice(0, sizes.tags).map((name) => ({ id: faker.string.uuid(), name }));
  const organizerIds = users.filter((user) => user.role === 'ORGANIZER').map((user) => user.id);
  const events = Array.from({ length: sizes.events }, (_, index) =>
    makeEvent(faker, { index, now, organizerIds, tagIds: tags.map((tag) => tag.id) }),
  );
  const sessions = events.flatMap((event) => makeSessions(faker, event, sizes.sessionsPerEvent));
  const registrations = makeRegistrations(faker, {
    sizes,
    now,
    customers: users.filter((user) => user.role === 'CUSTOMER'),
    sessions,
    events: new Map(events.map((event) => [event.id, event])),
  });
  return { users, tags, events, sessions, registrations };
}
