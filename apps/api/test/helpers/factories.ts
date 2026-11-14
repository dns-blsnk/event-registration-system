import { randomUUID } from 'node:crypto';

import type {
  Event,
  Prisma,
  PrismaClient,
  Registration,
  Session,
  User,
} from '../../src/generated/prisma/client.js';

/** Creates a user with a unique email; tests never depend on each other's data. */
export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: `user-${randomUUID()}@test.local`,
      name: 'Test User',
      role: 'CUSTOMER',
      ...overrides,
    },
  });
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** An event a week from now, lasting two days, owned by a fresh organizer unless one is given. */
export async function createEvent(
  prisma: PrismaClient,
  overrides: Partial<Prisma.EventUncheckedCreateInput> = {},
): Promise<Event> {
  const organizerId = overrides.organizerId ?? (await createUser(prisma, { role: 'ORGANIZER' })).id;
  const startsAt =
    overrides.startsAt === undefined
      ? new Date(Date.now() + 7 * DAY_MS)
      : new Date(overrides.startsAt);
  return prisma.event.create({
    data: {
      title: 'Test Event',
      slug: `test-event-${randomUUID()}`,
      description: 'A test event',
      venue: 'Main Hall',
      city: 'Kyiv',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * DAY_MS),
      status: 'PUBLISHED',
      ...overrides,
      organizerId,
    },
  });
}

/** A one-hour session at the start of its event (or at the given start). */
export async function createSession(
  prisma: PrismaClient,
  event: Event,
  overrides: Partial<Prisma.SessionUncheckedCreateInput> = {},
): Promise<Session> {
  const startsAt = overrides.startsAt === undefined ? event.startsAt : new Date(overrides.startsAt);
  return prisma.session.create({
    data: {
      eventId: event.id,
      title: 'Test Session',
      startsAt,
      endsAt: new Date(startsAt.getTime() + HOUR_MS),
      capacity: 10,
      ...overrides,
    },
  });
}

/** A registration of a fresh customer (or the given one) for the session. */
export async function createRegistration(
  prisma: PrismaClient,
  session: Session,
  overrides: Partial<Prisma.RegistrationUncheckedCreateInput> = {},
): Promise<Registration> {
  const customerId = overrides.customerId ?? (await createUser(prisma)).id;
  return prisma.registration.create({
    data: { sessionId: session.id, status: 'CONFIRMED', ...overrides, customerId },
  });
}
